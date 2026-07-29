# Connect (FFG) — operations & state

Last updated: 29 July 2026

## Where it runs

| | URL | Notes |
|---|---|---|
| **Client preview** | https://connect.navada-edge-server.uk | ASUS Docker → Cloudflare tunnel. **Send this to clients.** Public (no Access policy); app content still gated by Clerk sign-in. |
| Vercel | https://ffg-app.vercel.app | Still live and untouched. Same repo, auto-deploys on push to `main`. Cannot reach the database. |
| Repo | https://github.com/leeakpareva/FFG | Public. **No secrets may be committed.** |

## Containers (ASUS, all `restart: always`)

| Container | Port | Purpose |
|---|---|---|
| `ffg-connect` | 8100→80 | nginx serving the built SPA. On networks `bridge` + `navada-edge`. |
| `ffg-postgres` | 5435→5432 | Postgres 17.10 + pgvector 0.8.3. Volume `ffg-pgdata`. |

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
  first.** Last backup: `~/tunnel-config-backup-20260729-150149.json` (31 rules).
- Current count: 32 rules. `connect.navada-edge-server.uk → http://ffg-connect:80`
  sits immediately before the `http_status:404` catch-all.
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

**Outstanding**
1. **API layer** — nothing connects the app to Postgres yet. All screens still
   read the hardcoded constants in `FFGApp.jsx`.
2. **Seed** the real data from those constants into the database.
3. **Rooms** — wire join/leave/presence to `room_participants`. Audio deferred
   (needs a WebRTC SFU; **no GPU required**).
4. **Uploads** — R2 presigned PUT + the `media` table. Bucket `navada-assets`.
5. **Concierge** — its Anthropic call ships with no API key, so it always falls
   back to canned replies. Needs a server-side proxy holding the key.
6. **Clerk sign-up mode** is still `public` in the dashboard. The code guard
   holds, but close it server-side: Configure → Restrictions → Restricted.
7. `FFGApp.jsx` is ~2,900 lines holding every screen; bundle is 755 KB.
