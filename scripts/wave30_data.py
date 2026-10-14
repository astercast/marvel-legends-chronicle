#!/usr/bin/env python3
"""Wave 30 data updates: preorders enrichments + Super-Skrull item,
price-signal additions, new data/launch-curves.json. All claims sourced."""
import json, copy
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ---------------- preorders.json ----------------
p = ROOT / "data" / "preorders.json"
data = json.loads(p.read_text())
items = {i["id"]: i for i in data["items"]}

def add_src(item, label, url):
    if not any(s.get("url") == url for s in item.get("sources", [])):
        item.setdefault("sources", []).append({"label": label, "url": url})

# X-Men '97 wave: accessory details + Wave 4 hobby-press naming + Oct 12 re-check
x = items["xmen97-retro-wave"]
x["details"] = (
    "Hobby-press 'Wave 4': Death Gambit (2 kinetic energy card power effects), Cyclops "
    "(New X-Men bomb-jacket design, alt head + 2 alt hands), Jean Grey (alt hands, powered "
    "effects), Vindicator (2 heads, comic + X-Men '97 versions, extra hands), X-Factor Havok "
    "(alt hands, powered effects), X-Factor Polaris (powered effects, second pair of hands), "
    "all on retro blister cards, Season 2-inspired. Pre-orders opened Oct 21, 2026, 1 PM ET at "
    "Pulse, Amazon + retailers → Fall 2026. Oct 12 re-check: the Oct 21 window stands "
    "(1 PM ET, Pulse + Amazon + participating retailers, Fall 2026)."
)
add_src(x, "ScreenRant, Doomsday + X-Men '97 figures (Oct 11, 2026)",
        "https://screenrant.com/marvel-legends-avengers-doomsday-x-men-97-figures/")
add_src(x, "Near Complete Set, NYCC 2026 Hasbro panel liveblog (Oct 11, 2026)",
        "https://nearcompleteset.com/2026/10/11/nycc-26-hasbro-marvel-panel/")

# Doomsday Wave 2: accessory counts + ComicBook cut-design note + prose-slip flag
d = items["doomsday-wave-2"]
d["details"] = (
    "NYCC 2026 final-day panel: Lord Doom (Concept Series, from movie concept art, not the "
    "on-screen look; the design was cut from the film per ComicBook; 2 alt hands, open + closed "
    "spell books), Beast (5 accessories: alt head, removable glasses, 2 alt hands, computer "
    "data pad), Nightcrawler (5 accessories: 2 alt hands, 2 swords, tail). Pre-orders opened "
    "Oct 14, 2026, 1 PM ET at Pulse, Amazon + retailers, Spring 2027. The panel also confirmed "
    "a running likeness change on the Doomsday Thor figure, variant alert for carded "
    "collectors. Oct 12 re-check: the Oct 14 window (1 PM ET, Pulse + Amazon + participating "
    "retailers, Spring 2027) still stands, reconfirmed by Mephitsu, MaxBlizz, ScreenRant and "
    "FlickeringMyth. (Note: one line of Mephitsu's panel prose says '14th of November'; the "
    "official press block on the same page says October 14, treated as a prose slip, the "
    "official date stands.)"
)
add_src(d, "ComicBook, Lord Doom cut concept design (Oct 11, 2026)",
        "https://comicbook.com/movies/news/avengers-figure-reveals-lord-doom-doomsday-concept-design-that-was-cut-from-the-film/")

# YFNS: sale time + Carbonadium suit + accessory breakdown
y = items["yfns-spidey-rhino-2pack"]
y["details"] = (
    "NYCC 2026 reveal: animated-style cell-shaded Spider-Man (masked + unmasked Peter Parker "
    "heads, 4 alt hands, pair of glasses, web line, web-splat effect that attaches to his wrist "
    "or Rhino's face) vs. Rhino in his Carbonadium suit (alt head, 2 alt hands). Inspired by "
    "Season 2. 11 accessories. Pulse exclusive, on sale Nov 1, 2026 at 1 PM EDT (MarvelousNews). "
    "Oct 12 re-check: the Nov 1 Pulse-exclusive sale still stands; no pre-order window and no "
    "announced price."
)
add_src(y, "MarvelousNews, YFNS 2-pack: Nov 1, 1 PM EDT (Oct 2026)",
        "https://marvelousnews.com/252-39296")

# Astonishing 2-pack: re-confirm price unannounced
a = items["astonishing-cyclops-wolverine-2pack"]
a["details"] = (
    "NYCC 2026 reissue: Cyclops (2 alt hands, alt head) + Wolverine (4 alt hands, alt masked "
    "head), from the Astonishing X-Men comics. 8 accessories. Oct 12 re-check: the Oct 28 "
    "window stands (1 PM ET, Pulse + participating retailers, Fall 2026); price still "
    "unannounced (Mephitsu, single source)."
)

