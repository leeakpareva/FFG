# Connect (FFG) — operations & state

Last updated: 5 August 2026 (evening)

## Where it runs

**On AWS since 5 Aug 2026** — dedicated EC2 `ffg-connect` (i-04a64edf230a7e58b,
t3.medium, eu-west-2, own VPC, SSH-only security group; the IP changes on
stop/start so look it up: `aws ec2 describe-instances`). App at `/opt/ffg`,
compose runs ffg-connect (nginx+SPA), ffg-api, ffg-postgres (no published
port) and ffg-tunnel (own Cloudflare tunnel `ffg-connect-aws`). The ASUS
containers were deleted; volumes `ffg-pgdata`/`ffg-media` remain there as
rollback.

| | URL | Notes |
|---|---|---|
| **Client app** | https://connect.navada-edge-server.uk | AWS via its own tunnel. **Send this to clients.** Clerk-gated content. Calls the API same-origin through nginx. |
| Vercel | https://ffg-app.vercel.app | Same repo, auto-deploys on push to `main`. Reaches the API cross-origin via `VITE_API_BASE` — see below. |
| Public API | https://api-connect.navada-edge-server.uk | `ffg-api` on the tunnel. Exists so the Vercel copy can reach the database, which sits on the private network. |
| Repo | https://github.com/leeakpareva/FFG | Public. **No secrets may be committed.** |

Deploying now means: scp changed files to `/opt/ffg`, then
`docker compose build <svc> && docker compose up -d --force-recreate <svc>`.
Never copy a local `.env` over the box's — it carries box-only keys
(CLOUDFLARE_TUNNEL_TOKEN, R2_*, the `$$`-escaped admin hash).

### How Vercel reaches the API

The Vercel origin cannot route to the ASUS network, so the frontend calls the
API host directly instead of same-origin:

- Vercel env `VITE_API_BASE=https://api-connect.navada-edge-server.uk`, set on
  Production and Preview. **It is baked in at build time** — changing it means
  a redeploy (`vercel redeploy <url>`), not just an env edit.
- `ffg-api` env `ALLOWED_ORIGINS` must contain the calling origin. CORS is an
  explicit allowlist, never a wildcard, and credentials stay off because auth
  travels as an `Authorization` header rather than a cookie.

## Containers (AWS box, all `restart: always`)

| Container | Port | Purpose |
|---|---|---|
| `ffg-connect` | 8100→80 | nginx serving the built SPA, proxying `/api`, `/media`, `/ws`. |
| `ffg-api` | 8110 | Express + pg + Clerk + LiveKit + Stripe + WebSocket. Media in R2. |
| `ffg-postgres` | none published | Postgres 17 + pgvector. Volume `ffg-pgdata`. `docker exec` to reach it. |
| `ffg-tunnel` | outbound only | cloudflared, tunnel `ffg-connect-aws`. |

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

**Done (as of 5 Aug 2026, evening)**
- Fully data-driven app: social layer (posts w/ photo+video, likes, comments,
  saves, tags, follows, DMs), ML-ranked feed, admin panel (/admin, separate
  bundle), Stripe paid events (client's own account, live), Cloudflare Stream
  replays, LiveKit room audio + room chat, working search, profile editing
- **Real-time layer**: one Clerk-authenticated WebSocket per open app (`/ws`);
  dm / post / comment events are doorbells — clients refetch over REST, the
  polls stay as the safety net
- **Clerk sign-up closed server-side**: instance restriction `allowlist: true`
  (sign-in unaffected). Inviting a member adds their email to the allowlist;
  deleting removes it. All 5 member emails allowlisted (incl. Ann-Marie's
  unclaimed row)
- **Media in R2**: STORAGE_DRIVER=r2 on the box; bucket `navada-assets`,
  prefix `ffg/`; all 17 pre-existing files backfilled (idempotent script:
  `docker exec ffg-api node scripts/backfill-r2.js`). Local volume retained
  as rollback. Serving (incl. range requests for video seek) goes through
  the driver
- **Bundle**: main 827KB → 275KB; RoomStage/livekit is a lazy chunk that
  loads on room entry
- `members` seeded and claimed for all four real Clerk users; `AH`
  (Ann-Marie) pre-created, claims on her first sign-in

**Outstanding**
1. **OpenAI credits** — the account is exhausted (`credit_balance_exhausted`),
   which holds back BOTH the embeddings backfill and the live Concierge
   (canned replies until then). After topping up:
   `docker exec ffg-api node scripts/backfill-embeddings.js` (now covers
   members, posts, events, rooms, articles, replays, workshops).
2. **Capital tab** — hidden by design; the pillar exists in the schema. This
   is a product decision for FFG (what does Capital DO for members?), not an
   engineering gap. Do not build speculative financial content.
3. **Clerk pk_live** — deferred with the App Store plan: needs the production
   instance (domain + DNS + OAuth creds) in the dashboard, and swapping keys
   mid-UAT would sign every tester out.
4. **FFGApp.jsx** (~3,900 lines) still holds most screens. The bundle cost is
   solved; the remaining cost is maintainability. Split deliberately, screen
   by screen, not during live client testing.
5. Rooms audio group-test with the client (built and live; untested with 2+
   real people).
6. AWS account still uses root credentials — create an IAM user.
