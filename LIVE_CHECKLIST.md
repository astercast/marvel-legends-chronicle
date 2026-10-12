# LIVE_CHECKLIST — marvel-legends-chronicle (live track)

What is wired in the live track (`astercast/marvel-legends-chronicle-live`),
as of the 2026-10-12 release snapshot. The live repo is a pre-built snapshot
of the working repo — **no build step runs on Vercel** (vercel.json has no
`buildCommand`; publish dir = repo root).

## Serverless functions (4/12 used, `nodejs22.x`, zero npm deps)

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

- `scripts/validate.sh`: 452/452 tests pass, 16,415 relative links checked across
  277 pages (0 broken), all JSON parses, schemas validate.
- Spot-check on local file server: `/`, `/quest.html`, `/radar.html`,
  `/api/v1/index.json`, `/api/v1/drop-week.json`, character/wave pages → all 200.
- vercel.json parses; functions glob `api/**/*.js` matches exactly the 4
  functions above (no stray `.js` under `api/`).
- Frontend degrades honestly without functions: `assets/js/api-client.js`
  (7s live timeout, live/waking/cached/none states) — pages paint complete
  static content first; live swap is progressive enhancement.
- Build machine: **Standard, never Turbo** (Sept 2026 Turbo CPU billed $38.64).
