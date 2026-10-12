---
name: api-client
description: The code-level companion to AGENT.md: base pattern, every endpoint with its schema, and copy-paste fetch patterns.
---

# Call the Chronicle API from code (endpoints, schemas, example fetches)

## Use when

You are writing code (a script, a tool, another agent) against the Chronicle's static JSON API.

## Inputs

- What you need (figures, waves, stats, encyclopedia knowledge, pre-orders, characters)

## Procedure

1. Start at `api/v1/index.json` — the self-describing manifest. Each endpoint entry gives `path`, `description`, `schema` + `itemSchema` URLs, ISO-8601 UTC `updated`, `records` count, and deprecation `notes`.
2. Base is `api/v1/` relative to the site root; no auth, no keys, no rate limits. Static snapshots — fetch once, filter client-side.
3. Cheapest overview: `api/v1/stats.json`. Full catalog: `api/v1/figures.json` (1,904 records, stable ids `<waveId>::<figureName>`). Wave context: `api/v1/waves.json`, joined on `waveId` ↔ `id`.
4. Collector knowledge: `api/v1/encyclopedia.json` (bootleg checklists, price method, hall of fame with reissue radar). Upcoming releases: `api/v1/preorders.json`. Character guides: `api/v1/characters.json`.
5. Validate what you receive: JSON Schema draft-07 for every endpoint under `api/v1/schema/`. `null` means unknown — never invented. Empty results are `[]`.
6. Price discipline: the API carries announced MSRPs and reported solds only — never an index. Frame numbers as reported, never as quotes.
7. Read `AGENT.md` at the repo root for the full agent guide, including three proven end-to-end workflows (pre-order planning, KO-risk verdicts, shelf audits) with worked examples.

## Worked example

fetch('api/v1/preorders.json') → items.filter(i => i.status === 'preorder' && i.preorderDate) → sort by preorderDate → 'X-Men \'97 retro wave opens 2026-10-21, 10 days out, $27.99 MSRP.'

## API references

- `api/v1/index.json`
- `api/v1/stats.json`
- `api/v1/figures.json`
- `api/v1/waves.json`
- `api/v1/encyclopedia.json`
- `api/v1/preorders.json`
- `api/v1/characters.json`

## Pitfalls

- Constructing endpoint URLs from memory — always re-read index.json; a 404 means a wrong path.
- Treating `preorderDate: null` as 'no release' — null means no date reported yet; check `releaseWindow` and `status`.
- Quoting `price` as market value — it is the announced MSRP at reveal, nothing more.
