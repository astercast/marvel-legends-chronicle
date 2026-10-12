# AGENT.md — How an agent uses the Marvel Legends Chronicle

This file is the agent entry point for the Chronicle archive
(`https://github.com/astercast/marvel-legends-chronicle`, private repo).
Read this before touching any endpoint or skill.

## 0. TL;DR

1. Open `api/v1/index.json` — the self-describing manifest. Every endpoint
   lists its `path`, `description`, `schema` + `itemSchema` URLs, ISO-8601
   UTC `updated` timestamp, `records` count, and deprecation `notes`.
2. Open `skills/index.json`, load the skill whose task matches the request.
   Skills are the primary interface for *doing* work; the JSON endpoints are
   the data layer.
3. Skills in `skills/agents/` (`preorder-hunter`, `market-brief-reader`,
   `ko-spotter`, `grail-evaluator`, `baf-strategist`, `collection-auditor`)
   are cross-cutting playbooks with worked examples.

## 1. Base, auth, and conventions

- **Base:** `api/v1/` relative to the site root. Works on any static host
  (GitHub Pages, `file://`, `python3 -m http.server`).
- **No auth, no keys, no rate limits.** Fetch freely; be polite anyway.
- **Static snapshots.** Every payload is a complete, generated snapshot —
  filter client-side. There is no query language and no pagination.
- **Timestamps:** ISO-8601 UTC (`2026-10-11T00:00:00Z`). Date-only fields are
  `YYYY-MM-DD`.
- **Versions:** `meta.version` semver on the manifest (currently `1.0.0`).
  Breaking changes get a new `v2/` path, never a silent shape change.
- **Errors:** static files can't return error bodies. A 404 means a wrong
  path — re-read `index.json`. Empty results are `[]`, never `null`.
- **Provenance:** every record carries its provenance. Generated payloads
  state `version` + `observed` (dataset observation date: `2026-10-11`).
- **Honesty rules (non-negotiable):**
  - Never invent figures, dates, prices, or retailers. `null` means unknown.
  - Prices in the archive are *reported* (eBay solds someone logged) or
    *announced* (MSRP at reveal) — never a market index or a quote.
  - `verified: false` on hall-of-fame entries = single/taboid source.
    Present as lore, not data.
  - The reissue radar (`resilient` vs `vulnerable`) is editorial analysis.
  - When you don't know, say what would change your mind.

## 2. Endpoints

| Endpoint | What it is | Schema |
|---|---|---|
| `api/v1/index.json` | The manifest — start here | `api/v1/schema/manifest.json` |
| `api/v1/stats.json` | Archive totals (waves, figures, year range, BAF/exclusive/variant counts, per-year and per-manufacturer breakdowns). Cheapest entry point. | `api/v1/schema/stats.json` |
| `api/v1/waves.json` | 158 wave summaries: `id`, `year`, `manufacturer`, `series`, `baf` (nullable), `source` (nullable), `figureCount` | `api/v1/schema/waves.json` → item `api/v1/schema/wave.json` |
| `api/v1/figures.json` | 1,904 figures, flat, with wave context. Stable id `<waveId>::<figureName>` (e.g. `toybiz-2002-series-1::Hulk`). Filter by `year`, `manufacturer`, `waveId`, `exclusive`, `variant`, `bafPiece`. Join to waves on `waveId` ↔ `id`. | `api/v1/schema/figures.json` → item `api/v1/schema/figure.json` |
| `api/v1/encyclopedia.json` | Collector knowledge: `history`, `packagingGuide`, `variantsGuide`, `hallOfFame` (23 entries, each with `reissueRadar` + `verified`), `gradingGuide`, `priceMethod` (the sold-listings methodology), `bootlegGuide` (six checklists), `resources` | `api/v1/schema/encyclopedia.json` |
| `api/v1/preorders.json` | 20 researched upcoming releases: `status` (`preorder`/`revealed`/`available`), exact `preorderDate` (`YYYY-MM-DD`, `null` when unreported), `releaseWindow`, `price` (announced MSRP, never market), `retailers`, `sources` | `api/v1/schema/preorders.json` → item `api/v1/schema/preorder.json` |
| `api/v1/characters.json` | 66 character guides: `slug`, `name`, `count`, `first`, `last`, `page` (`characters/<slug>.html`) | `api/v1/schema/characters.json` → item `api/v1/schema/character.json` |
| `api/v1/timeline.json` | The Legends Timeline: 25 year records (2002–2026) — `era`, `headline`, `summary`, sourced `milestones`, `packaging` notes, per-year `waves` (real archive ids + pages), `spotlight` figure ids; envelope carries the 5 `packagingEras` | `api/v1/schema/timeline.json` → item `api/v1/schema/timeline-year.json` |
| `api/v1/rarity.json` | The Rarity Guide: 9 tier records (chase, running-change, deco, unmasked, convention, retailer, Pulse/Fan Channel, HasLab, made-to-order) — `body`, `howToSpot`, `valueNote` (reported prices only), `archiveSignal`, `questAchievement`, `examples` (real figure `id`s + `waveId`/`year`/`wavePage`), `sources[]`; envelope carries `archiveCounts` + `methodology` + `crossCutting` | `api/v1/schema/rarity.json` → item `api/v1/schema/rarity-tier.json` |
| `api/v1/radar-candidates.json` | Hand-maintained reissue-radar research feed (newly spotted news). Research notes, not a generated snapshot. | `api/v1/schema/radar-candidates.json` → item `api/v1/schema/radar-candidate.json` |
| `api/v1/radar-seen.json` | Hand-maintained dedupe list of processed radar URLs | `api/v1/schema/radar-seen.json` |

