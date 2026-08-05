# Connect (FFG) — operations & state

Last updated: 1 August 2026

## Where it runs

| | URL | Notes |
|---|---|---|
| **Client preview** | https://connect.navada-edge-server.uk | ASUS Docker → Cloudflare tunnel. **Send this to clients.** Public (no Access policy); app content still gated by Clerk sign-in. Calls the API same-origin through nginx. |
| Vercel | https://ffg-app.vercel.app | Same repo, auto-deploys on push to `main`. Reaches the API cross-origin via `VITE_API_BASE` — see below. |
| Public API | https://api-connect.navada-edge-server.uk | `ffg-api` on the tunnel. Exists so the Vercel copy can reach the database, which sits on the private network. |
| Repo | https://github.com/leeakpareva/FFG | Public. **No secrets may be committed.** |

### How Vercel reaches the API

The Vercel origin cannot route to the ASUS network, so the frontend calls the
API host directly instead of same-origin:

- Vercel env `VITE_API_BASE=https://api-connect.navada-edge-server.uk`, set on
  Production and Preview. **It is baked in at build time** — changing it means
  a redeploy (`vercel redeploy <url>`), not just an env edit.
- `ffg-api` env `ALLOWED_ORIGINS` must contain the calling origin. CORS is an
  explicit allowlist, never a wildcard, and credentials stay off because auth
  travels as an `Authorization` header rather than a cookie.

## Containers (ASUS, all `restart: always`)

| Container | Port | Purpose |
|---|---|---|
| `ffg-connect` | 8100→80 | nginx serving the built SPA. On networks `bridge` + `navada-edge`. |
| `ffg-api` | 8110→8110 | Express + pg + Clerk. Uploads land on volume `ffg-media`. On `navada-edge`. |
| `ffg-postgres` | 5435→5432 | Postgres 17.10 + pgvector 0.8.3. Volume `ffg-pgdata`. |

### Gotcha: never launch `ffg-api` from Git Bash

`-e MEDIA_ROOT=/data/media` gets rewritten by MSYS path translation to
`C:/Program Files/Git/data/media`, so uploads are written inside the container
instead of the `ffg-media` volume and vanish on the next recreate. The
Dockerfile already sets the correct value — **do not pass `MEDIA_ROOT` at all**,
and start the container from PowerShell.

### Gotcha: host clock drift kills all sign-in

Clerk rejects a token whose `iat` is more than its skew tolerance in the
future. The ASUS drifted 12s (the `w32time` service was not running) and every
authenticated request failed with `invalid token` — the app looked broken for
reasons nothing in the app could explain. `w32time` is now `Automatic` and
syncing from `pool.ntp.org`; `auth.js` also allows 60s of skew. To check:

```powershell
w32tm /query /status
```

The Cloudflare tunnel (`navada-tunnel`) reaches the app at `http://ffg-connect:80`
over the `navada-edge` network — that attachment is required, and it survives
container restarts.

### Deploying a change

```bash
cd ~/ffg-app
npm run build                       # sanity check
docker build -t ffg-connect:latest .
docker rm -f ffg-connect
docker run -d --name ffg-connect --restart always -p 8100:80 ffg-connect:latest
docker network connect navada-edge ffg-connect   # required for the tunnel
```

Pushing to `main` also redeploys Vercel automatically; the Cloudflare copy
must be rebuilt with the commands above.

## Cloudflare

- Tunnel `7c9e3c36-162a-4bb3-9f4e-8aab3f552636`, **dashboard-managed** — ingress
  lives in Cloudflare, not a local config file.
- Ingress is a single object: adding one rule rewrites all of them. **Back up
  first.** Last backup: `~/tunnel-config-backup-20260801-094233.json` (33 rules).
- Current count: 33 rules. `connect.navada-edge-server.uk → http://ffg-connect:80`
  and `api-connect.navada-edge-server.uk → http://ffg-api:8110` sit immediately
  before the `http_status:404` catch-all.
- API tokens are in Azure Key Vault `navada-edge-vault`:
  `cloudflare-api-token` (tunnel scope), `cloudflare-api-token-full` (DNS scope).

## Database

Schema in `db/` — `schema.sql` then `002_media.sql`, applied in that order.

16 tables: members, posts, events, rooms, articles, messaging, notifications,
media, plus ordered child tables. Every searchable table carries a generated
`tsvector` **and** a nullable `vector(1536)` column, so lexical search works now
and semantic ranking switches on once embeddings are backfilled — no schema
change needed.

`room_participants` + the `room_state` view provide real presence and honest
listener counts. That is what "rooms working" needs before any audio layer.

```bash
docker exec -it ffg-postgres psql -U postgres -d ffg
```

## State: done vs outstanding

**Done**
- Light-only theme; Capital tab hidden (pillar retained); Stories removed
- Clerk self-signup blocked (`transferable: false`) + in-app `/not-a-member`
- Working search across members, posts, events, rooms, library
- Naming: header "Connect", tab "Meet", "Library", "Connect Concierge"
- Two-circle `AgentMark` replacing every sparkle icon
- Postgres + pgvector schema applied; Jeen AI data deleted (Ada's DB untouched)
- Containerised and published on the tunnel
- **Image uploads working on both sites**, verified end to end on 1 Aug 2026:
  member resolved → `POST /api/media` 201 → file served back as `image/png` →
  bytes on the `ffg-media` volume → a non-image correctly rejected with 415

**Outstanding**
1. **Seed `members`** — the table is **empty apart from `LA`**. `requireMember`
   answers **403 "not a member"** to any Clerk user with no row, so a tester who
   signs in successfully still cannot upload or post. Every Clerk account that
   is meant to test needs a row whose `email` matches their sign-in address.
   Current Clerk users: `leeakpareva@gmail.com` (seeded, admin),
   `charlenegrichards@gmail.com`, `ffgcontent@gmail.com`, `send2chopstix@gmail.com`.
2. **API layer** — uploads and articles are wired; the rest of the screens still
   read the hardcoded constants in `FFGApp.jsx`.
3. **Seed** the remaining real data from those constants into the database.
4. **Rooms** — wire join/leave/presence to `room_participants`. Audio deferred
   (needs a WebRTC SFU; **no GPU required**).
5. **Uploads → R2** — files currently live on the local `ffg-media` volume.
   `storage.js` abstracts this behind put/remove/exists, so moving to R2
   (bucket `navada-assets`) is a driver swap plus a backfill, not a rewrite.
6. **Concierge** — its Anthropic call ships with no API key, so it always falls
   back to canned replies. Needs a server-side proxy holding the key.
6. **Clerk sign-up mode** is still `public` in the dashboard. The code guard
   holds, but close it server-side: Configure → Restrictions → Restricted.
7. `FFGApp.jsx` is ~2,900 lines holding every screen; bundle is 755 KB.
