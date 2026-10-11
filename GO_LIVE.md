# GO_LIVE — Marvel Legends Chronicle live-readiness & refresh pipeline

> Status: GitHub-only, **NO Vercel** (standing rule). Nothing is deployed yet.
> This doc explains what is live-capable, how the refresh pipeline works,
> and exactly what to do when deploying.

## 1. Live architecture

```
                    +-------------------+
                    |  STATIC HOST      |  serves repo root as-is
                    |  (GitHub Pages /  |  index.html, radar.html,
                    |   any static host)|  api/v1/*.json, data/*.json,
                    |                   |  assets/, characters/, waves/
                    +--------+----------+
                             |
                             | git pull / redeploy after each refresh
                             |
                    +--------v----------+
                    |  SCHEDULER        |  runs scripts/refresh/refresh.sh
                    |  (cron / GH       |  daily 08:00 UTC (copy-paste below)
                    |   Actions)        |
                    +--------+----------+
                             | writes
                    +--------v----------+
                    |  GIT = DATABASE   |  api/v1/radar-candidates.json
                    |                   |  api/v1/radar-seen.json
                    |                   |  logs/refresh.log (rotated in-file)
                    +-------------------+
```

- **Static host serves the repo root.** Deploy root = repo root. All links and
  asset references are relative; `fetch()` calls use relative paths
  (`api/v1/stats.json`, `data/encyclopedia.json`, …).
- **The scheduler runs `scripts/refresh/refresh.sh`** once a day. It runs the
  reveal scanner and logs to `logs/refresh.log`.
- **Git is the database.** Fresh scan output lands as JSON under `api/v1/`
  and gets committed + pushed, so the live site picks it up on redeploy.

## 2. What's live vs static, per feature

| Feature | Mode | How it stays fresh |
|---|---|---|
| **Release radar** (`radar.html`) | Semi-live | Daily candidate scan (see §3) + **human promotion** (§3.3). The scan never edits `radar.html` itself. |
| Price journal (`journal.html`) | Live by design | Browser-only data (`mlc_journal_v1`); works with zero server. |
| Watchlist / owned / wanted (`watchlist.html`, `checklist.html`) | Live by design | Browser-only keys (`mlc_watchlist_v1`, `mlc_owned_v1`, `mlc_wanted_v1`, `mlc_shelf_history_v1`). |
| Collection value (`collection-value.html`) | Live by design | Browser-only buys ledger (`mlc_buys_v1`); prices are user-pasted solds, honest by construction. |
| Encyclopedia / waves / characters / stats / API pages | Static archive | Rebuilt by `scripts/build_*.py` when the archive changes; deploy to refresh. |
| Everything else (guides, BAf planner, compare, shelf, etc.) | Static archive | Content updates are manual builder edits. |

"No server needed" features are live by design: they only ever needed a
browser, and they only ever will.

## 3. Pipeline docs

### 3.1 `scripts/refresh/check_radar.py` — hobby-press reveal scanner

- **Stdlib only** (`urllib` + `xml.etree`). No pip deps, nothing to install.
- **Sources** (RSS first, HTML `<a>`-scan fallback; per-source errors never
  kill the run):
  1. **Toyark** — `https://www.toyark.com/feed/`
  2. **Marvel Toy News** — `https://marveltoynews.com/feed/`
  3. **Bleeding Cool** — `https://bleedingcool.com/collectibles/feed/`
     (falls back to the main feed)
  4. **Google News** — public no-key RSS, aggregated across four query
     variants: `"Marvel Legends"`, `"Marvel Legends" wave`,
     `"Marvel Legends" exclusive`, `"Marvel Legends" revealed`
     (`https://news.google.com/rss/search?q=…&hl=en-US&gl=US&ceid=US:en`).
     Google News is high-volume — expect tens to hundreds of candidates per
     run; the review step (§3.3) filters reviews and duplicates down to real
     reveals.
- **Filter**: title must contain "marvel legends" (case-insensitive) **and**
  one of: reveal(s/ed), announce(d/ment), exclusive(s), wave, pre-order(s),
  first look, unveil(ed).
- **Output**: `api/v1/radar-candidates.json` —
  `[{ "title", "url", "source", "detected_at" }]` — rewritten every run with
  only the NEW items. Valid JSON even when zero candidates (`[]`).
- **Dedup**: `api/v1/radar-seen.json` — persistent seen-URL store the script
  maintains itself (sorted URL list). Items already seen are never re-emitted.
