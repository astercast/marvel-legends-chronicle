# Marvel Legends Chronicle

**Every Marvel Legends figure ever released, in chronological order — including the pre-Hasbro Toy Biz era.**

Static site. GitHub only — nothing is deployed anywhere.

## What's here

- `index.html` — the chronological timeline (1,904 figures, 158 waves, 2002–2026), with a "Featured In" story-source facet (MCU / animated / video game — 29 waves classified, the rest honestly Unclassified)
- `timeline.html` — The Legends Timeline: year-by-year line history 2002–2026 — sourced milestones, 5 packaging eras, all 158 waves linked into the archive (rebuild year sections with `python3 scripts/build_timeline.py`); API at `api/v1/timeline.json`
- `start.html` — new collector starter guide: smart first pickups, how to read a wave, spotting fakes, BAF math, tracking your shelf, learning real prices
- `waves/` — 158 generated wave detail pages (`waves/<wave-id>.html` + index; rebuild with `python3 scripts/build_waves.py`): every figure with inline Owned/Wanted toggles, BAF breakdown, research links, prev/next wave navigation, print checklist — plus wave-26 deep-link overhaul: every figure gets a stable `#fig-<slug>` anchor (stable deep link `waves/<waveId>.html#fig-<slug>`) and a cross-link row (⚖️ Compare entry, 💎 rarity-tier link, 💰 reported price signals, ⚠️ KO-spotter note, 🏆/🎯 quest relevance)
- `compare.html` — figure compare (VS mode, wave 26): 2–4 figures side-by-side — release info, archive notes, reported price bands (reported, never live), rarity signals, KO watch, documented upgrade paths (variants / documented reissues / exclusives / same character, honest trade-offs), "which to buy" guidance grounded in the data (no hype, no winner); shareable links (`compare.html?a=<id>&b=<id>`), keyboard operable, mobile-first; profiles via new `api/v1/compare.json` (built by `scripts/compare_lib.py`)
- `2026-review.html` — 2026: The State of Legends (wave 27): data-driven year-in-review — month-by-month scrubber timeline, scored Top-10 2026 releases with shown distinction criteria, best-value picks from announced MSRPs, price movements from reported solds only (white Epic Heroes Doom +$50/+33.3% Mar→Aug), 8 biggest surprises, KO watch (no new 2026 counterfeit wave documented), rarity highlights, market narrative arc; everything computed from the real archive data, gaps labeled; cross-links to timeline / market briefing / rarity guide / radar / encyclopedia / VS mode; content from `data/year-review.json` via `scripts/build_review.py`; API at `api/v1/year-review.json` (14th endpoint)
- `drop-week.html` — Drop Week Command Center (wave 32): the Oct 14 → Nov 1 drop sequence + Nov 20 made-to-order deadline — Oct 14 Doomsday Wave 2, Oct 21 X-Men '97 wave, Oct 28 Astonishing 2-pack reissue, Nov 1 YFNS Spider-Man vs. Rhino Pulse-exclusive sale day, Nov 20 Trask & Bastion MTO deadline; live countdowns, confirmed lineups with researched accessory breakdowns, price/scarcity/KO intel, morning-of playbook, rumor watch (flagged uncertain), personal battle plan per figure (want → ordered, browser-local `mlc_dropweek_v1`, copy-to-share); breadcrumb + sticky in-page wayfinding rail, container-query drop cards, reduced-motion safe; content from `data/drop-week.json` via `scripts/build_dropweek.py` (also writes `api/v1/drop-week.json` + schemas + noscript fallback; manifest registration pending merge)
- `stats.html` — stats dashboard: figures per year, BAF waves over time, top 25 characters, exclusives share, wave-size breakdowns — all computed live from the data
- `grails.html` — 23 sourced grail stories expanding the hall of fame (incl. 3 NYCC 2026 additions): the legend, the hunt, the reissue saga, honest prices
- `variants.html` — variant & chase identifier: how to spot variants in the wild + wave-by-wave index of all 83 documented variants
- `baf-economics.html` — BAF economics: cost-to-complete per Build-A-Figure from your own journal sold sightings, ranked cheapest-first (browser-local)
- `hunt.html` — hunt planner: toy-show trip planner with targets, max prices, printable hunt sheet (browser-local)
- `variant-spotlight.html` — 15 of the most interesting documented variants: why each matters + how to spot it
- `rarity.html` — The Rarity Guide: chase vs variant vs exclusive vs limited — 9 tiers with documented examples (real archive ids), how-to-spot tells, value notes (reported prices only), rare = faked / rarity ≠ value / rarity ≠ quality sections; content from `data/rarity-guide.json` (rebuild with `python3 scripts/build_rarity.py`); API at `api/v1/rarity.json`
- `checklist.html` — printable owned/wanted checklist from your tracker data, grouped by wave (print stylesheet also covers the timeline)
- `explore.html` — archive explorer: "Surprise me" seeded random-figure engine (no repeats until the deck is exhausted) + curated rabbit holes — variant oddities, deepest Toy Biz cuts, one-figure characters, the ten oldest BAFs (browser-local)
- `retro.html` — retro line browser: every retro-carded figure identified from the archive's own notes, grouped by retro line (Marvel Retro waves, Retro fan channel, retro singles); retro status never guessed (browser-local)
- `showcase.html` — Shelfie showcase: curate your top 10 from owned figures, drag-or-keyboard reorder, one "why it made the cut" line per slot, printable layout (browser-local)
- `encyclopedia.html` — collector encyclopedia: line history, packaging evolution, variant/chase/exclusive taxonomy, 23-entry hall of fame (with reissue radar), grading guide, bootleg-spotting guide, resources directory
- `baf-planner.html` — "complete my BAF" planner: mark owned figures, see missing pieces + acquisition guidance (browser-local, syncs with the timeline tracker)
- `characters/` — 66 generated character archive pages (`characters/<slug>.html` + index; rebuild with `python3 scripts/build_characters.py`), each with a run-completion progress bar + missing-figure checklist driven by your tracker
- `price-guide.html` — transparent sold-listings price methodology, dated price history, reissue effect
- `auth-wizard.html` — interactive bootleg authentication wizard (step-by-step pass/fail with verdict)
- `community.html` — fan social: profiles, feed, likes, comments, follows, figure-tagged posts (client-side demo)
- `holiday.html` — 2026 Holiday Buying Guide: four recipient profiles from the researched 2026 releases, honest price bands (announced MSRP or "check eBay solds"), KO red flags, reissue intel, don't-get-burned checklist
- `quest.html` — Grail Quest 4.0: your collection as a game — auto-generated quests (BAF finishes, series/character runs), next-quest recommendations (closest BAF, watch-weighted cheapest missing piece, nearest watchlist grail, watchlist hunts, insight pick from the gap analysis), 17 achievements, collector levels, collection insights dashboard (completion by wave/year/character, duplicates, shelf-value band from reported ranges only, one-figure-away gaps), growth & milestones, collection report export (markdown, for insurance/records), shareable quest card (browser-local)
- `api.html` — human-readable API docs
- `assets/css/` — design system: `tokens.css`, `base.css`, `layout.css`, `components.css`, plus per-page stylesheets
- `assets/js/` — ES modules: `config`, `store` (versioned localStorage), `data` (query layer), `tracker`, `listings`, `modal`, `figure-dialog`, and per-page initializers (`timeline`, `encyclopedia`, `community` + `community-page`)
- `data/figures.json` — the figure database (waves in chronological order)
- `data/encyclopedia.json` — encyclopedia source data
- `data/community.json` — seed profiles and posts for the community demo
- `data/preorders.json` — researched upcoming releases feeding the pre-order tracker + release calendar (wave 12 sources, no invented dates)
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
- **Collector tools:** BAF planner (owned-sync, missing-piece acquisition plan), 66 chronological character pages, 158 wave detail pages with inline tracking, new-collector starter guide, bootleg authentication wizard, transparent price-methodology page, 2026 market briefing (chase-figure era over, reported solds, reissue-cooling, KO buyer-beware), your-shelf dashboard (with "almost there" completion recommendations + v2 analytics: manufacturer split, peak years, growth trend, journal value over time, per-era rarity), price journal (personal sold-listing log + tracked collection value), collection ledger (cost basis vs tracked value = gain/loss), grail watchlist (your hunts, your max prices, deal-or-no-deal sightings, Price Watch vs reported market signals), budget tracker (your monthly/annual spend targets as a mirror — your logged purchases, never advice), exclusives browser (587 exclusives by retailer), release radar, pre-order tracker (live status countdowns + ordered/watching/skipped), 12-month release calendar, figure compare (VS mode: shareable `compare.html?a=&b=` links, reported price bands, rarity signals, KO watch, documented upgrade paths, honest buy guidance — no winner declared), milestone-anniversary strip on the timeline, archive explorer (surprise-me engine + curated rabbit holes), retro line browser, Shelfie showcase (your top 10, printable), gift finder (budget + character → suggestions with real research links), shareable shelf summary, per-figure price trends from your own journal sales
- **Stats dashboard:** figures per year, BAF waves over time, top 25 characters, exclusives share, average wave size (Toy Biz vs Hasbro) — vanilla SVG, computed live from the archive

