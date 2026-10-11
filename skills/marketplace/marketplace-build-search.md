---
name: marketplace-build-search
description: Search strings that find the figure and dodge the bootlegs.
---

# Build a marketplace search query

## Use when

Hunting a specific figure on eBay/Mercari/Whatnot.

## Inputs

- Figure name
- Wave/year
- Variant details

## Procedure

1. Start: `"Marvel Legends" + character + wave keyword (e.g. "Retro Spider-Man")`.
2. Add exclusions: `-bootleg -custom -"not marvel legends"` as needed.
3. For BAF pieces: search the piece + BAF name (`"Giant Man" "left leg" BAF piece`).
4. Save the search with alerts — grails surface at odd hours.

## Worked example

Query: Marvel Legends Moon Knight Fist of Khonshu -custom -bootleg

## Data references

- `data/figures.json`

## Pitfalls

- Generic searches — 'marvel legends spider-man' returns 10,000 results.
