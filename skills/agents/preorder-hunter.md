---
name: preorder-hunter
description: Turn the pre-order tracker and radar into a timed hunt plan: what's dropping, exact dates, and retailer search links.
---

# Hunt upcoming pre-orders (what's coming, when, where)

## Use when

You want to know what's coming, when pre-orders open, and where to look — this month or next.

## Inputs

- A time window (e.g. this month, the next 60 days)
- Optional character or line focus

## Procedure

1. Load `api/v1/preorders.json` — 15 researched upcoming releases (wave-12 research, observed 2026-10-11). Each item: `status` (`preorder`/`revealed`/`available`), `preorderDate` (exact YYYY-MM-DD when reported, `null` when unreported — never invented), `releaseWindow`, `price` (announced MSRP at reveal, never a market price), `retailers` (retailer search-pattern ids), `sources` (hobby-press links).
2. Sort by status then date: exact-`preorderDate` items first ('pre-order opens in N days'), then `revealed` items by `releaseWindow`, then `available` items to buy now.
3. Cross-check the radar (`radar.html`) for newly spotted items not yet in the tracker — radar cards are research notes; the tracker is the canonical schedule.
4. For each target, use the item's `query` with the retailer search patterns to find listings — the archive links search pages, never product URLs, so links don't rot.
5. Report what you know vs. don't: exact-date items are actionable, season-only items are watchlist material, `null` preorderDate means no date has been reported yet.

## Worked example

Asked 'what should I pre-order this month': Mini Comics Wave 3 (pre-order opened 2026-10-06, $27.99 MSRP) is available now via retailer search; the X-Men '97 retro wave pre-order opens 2026-10-21 — set the reminder; the Avengers: Doomsday wave (Fall 2026, revealed) goes on the watchlist.

## API references

- `api/v1/preorders.json`

## Pitfalls

- Treating `releaseWindow` as a pre-order date — only `preorderDate` is a real date; everything else is a watch.
- Quoting `price` as market value — it's the announced MSRP at reveal, not what the item is worth now.
