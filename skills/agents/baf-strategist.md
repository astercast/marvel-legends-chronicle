---
name: baf-strategist
description: Turn a wave's piece checklist and your owned figures into a cheapest-first BAF completion plan.
---

# Plan Build-A-Figure completion from your owned state

## Use when

You want to complete a Build-A-Figure and need the optimal buy order.

## Inputs

- Target BAF name + wave
- Your owned/wanted figures (from the site tracker)

## Procedure

1. Find the BAF skill in `skills/index.json` (101 completion checklists, `baf-*`) — it lists every piece-carrying figure in the wave, built from `data/v1/figures.json` (`bafPiece` per figure).
2. Subtract figures you already own: owned figure = owned piece. Missing pieces map to missing figures.
3. Prioritize: figures you want anyway first, then the cheapest piece-carriers. Watch for variants that DON'T include the piece — check `bafPiece` notes before buying.
4. Cross-check cost with BAF-economics logic: cost-to-complete from your own journal sold sightings; pieces with no logged sightings have no data, not zero cost.
5. Verify each piece against the BAF's assembly (some waves split one piece across variants) and authenticate the figures first — bootleg BAF pieces don't fit right. Keep boxes until the build is complete.

## Worked example

Missing the Box BAF torso? The `baf-box` skill says Marrina Smallwood (2026 Box Wave) carries it — she is the cheapest-path figure to check sold listings for.

## API references

- `data/v1/figures.json`
- `skills/index.json`

## Pitfalls

- Buying a figure for the piece, then discovering the variant doesn't include it — check `bafPiece` notes first.
- Using zero-data pieces as zero cost — no sightings means unknown, not free.
