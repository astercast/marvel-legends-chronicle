---
name: market-brief-reader
description: Interpret the 2026 market briefing and price-trend data without turning reported listings into a market index.
---

# Read the market briefing honestly (reported solds, never an index)

## Use when

You want the market's temperature: what's hot, what's cooling, and what the data actually supports.

## Inputs

- The claim you want to check (e.g. 'is X hot right now?')

## Procedure

1. Load `data/v1/encyclopedia.json` → `priceMethod` for the methodology: the Chronicle works from reported eBay sold listings only. There is no price index here — every number is a reported transaction, never a market quote.
2. Frame every price as reported or user-logged: 'reported eBay solds at $115–$200' — never 'the market says $157'. Give the range and the count of reports, never a single index number.
3. Check the briefing's 2026 themes: (a) modern chases are effectively dead ('largely abandoned'); (b) the reissue program is cooling aftermarket premiums — availability-driven prices collapse on reissue; (c) grail resilience sorts by reissue radar: `resilient` (prototypes, true chases, pre-2020 con exclusives, crowdfund caps) vs `vulnerable` (availability-driven).
4. Flag single-source claims: entries marked `verified: false` come from one or tabloid source — present them as lore, not data.
5. When in doubt, say what would change your mind: which sold listings, which reissue announcement, which new data source.

## Worked example

Asked 'is white Dr. Doom hot?': Epic Heroes white Dr. Doom shows reported eBay solds of $115–$200 vs $60 retail (actionfigure411) — a hot *reported* band. But Epic Heroes figures get reissued, so frame it as a reported range with reissue risk, never 'worth $150'.

## API references

- `data/v1/encyclopedia.json`

## Pitfalls

- Averaging three solds into an index number — the archive's whole method forbids this.
- Quoting the $7.5K Wasp prototype ask as a sale — it's an asking price for an unproduced Toy Biz Series 15 blue/white Wasp chase prototype (~10 carded), not a transaction.
