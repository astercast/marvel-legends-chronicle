---
name: marketplace-price-check
description: The 90-day sold method: the only price that matters.
---

# Price-check via sold listings

## Use when

Before buying or selling anything.

## Inputs

- Figure + condition tier

## Procedure

1. eBay → advanced search → SOLD listings, last 90 days.
2. Filter to your condition tier and match it exactly — loose complete / boxed / graded. A loose sold tells you nothing about a boxed price.
3. Take the median of the last 10–15 solds, drop outliers.
4. Asking prices are irrelevant — only solds count.
5. hobbyDB is a catalog cross-check, NOT a price source — its 'Estimated Value' is member-curated and many entries show 'Help Wanted' (no value yet); it is not transaction-derived.
6. StockX covers some Legends with verified 'last sale' data (e.g. Retro Ben Reilly Spider-Man: release 04/01/2022, retail $23, last sale $35, observed Oct 2026) — useful where covered, but toy coverage is thin.
7. No PriceCharting equivalent exists for action figures (no transaction-aggregating guide found as of 2026-10-11) — don't hunt for one; the 90-day sold method IS the aggregator.

## Worked example

Retro Spider-Man boxed: 12 solds, median $28 — that's the price, not the $60 ask.

## Data references

- `data/encyclopedia.json`

## Pitfalls

- One high sold = the market. Medians, not peaks.
- Mixing condition tiers — match loose/boxed/graded exactly.
