# Marvel Legends Chronicle — API Reference

Version **1.0.0** · Observed **2026-10-11** · Static JSON, no auth, no rate limits.

Base path: `api/v1/`

## Shared API conventions (all sites)
- Base: `api/v1/` relative to the site root. Works on any static host; no auth, no keys, no rate limits.
- Manifest: `api/v1/index.json` lists every endpoint with its schema URL, `updated` timestamp, and notes. Start here.
- Timestamps: ISO-8601 UTC (`2026-10-11T00:00:00Z`). Date-only fields are `YYYY-MM-DD`.
- Versions: `meta.version` semver on the manifest; breaking changes get a new `v2/` path, never a silent shape change.
- Errors: static files can't return error bodies. A missing endpoint means a wrong path — re-read `index.json`. Empty results are `[]`, never `null`. Every record carries its provenance (`source`, `observed`/`updated`).
- Pagination: not needed — payloads are complete snapshots sized for client-side filtering. If a future endpoint paginates, it will use `?page=` and document it here.
- Freshness: every payload states when it was generated and from what snapshot. Treat undated numbers as stale.

## Endpoints

| Endpoint | Contents |
|---|---|
| `index.json` | Self-describing manifest: every endpoint with `path`, `description`, `schema` + `itemSchema` URLs, ISO-8601 UTC `updated`, `records` count, deprecation `notes` |
| `stats.json` | Totals: waves, figures, year range, BAF waves, exclusive/variant counts, per-year and per-manufacturer breakdowns |
| `waves.json` | Array of 158 wave summaries: `id`, `year`, `manufacturer`, `series`, `baf` (nullable), `source` (nullable), `figureCount` |
| `figures.json` | Array of 1,904 figures, flat. Each figure carries its wave context |
| `encyclopedia.json` | `history` (timeline events), `packagingGuide` (packaging evolution, sourced), `variantsGuide` (variant taxonomy, chase/case ratios, exclusives, international), `hallOfFame` (23 entries, each with a `reissueRadar` flag), `gradingGuide` (AFA/CGA, CAS, UKG, grading-premium caveat), `priceMethod` (sold-listings methodology, dated price history, reissue effect), `bootlegGuide` (sections), `resources` (directory) |
| `preorders.json` | Envelope `{version, observed, source, note, count, items}` — 21 researched upcoming releases (waves 12 + 20 + 24): `id`, `name`, `status` (`preorder`/`revealed`/`available`), `preorderDate` (exact `YYYY-MM-DD`, null when unreported — never invented), `releaseWindow` (e.g. `"Fall 2026"`), `price` (announced MSRP, never a market price), `query` (retailer search query), `venue`, `details`, `retailers` (retailer search-pattern ids the research names), `sources` (hobby-press links) |
| `characters.json` | Envelope `{version, observed, count, characters}` — 66 character guides: `slug`, `name`, `count`, `first`, `last`, `page` (`characters/<slug>.html`) |
| `timeline.json` | Envelope `{version, observed, title, lede, yearMin, yearMax, count, years, packagingEras, sourcesNote}` — 25 year records (2002–2026): `year`, `era`, `headline`, `summary`, `packaging` (nullable), `milestones` (each with `text` + `sources[]`), `waves` (real archive `id`s + `page`), `spotlight` (real figure `id`s + `why`) |
| `rarity.json` | Envelope `{tiers, title, lede, observed, methodology, archiveCounts, crossCutting, page}` — 9 tier records: `body`, `howToSpot`, `valueNote` (reported prices only, never an index), `archiveSignal`, `questAchievement`, `examples` (real figure `id`s + `waveId`/`year`/`series`/`wavePage`), `sources[]` (`label`/`url`/`note`) |
| `price-signals.json` | Envelope `{version, observed, methodology, count, signals}` — 7 reported market price signals (wave 25): `id`, `figId` (real archive id), `label`, `kind` (`sold-band`/`sold-avg`/`listing`/`claimed`), `low`/`high` (USD), `display`, `source` + `sourceUrl`, `note`, `singleSource` (nullable), `asOf` — reported ranges, not live prices; the Chronicle publishes no price index. Powers Price Watch verdicts vs user targets. |
| `radar-candidates.json` | Hand-maintained reissue-radar research feed: newly spotted news items (`title`, `url`, `source`, `detected_at`) |
| `radar-seen.json` | Hand-maintained dedupe list of processed radar URLs (array of strings) |
| `schema/` | JSON Schema (draft-07) for every endpoint: `manifest.json`, `stats.json`, `waves.json` + item `wave.json`, `figures.json` + item `figure.json`, `encyclopedia.json`, `preorders.json` + item `preorder.json`, `characters.json` + item `character.json`, `timeline.json` + item `timeline-year.json`, `rarity.json` + item `rarity-tier.json`, `price-signals.json` + item `price-signal.json`, `radar-candidates.json` + item `radar-candidate.json`, `radar-seen.json` |