## Skills

`skills/` — 219 agentic task procedures (`python3 scripts/build_skills.py`
regenerates from `data/*.json` + authored procedures). `skills/index.json`
is the manifest agents should load first; `api/v1/index.json` points at it.
101 BAF completion checklists, 46 character collector guides (with run completion), 24 grail
dossiers (incl. reissue-radar), bootleg authentication + counterfeit-market
awareness, packaging-era ID, chase/case-ratio decoding, exclusive-hunting
playbook, grading decisions, era guides, hunt tactics, marketplace and
community procedures, plus 7 cross-cutting agent playbooks (`skills/agents/`:
preorder-hunter, market-brief-reader, ko-spotter, grail-evaluator,
baf-strategist, collection-auditor, api-client) — see the agents landing page
(`agents.html`) and the agent guide (`AGENT.md`).

## Data status

`data/figures.json` holds **1,904 figures across 158 waves** (2002–2026), merged from twelve researched parts. Year ordering is accurate; within-year monthly ordering is not yet audited. Some BAF pieces and disputed wave numbers are flagged `unverified` in notes. Announced-but-unreleased entries should be treated cautiously.

## Accessibility & performance

Semantic landmarks, skip link, focus-visible rings, ARIA for dialogs/tabs/toggles, `prefers-reduced-motion` support, keyboard-operable cards and dialogs. No frameworks, no build step, no external requests — works from `file://` or any static host.
