# Marvel Legends Chronicle

**Every Marvel Legends figure ever released, in chronological order — including the pre-Hasbro Toy Biz era.**

Static site. GitHub only — nothing is deployed anywhere.

## What's here

- `index.html` — the timeline app
- `styles.css` — dark comic-style theme
- `app.js` — rendering, filters, collection tracker, marketplace links
- `data/figures.json` — the figure database (waves in chronological order)

## Features (mock-up)

- **Chronological timeline:** waves grouped by year, Toy Biz → Hasbro, with Build-A-Figure callouts
- **Search & filters:** by name, manufacturer, year, and collection status
- **Collection tracker:** mark figures Owned / Wanted — stored in the browser's localStorage only, no account, no backend
- **Marketplace links:** per-figure pre-filled searches on eBay, Amazon, Entertainment Earth, and BigBadToyStore — these are constructed search URLs (mock), not live inventory integrations

## Data status

`data/figures.json` currently holds **sample data** demonstrating the schema. The full database — every wave and figure from Toy Biz Series 1 (2002) through the present Hasbro line, including variants, exclusives, and Build-A-Figure pieces — is being compiled from research and will replace it.

### Schema

```json
{
  "waves": [{
    "id": "toybiz-series-1",
    "year": 2002,
    "manufacturer": "Toy Biz",
    "series": "Series 1",
    "baf": "Build-A-Figure name or null",
    "sample": false,
    "figures": [{
      "name": "Captain America",
      "variant": null,
      "exclusive": "Convention Exclusive or null",
      "bafPiece": "Left Arm or null",
      "notes": ""
    }]
  }]
}
```

## Roadmap

1. Full figure database from research (all waves, all figures, variants, exclusives, BAFs)
2. Figure images per card
3. Wave checklists / completion percentages
4. Price-trend notes per figure (manual, from sold listings)
