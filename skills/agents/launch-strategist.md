---
name: launch-strategist
description: Read a figure's launch curve and decide whether to buy at launch, wait out the spike, or set a watchlist target — from reported data only.
---

# Decide: buy at launch or wait (the launch-curve verdict)

## Use when

A hot figure is selling out and you need a buy/wait verdict grounded in what actually happened last time.

## Inputs

- Figure name + wave (must resolve in data/v1/figures.json)
- Your max price (optional)

## Procedure

1. Load `data/v1/launch-curves.json` — real sold-price timelines (every point a reported eBay sold/presale from a named hobby tracker, with sellout event markers and MSRP). Curves exist only where a tracker published ≥3 dated sold points; if there is no curve for the figure, say so — never extrapolate.
2. Read the curve's arc: peak price/date, latest price/date, peak→latest drop %, and the MSRP line. The documented pattern is sellout → spike → cool → retail: Doomsday Wave 1 Gambit peaked at $79.99 (Sep 24, 2026) and presold at $25.99 fifteen days later — below MSRP.
3. Check the reissue radar (`data/v1/encyclopedia.json` hall of fame): `resilient` premiums (prototypes, true chases, pre-2020 con exclusives) don't follow the curve; `vulnerable` availability premiums do — and they cool faster.
4. Check `data/v1/preorders.json` for the figure's window: if a pre-order date is confirmed, the buy-at-launch path is the MSRP path; if it sold out, the wait path is the curve path.
5. Deliver the verdict in three parts: (1) what the data shows (peak, latest, drop, days — all reported), (2) the wait case vs the buy case, (3) a concrete rule: mainline waves → set the watchlist target at or below MSRP and let the Price Watch ping you; resilient-radar grails → pay the premium or pass. Never invent a future price.

## Worked example

Asked 'should I pay $60 for Doomsday Gambit now?': the launch curve shows $79.99 → $25.99 in 15 days (reported solds, actionfigure411) with a $27.99 MSRP — $60 buys the spike, not the figure. Verdict: wait, set a $27.99 watchlist target.

## API references

- `data/v1/launch-curves.json`
- `data/v1/preorders.json`
- `data/v1/encyclopedia.json`

## Pitfalls

- Treating a 'Sold Out' product page as scarcity — sold out is a stock flag, not a grail signal; real scarcity has a production story.
- Averaging the curve into a price quote — the points are reported solds, not a valuation.
- Applying the curve to resilient-radar grails — prototypes and true chases don't cool like mainline waves.
