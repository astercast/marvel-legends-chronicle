# Marvel Legends Chronicle

**Every Marvel Legends figure ever released, in chronological order — including the pre-Hasbro Toy Biz era.**

Static site. GitHub only — nothing is deployed anywhere.

## What's here

- `index.html` — the chronological timeline (1,904 figures, 158 waves, 2002–2026), with a "Featured In" story-source facet (MCU / animated / video game — 29 waves classified, the rest honestly Unclassified)
- `start.html` — new collector starter guide: smart first pickups, how to read a wave, spotting fakes, BAF math, tracking your shelf, learning real prices
- `waves/` — 158 generated wave detail pages (`waves/<wave-id>.html` + index; rebuild with `python3 scripts/build_waves.py`): every figure with inline Owned/Wanted toggles, BAF breakdown, research links, prev/next wave navigation, print checklist
- `stats.html` — stats dashboard: figures per year, BAF waves over time, top 25 characters, exclusives share, wave-size breakdowns — all computed live from the data
- `grails.html` — 10 sourced grail stories expanding the hall of fame: the legend, the hunt, the reissue saga, honest prices
- `variants.html` — variant & chase identifier: how to spot variants in the wild + wave-by-wave index of all 83 documented variants
- `checklist.html` — printable owned/wanted checklist from your tracker data, grouped by wave (print stylesheet also covers the timeline)
- `encyclopedia.html` — collector encyclopedia: line history, packaging evolution, variant/chase/exclusive taxonomy, 23-entry hall of fame (with reissue radar), grading guide, bootleg-spotting guide, resources directory
- `baf-planner.html` — "complete my BAF" planner: mark owned figures, see missing pieces + acquisition guidance (browser-local, syncs with the timeline tracker)
- `characters/` — 66 generated character archive pages (`characters/<slug>.html` + index; rebuild with `python3 scripts/build_characters.py`)
- `price-guide.html` — transparent sold-listings price methodology, dated price history, reissue effect
- `auth-wizard.html` — interactive bootleg authentication wizard (step-by-step pass/fail with verdict)
- `community.html` — fan social: profiles, feed, likes, comments, follows, figure-tagged posts (client-side demo)
- `api.html` — human-readable API docs
- `assets/css/` — design system: `tokens.css`, `base.css`, `layout.css`, `components.css`, plus per-page stylesheets
- `assets/js/` — ES modules: `config`, `store` (versioned localStorage), `data` (query layer), `tracker`, `listings`, `modal`, `figure-dialog`, and per-page initializers (`timeline`, `encyclopedia`, `community` + `community-page`)
- `data/figures.json` — the figure database (waves in chronological order)
- `data/encyclopedia.json` — encyclopedia source data
- `data/community.json` — seed profiles and posts for the community demo
- `api/v1/` — versioned static JSON API with JSON Schemas (see `API.md`, `llms.txt`)
- `scripts/build_api.py` — regenerates `api/v1/` from `data/`; commit the outputs

## Features (mock-up)

- **Chronological timeline:** waves grouped by year, Toy Biz → Hasbro, with Build-A-Figure callouts; year jump rail; packaging-era bands (Toy Biz → windows return) with one-line notes from the encyclopedia; `content-visibility` keeps 1,900+ cards fast
- **Search & filters:** by figure, wave, BAF, manufacturer, collection status, and story source ("Featured In": MCU / animated / video game)
- **Collection tracker:** mark figures Owned / Wanted — localStorage only, no account, no backend; corrupt storage resets safely
- **Marketplace links:** per-figure pre-filled searches on eBay, Amazon, BigBadToyStore, Hasbro Pulse — constructed search URLs (mock), not live inventory
- **Research links:** per-figure "Research" affordance in the figure dialog and on every character-page release — eBay *sold* listings (actual sale prices, same pattern as the BAF planner), YouTube review search, general web search; external third-party content, clearly labeled
- **Encyclopedia:** history timeline, packaging evolution, searchable hall of fame with verified/unverified price flags and reissue-radar (resilient vs vulnerable premiums), grading guide (AFA/CGA, CAS, UKG, no-premium caveat), bootleg guide, resources
- **Community:** seeded collector profiles; photo composer with client-side downscaling; chronological + following feeds; likes, comments, follows, hashtags; figure tags open the figure dialog
- **Collector tools:** BAF planner (owned-sync, missing-piece acquisition plan), 66 chronological character pages, 158 wave detail pages with inline tracking, new-collector starter guide, bootleg authentication wizard, transparent price-methodology page, your-shelf dashboard (with "almost there" completion recommendations), price journal (personal sold-listing log + tracked collection value), release radar, figure compare, milestone-anniversary strip on the timeline
- **Stats dashboard:** figures per year, BAF waves over time, top 25 characters, exclusives share, average wave size (Toy Biz vs Hasbro) — vanilla SVG, computed live from the archive

## Skills

`skills/` — 212 agentic task procedures (`python3 scripts/build_skills.py`
regenerates from `data/*.json` + authored procedures). `skills/index.json`
is the manifest agents should load first; `api/v1/index.json` points at it.
101 BAF completion checklists, 66 character collector guides, 24 grail
dossiers (incl. reissue-radar), bootleg authentication + counterfeit-market
awareness, packaging-era ID, chase/case-ratio decoding, exclusive-hunting
playbook, grading decisions, era guides, hunt tactics, marketplace and
community procedures.

## Data status

`data/figures.json` holds **1,904 figures across 158 waves** (2002–2026), merged from twelve researched parts. Year ordering is accurate; within-year monthly ordering is not yet audited. Some BAF pieces and disputed wave numbers are flagged `unverified` in notes. Announced-but-unreleased entries should be treated cautiously.

## Accessibility & performance

Semantic landmarks, skip link, focus-visible rings, ARIA for dialogs/tabs/toggles, `prefers-reduced-motion` support, keyboard-operable cards and dialogs. No frameworks, no build step, no external requests — works from `file://` or any static host.
