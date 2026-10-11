---
name: variants-chase-case-decode
description: Tell real chases from variants using assortment codes and case math.
---

# Decode chase figures and case ratios

## Use when

Deciding whether a 'chase' premium is justified.

## Inputs

- The figure
- Its assortment/SKU code
- The wave's case mix if known

## Procedure

1. Remember the rule: case ratios are set by the ASSORTMENT number on the shipping case, not the wave. One wave can span multiple assortments; 'revision cases' swap variants in/out mid-wave.
2. A figure is a chase if it ships 1× per case while the rest ship 1–2×, or only in revision assortments. Modern standard case: 8 figures (e.g. 2× anchor figure + 1× each of 6 others).
3. Check the 5-digit SKU code (G/F prefix recent, all-numeric older) — it must match the product number on the cardback. Older QA/batch codes appear on legs/feet.
4. For Target exclusives, the Target DCPI locates stock via scanners and employee pulls.
5. No official 'chase ratio' is published by Hasbro — every ratio is reverse-engineered from case mixes. Anyone quoting an official ratio is inventing it.
6. Price ceiling: 1-per-case chase at $25 retail → fair aftermarket $40–60, not $150. Launch-week panic is the tax; chases settle after ~60 days.

## Worked example

Seller claims '1 of 500 chase': ask for the assortment code and case mix — if they can't produce it, price it as a variant, not a grail.

## Data references

- `data/encyclopedia.json`
- `data/figures.json`

## Pitfalls

- Paying 'limited edition' premiums with no assortment evidence.
- Confusing a revision-case variant with a true chase — both are short, only one is rare.
