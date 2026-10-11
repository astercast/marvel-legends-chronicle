# Marvel Legends Chronicle

**Every Marvel Legends figure ever released, in chronological order — including the pre-Hasbro Toy Biz era.**

Static site. GitHub only — nothing is deployed anywhere.

## What's here

- `index.html` — the chronological timeline (1,904 figures, 158 waves, 2002–2026)
- `encyclopedia.html` — collector encyclopedia: line history, 23-entry hall of fame, bootleg-spotting guide, resources directory
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

- **Chronological timeline:** waves grouped by year, Toy Biz → Hasbro, with Build-A-Figure callouts; year jump rail; `content-visibility` keeps 1,900+ cards fast
- **Search & filters:** by figure, wave, BAF, manufacturer, and collection status
- **Collection tracker:** mark figures Owned / Wanted — localStorage only, no account, no backend; corrupt storage resets safely
- **Marketplace links:** per-figure pre-filled searches on eBay, Amazon, BigBadToyStore, Hasbro Pulse — constructed search URLs (mock), not live inventory
- **Encyclopedia:** history timeline, searchable hall of fame with verified/unverified price flags, bootleg guide, resources
- **Community:** seeded collector profiles; photo composer with client-side downscaling; chronological + following feeds; likes, comments, follows, hashtags; figure tags open the figure dialog

## Skills

`skills/` — 206 agentic task procedures (`python3 scripts/build_skills.py`
regenerates from `data/*.json` + authored procedures). `skills/index.json`
is the manifest agents should load first; `api/v1/index.json` points at it.
101 BAF completion checklists, 46 character collector guides, 23 grail
dossiers, bootleg authentication, era guides, hunt tactics, marketplace and
community procedures.

## Data status

`data/figures.json` holds **1,904 figures across 158 waves** (2002–2026), merged from twelve researched parts. Year ordering is accurate; within-year monthly ordering is not yet audited. Some BAF pieces and disputed wave numbers are flagged `unverified` in notes. Announced-but-unreleased entries should be treated cautiously.

## Accessibility & performance

Semantic landmarks, skip link, focus-visible rings, ARIA for dialogs/tabs/toggles, `prefers-reduced-motion` support, keyboard-operable cards and dialogs. No frameworks, no build step, no external requests — works from `file://` or any static host.
