# GO_LIVE — Marvel Legends Chronicle (marvel-radar)

> **TWO-TRACK MODEL (2026-10-11, user's order):** the working repo
> (`astercast/marvel-legends-chronicle`) is NEVER deployed — all wave work,
> commits, and pushes happen here, GitHub-only. The live track is the
> release snapshot repo **`astercast/marvel-legends-chronicle-live`**
> (private), holding a clean pre-built snapshot: static frontend +
> `vercel.json` + `/api/*` functions + cron. First -live snapshot pushed
> 2026-10-12 (authorized one-time); after that, NEVER push -live again
> without the user's explicit "push"/"ship it". The Vercel deploy is a
> **one-time CLI deploy from the `-live` clone — no git integration, ever**.
> Before every push, verify `git remote get-url origin` matches the intended
> track; when in doubt, stop and report.
>
> The rest of this document describes the deployment architecture that the
> `-live` snapshot carries. "Repo" below = the -live release repo.

> **LIVE-READY, NOT DEPLOYED. Do not connect Vercel until the user approves.**
>
> This document is the single source of truth for taking the Chronicle live on
> Vercel. Follow it click-for-click. Spec: `~/workspace/server-program/ARCHITECTURE.md`.

## 1. Status

**LIVE-READY, NOT DEPLOYED.** Everything below is built, tested, and verified
locally. Nothing is connected to Vercel yet. Do not run the hookup steps in
§4 until the user says "I'm happy."

## 2. What deploys

One Vercel project containing:

- **Static frontend** — the whole repo root: 275 pages (42 root + 167 waves +
  66 characters), `assets/`, `data/`, `skills/`, `data/v1/*.json` (static
  fallback data).
- **4 serverless functions** (service `marvel-radar`, zero npm dependencies,
  Node auto-detected — no `runtime` key, envelope-only responses):
  - `api/health.js` → `GET /api/health` — service health, never 5xx
  - `api/reveals.js` → `GET /api/reveals` — latest reveal detections (`?since=`, `?limit=`)
  - `api/preorders.js` → `GET /api/preorders` — upcoming pre-order dates
  - `api/cron/radar.js` → `GET /api/cron/radar` — daily collector-press poll (cron only)
- **Shared `lib/`** — `envelope.js`, `fetchx.js`, `ratelimit.js`,
  `cronauth.js`, `github.js` (canonical §1.11 copies; this repo is the first
  of seven, so these are the verbatim masters the others diff against).
- **1 daily cron** — `/api/cron/radar` at `0 15 * * *` UTC (§4.4 schedule).
- **Frontend wiring** — `assets/js/api-client.js` (§3.2 reference client,
  7s live timeout, live/waking/cached/none states); `radar.html` "Latest
  press scan" section and `preorders.html` tracker both call `/api/*` first
  and fall back to the static `data/v1/` JSON. The site never looks broken
  when functions are unavailable.

**Known quirk (documented, not changed):** `build_api.py` and
`build_dropweek.py` both write `data/v1/drop-week.json` (content identical,
formatting differs minified vs pretty — last writer wins). The
`buildCommand` runs `build_api.py` first and `build_dropweek.py` last, so
the drop-week build's file is the one deployed. Do not "fix" this by
reordering; the builds are intentionally independent.

## 3. Prerequisites

- [ ] The repo is pushed to GitHub (`main` clean, no secrets committed —
      grep for `CRON_SECRET` / tokens before every push).
- [ ] Vercel account access (the user's account).
- [ ] Secrets generated and stored (values go in the Vercel dashboard ONLY,
      never in the repo):
  - `CRON_SECRET` — 32+ random hex chars:
    `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - `GITHUB_REPO_TOKEN` — **pending decision** (spec §14 open decision 1):
    fine-grained PAT, `contents:write` on **this repo only**, no other
    scopes. Until the user creates it, the cron job runs in **read-only
    mode**: it computes and returns fresh data in its response envelope but
    commits nothing (`committed:false, reason:'no-token'`). The site is
    fully live-readable without it; only daily auto-commits wait on it.
  - `GITHUB_REPO` — `owner/name` of this repo (used by the cron job's commit path).
  - `REPO_STATIC_PREFIX` — empty string (marvel serves from the root; §2.1).

## 4. Hookup steps (exact clicks)

1. **vercel.com/new → Import Git Repository** → select the
   `marvel-legends-chronicle` repo.
2. **Framework Preset: Other.**
   - Build Command: `python3 scripts/build_api.py && python3 scripts/build_waves.py && python3 scripts/build_characters.py && python3 scripts/build_timeline.py && python3 scripts/build_rarity.py && python3 scripts/build_launch.py && python3 scripts/build_review.py && python3 scripts/build_dropweek.py && python3 scripts/build_skills.py && python3 scripts/update_nav.py` (timed 5.6s locally; budget <60s)
   - Output Directory: *(leave empty — repo root is the Vercel default)*
   - Install Command: `echo 'no dependencies'`
3. **Environment Variables** (Production scope):
   `CRON_SECRET`, `GITHUB_REPO_TOKEN` (pending §3 decision), `GITHUB_REPO`,
   `REPO_STATIC_PREFIX` (empty).
4. **Build machine: Standard.** Settings → Build & Deployment → Build Machine
   → **Standard**. **Never Turbo** — September 2026 Turbo CPU billed
   **$38.64** (invoice 1ZU1WJJS-0012). Turbo buys nothing on a static site;
   the build takes seconds either way.
5. **Deploy.** Open `/api/health` — assert `"status":"ok"` and the
   `functions` list matches the 4 in §2 exactly.
6. **Dashboard → Cron Jobs** — assert `/api/cron/radar` is listed with
   schedule `0 15 * * *`. Trigger it once manually (Functions → ⋯ → Test)
   with the secret; check the `[cron]` log lines (§8).
7. **Roster curls** (assert the §1.1 envelope on each):
   ```bash
   BASE=https://<project>.vercel.app
   curl -sf "$BASE/api/health" | python3 -c "import json,sys; e=json.load(sys.stdin); assert e['ok']"
   curl -sf "$BASE/api/reveals?limit=5" | python3 -c "import json,sys; e=json.load(sys.stdin); assert e['ok'] and 'reveals' in e['data']"
   curl -sf "$BASE/api/preorders" | python3 -c "import json,sys; e=json.load(sys.stdin); assert e['ok'] and 'preorders' in e['data']"
   curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/cron/radar"   # expect 401 without secret
   curl -sf "$BASE/data/v1/radar-candidates.json" -o /dev/null        # static twin coexists
   ```
8. **Disable test:** block `/api/*` (or stop functions) → reload
   `radar.html` and `preorders.html` → assert every widget shows cached data
   with honest "updated" badges; zero blank widgets. (Verified locally
   2026-10-11: both pages render fully with `cached · updated …` badges.)
9. Run `BASE=<project-url> ./tests/api.test.sh` against the preview —
   expect 26/26.

## 5. Env var table

| Name | Required? | Where set | Notes / rotation |
|---|---|---|---|
| `CRON_SECRET` | Yes | Vercel → Settings → Environment Variables (Production) | 32+ hex chars. Vercel auto-sends it as `Authorization: Bearer` on cron invocations. Rotate by regenerating + updating the var + redeploying. Without it, `/api/cron/radar` 401s (fail closed). |
| `GITHUB_REPO_TOKEN` | Pending decision (§3) | Same | Fine-grained PAT, contents:write on this repo only. Cron runs read-only without it. Rotate like any PAT; old tokens die with the PAT, nothing else to change. |
| `GITHUB_REPO` | Yes for cron commits | Same | `owner/name`. Used by `lib/github.js` commit path. |
| `REPO_STATIC_PREFIX` | Yes | Same | Empty string for this repo (root-served). Other sites use `site/`. |

No secrets in the repo — ever. Not in code, not in `vercel.json`, not in
comments, not in test fixtures.

## 6. Hobby limits table

| resource | Hobby limit | our usage |
|---|---|---|
| Bandwidth | 100 GB/mo | static + small JSON; personal-use sites ≈ MBs |
| Build minutes | 6,000/mo | ~6s per deploy; daily cron redeploys ≈ negligible |
| Function invocations | 100k/mo | edge cache absorbs reads (`s-maxage=600`); ~1 cron + trickle |
| Function duration | 10s default (Hobby) | all functions designed ≤10s; `maxDuration: 10` pinned per function in `vercel.json` (also satisfies the "≥1 valid property" rule) |
| Cron jobs | daily minimum cadence, UTC, ±60min window, prod only | 1 job, `0 15 * * *` UTC |
| Overage billing | **none — usage pauses instead of charging** | design stays far under limits; a pause is a visible signal, not a bill |

## 7. Cold-start behavior

- First hit on a cold function is typically **1–3s** on Hobby. The frontend's
  live timeout is **7s**, so a normal cold start still wins the race and the
  badge flips from `waking server…` to `live`.
- A cold start that misses 7s loses cleanly: the page already painted its
  complete static content; the badge settles on `cached · updated HH:MM`.
- **The first paint never waits for `/api/*`.** Static HTML paints
  instantly; the live swap is progressive enhancement. A 12s cold function
  is invisible to the reader — the page was complete the whole time.
- Local loopback proxy measurements (2026-10-11): first hit 0.026s, warm
  0.008s, `/api/reveals?limit=8` 0.013s, `/api/preorders` 0.010s — far under
  the 7s client timeout and the 10s function budget. Re-measure on the
  preview deploy per §12.4 and record in the wave report.

## 8. Cron behavior

- **Schedule:** daily, `0 15 * * *` UTC. Timing guaranteed only within the
  hour (may fire any time 15:00–16:00 UTC). Production deployments only.
- **What it does:** polls collector-press RSS/pages (Toyark, MarvelousNews,
  news aggregators — bounded fetch, 4s per source), extracts reveal
  detections, dedupes vs `radar-seen.json`, appends candidates to
  `radar-candidates.json` (pruned to 90 days), commits on change via
  `writeJsonIfChanged`. No change → no commit, no redeploy.
- **Idempotent:** content-hash commits (identical output → no commit), 60s
  duplicate-delivery cooldown, one SHA-conflict retry then
  `committed:false`. Never force-pushes.
- **Alerting is logs only** — read Functions → Logs in the Vercel dashboard:
  - `[cron] radar start request_id=...`
  - `[cron] radar done changed=true|false committed=<sha|false> sources_ok=N/M request_id=...`
  - `[cron] radar fail stage=<fetch|merge|commit> error=<one line> request_id=...`
  - `[upstream] <source> fail error=<one line> latency_ms=...`
- **Every wave's checklist includes "read the last 7 days of `[cron]`
  lines; every run accounted for." A cron job that hasn't logged in 48h is
  itself the alert.**
- **Honesty:** rumors stay `rumor` until 2+ distinct sources confirm;
  `price_tbd` is always true on feed reveals — no MSRP is ever published as
  fact.

## 9. Custom domain notes

- Add the domain in Vercel dashboard → Domains; the `api/*` paths move with
  the domain automatically.
- If a custom domain is assigned later, sweep `llms.txt`/sitemap absolute
  URLs and the `data/v1/schema/envelope.json` `$id` (currently on the
  default `*.vercel.app` host) — flag as a wave task at that time.

## 10. Rollback

1. `git revert <offending-commit>` → push → Vercel redeploys the previous
   good state automatically.
2. Functions are stateless; there is no data migration to undo. The repo's
   committed JSON *is* the database — a bad data commit reverts the same
   way (the previous file version redeploys with it).
3. For a bad cron commit specifically: revert the cron's commit, push; the
   next daily run re-derives from the restored files.

## 11. Cost rules

- **Build machine: Standard. Never Turbo.** Vercel dashboard → Project →
  Settings → Build & Deployment → Build Machine → **Standard**. September
  2026 invoice 1ZU1WJJS-0012: **$38.64** of Turbo build CPU across the
  user's projects. These are static sites with seconds-long builds — Turbo
  buys nothing. Never repeat it.
- `installCommand`: `echo 'no dependencies'` — zero npm packages, nothing
  to install, builds stay seconds-long.
- Static builds are the only builds. Function bundling is part of the
  static build (no separate build minutes).
- Hobby limits table (§6) is the budget. If any site approaches 80% of any
  Hobby limit, the fix is *less* work (longer edge TTL, smaller payloads) —
  never a plan upgrade without the user's explicit word.
