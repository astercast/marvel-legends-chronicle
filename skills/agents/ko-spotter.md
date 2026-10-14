---
name: ko-spotter
description: Run the KO risk pass: market vectors, price logic, photo tells, and the authentication-wizard flow.
---

# Spot a likely bootleg (KO market intel + auth-wizard logic)

## Use when

You have an eBay or marketplace listing lead and need a KO risk verdict before buying.

## Inputs

- Listing URL or photos
- Asking price
- Figure identity (wave, year)

## Procedure

1. Load `data/v1/encyclopedia.json` → `bootlegGuide` for the six checklists (packaging, paint, joints, targets, listings, price-logic), run all six, not just one.
2. Apply the vectors: AliExpress is the primary direct-to-consumer KO source ('Maximum Series Spider-Man'-style listings); Shopee (SE Asia) lists KOs at near-genuine prices (₱2,491–₱2,677 for a 'Retro VENOM', observed Oct 2026), the fraud zone is KOs priced LIKE genuine, distinct from knowing KO purchases.
3. Apply price logic: ~$10–16 KO band vs $25–100+ genuine (reviewer anecdote). 40%+ under 90-day reported solds = assume bootleg until proven otherwise. A $40 'SDCC exclusive' is a tell, not a deal.
4. Apply photo tells: stock photos vs real photos; neck ball-peg differences, elbow/hand pegs, joint gaps; documented tells like KO Carnage's silver eyes (stillfigurineout.com comparisons).
5. For grails demand provenance: where from, when, any receipts. When in doubt, pass, another listing always comes.

## Worked example

A $45 'Retro Venom' listing with stock photos and a 3-feedback seller: price-logic fail + photo fail + seller fail, high KO risk; walk away or demand real photos first.

## API references

- `data/v1/encyclopedia.json`

## Pitfalls

- Trusting a near-retail KO price, Shopee fraud-zone listings price like genuine on purpose.
- FOMO buying, scarcity pressure is the bootlegger's best tool.
