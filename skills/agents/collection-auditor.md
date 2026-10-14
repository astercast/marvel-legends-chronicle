---
name: collection-auditor
description: Summarize a shelf from owned/wanted state: era coverage, near-complete wins, gaps, and the smartest next pickups.
---

# Audit a collection shelf (gaps, era splits, next acquisitions)

## Use when

You want a read on your collection: what's strong, what's thin, and the smartest next acquisitions.

## Inputs

- Owned + wanted figures (site tracker state)
- Optional focus: character, era, or budget

## Procedure

1. Use the archive's shelf-analytics template (`data/v1/stats.json` for archive totals): manufacturer split (Toy Biz vs Hasbro), era coverage (founding 2002–2006 era, transition, modern), peak collecting years.
2. Find near-complete wins first: waves past 50%, BAFs missing 1–2 pieces, characters nearly complete, the site's 'Almost there' logic. Completing a near-finished set beats starting a new one.
3. Spot era gaps: e.g. an all-modern shelf with zero Toy Biz, or no retro-carded representation, name the gap and the cheapest representative fix from `data/v1/figures.json`.
4. Rank next acquisitions: near-completions first, then grail targets with resilient reissue radar, then hunt-list figures with logged max prices.
5. Present the summary in the shareable shelf-summary shape: counts, era splits, top 3 gaps, top 3 next pickups, plain sentences, no invented prices (prices only from the user's own journal solds).

## Worked example

A shelf of 40 modern Spider-Man figures and zero X-Men: coverage skew flagged; top next pickup = the wanted-list figures that complete the nearest 'almost there' X-Men wave.

## API references

- `data/v1/stats.json`
- `data/v1/figures.json`
- `data/v1/encyclopedia.json`

## Pitfalls

- Auditing from memory instead of the tracker, stale owned state produces wrong gaps.
- Recommending a figure whose only 'value' is an ask price, reported solds or the user's own data only.
