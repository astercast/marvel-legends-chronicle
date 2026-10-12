# ARCHITECTURE — Marvel Legends Chronicle

The doc a new senior dev reads first. Last updated 2026-10-11.

## What it is

A fully static, client-side archive of every Marvel Legends action figure
(2002–2026): 1,939 figures across 167 waves, plus collector tools (tracker,
journal, BAF planner, price tools) and an encyclopedia. No backend, no build
step for the site itself — pages are hand-written HTML + ES modules, data is
JSON fetched at runtime. Private repo, GitHub-only.

## Repository layout

```
index.html, *.html            27 hand-written root pages (one per feature)
waves/*.html                  167 generated wave-detail pages (build_waves.py)
characters/*.html             66 generated character pages + index (build_characters.py)
assets/js/*.js                39 ES modules (type="module", no bundler)
assets/css/*.css               8 stylesheets (tokens → base → layout → components)
data/figures.json             SOURCE OF TRUTH: 167 waves, 1939 figures (minified, nulls stripped)
data/encyclopedia.json        Encyclopedia content (minified)
data/community.json           Seed posts for the fan-social mock
data/v1/*.json                 Generated public API (build_api.py): figures, waves,
                              stats, encyclopedia, index + schema/{figure,wave}.json
data/v1/schema/                JSON Schemas (draft-07 subset) for figures + waves
characters/manifest.json      Generated: 66 characters, figure counts, year ranges
skills/*/SKILL.md             Agent skills (build_skills.py regenerates the set)
scripts/                      Generators + validate.sh
tests/                        Node test suite (no dependencies)
docs/                         PERFORMANCE.md, ACCESSIBILITY.md
llms.txt / API.md / README.md Agent + human entry points
```

## Data flow

```
data/figures.json (hand-maintained, minified)
    ├──> site pages, via assets/js/data.js loadData()
    │       shapes rows into { id: "<waveId>::<name>", waveId, waveSeries,
    │       year, manufacturer, waveBaf, source, ...fig } — cached in-memory
    ├──> scripts/build_waves.py      → waves/*.html (167 pages)
    ├──> scripts/build_characters.py → characters/*.html + manifest.json
    └──> scripts/build_api.py        → data/v1/*.json (+ schemas)
```

**Generators own their outputs.** Never hand-edit `waves/*.html`,
`characters/*.html`, `data/v1/*.json`, or `skills/*/SKILL.md` — change the
source/generator and re-run. `scripts/update_nav.py` owns the nav blocks on
all 27 root pages (canonical `NAV` list; `build_waves.py` has the relative
form for generated pages — keep them in sync).

**`data/figures.json` must stay minified** with null-valued optional keys
stripped (339 KB → 177 KB). `scripts/validate.sh` fails past 225 KB.
All site JS was audited null/undefined-safe for the optional figure fields
(`variant`, `exclusive`, `bafPiece`, `notes`, `waveBaf`); `data/v1/figures.json`
keeps its nulls (API contract: absent ≠ null).

## Page types

1. **Archive browsers** — `index.html` (timeline), `explore.html`,
   `retro.html`, `variants.html`, `exclusives.html`, generated wave/character
   pages. Read from `loadData()`, render cards, link to each other.
2. **Collection tools** — `shelf.html`, `checklist.html`, `journal.html`,
   `watchlist.html`, `collection-value.html` (ledger), `hunt.html`,
   `baf-planner.html`, `baf-economics.html`, `showcase.html`, `gift.html`,
   `compare.html`, `radar.html`, `start.html`. Read `loadData()` +
   localStorage state, all mutations stay local.
3. **Reference** — `encyclopedia.html`, `price-guide.html`, `grails.html`,
   `variant-spotlight.html`, `auth-wizard.html`, `stats.html`,
   `community.html`, `skills.html`, `api.html`. Mostly static content with
   small JS enhancements.

## JS module map

| Module | Role |
|---|---|
| `config.js` | `PATHS`, `STORE_KEYS` (canonical localStorage registry), `MARKETPLACES` |
| `store.js` | `load`/`save`/`makeIdSet` — **all** localStorage goes through here; corruption recovery, private-mode safe |
| `data.js` | `loadData()` (cached fetch + row shaping), `searchFigures`, `figureById`, `computeStats`, source-facet helpers |
| `figure-dialog.js` | `openFigureDialog`, `badgeFor`, `escapeHtml` — the shared detail modal |
| `modal.js` | `openModal`/`closeModal` — focus-trapped accessible dialog primitive |
| `tracker.js` | `owned`/`wanted` id-sets + toggle buttons (mutually exclusive) |
| `listings.js` | Marketplace/sold-listing URL builders (no live inventory) |
| `price-trends.js` | `entriesForFigure`, `trendStats`, `sparklineSVG` — trends from the user's own journal |
| `explore.js` | Seeded discovery (`mulberry32`), curated rabbit holes |
| `showcase.js` | Top-10 curation, `moveId` pure ordering helper |
| `baf-planner.js` | `buildBafs`, `pieceOwned`, `bafProgress` — piece/carrier mapping |
| others | One page-specific module per feature page (see page list) |

Conventions: ES modules, no bundler, no dependencies. `escapeHtml` on every
interpolated string. `type="module"` scripts are deferred — nothing
parser-blocking. Every `fetch()` has a failure path with a user-visible
empty state; every `JSON.parse` is in try/catch; storage access never throws.

## Identity and storage

- **Figure id:** `<waveId>::<figureName>` (stable, derived). Known trade-off:
  same-name variants in one wave share an id (411 of 1939 rows), so they
  share owned/wanted state. Rows are always distinguishable by
  `(waveId, name, variant, notes)` — zero fully-identical rows (enforced by
  `tests/test-data-integrity.js`). Changing the id scheme would orphan
  existing users' localStorage; don't.
- **Storage keys:** `mlc_*_v1`, all registered in `config.js` `STORE_KEYS`.
  `validate.sh` fails on any unregistered literal. Current keys: owned,
  wanted, social, journal, buys, watchlist, shelfHistory, exploreSeed,
  exploreSeen, showcase, hunt.

## Quality gates

- `scripts/validate.sh` — one command: syntax, JSON, schemas, links (8,476
  refs), element-ID cross-check, storage-key registry, perf budgets, tests.
  **Run before every commit.**
- `tests/run.sh` — 51 unit + data-integrity tests, zero dependencies
  (`tests/stubs.js` provides DOM/storage/fetch shims).
- `docs/PERFORMANCE.md` — budgets and the data-diet rationale.
- `docs/ACCESSIBILITY.md` — audit results and component rules.

## Deploying (static host)

Any static host works: upload the repo root. No server code, no env vars,
no build. Data freshness is manual: edit `data/figures.json`, re-run the
generators + `validate.sh`, commit, re-upload. (A live-refresh pipeline is
tracked separately — see the repo's GO_LIVE work.)