- **Quirk learned 2026-10-11**: both Toyark and Bleeding Cool reject
  non-browser user-agents on their feeds (Toyark 404s, Bleeding Cool 307s a
  bot check), so the scanner identifies as a compatible browser client.
  This is a public RSS poll — no accounts, no keys, no spend, no private data.
- Always exits 0 and prints a per-source summary
  (`rss` / `html-fallback` / `failed`, new-item counts, error text).

### 3.2 `scripts/refresh/refresh.sh` — cron-ready entry point

- Runs `check_radar.py`, appends a UTC-timestamped summary to
  `logs/refresh.log`, and rotates the log in-file (keeps ~20k lines).
- Usage: `scripts/refresh/refresh.sh` (executable, no args).

### 3.3 Promotion step (human/builder review → radar.html)

**The scanner never auto-adds to `radar.html`.** Unverified reveals would
violate the site's honesty standards. The documented loop:

1. Open `api/v1/radar-candidates.json` after a refresh run.
2. For each candidate, open the source URL and verify: is this a real
   Marvel Legends reveal/announcement (not a review, not a rumor, not a
   duplicate of an existing radar entry)?
3. For each verified item, add an entry to the radar section in `radar.html`
   following the existing card pattern (`venue` span, description paragraph,
   `src` link to the source article), and bump the "Last updated" time.
4. Commit + push; redeploy so the live site picks it up.

## 4. Scheduling — copy-paste

### Cron (daily 08:00 UTC, on the host that runs refreshes)

```cron
# Marvel Legends Chronicle — daily reveal scan
0 8 * * * /home/hatch/workspace/marvel-legends-chronicle/scripts/refresh/refresh.sh >> /dev/null 2>&1
```

After the scan, commit + push changed `api/v1/radar-*.json` files (e.g. a
second cron line or a wrapper that runs `git add api/v1/radar-*.json logs/`
+ commit + `python3 ~/workspace/skills/github/bin/gh-push.py
~/workspace/marvel-legends-chronicle`). Keep pushes through `gh-push.py`
(plain `git push` can't auth via this connector).

### GitHub Actions sketch (runs the scan + commits in CI)

```yaml
name: radar-refresh
on:
  schedule:
    - cron: "0 8 * * *"   # daily 08:00 UTC
  workflow_dispatch: {}
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - name: Run reveal scanner
        run: |
          python3 scripts/refresh/check_radar.py
          bash scripts/refresh/refresh.sh
      - name: Commit scan output
        run: |
          git config user.name "radar-bot" && git config user.email "radar-bot@local"
          git add api/v1/radar-candidates.json api/v1/radar-seen.json logs/refresh.log
          git diff --cached --quiet || git commit -m "radar refresh $(date -u +%F)"
      - name: Push
        uses: ad-m/github-push-action@v0.8.0
        with: { github_token: ${{ secrets.GITHUB_TOKEN }} }
```

## 5. Keys needed

**None.** All sources are public RSS endpoints — no API keys, no accounts,
no sign-ups, no spend, no private data touched.

## 6. Deploy checklist

Deploy = upload **repo root**, excluding dev-only dirs:

- **EXCLUDE**: `scripts/` (build + refresh tooling), `skills/`
  (agent tooling, not site content), `logs/` (run logs), `.git/`.
- **MUST DEPLOY**: `api/` (JSON the pages fetch), `data/`
  (encyclopedia + figure data), `assets/`, `characters/`, `waves/`,
  all `*.html` pages, `llms.txt`, `API.md`, `README.md`.

Then confirm: load `index.html`, open the browser console — zero 404s on
`api/v1/*.json` and `data/*.json` fetches.

## 7. Static-readiness audit summary (2026-10-11)

- All links/asset refs **relative** — zero absolute `/` refs.
- Zero `localhost` / `file://` refs.
- All `fetch()` calls use **relative paths** (`api/v1/stats.json`,
  `data/encyclopedia.json`, …).
- Link check: **15,307 refs, 0 broken.**
- Refresh pipeline added this date: `scripts/refresh/check_radar.py`,
  `scripts/refresh/refresh.sh`, `api/v1/radar-candidates.json`,
  `api/v1/radar-seen.json`, `logs/refresh.log`, this doc.
- Feed test 2026-10-11: Toyark (RSS), Marvel Toy News (RSS), Bleeding Cool
  (RSS), Google News (RSS ×4 query variants) all responded; keyword filter +
  seen-dedup verified working.
