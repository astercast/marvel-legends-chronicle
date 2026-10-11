# WAVELOG — Marvel Legends Chronicle

One line per wave, so a fresh mind can reconstruct the history.

- **Waves 1–11 (completed 2026-10-11):** archive build-out — 1,904-figure archive, wave/character pages, explore, retro, showcase, gift finder, price trends, shelf, journal, radar, BAF planner; engineering pass (51-test suite, `scripts/validate.sh`); design overhaul v2 ("The Archive").

## Wave 12 — research integration (2026-10-11)

- Source: `~/workspace/research_notes/ai-film-deep-2026-20261011-2154` (Mission 2, Marvel Legends 2026 — read 2026-10-11). No invented figures, dates, prices, or retailers; every claim carries its source or a single-source flag.
- **Radar** (`radar.html`): +7 cards — Mini Comics Wave 3 (pre-order Oct 6, 2026; red Elektra first since 2018, Fraction/Aja Hawkeye, Acroyear, Doom Suit Spider-Man, Earth X Cap, Elsa Bloodstone, mini comic per figure; $27.99); X-Men '97 retro wave (pre-order Oct 21, 2026); Spider-Man: TAS retro wave (pre-order Sep 29, 2026; first solo 6" Aunt May; VHS-exclusive reissues); Avengers: Doomsday wave (NYCC reveal, Fall 2026); MTG Wave 2 (shipped Oct 2026, $39.99, Amazon-exclusive Black Panther); Bastion & Bolivar Trask 2-pack (announced, Fall 2027); 2026-releases recap card (Secret Wars Wave 2, Box BAF wave, Professor Hulk, Iron Spider Aaron Davis, Miles mask, Vision/Scarlet Witch 2-pack, Holiday Spidey, Iron Man vs Spiral, Gargantos, Cyclops visor, 12" Apocalypse; $27.99 standard). New `status-preorder` pill (revealed / pre-order / available).
- **Market intel**: new `market-briefing.html` (in nav as "Market Briefing") — modern chases effectively dead ("largely abandoned"); Epic Heroes white Dr. Doom $60 → $115–$200 (reported eBay solds, actionfigure411); $7.5K ask for unproduced Toy Biz Series 15 blue/white Wasp chase prototype (~10 carded); reissue program cooling aftermarket premiums; evergreen KO buyer-beware (no 2026 counterfeit wave documented); reported-listings-only methodology, flagged single-source claims.
- **Packaging** (`encyclopedia.html`, data-driven): new `retro-blisters-2026` section in `data/encyclopedia.json` + `api/v1/encyclopedia.json` — 2026 = retro blister cards + mini-comic pack-ins, no new overhaul; plastic-free reversal (Apr 2023, bioPET windows) verified already covered.
- Nav synced in `scripts/update_nav.py`, `scripts/build_waves.py`, `scripts/build_characters.py`; nav rebuilt on all pages; `llms.txt` + `README.md` updated.
- **Validation:** `scripts/validate.sh` — VALIDATION PASSED (51/51 tests, 9 suites).
- **Commit:** 706e233