All schemas are JSON Schema draft-07. Every endpoint validates; run
`scripts/validate.sh` to re-check after data changes.

### Example requests

```js
// Cheapest overview
const stats = await (await fetch("api/v1/stats.json")).json();
// -> { waves: 158, figures: 1904, yearMin: 2002, yearMax: 2026, ... }

// Every 2024 Hasbro figure (client-side filter)
const figures = await (await fetch("api/v1/figures.json")).json();
const modern = figures.filter(f => f.year === 2024 && f.manufacturer === "Hasbro");

// Join a figure to its wave
const waves = await (await fetch("api/v1/waves.json")).json();
const byId = Object.fromEntries(waves.map(w => [w.id, w]));
const fig = figures.find(f => f.id === "hasbro-2024-the-void::Namor");
byId[fig.waveId].series; // "The Void Wave"

// Character guides
const chars = await (await fetch("api/v1/characters.json")).json();
chars.characters.find(c => c.slug === "spider-man");
// -> { slug, name: "Spider-Man", count: 86, first: 2003, last: 2026, page: "characters/spider-man.html" }

// Upcoming pre-orders, sorted by exact date
const pre = await (await fetch("api/v1/preorders.json")).json();
pre.items
  .filter(i => i.status === "preorder" && i.preorderDate)
  .sort((a, b) => a.preorderDate.localeCompare(b.preorderDate));
```

## 3. End-to-end workflows

Each workflow below is proven by `tests/test-api-workflows.js`, which runs it
against the real local `api/v1` JSON.

### Workflow A — "What should I pre-order this month?"

1. Load `api/v1/preorders.json` (20 researched items, observed 2026-10-11).
2. Split by status + date honesty:
   - `status === "preorder"` with an exact `preorderDate` → actionable.
     `preorderDate <= today` = open now; within 30 days = upcoming.
   - `status === "revealed"` → watchlist material (only `releaseWindow`,
     never a date).
   - `status === "available"` → buy now.
3. Report "what you know vs. what you don't": exact-date items get countdowns
   ("opens in N days"); `null` `preorderDate` means no date has been reported.
4. For each target, use the item's `query` with its `retailers` search
   patterns — the archive links search pages, never product URLs.

