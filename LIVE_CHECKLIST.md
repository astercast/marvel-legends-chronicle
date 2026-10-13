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

- `scripts/validate.sh`: 552/552 tests pass (2026-10-13 pre-window verification,
  rotations 4 and 5; rotation 5: 17,409 refs across 278 pages, 0 broken),
  relative links checked across all pages (0 broken), all JSON
  parses, schemas validate.
- Drop Week countdown verified independently 2026-10-12 and re-verified
  2026-10-13 00:21 UTC (rotation 4): Oct 14, 2026 is a Wednesday, EDT (UTC−4)
  until Nov 1 — window instant `2026-10-14T13:00:00-04:00` = 17:00 UTC =
  10:00 AM PDT. Headless hero read "1d 16h 38m" — exactly the independent
  span. Re-verified rotation 5 (2026-10-13 00:46 UTC): hero "1d 16h 14m 1s"
  vs independent 1d 16h 14m 0s — exact to the minute; atrium teaser agreed.
  Reader-facing copy names Wed Oct 14 explicitly (no relative
  "tomorrow" — from Oct 12 that pointed at Oct 13).
- Drop-day capture workflow armed and rehearsed 2026-10-13 (rotations 4
  and 5; rotation 5 re-rehearsed the full lane discipline end to end):
  4 doors in order (Pulse, Amazon, BigBadToyStore, Entertainment Earth);
  browser-local capture log fills the post-window report from real entries
  only (sellouts stored price-less). Published `captureLog` still
  `awaiting-window` and empty — correct until Wed Oct 14, 1 PM ET.
- Reveal Radar candidates record: 213 entries (193 from Oct 11 restored after
  the Python scanner's overwrite was fixed to append + prune-to-90d, matching
  `api/cron/radar.js`; 12 from the Oct 12 22:05 UTC poll; 7 from the 23:24 UTC
  re-poll; 1 X-Men '97 Jean Grey candidate from the Oct 13 00:42 UTC poll —
  a racing parallel write dropped it and it was restored verbatim from that
  run's own output, rotation 5). Rotation 4 poll Oct 13 00:20 UTC: all four
  sources answered (Bleeding Cool via HTML fallback), 0 new candidates,
  0 pruned. Rotation 5 polls Oct 13: run 1 filed the Jean Grey candidate
  (Toyark feed HTTP 308 in that run only); run 2 (00:44 UTC) all four via RSS,
  0 new, 0 pruned. Seen store: 434 URLs. One Google News query
  variant returned HTTP 503 during the Oct 12 evening re-poll — the other
  sources answered.
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
