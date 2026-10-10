# Marvel Legends Chronicle — API Reference

Version **1.0.0** · Observed **2026-10-10** · Static JSON, no auth, no rate limits.

Base path: `api/v1/`

## Endpoints

| Endpoint | Contents |
|---|---|
| `index.json` | Manifest: name, version, observation date, provenance note, endpoint map |
| `stats.json` | Totals: waves, figures, year range, BAF waves, exclusive/variant counts, per-year and per-manufacturer breakdowns |
| `waves.json` | Array of 158 wave summaries: `id`, `year`, `manufacturer`, `series`, `baf` (nullable), `figureCount` |
| `figures.json` | Array of 1,904 figures, flat. Each figure carries its wave context |
| `encyclopedia.json` | `history` (timeline events), `hallOfFame` (23 entries), `bootlegGuide` (sections), `resources` (directory) |
| `schema/wave.json` | JSON Schema (draft-07) for wave summaries |
| `schema/figure.json` | JSON Schema (draft-07) for figures |

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
  "verified": true
}
```

`verified: false` marks entries sourced from a single or tabloid source — treat prices as lore, not data.

## Usage notes

- `stats.json` is the cheapest entry point for overview questions.
- Filter `figures.json` client-side by `year`, `manufacturer`, `waveId`, `exclusive`, or `variant`.
- Join figures to waves on `waveId` ↔ `id`.
- `encyclopedia.json` is editorial knowledge, not catalog data — cite `priceNote` and `verified` when quoting prices.

## Provenance and limitations

Fan-compiled archive. Within-year ordering is year-accurate but not audited to the month. Some BAF pieces and disputed wave numbers are flagged in `notes`. Hall-of-fame prices are secondary-market observations, not guarantees. Regenerate with `python3 scripts/build_api.py` after data changes.