Real run (as of 2026-10-11): Mini Comics Wave 3 (pre-order opened 2026-10-06,
$27.99 MSRP) is open now; the X-Men '97 retro wave opens 2026-10-21
(10 days out, $27.99 MSRP); the Avengers: Doomsday wave is `preorder`
(status upgraded Oct 2026 — Cyclops pre-orders opened Jul 2026) but its
exact date is unreported, so it reads "open now, date unconfirmed"; Doomsday
Wave 2 opens 2026-10-14 (3 days out, Spring 2027); the Trask &amp; Bastion
2-pack is made-to-order with the order window closing Nov 20, 2026. See
skill `preorder-hunter`.

### Workflow B — "Is this eBay listing a KO risk?"

1. Load `api/v1/encyclopedia.json` → `bootlegGuide.sections` (six checklists:
   `packaging`, `paint`, `joints`, `targets`, `listings`, `price-logic`).
2. Run the listing through them:
   - **Known targets:** the archive documents Dragon Man, Ronan, and the
     Juggernaut BAF recast as known KO targets.
   - **Price logic:** China/Hong Kong seller at $10–40 on a $25+ figure is a
     documented tell; anything far below retail for the wave means investigate.
   - **Listing flags:** stock photos only, no brand named, "no box" on a
     supposedly mint exclusive.
   - **Photo tells:** neck ball-peg differences, elbow/hand pegs, joint gaps —
     e.g. KO Carnage has silver eyes.
3. Verdict: 2+ failed checks = HIGH risk (walk away or demand real photos),
   1 = MEDIUM, 0 = LOW. Never buy on FOMO — another listing always comes.
   See skill `ko-spotter`.

### Workflow C — "Audit my X-Men shelf for gaps"

1. Load `api/v1/figures.json` + `api/v1/waves.json` (+ `api/v1/stats.json`
   for archive-level consistency checks).
2. From the user's owned figure ids (stable `<waveId>::<figureName>`), compute
   per-wave completion.
3. Surface **near-complete wins first**: waves ≥50% complete — finishing a
   started set beats starting a new one.
4. For incomplete BAF waves, list missing pieces from each figure's `bafPiece`
   (unowned piece-carriers = the buy list).
5. Use `api/v1/characters.json` for character-run gaps (e.g. a Spider-Man-only
   shelf with zero X-Men).
6. Prices come only from the user's own journal solds — never invent them.
   See skill `collection-auditor`.

### Workflow D — "Is this grail worth the premium?"

1. Confirm the exact release in `api/v1/figures.json` (never evaluate from a
   bare name) — check `variant`/`exclusive` flags and year.
2. Read `api/v1/encyclopedia.json` → `hallOfFame`: the entry's `reissueRadar`
   (`resilient` = true rarity: prototypes, true chases, pre-2020 con
   exclusives, crowdfund caps; `vulnerable` = availability-driven, collapses
   on reissue) and `verified` (false = single-source, treat as lore).
3. Max-pay rule: resilient radar = pay the premium with confidence; vulnerable
   radar = cap at reissue price + a small premium, or wait.
   See skill `grail-evaluator`.

### Workflow E — "What's a good gift for a Marvel fan?"

1. Confirm budget band and recipient: kid / casual fan / collector. Budget
   bands are figure-type proxies, never prices — "under $25" = standard
   singles only; state that plainly.
2. Resolve the character or team in `api/v1/figures.json` (name substring;
   teams: X-Men, Avengers, Spider-Man, Fantastic Four, Guardians, Deadpool —
   matched on name + wave series text).
3. Rank from archive signals only: character/team match, recency (a kid
   wants 2024+ at retail), figure type, rarity flags (collector: exclusives,
   variants, chases first; kid: exclusives last).