## Figure object

```json
{
  "id": "toybiz-2002-series-1::Hulk",
  "name": "Hulk",
  "variant": null,
  "exclusive": null,
  "bafPiece": "left leg",
  "notes": null,
  "waveId": "toybiz-2002-series-1",
  "waveSeries": "Series 1",
  "year": 2002,
  "manufacturer": "Toy Biz",
  "waveBaf": null
}
```

- `id` is stable: `<waveId>::<figureName>`. New figures get new ids; ids are never recycled.
- Nullable fields are explicit `null` when unknown — never invented.
- `notes` may flag disputed wave numbering or unverified BAF pieces.

## Wave object

```json
{
  "id": "toybiz-2002-series-1",
  "year": 2002,
  "manufacturer": "Toy Biz",
  "series": "Series 1",
  "baf": null,
  "figureCount": 6
}
```

## Hall of fame entry

```json
{
  "name": "Sentinel BAF (Series 10, 2005)",
  "era": "Toy Biz",
  "why": "Iconic X-Men BAF; still the centerpiece of many collections.",
  "price": "~$552.50 est.",
  "priceNote": "Coleka estimate",
  "verified": true,
  "reissueRadar": {
    "level": "vulnerable",
    "note": "HasLab Sentinel (2020) exists; availability-driven premium."
  }
}
```

`verified: false` marks entries sourced from a single or tabloid source — treat prices as lore, not data. `reissueRadar.level` is Chronicle editorial analysis: `resilient` premiums rest on true rarity (prototypes, true chases, pre-2020 con exclusives, crowdfund caps); `vulnerable` ones rest on availability and can collapse when Hasbro reissues.

## Usage notes

- `stats.json` is the cheapest entry point for overview questions.
- Filter `figures.json` client-side by `year`, `manufacturer`, `waveId`, `exclusive`, or `variant`.
- Join figures to waves on `waveId` ↔ `id`.
- `encyclopedia.json` is editorial knowledge, not catalog data — cite `priceNote` and `verified` when quoting prices.

## Skills

219 task procedures in `skills/`, indexed by `skills/index.json`
(id, title, description, path). Each skill file has frontmatter
(`name`, `description`) followed by: Use when, Inputs, Procedure,
Worked example, Data references, Pitfalls.

The `agents` category (6 cross-cutting playbooks) uses an
**API references** section pointing at `api/v1` endpoints instead of
`Data references`: `preorder-hunter` (upcoming pre-orders from
`preorders.json` + radar), `market-brief-reader` (market briefing +
price-trend data, reported solds only), `ko-spotter` (bootleg risk
from KO intel + auth-wizard logic), `grail-evaluator` (rarity signals
+ reissue radar), `baf-strategist` (cheapest-first BAF completion),
`collection-auditor` (shelf gaps, era splits, next acquisitions).

Agents: `api/v1/index.json` carries `repository`, `skills` (directory,
index, count, usage), and `for_agents` routing. Load the skill matching
the task; use the JSON endpoints as the data layer behind it.
The human-readable agents surface is `agents.html` (endpoint table,
`llms.txt`, skills directory, data freshness, worked workflows).
Regenerate with `python3 scripts/build_skills.py` after data changes.

## Provenance and limitations

Fan-compiled archive. Within-year ordering is year-accurate but not audited to the month. Some BAF pieces and disputed wave numbers are flagged in `notes`. Hall-of-fame prices are secondary-market observations, not guarantees. Every encyclopedia claim added 2026-10-11 carries a `source` and `confidence` field (`verified` / `single-source` / `anecdote` / `unverified` / `analysis`). Regenerate with `python3 scripts/build_api.py` after data changes; regenerate character pages with `python3 scripts/build_characters.py`.
