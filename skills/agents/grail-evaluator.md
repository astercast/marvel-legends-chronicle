---
name: grail-evaluator
description: Assess whether a figure deserves grail money: hall-of-fame signals, variant/chase data, and what the archive does and doesn't know.
---

# Evaluate a grail candidate (rarity signals, reissue radar)

## Use when

You found a high-ticket listing and need to know if the premium is real or reissue-vulnerable.

## Inputs

- Figure name + wave/year

## Procedure

1. Look up the figure in `data/v1/figures.json` (stable id `<waveId>::<figureName>`) — confirm the exact release, `variant`/`exclusive` flags, and year. Never evaluate from a bare name.
2. Check the hall of fame in `data/v1/encyclopedia.json` (23 entries) and the 20 grail stories for documented narratives — legend, hunt, and reissue saga. Quote `priceNote` + `verified`; `verified: false` = single-source, treat as lore.
3. Read the `reissueRadar`: `resilient` premiums rest on true rarity (prototypes, true chases, pre-2020 con exclusives, crowdfund caps); `vulnerable` ones rest on availability and collapse when Hasbro reissues.
4. Check the variant/chase data in the variants guide (chase/case ratios, exclusives taxonomy) — modern chases are effectively dead, so post-2020 'chase' premiums are suspect.
5. Pull the figure's compare profile from `data/v1/compare.json` (keyed by figure id): `rarity` tier cross-ref, `priceSignals` (reported ranges — never live prices), `koWatch` note, and `upgradePaths` — documented other releases of the same character with honest relations (`variant` = scarcer release, usually pricier; `base-release` = the budget path; `reissue` = usually undercuts the original; `exclusive` = often an aftermarket premium). The shareable compare link is `compare.html?a=<id>&b=<id>`.
6. State what the archive doesn't know: spike numbers are rarely published; price bands are reported solds, not quotes. End with a max-pay rule: resilient radar = pay the premium with confidence; vulnerable radar = cap at reissue price + a small premium, or wait.

## Worked example

Asked about the Toy Biz Series 15 blue/white Wasp chase prototype: ~10 carded, unproduced, $7.5K ask — resilient (prototype, true rarity), but the number is an asking price not a sale, and the entry is single-sourced → present as lore, not data.

## API references

- `data/v1/figures.json`
- `data/v1/encyclopedia.json`
- `data/v1/compare.json`

## Pitfalls

- Treating 'sold out' as 'rare' — sold out is a week, rare is forever.
- Paying a 2021-style premium in a 2026 reissue environment — check the Retro program first.