4. KO-risk check: flag any pick matching the archive's known-KO-target
   research (`bootlegGuide` targets: Dragon Man, Ronan, Juggernaut BAF
   recast, Carnage silver-eyes tell; holiday-guide 2026: Maximum Spider-Man,
   X-Men '97 Cyclops). KO picks get "retail or Auth Wizard first", never a
   marketplace recommendation.
5. "Buy this, not that": if the same character has a pricier variant or
   exclusive, recommend the standard and name the skip explicitly.
6. Price honesty: the only dollars you may cite are announced pre-order
   MSRPs (`api/v1/preorders.json` `price`, labeled as such) or the user's
   own logged prices. Everything else = "check eBay solds".
   Prefill the tool for the user:
   `gift.html?budget=under25&for=kid&character=Spider-Man`.

### Workflow F — "Curate my shelf gallery for sharing"

1. Ask the user to paste their `mlc_gallery_v1` export (shape in §4 —
   shelves with per-photo `tags: [figId]`; photos themselves stay on their
   device, only ids and captions travel).
2. Validate every tag against `api/v1/figures.json` ids (stable
   `<waveId>::<figureName>`); drop or flag anything unmatched — never guess.
3. Suggest a layout per shelf: `run` for shelves tagged with one character or
   series run (check `api/v1/characters.json` for run membership), `baf` when
   a shelf holds most pieces of one BAF wave (`bafPiece` fields), `grid`
   otherwise.
4. Draft the "Shelfie share card" text: photo/shelf counts, top-5 tagged
   figures (real names, no ids), quest level + archive completion % from the
   user's owned count, and the newest rare-tagged photo (chase / convention
   exclusive / HasLab / variant signals) as the "latest grail-worthy shelfie".
5. Remind them: photos never leave their browser (dataURL + localStorage);
   share text only.

## 4. Interactive tools: using their data shapes programmatically

The site's tools (tracker, journal, watchlist, hunt planner, BAF planner,
pre-order tracker) are browser-local — an agent can't reach a user's
`localStorage`, but can read and mirror the exact shapes from
`assets/js/config.js` (`STORE_KEYS`):

| Key | Shape |
|---|---|
| `mlc_owned_v1` / `mlc_wanted_v1` | `[figureId]` — stable `<waveId>::<figureName>` ids |
| `mlc_journal_v1` | `[{ id, figId, name, condition, price, date, url, note }]` — the user's own eBay-sold logs |
| `mlc_buys_v1` | `[{ id, figId, name, wave, condition, price, date, where, note }]` — what the user paid |
| `mlc_watchlist_v1` | `[{ id, figId, name, wave, target, note, created, sightings: [{ id, date, where, price, sold, url, note }] }]` |
| `mlc_hunt_v1` | `{ selected: [figId], maxPrices: { figId: number } }` |
| `mlc_preorders_v1` | `{ <preorderItemId>: "watching" \| "ordered" \| "skipped" }` |
| `mlc_showcase_v1` | `{ order: [figId], notes: { figId: text } }` |
| `mlc_gallery_v1` | `{ shelves: [{ id, name, layout: "grid"\|"run"\|"baf", photos: [{ id, dataUrl, caption, tags: [figId], ts }] }] }` — client-side only, never uploaded |
| `mlc_shelf_history_v1` | `[{ d: "YYYY-MM-DD", owned, wanted, bafDone }]` |

When a user pastes their tracker export, parse it against these shapes, then
run Workflow C. Never fabricate owned state.

## 5. Rate and expectation notes

- **No rate limits** — static JSON on a static host. Fetch the whole
  `figures.json` (732KB pretty, minified on the wire) once and filter locally.
- **Prices are reported or user-logged, never an index.** Frame every number
  as "reported eBay solds at $X–$Y (n reports)" — never "the market says $Z".
- **Freshness:** every payload states `observed` / `updated`. The current
  dataset is observed **2026-10-11**. Treat undated numbers as stale.
- **Radar feeds** (`radar-candidates.json`, `radar-seen.json`) are
  hand-maintained research notes — freshest, but unstructured.
- **The archive doesn't know:** spike prices (rarely published), exact
  within-month ordering (year-accurate only), or anything after the
  observation date. Say so.

## 6. Skills are the procedures

`skills/index.json` indexes all skills (id, title, description, path). Load
the full skill file for the task at hand — each has Use when, Inputs,
Procedure, a Worked example, Data/API references, and Pitfalls. The six
`skills/agents/` playbooks are the primary agentic interface; the API is the
data layer behind them. The human-readable agents surface is `agents.html`.
