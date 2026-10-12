# LIVE_CHECKLIST — marvel-legends-chronicle (live track)

What is wired in the live track (`astercast/marvel-legends-chronicle-live`),
as of the 2026-10-12 release snapshot. The live repo is a pre-built snapshot
of the working repo — **no build step runs on Vercel** (vercel.json has no
`buildCommand`; publish dir = repo root).

## Serverless functions (4/12 used, Node auto-detected, zero npm deps)

| path | route | purpose |
|---|---|---|
| `api/health.js` | `GET /api/health` | service health, never 5xx |
| `api/reveals.js` | `GET /api/reveals` | latest reveal detections (`?since=`, `?limit=`) |
| `api/preorders.js` | `GET /api/preorders` | upcoming pre-order dates |
| `api/cron/radar.js` | `GET /api/cron/radar` | daily collector-press poll (cron only) |

All functions use node builtins + `lib/` only (`envelope`, `fetchx`,
`ratelimit`, `cronauth`, `github`). Designed ≤10s (Hobby budget); local
measurements 2026-10-11: first hit 0.026s, warm 0.008s — far under the 7s
frontend live timeout and the 10s function budget.

## Cron (1)

- `/api/cron/radar` — schedule `0 15 * * *` UTC, daily. Polls collector-press
  sources (Toyark, MarvelousNews, aggregators; 4s per source), dedupes vs
  `radar-seen.json`, appends candidates to `radar-candidates.json` (90-day
  prune), commits on change via content-hash (no change → no commit).
- Without `GITHUB_REPO_TOKEN`: read-only mode — returns fresh data in the
  response envelope, commits nothing (`committed:false, reason:'no-token'`).

## Environment variables (Vercel dashboard only — never in the repo)

| name | required | notes |
|---|---|---|
| `CRON_SECRET` | yes for cron | 32+ hex chars; Vercel sends as `Authorization: Bearer`. `/api/cron/radar` 401s without it (fail closed). |
| `GITHUB_REPO_TOKEN` | optional | fine-grained PAT, `contents:write` on the -live repo only. Cron commits wait on it. |
| `GITHUB_REPO` | yes for cron commits | `owner/name` of the -live repo. |
| `GITHUB_BRANCH` | no | defaults to production branch. |
| `REPO_STATIC_PREFIX` | yes | empty string (root-served). |

## Known-good status (2026-10-12 snapshot)

- `scripts/validate.sh`: 540/540 tests pass (2026-10-12 evening verification),
  relative links checked across all pages (0 broken), all JSON parses, schemas validate.
- Drop Week countdown verified independently 2026-10-12: Oct 14, 2026 is a
  Wednesday, EDT (UTC−4) until Nov 1 — window instant `2026-10-14T13:00:00-04:00`
  = 17:00 UTC = 10:00 AM PDT. Reader-facing copy names Wed Oct 14 explicitly
  (no relative "tomorrow" — from Oct 12 that pointed at Oct 13).
- Reveal Radar candidates record: 212 entries (193 from Oct 11 restored after
  the Python scanner's overwrite was fixed to append + prune-to-90d, matching
  `api/cron/radar.js`; 12 from the Oct 12 22:05 UTC poll; 7 from the 23:24 UTC
  re-poll). Seen store: 409 URLs. One Google News query variant returned
  HTTP 503 during the evening re-poll — the other sources answered.
- Spot-check on local file server: `/`, `/quest.html`, `/radar.html`,
  `/data/v1/index.json`, `/data/v1/drop-week.json`, character/wave pages → all 200.
- vercel.json parses; `functions` lists the 4 functions by explicit path with
  `{"maxDuration": 10}` each (no broad globs, no `runtime` keys — Node auto-detected).
- Frontend degrades honestly without functions: `assets/js/api-client.js`
  (7s live timeout, live/waking/cached/none states) — pages paint complete
  static content first; live swap is progressive enhancement.
- Build machine: **Standard, never Turbo** (Sept 2026 Turbo CPU billed $38.64).
- Vercel functions entries need ≥1 valid property — use `{"maxDuration": 10}` per explicit function path; never set `runtime` for Node (omit it); never broad globs (2026-10-12: both `nodejs22.x` and `nodejs20.x` fail build validation; empty `{}` fails with "Function must contain at least one property"; `runtime` is only for community runtimes like `vercel-php@0.5.2`). Vercel auto-detects Node from the `api/` directory.
- No static `.js` data files under `api/` ever — Vercel deploys every `.js` there as a function (the `functions` map is not an allowlist); basename collisions (`x.js` + `x.json` in one dir) fail the build (2026-10-12). Audited 2026-10-12: only the 4 real functions exist, zero collisions.
- Vercel never serves static files under `api/` — all static data lives in `data/v1/`; only real function handlers under `api/` (2026-10-12).
