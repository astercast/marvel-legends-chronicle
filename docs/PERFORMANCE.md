# Performance audit — Marvel Legends Chronicle

Date: 2026-10-11. Method: static weight analysis of every root page
(HTML + linked CSS + linked JS + data JSON fetched on load). No images exist
in the repo; all scripts are `type="module"` (deferred by default).

## Budgets

- **Data cap (hard, enforced by `scripts/validate.sh`):** `data/figures.json` ≤ 225,000 bytes.
- **Page weight (warn, enforced by `scripts/validate.sh`):** initial page weight ≤ 500 KB.

## Findings and fixes

### 1. `data/figures.json` was pretty-printed with explicit nulls — FIXED

The 1,904-figure database shipped as indented JSON with `"variant": null`
(and friends) on every row. It is hand-maintained source data, so it was
optimized in place:

| File | Before | After | Saving |
|---|---|---|---|
| `data/figures.json` | 339,051 B | 176,735 B | **−48%** (minified, null keys stripped) |
| `data/encyclopedia.json` | 52,808 B | 41,639 B | −21% (minified; nulls kept) |
| `api/v1/figures.json` (generated) | 732,443 B | 583,930 B | −20% (minified; **nulls kept** — API contract) |

Null-stripping `data/figures.json` is safe: every site access to the optional
figure fields (`variant`, `exclusive`, `bafPiece`, `notes`, `waveBaf`) goes
through truthiness guards or `??`/`||` fallbacks, which treat `undefined`
identically to `null` (audited 2026-10-11). `scripts/build_api.py` now emits
minified API JSON permanently; nulls are preserved there because API
consumers may test `=== null`.

`data/figures.json` must stay minified — `validate.sh` fails the build if it
regresses past 225 KB.

### 2. Per-page initial weights (after fix)

Worst pages (HTML + CSS + JS + `data/figures.json` where loaded):

| Page | Initial weight |
|---|---|
| `shelf.html` | 219 KB |
| `journal.html` | 212 KB |
| `index.html` | 212 KB |
| `community.html` | 211 KB |
| `collection-value.html` | 210 KB |
| … (16 more data pages) | 200–208 KB |
| `start.html` / `skills.html` / `api.html` (no dataset) | 19–24 KB |

**All 29 root pages are under the 500 KB budget.** The dataset dominates
every data page (~172 KB of ~210 KB). It is fetched once and cached by the
browser for subsequent page views, so multi-page sessions cost ~40 KB/page
after the first.

### 3. Render-blocking resources — none found

- All scripts are `<script type="module">` → deferred, never parser-blocking.
- Total CSS is ~33 KB across 8 files; pages link 3–5 of them. No @import chains.
- No webfonts, no images, no third-party requests on any page.

### 4. Considered and deliberately skipped

- **Splitting `data/figures.json` per page:** every data page needs the full
  set for search/filter (timeline, compare, checklist, journal matching…).
  A lite/full split would double the cache entries and complicate `data.js`
  for ~0 KB first-page saving on repeat visits. Revisit only if the archive
  grows past ~500 KB minified.
- **`<link rel="preload">` for `data/figures.json`:** heads are
  hand-maintained per page (the nav generator only touches nav blocks), so
  this would mean editing ~20 pages for an estimated 100–300 ms gain on slow
  first loads, on a resource that is cache-hot after one view. Not worth the
  churn at current weights; re-measure if the dataset doubles.

## How to keep it fast

1. Keep `data/*.json` minified (`validate.sh` enforces the cap).
2. New pages that need the archive: `import { loadData } from "./data.js"` —
   the module caches, so N pages share one fetch.
3. If you add images: use WebP, `loading="lazy"` below the fold, and add an
   image-weight line to this doc.