# Cypher Target: pre-orders live, $27.99, Oct 2026 (BleedingCool, single source)
c = items["cypher-target"]
c["details"] = (
    "The first-ever Cypher figure, via Target's 2026 Geek-Out event: classic New Mutants "
    "black-and-yellow outfit, retro-inspired X-Men card-back packaging, alt hands + signature "
    "sword. Pre-orders reported live at Target, $27.99, expected October 2026 (BleedingCool, "
    "single source)."
)
c["price"] = 27.99
c["releaseWindow"] = "October 2026"
add_src(c, "BleedingCool, Target-exclusive Cypher (Sep 2026, single source)",
        "https://bleedingcool.com/collectibles/exclusive-marvel-legends-x-men-cypher-figure-revealed-by-hasbro/")

# NEW: Super-Skrull Fan Channel reissue (wave-30 research integration)
items["super-skrull-reissue"] = {
    "id": "super-skrull-reissue",
    "name": "Super-Skrull (Fan Channel reissue)",
    "status": "preorder",
    "preorderDate": None,
    "releaseWindow": "Oct–Nov 2026",
    "price": None,
    "query": "Marvel Legends Super-Skrull reissue Fan Channel",
    "venue": "Fan Channel pre-orders live → Oct–Nov 2026",
    "retailers": [],
    "details": (
        "Reissue of the previously-exclusive Super-Skrull (ToyHypeUSA, Sep 24, 2026): "
        "priced at $46.99–$47.99 across retailers (EE $46.99, BBTS $47.99), expected to ship "
        "October–November 2026; pre-orders live at BigBadToyStore, Entertainment Earth, Amazon, "
        "GameStop and Zavvi. Another availability-based premium under the reissue radar."
    ),
    "sources": [
        {"label": "ToyHypeUSA, Super-Skrull reissue pre-orders (Sep 24, 2026)",
         "url": "https://toyhypeusa.com/2026/09/24/hasbro-marvel-legends-series-fantastic-four-super-skrull-figure-pre-orders/"}
    ],
}

data["items"] = list(items.values())
p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
print("preorders items:", len(data["items"]))

# ---------------- price-signals.json ----------------
s = ROOT / "data" / "price-signals.json"
sig = json.loads(s.read_text())
by_id = {x["id"]: x for x in sig["signals"]}

w = by_id["white-epic-heroes-doom"]
w["asOf"] = "2026-10-12"
w["note"] = ("Most recent reported sold $200.00 (Aug 10, 2026), top of the band. Earlier 2026 "
             "solds: Mar 12 $150, May 3 $149. Oct 12, 2026 re-check: still no new solds, "
             "the band stands. One tracker, not a valuation.")

g = by_id["green-epic-heroes-doom"]
g["asOf"] = "2026-10-12"
g["note"] = ("$62.44 avg over 48 tracked sales (Legendsverse). Recent solds: Sep 6, 2026 $49.49, "
             "Aug 27 $40.00, Jul 29 $74.87, inside the $40–$75 band. Oct 12, 2026 re-check: "
             "the band stands. One tracker, not a valuation.")

sig["signals"].append({
    "id": "doomsday-gambit",
    "figId": "hasbro-2026-doomsday-1::Gambit",
    "label": "Doomsday Wave 1 Gambit",
    "kind": "sold-band",
    "low": 25.99,
    "high": 79.99,
    "display": "$25.99–$79.99",
    "asOf": "2026-10-12",
    "source": "actionfigure411 eBay sold tracker",
    "sourceUrl": "https://www.actionfigure411.com/marvel/marvel-legends-avengers-doomsday-gambit-14107.php",
    "note": ("Launch-curve documented: sold $79.99 on Sep 24, 2026 (sellout window) → $25.99 "
             "presale on Oct 9, 2026; tracker-reported average $49.32. Premium collapsed toward "
             "the $27.99 MSRP inside six weeks. One tracker, not a valuation."),
})
sig["signals"].append({
    "id": "doomsday-cyclops",
    "figId": "hasbro-2026-doomsday-1::Cyclops",
    "label": "Doomsday Wave 1 Cyclops",
    "kind": "sold-band",
    "low": 34.99,
    "high": 64.99,
    "display": "$34.99–$64.99",
    "asOf": "2026-10-12",
    "source": "actionfigure411 eBay sold tracker",
    "sourceUrl": "https://www.actionfigure411.com/marvel/marvel-legends-avengers-doomsday-cyclops-14108.php",
    "note": ("Launch-curve documented: sold $64.99 on Sep 25, 2026 (sellout window) → "
             "$40.99–$52.99 Oct 3–4, 2026; early-September presale $34.99. Premium deflating "
             "toward retail. One tracker, not a valuation."),
})
sig["signals"].append({
    "id": "retro-ben-reilly-stockx",
    "figId": "hasbro-2022-exclusives::Spider-Man (Ben Reilly)",
    "label": "Retro Spider-Man Ben Reilly (2022)",
    "kind": "sold-band",
    "low": 35.0,
    "high": 35.0,
    "display": "$35 last sale",
    "asOf": "2026-10-12",
    "source": "StockX last-sale record",
    "sourceUrl": "https://stockx.com/hasbro-marvel-legends-retro-spider-man-ben-reilly-spider-man-action-figure",
    "note": ("StockX verified last-sale record (release 04/01/2022, retail $23): $35. Single "
             "transaction record, not a band, observed Oct 2026 via research mission."),
})
sig["observed"] = "2026-10-12"
s.write_text(json.dumps(sig, ensure_ascii=False) + "\n")
print("signals:", len(sig["signals"]))
