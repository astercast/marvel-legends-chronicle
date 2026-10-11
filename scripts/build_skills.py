#!/usr/bin/env python3
"""Generate the skills/ library for the Marvel Legends Chronicle.

Usage: python3 scripts/build_skills.py
Reads data/*.json, writes skills/<category>/<id>.md + skills/index.json.

Every skill is task-oriented (inputs, procedure, worked example, data refs,
pitfalls) — generated from the Chronicle's own verified data, never invented.
"""
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "skills"
VERSION = "1.0.0"


def load(name):
    return json.loads((DATA / name).read_text())


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def render(skill):
    lines = ["---", f"name: {skill['id']}", f"description: {skill['desc']}",
             "---", "", f"# {skill['title']}", "", "## Use when", "",
             skill["use"], "", "## Inputs", ""]
    lines += [f"- {i}" for i in skill["inputs"]]
    lines += ["", "## Procedure", ""]
    lines += [f"{n}. {step}" for n, step in enumerate(skill["steps"], 1)]
    lines += ["", "## Worked example", "", skill["example"], ""]
    ref_heading = "API references" if skill.get("cat") == "agents" else "Data references"
    if skill.get("refs"):
        lines += [f"## {ref_heading}", ""]
        lines += [f"- `{a}`" for a in skill["refs"]]
        lines += [""]
    if skill.get("pitfalls"):
        lines += ["## Pitfalls", ""]
        lines += [f"- {p}" for p in skill["pitfalls"]]
        lines += [""]
    return "\n".join(lines)


def base_name(n):
    return re.sub(r"\s*\(.*?\)\s*", "", n).strip()


# ------------------------------------------------------------ data-driven

def baf_skills(figures):
    out = []
    for w in figures["waves"]:
        baf = w.get("baf")
        if not baf:
            continue
        pieces = defaultdict(set)
        for f in w["figures"]:
            if f.get("bafPiece"):
                pieces[f["name"]].add(f["bafPiece"])
        if not pieces:
            continue
        checklist = "\n".join(
            f"  - [ ] {fig} → {', '.join(sorted(pcs))}" for fig, pcs in sorted(pieces.items()))
        n_figs = len(pieces)
        out.append({
            "id": f"baf-{slug(baf)}",
            "cat": "baf",
            "title": f"Complete the {baf} Build-A-Figure",
            "desc": f"Complete the {baf} BAF: which {w['year']} figures carry which pieces.",
            "use": f"You want to build the {baf} BAF from the {w['year']} {w.get('series', '')} wave. "
                   f"{n_figs} figures carry pieces.",
            "inputs": ["Your current figure inventory", "The BAF piece you still need"],
            "steps": [
                f"The BAF: **{baf}** ({w['year']}, {w.get('series', 'assortment')}).",
                "Checklist — buy the figure, keep the piece:\n" + checklist,
                "Prioritize: figures you want anyway first, then cheapest piece-carriers.",
                "Verify each piece against the BAF's assembly (some waves split one piece across variants).",
                "Keep boxes until the BAF is complete — piece claims need proof.",
            ],
            "example": f"Missing the {baf} torso? Find which figure above carries it, "
                       f"check sold listings for the cheapest loose complete figure.",
            "refs": ["data/figures.json"],
            "pitfalls": [
                "Buying a figure for the piece, then discovering the variant doesn't include it — check bafPiece notes.",
                "Bootleg BAF pieces don't fit right — authenticate the figures first.",
            ],
        })
    return out


def character_skills(figures):
    counts = Counter()
    by_char = defaultdict(list)
    for w in figures["waves"]:
        for f in w["figures"]:
            b = base_name(f["name"])
            counts[b] += 1
            by_char[b].append((w["year"], w.get("series", ""), f["name"],
                               f.get("variant"), f.get("exclusive")))
    out = []
    for char, n in counts.most_common():
        if n < 8:
            break
        rows = sorted(by_char[char], key=lambda r: r[0])
        listing = "\n".join(
            f"  - {y} — {series}: {name}"
            + (f" [{variant}]" if variant else "")
            + (f" ({excl})" if excl else "")
            for y, series, name, variant, excl in rows[:14])
        more = f"\n  - …and {len(rows) - 14} more" if len(rows) > 14 else ""
        out.append({
            "id": f"collect-{slug(char)}",
            "cat": "characters",
            "title": f"Collect every {char}",
            "desc": f"Complete a {char} collection: all {n} Marvel Legends releases, chronological.",
            "use": f"You collect {char}. {n} releases are catalogued from {rows[0][0]} to {rows[-1][0]}.",
            "inputs": ["Your current holdings", "Budget tier (loose / boxed / graded)"],
            "steps": [
                "Work the list chronologically — oldest first, they appreciate fastest:",
                listing + more,
                "Mark owned/wanted in the Chronicle tracker as you go.",
                "Toy Biz-era releases: authenticate hard (bootlegs concentrate here).",
                "Exclusives and variants: decide your completion rule NOW (all variants? one per sculpt?).",
            ],
            "example": f"Starting a {char} run? Grab the most recent mainline release first (cheapest, in-stock), "
                       f"then hunt backwards by price.",
            "refs": ["data/figures.json"],
            "pitfalls": [
                "No completion rule = endless spending. Define 'complete' before you start.",
                "Variant rabbit holes — some characters have 5+ releases of one sculpt.",
            ],
        })
    return out


def grail_skills(ency):
    out = []
    for g in ency["hallOfFame"]:
        ver = "verified price data" if g.get("verified") else "UNVERIFIED — treat as collector lore, not market data"
        price = g.get("price") or g.get("priceNote") or "no price recorded"
        out.append({
            "id": f"grail-{slug(g['name'])}",
            "cat": "grails",
            "title": f"Research the {g['name']} grail",
            "desc": f"Why the {g['name']} matters, its price evidence, and how to verify one.",
            "use": f"You're considering buying, selling, or hunting the {g['name']} ({g.get('era', 'unknown era')}).",
            "inputs": ["The listing or lead", "Your authentication checklist"],
            "steps": [
                f"Why it matters: {g.get('why', 'Hall of Fame entry.')}",
                f"Price evidence: {price} ({ver}).",
                "Authenticate before negotiating — grails attract the best bootlegs.",
                "Compare against 90 days of eBay SOLD listings, not asking prices.",
                "For boxed grails: grade the card (see the card-grading skill) before paying a premium.",
            ],
            "example": f"Listing claims a {g['name']}: run the bootleg checklist, "
                       f"pull 90-day solds, then negotiate from data, not excitement.",
            "refs": ["data/encyclopedia.json"],
            "pitfalls": [
                "Paying asking-price logic on a grail — solds are the market, asks are wishes.",
                "Skipping authentication because 'the seller seems nice.'",
            ],
        })
    return out


def bootleg_skills(ency):
    out = []
    for s in ency["bootlegGuide"]["sections"]:
        items = "\n".join(f"  - [ ] {it}" for it in s["items"][:8])
        out.append({
            "id": f"bootleg-{s['id']}",
            "cat": "bootleg",
            "title": f"Spot bootlegs: {s['id'].replace('-', ' ')}",
            "desc": f"Authenticate a figure via {s['id'].replace('-', ' ')}: the guide's red flags as a checklist.",
            "use": "Authenticating a figure or listing — run all six bootleg skills, not just one.",
            "inputs": ["Clear photos (or the figure in hand)"],
            "steps": [
                "Work the checklist — one fail doesn't convict, two corroborating fails do:",
                items,
                "Cross-check with the listing/price-logic skill — bootlegs cluster at impossible prices.",
            ],
            "example": "Blurry card printing + wrong plastic sheen = walk away, no matter the price.",
            "refs": ["data/encyclopedia.json"],
            "pitfalls": ["Authenticating from one blurry photo — demand clear shots or pass."],
        })
    out.append({
        "id": "bootleg-authenticate-listing",
        "cat": "bootleg",
        "title": "Authenticate a listing end-to-end",
        "desc": "The full authentication pass: figure, packaging, seller, and price logic.",
        "use": "Before buying any figure above impulse-buy price.",
        "inputs": ["Listing URL or photos", "Seller profile"],
        "steps": [
            "Run all six bootleg checklists (packaging, paint, joints, targets, listings, price-logic).",
            "Check the seller: feedback history, other listings, stock-photo vs real-photo.",
            "Price logic: if it's 40%+ under 90-day solds, assume bootleg until proven otherwise.",
            "For grails: demand provenance — where did they get it, when, any receipts.",
            "When in doubt, pass. Another listing always comes.",
        ],
        "example": "A $40 'SDCC exclusive' with stock photos and 3 feedback: three fails — pass.",
        "refs": ["data/encyclopedia.json"],
        "pitfalls": ["FOMO buying — scarcity pressure is the bootlegger's best tool."],
    })
    return out


# ------------------------------------------------------------- hand-authored

HAND = [
 # --- eras (5)
 dict(id="era-toy-biz", cat="eras", title="Collect the Toy Biz era (2002–2006)",
      desc="Navigate the founding era: grails, bootlegs, and what holds value.",
      use="Collecting or evaluating 2002–2006 Toy Biz releases.",
      inputs=["Era knowledge: 6-inch scale launch, BAF innovation, legendary sculpts"],
      steps=["Start with the Hall of Fame Toy Biz entries — they define the era's value.",
             "Authenticate everything: bootleg density is highest here.",
             "Condition is king — card condition drives Toy Biz premiums.",
             "Key lines: Series 1–9, Face-Off, X-Men Classics, Marvel Select crossovers."],
      example="A Series 1 Toad: verify the initial-assortment markers before paying grail money.",
      refs=["data/encyclopedia.json", "data/figures.json"],
      pitfalls=["Loose Toy Biz at boxed prices — loose is common, boxed is the premium."]),
 dict(id="era-transition", cat="eras", title="Collect the Transition years (2007–2009)",
      desc="The Hasbro takeover era: what changed and what to hunt.",
      use="Understanding 2007–2009 releases and their quirks.",
      inputs=["Knowledge of the license handoff"],
      steps=["Learn the handoff story — it explains packaging and distribution quirks.",
             "Watch for short-packed waves; some transition figures are sleeper grails.",
             "Cross-reference waves by year in the Chronicle timeline."],
      example="Transition-era short-packs often out-appreciate their Hasbro successors.",
      refs=["data/encyclopedia.json", "data/figures.json"],
      pitfalls=["Assuming Hasbro-era pricing logic applies — transition supply was chaotic."]),
 dict(id="era-hasbro-return", cat="eras", title="Collect the Hasbro Return era (2010–2015)",
      desc="The modern line takes shape: BAF standardization and the collector boom.",
      use="Collecting 2010–2015 Hasbro releases.",
      inputs=["Your focus: characters, BAFs, or completism"],
      steps=["BAF waves become the collecting unit — use the BAF completion skills.",
             "Track the annual SDCC exclusives; they anchor the era's value.",
             "Infinite Series branding: learn the wave-numbering to spot gaps."],
      example="Completing the 2013 wave set? The BAF skills list every piece-carrier.",
      refs=["data/figures.json"],
      pitfalls=["Chasing every variant — the Return era varianted aggressively."]),
 dict(id="era-infinite", cat="eras", title="Collect the Infinite era (2016–2021)",
      desc="Peak modern Legends: deep cuts, army builders, and the MCU wave machine.",
      use="Collecting 2016–2021 releases.",
      inputs=["Your lane: comic, MCU, or X-Men"],
      steps=["Deep-cut characters debuted here — check character guides for first-appearance figures.",
             "MCU waves: buy on release; they saturate then climb.",
             "Army builders: decide your troop count before the aftermarket does it for you."],
      example="First-appearance deep cuts from this era are the next decade's grails.",
      refs=["data/figures.json"],
      pitfalls=["MCU wave FOMO — most restock; patience beats panic."]),
 dict(id="era-haslab", cat="eras", title="Understand the HasLab era (2020+)",
      desc="Crowdfunded flagships: how HasLab changed high-end collecting.",
      use="Evaluating HasLab projects and their aftermarket.",
      inputs=["The HasLab project list", "Backer counts"],
      steps=["HasLab = limited by backers, not by retail — scarcity is real.",
             "Aftermarket peaks 6–12 months post-delivery, then settles.",
             "Never back what you can't afford to keep — flipping HasLab is a gamble."],
      example="Galactus: backer-count scarcity drove a 2× aftermarket before settling.",
      refs=["data/encyclopedia.json"],
      pitfalls=["Backing for flip profit — the settle hurts."]),
 # --- collection (5)
 dict(id="collection-mark-owned", cat="collection", title="Track your collection",
      desc="Use the Chronicle's owned/wanted tracker properly.",
      use="Keeping a real inventory instead of a mental one.",
      inputs=["Your figures, loose and boxed"],
      steps=["Mark owned per figure — the tracker lives in your browser (localStorage).",
             "Mark wanted for hunt-list figures; review the list monthly.",
             "Export or screenshot quarterly — browsers get wiped."],
      example="Sunday audit: 10 minutes marking the week's pickups, wanted list reprioritized.",
      refs=[],
      pitfalls=["No backup — localStorage is not a cloud."]),
 dict(id="collection-want-list", cat="collection", title="Build a want list that works",
      desc="A prioritized hunt list with price targets.",
      use="Turning 'I want everything' into an actionable plan.",
      inputs=["Your focus characters or eras"],
      steps=["List wants with a max price each — a want without a price is a wish.",
             "Rank by: grail risk (buy appreciating assets first) vs availability.",
             "Review monthly; kill wants you've outgrown."],
      example="Want: Sentinel BAF — max $180 — priority 1 (appreciating, complete the wave).",
      refs=["data/figures.json"],
      pitfalls=["An infinite want list — cap it at 20, finish it, then add more."]),
 dict(id="collection-value-collection", cat="collection", title="Value your collection",
      desc="Estimate collection value from sold listings, not asking prices.",
      use="Insurance, selling, or just knowing.",
      inputs=["Your owned list"],
      steps=["Price each figure from 90-day eBay SOLD listings in matching condition.",
             "Loose complete vs boxed vs graded — match the condition tier exactly.",
             "Sum, then haircut 15% — that's the realizable number.",
             "Revisit annually; the market moves."],
      example="40 figures × average $35 sold = $1,400 gross → ~$1,190 realizable.",
      refs=["data/figures.json"],
      pitfalls=["Valuing at asking prices — that's fantasy accounting."]),
 dict(id="collection-shelf-organize", cat="collection", title="Organize your display",
      desc="Shelving that shows the collection instead of storing it.",
      use="Setting up or redoing a display.",
      inputs=["Shelf space", "Your display goal (era, character, scene)"],
      steps=["Group by story: waves, teams, or sagas — not by purchase order.",
             "BAFs get center placement; they're the anchors.",
             "Leave 20% empty — a full shelf can't grow.",
             "Dust monthly; sun kills cards and paint."],
      example="X-Men shelf: Jim Lee team in the center, villains flanking, Sentinel BAF behind.",
      refs=[],
      pitfalls=["Direct sunlight — the silent collection killer."]),
 dict(id="collection-photograph", cat="collection", title="Photograph your figures",
      desc="Shelfie-grade photos with a phone.",
      use="Community posts, sale listings, insurance records.",
      inputs=["Phone", "One lamp", "Neutral background"],
      steps=["One key light at 45°, neutral background (poster board works).",
             "Eye-level with the figure — never shoot down at toys.",
             "For sales: front, back, joints, flaws — honest photos sell faster.",
             "For shelfies: depth — stagger figures, blur the background."],
      example="Sale listing: 6 photos (front/back/left/right/joints/flaw close-up) — sells in days, not weeks.",
      refs=[],
      pitfalls=["Flash on-camera — flattens everything and blows out paint."]),
 # --- marketplace (3)
 dict(id="marketplace-build-search", cat="marketplace", title="Build a marketplace search query",
      desc="Search strings that find the figure and dodge the bootlegs.",
      use="Hunting a specific figure on eBay/Mercari/Whatnot.",
      inputs=["Figure name", "Wave/year", "Variant details"],
      steps=["Start: `\"Marvel Legends\" + character + wave keyword (e.g. \"Retro Spider-Man\")`.",
             "Add exclusions: `-bootleg -custom -\"not marvel legends\"` as needed.",
             "For BAF pieces: search the piece + BAF name (`\"Giant Man\" \"left leg\" BAF piece`).",
             "Save the search with alerts — grails surface at odd hours."],
      example="Query: Marvel Legends Moon Knight Fist of Khonshu -custom -bootleg",
      refs=["data/figures.json"],
      pitfalls=["Generic searches — 'marvel legends spider-man' returns 10,000 results."]),
 dict(id="marketplace-price-check", cat="marketplace", title="Price-check via sold listings",
      desc="The 90-day sold method: the only price that matters.",
      use="Before buying or selling anything.",
      inputs=["Figure + condition tier"],
      steps=["eBay → advanced search → SOLD listings, last 90 days.",
             "Filter to your condition tier and match it exactly — loose complete / boxed / graded. A loose sold tells you nothing about a boxed price.",
             "Take the median of the last 10–15 solds, drop outliers.",
             "Asking prices are irrelevant — only solds count.",
             "hobbyDB is a catalog cross-check, NOT a price source — its 'Estimated Value' is member-curated and many entries show 'Help Wanted' (no value yet); it is not transaction-derived.",
             "StockX covers some Legends with verified 'last sale' data (e.g. Retro Ben Reilly Spider-Man: release 04/01/2022, retail $23, last sale $35, observed Oct 2026) — useful where covered, but toy coverage is thin.",
             "No PriceCharting equivalent exists for action figures (no transaction-aggregating guide found as of 2026-10-11) — don't hunt for one; the 90-day sold method IS the aggregator."],
      example="Retro Spider-Man boxed: 12 solds, median $28 — that's the price, not the $60 ask.",
      refs=["data/encyclopedia.json"],
      pitfalls=["One high sold = the market. Medians, not peaks.",
                "Mixing condition tiers — match loose/boxed/graded exactly."]),
 dict(id="marketplace-compare-retailers", cat="marketplace", title="Compare retailers",
      desc="Where to buy: retail vs aftermarket vs community.",
      use="Deciding where to hunt.",
      inputs=["Figure", "Urgency"],
      steps=["New releases: retail first (Hasbro Pulse, BBTS, EE) — aftermarket is for misses.",
             "Aftermarket: eBay (selection), Mercari (deals), Whatnot (live, risky).",
             "Community: r/MarvelLegends and Facebook groups — best prices, slowest.",
             "Factor shipping: a $5 deal with $12 shipping is a $17 figure."],
      example="Missed a wave? BBTS pile-of-loot first, then eBay solds for the gap figures.",
      refs=[],
      pitfalls=["Whatnot hype bidding — set your max before the stream starts."]),
 # --- community (4)
 dict(id="community-write-post", cat="community", title="Write a community post",
      desc="Posts that get engagement in the Chronicle's fan community.",
      use="Sharing pickups, shelfies, and hot takes.",
      inputs=["Your photos", "The story behind the figure"],
      steps=["Lead with the photo — cropped, lit, eye-level.",
             "One hook line, then the story: why THIS figure.",
             "Tag the figure so it links to its Chronicle entry.",
             "Ask one question — posts with questions get 3× the replies."],
      example="'Finally completed the Sentinel BAF — which piece took you longest?' + build photo.",
      refs=[],
      pitfalls=["Photo-dump with no words — the algorithm and the humans both skip it."]),
 dict(id="community-tag-figures", cat="community", title="Tag figures in posts",
      desc="Link your posts to Chronicle figure entries.",
      use="Every figure-related post.",
      inputs=["Figure name"],
      steps=["Tag the exact figure — tags link to the entry with wave, year, and price context.",
             "Tag the BAF too when showing a completed build.",
             "Hashtags for discovery: #marvellegends + character tag."],
      example="Post tags: [Retro Spider-Man] #marvellegends #spiderman",
      refs=["data/figures.json"],
      pitfalls=["Wrong-variant tags — check the entry before tagging."]),
 dict(id="community-id-figure", cat="community", title="Identify an unknown figure",
      desc="ID a figure from photos or a description.",
      use="Mystery figures, lot finds, childhood toys.",
      inputs=["Photos (front/back/accessories) or a detailed description"],
      steps=["Note: costume details, accessories, articulation, base/stand, copyright stamps.",
             "Search the Chronicle by character, then filter by year.",
             "Copyright stamp year + sculpt style narrows it to a wave.",
             "Ask the community with the details you gathered — ID posts get fast answers."],
      example="'Blue suit, lightning hands, 2003 stamp' → search Thor → 2003 wave identified in minutes.",
      refs=["data/figures.json"],
      pitfalls=["'It's Spider-Man, which one?' — details or it didn't happen."]),
 dict(id="community-find-collectors", cat="community", title="Find your collector people",
      desc="Discover collectors who share your lane.",
      use="Building your community circle.",
      inputs=["Your collecting lane"],
      steps=["Search hashtags for your lane (#xmenlegends, #spideyshelf).",
             "Follow 10, engage genuinely for two weeks — comments, not just likes.",
             "Trade with established members before strangers."],
      example="X-Men collector: #xmenlegends → 10 follows → first trade in week three.",
      refs=[],
      pitfalls=["DMing 'sell me that' as a first message — engage first."]),
 # --- variants (2)
 dict(id="variants-chase-hunting", cat="variants", title="Hunt chase variants",
      desc="Find short-packed chase figures without overpaying.",
      use="Chasing 1-per-case variants.",
      inputs=["The chase figure", "Case ratios"],
      steps=["Learn the case ratio — it sets the fair price ceiling.",
             "Check retail first: chases surface in restocks.",
             "Aftermarket: pay the ratio premium, not the hype premium.",
             "Decide: chase or standard? Most collectors are happy with the standard."],
      example="1-per-case chase at $25 retail → fair aftermarket $40–60, not $150.",
      refs=["data/figures.json"],
      pitfalls=["Launch-week panic buying — chases settle after 60 days."]),
 dict(id="variants-identify", cat="variants", title="Identify variants",
      desc="Tell variants apart: deco, sculpt, and packaging differences.",
      use="Buying, selling, or cataloguing variants.",
      inputs=["The figure in question"],
      steps=["Check the Chronicle entry's variant notes first.",
             "Deco vs sculpt: repaints are common, resculpts are the valuable ones.",
             "Packaging variants: same figure, different card — decide if you care.",
             "Photograph the differences for your records."],
      example="Two Wolverines, different belt paint — deco variant, note it, move on.",
      refs=["data/figures.json"],
      pitfalls=["Paying resculpt money for a repaint."]),
 # --- hunts (10)
 dict(id="hunt-sdcc-exclusives", cat="hunts", title="Hunt SDCC exclusives",
      desc="Get Comic-Con exclusives without attending.",
      use="Every July.",
      inputs=["The year's exclusive list", "Your max prices"],
      steps=["Hasbro Pulse usually gets shared stock — watch the drop time.",
             "Aftermarket day-one is peak hype; prices dip in September.",
             "Authenticate: exclusives are bootleg magnets (see bootleg skills)."],
      example="SDCC exclusive at $60 retail → $120 day-one aftermarket → $80 by October.",
      refs=[],
      pitfalls=["Day-one aftermarket — patience saves 40%."]),
 dict(id="hunt-store-exclusives", cat="hunts", title="Hunt store exclusives",
      desc="Target/Walmart/Amazon exclusives: stock patterns and timing.",
      use="Chasing retailer exclusives.",
      inputs=["The exclusive", "Retailer restock patterns"],
      steps=["Learn the retailer's restock rhythm (Target: Tuesday mornings, etc.).",
             "Brickseek-style stock checkers for in-store hunts.",
             "Online: set alerts; exclusives sell out in waves, not once."],
      example="Target exclusive restocked three times in a month — the patient got it at retail.",
      refs=[],
      pitfalls=["Paying scalper prices during wave one — waves two and three exist."]),
 dict(id="hunt-toy-biz-grails", cat="hunts", title="Hunt Toy Biz grails",
      desc="Find 2002–2006 grails in the wild.",
      use="Vintage hunting.",
      inputs=["Your grail list with max prices"],
      steps=["Flea markets, estate sales, and lots — grails hide in collections, not listings.",
             "Learn the era's packaging at a glance (see the Toy Biz era skill).",
             "Authenticate on the spot — bring the bootleg checklists.",
             "Negotiate from sold data, loaded on your phone."],
      example="Flea-market Series 2 lot: $30 for five figures including a $50 grail — knowledge paid.",
      refs=["data/encyclopedia.json"],
      pitfalls=["'Vintage' pricing on common Toy Biz — most are $10–15 loose."]),
 dict(id="hunt-chase-variants", cat="hunts", title="Hunt chase variants in the wild",
      desc="Retail hunting tactics for short-packed figures.",
      use="Active retail hunts.",
      inputs=["Case ratios", "Store stock patterns"],
      steps=["See variants-chase-hunting for pricing; this is the field tactics.",
             "Feel the weight? No — check the assortment code on the box.",
             "Befriend stock staff; ask about truck days.",
             "Don't be the person who tears cases open in the aisle."],
      example="Assortment code check found the chase without opening a single box.",
      refs=[],
      pitfalls=["Scalper behavior — the community remembers."]),
 dict(id="hunt-convention-exclusives", cat="hunts", title="Hunt convention exclusives",
      desc="Beyond SDCC: NYCC, PulseCon, and international exclusives.",
      use="Convention season.",
      inputs=["Convention calendar"],
      steps=["List every convention exclusive at the start of the season.",
             "PulseCon is the accessible one — no travel needed.",
             "International exclusives: proxy services or community trades."],
      example="PulseCon exclusive ordered from the couch — zero travel, retail price.",
      refs=[],
      pitfalls=["Forgetting PulseCon — it's the easiest exclusive of the year."]),
 dict(id="hunt-complete-wave", cat="hunts", title="Complete a wave",
      desc="Finish a wave efficiently: BAF math and gap-filling.",
      use="Wave completion projects.",
      inputs=["The wave", "Your owned list"],
      steps=["Use the wave's BAF skill — it lists every piece-carrier.",
             "Buy the BAF pieces first (they appreciate); fill commons last (they don't).",
             "Lots > singles for commons — wave lots surface constantly.",
             "Track in the Chronicle as you go."],
      example="Wave at 5/8: BAF pieces first ($90), commons as a lot ($40) — done under budget.",
      refs=["data/figures.json"],
      pitfalls=["Buying commons first — they're always available, BAF pieces aren't."]),
 dict(id="hunt-track-preorders", cat="hunts", title="Track preorders",
      desc="Never miss a release: the preorder system.",
      use="Ongoing.",
      inputs=["Your want list"],
      steps=["Preorder day-one at BBTS/EE/Pulse — no deposit, cancel anytime.",
             "Pile-of-loot (BBTS) batches shipping — saves a fortune.",
             "Set calendar alerts for known drop windows.",
             "Review preorders quarterly — kill what you've outgrown."],
      example="12 preorders in one pile-of-loot shipment: $18 shipping total vs $90 separate.",
      refs=[],
      pitfalls=["Preordering everything — the pile becomes a bill."]),
 dict(id="hunt-buy-ebay-safely", cat="hunts", title="Buy safely on eBay",
      desc="eBay tactics: filters, offers, and seller reads.",
      use="Every eBay purchase.",
      inputs=["Your target + max price from sold data"],
      steps=["Filter: sold listings for price, then active with 'Buy It Now + Best Offer'.",
             "Offer 15–20% under ask on stale listings (30+ days).",
             "Read the seller: feedback, other listings, photo originality.",
             "Run the authenticate-a-listing skill on anything over $50."],
      example="Stale $80 listing → $65 offer accepted — sold data said $62.",
      refs=[],
      pitfalls=["Bidding wars — set your max from solds and walk away at it."]),
 dict(id="hunt-buy-whatnot", cat="hunts", title="Buy safely on Whatnot",
      desc="Live-auction tactics without the hype tax.",
      use="Whatnot streams.",
      inputs=["Your max per lot, set BEFORE the stream"],
      steps=["Set max bids before the stream — hype is the product.",
             "Watch two streams before bidding in one — learn the sellers.",
             "Factor shipping per order, not per item.",
             "Screenshot wins immediately — disputes need evidence."],
      example="Watched two streams, bid in the third, won a lot at 60% of eBay solds.",
      refs=[],
      pitfalls=["The room's energy — it's designed to make you overbid."]),
 dict(id="hunt-grade-card", cat="hunts", title="Grade card condition",
      desc="Assess carded figure condition like a grader.",
      use="Buying or selling carded figures.",
      inputs=["The carded figure, good light"],
      steps=["Corners: sharp? Blunt one corner = a full grade down.",
             "Edges: shelf wear along the bottom is the common flaw.",
             "Bubble: clear? Yellowed? Cracked? Lifting?",
             "Card: price stickers, bends, spine stress — photograph all of it.",
             "Grade honestly: C10 is a myth; most 'mint' is C8.",
             "Know the collector scale: C10 (mint — essentially theoretical) down to C1 (destroyed); most traded cards land C6–C8.5.",
             "Third-party grading: AFA now operates inside CGA (Roswell, GA; NY drop-off office opened Sept 2026) — 0–100 scale in 5s; sub-grades card (C) / bubble (B) / figure (F); 'Y' = yellowed bubble. Historic costs only: ~$16 standard / $28 express (old), ~$45+ with shipping (2008), up to ~$90–100 all-in for large items (2012) — verify current pricing before sending anything.",
             "CAS (Collector Archive Services) is the independent alternative — BBTS partnered with CAS in Nov 2025, selling CAS-graded items with UV-blocking acrylic and digital certificates.",
             "The no-premium caveat: NO Legends-specific graded-vs-ungraded sale premium has been documented. Grade for authentication, preservation, and buyer confidence — never pay to grade a $30 figure expecting a markup."],
      example="C8.5 assessment: one soft corner, clear bubble — priced as C8, sold fast.",
      refs=["data/encyclopedia.json"],
      pitfalls=["Calling everything mint — buyers distrust perfect grades on imperfect cards.",
                "Paying modern grading fees on a common figure — the math doesn't work."]),
 # --- round 2: packaging, chases, exclusives, grading, market (2026-10-11)
 dict(id="variants-packaging-era-id", cat="variants", title="Identify the packaging era",
      desc="Date a figure's packaging: clamshell, window box, windowless, or retro card.",
      use="Dating loose-card finds, spotting repacks, or authenticating Toy Biz-era figures.",
      inputs=["The packaging (photos or in hand)"],
      steps=["Clamshell + 32-page comic pack-in + display stand = Toy Biz, 2002–2006. International Toy Biz may carry a poster instead of a comic (UK/CA 'Gold Poster' variants exist).",
             "No comic pack-in, blister card = Hasbro takeover onward, 2007+.",
             "Scooped-side window box with blue highlight side art and wave checklist on back = Infinite Series relaunch, 2013/14 onward.",
             "Printed image instead of a window, comic-art box design = windowless/plastic-free era, 2022–2023. Retro line was exempt — a Retro card in this window is not an anomaly.",
             "Bio-PET/recycled-PET window = late 2023 onward.",
             "Toy Biz 90s-style cardback = Spider-Man: The Animated Series retro cards (2023) or the 20th Anniversary Fan Channel line (2022) — NOT original Toy Biz.",
             "Packaging-era mismatch with the figure's release year is a repack/bootleg red flag."],
      example="Clamshell with comic: Toy Biz era confirmed — run the Toy Biz authentication checks next.",
      refs=["data/encyclopedia.json"],
      pitfalls=["Retro cards are homages, not vintage — don't pay vintage prices for a 2023 retro card."]),
 dict(id="variants-chase-case-decode", cat="variants", title="Decode chase figures and case ratios",
      desc="Tell real chases from variants using assortment codes and case math.",
      use="Deciding whether a 'chase' premium is justified.",
      inputs=["The figure", "Its assortment/SKU code", "The wave's case mix if known"],
      steps=["Remember the rule: case ratios are set by the ASSORTMENT number on the shipping case, not the wave. One wave can span multiple assortments; 'revision cases' swap variants in/out mid-wave.",
             "A figure is a chase if it ships 1× per case while the rest ship 1–2×, or only in revision assortments. Modern standard case: 8 figures (e.g. 2× anchor figure + 1× each of 6 others).",
             "Check the 5-digit SKU code (G/F prefix recent, all-numeric older) — it must match the product number on the cardback. Older QA/batch codes appear on legs/feet.",
             "For Target exclusives, the Target DCPI locates stock via scanners and employee pulls.",
             "No official 'chase ratio' is published by Hasbro — every ratio is reverse-engineered from case mixes. Anyone quoting an official ratio is inventing it.",
             "Price ceiling: 1-per-case chase at $25 retail → fair aftermarket $40–60, not $150. Launch-week panic is the tax; chases settle after ~60 days."],
      example="Seller claims '1 of 500 chase': ask for the assortment code and case mix — if they can't produce it, price it as a variant, not a grail.",
      refs=["data/encyclopedia.json", "data/figures.json"],
      pitfalls=["Paying 'limited edition' premiums with no assortment evidence.",
                "Confusing a revision-case variant with a true chase — both are short, only one is rare."]),
 dict(id="hunt-exclusive-playbook", cat="hunts", title="Hunt store and convention exclusives",
      desc="The full exclusive map: SDCC, PulseCon, Target, Walmart, Walgreens, Amazon, Fan Channel.",
      use="Chasing any retailer or convention exclusive, current or vintage.",
      inputs=["The exclusive", "Your max price"],
      steps=["Know the venue's pattern. SDCC (booth-first, then Hasbro Pulse online): genuinely limited at the show, wider online — aftermarket spikes day-one, dips by September.",
             "PulseCon (Hasbro's virtual con, est. 2020) is the accessible exclusive — no travel, retail price, ships to US/Canada/UK.",
             "Target: Geek-Out/Geek Fest event drops; exclusives sell out in waves, not once — restocks happen. (2026: Target also cancelled confirmed preorders — order early AND have a backup.)",
             "Walmart: Collector Con events with livestreams; Ares and Nemesis BAF waves were Walmart-exclusive waves — check these before assuming a BAF is common.",
             "Walgreens: the Fantastic Four/Inhumans destination (Invisible Woman 2017, Human Torch, Mr. Fantastic, Thing, Namor, Medusa, Silver Surfer, Quasar, Binary, Sentry, Baron Zemo) — limited store quantities, also on walgreens.com.",
             "Amazon: Marvel vs. Capcom box sets (2025); Fan Channel (online specialty retailers): 20th Anniversary line, X-Force reissues.",
             "The 2020 rule: Pulse-era (2020+) exclusives are produced to meet demand and often return or get reissued; pre-2020 con exclusives generally were not — and carry the real premiums."],
      example="Missed a PulseCon drop? Wait for the Pulse restock wave before touching the aftermarket — most Pulse-era exclusives come back.",
      refs=["data/encyclopedia.json"],
      pitfalls=["Day-one aftermarket on a Pulse-era exclusive — patience saves 40%.",
                "Assuming 'exclusive' means limited — check whether it's a restocking program first."]),
 dict(id="marketplace-should-you-grade", cat="marketplace", title="Decide whether to grade a figure",
      desc="The should-you-grade decision: costs, turnaround, and the no-premium caveat.",
      use="Before sending any carded figure to AFA/CGA, CAS, or UKG.",
      inputs=["The figure", "Its honest card grade (C-scale)", "Its ungraded market value"],
      steps=["Grade the card honestly first (see the card-grading skill). C10 is a myth; most 'mint' is C8. Only C8.5+ candidates are worth the conversation.",
             "Know the vendors: AFA inside CGA (Roswell GA; NY drop-off since Sept 2026; 0–100 in 5s; C/B/F sub-grades); CAS (independent, anti-U-grade, BBTS partner since Nov 2025); UKG (UK-based). TGA is CLOSED — do not send there.",
             "Historic costs only (verify current before sending): ~$16 standard / $28 express (old), ~$45+ with shipping (2008), up to ~$90–100 all-in for large items (2012); CAS ~$100 all-in (2023–24 anecdote). Turnarounds historically 30–90+ days.",
             "The no-premium caveat: NO Legends-specific graded-vs-ungraded sale premium has been documented. Graded SW anecdotes run 1/3–2× ungraded AND below purchase price — both directions, both anecdotes.",
             "Decision rule: grade for authentication, preservation, or buyer confidence on a figure worth 5×+ the grading cost. Never grade a $30 figure expecting a markup — the math doesn't work."],
      example="$45 figure, C9 card, $60 grading cost: don't grade. $400 grail, C8.5, authentication doubt: grade for the buyer confidence.",
      refs=["data/encyclopedia.json"],
      pitfalls=["Grading for profit on a common figure — the premium is unproven and the fee is certain."]),
 dict(id="grails-reissue-radar", cat="grails", title="Run the reissue radar on a grail",
      desc="Availability-based vs rarity-based premiums: which grails survive a reissue.",
      use="Before paying a premium on any hall-of-fame-tier figure.",
      inputs=["The grail", "Its price evidence"],
      steps=["Ask the one question: is the premium driven by RARITY (short-pack, prototype, limited con run, crowdfund cap) or AVAILABILITY (Hasbro just hasn't remade it yet)?",
             "Rarity-based = resilient: unreleased prototypes (Crimson Dawn Psylocke), true Toy Biz chases, pre-2020 con exclusives, HasLab backer caps. Reissues can't touch these.",
             "Availability-based = vulnerable: demand-driven premiums on reissuable sculpts (Deadpool S6, Sentinel BAF with HasLab existing, SDCC 2012 X-Force — which got a Fan Channel reissue in 2026). A reissue announcement collapses asking prices within days.",
             "Check the Chronicle entry's reissue-radar flag, then verify yourself: has Hasbro reissued this sculpt/character recently? Is it in the current Retro program?",
             "Documented mechanism: sellout → aftermarket spike → reissue (VHS Animated Series exclusives → Retro cards at $27.99, Sept 2026). Spike numbers are rarely published — don't pay spike prices.",
             "Counter-proof: the 2018 Blue Wasp retro tribute was a 'middling seller, lingering on store shelves' — true rarity is immune to reissues."],
      example="Grails with resilient radar: pay the premium with confidence. Vulnerable radar: set your max at the reissue price + small premium, or wait.",
      refs=["data/encyclopedia.json"],
      pitfalls=["Paying a 2021-style premium in a 2026 reissue environment — check the Retro program first.",
                "Treating 'sold out' as 'rare' — sold out is a week, rare is forever."]),
 dict(id="bootleg-counterfeit-market", cat="bootleg", title="Understand the counterfeit market",
      desc="The KO economy: where bootlegs sell, what they cost, and who buys them knowingly.",
      use="Market awareness — complements the authentication checklists.",
      inputs=["None — read before hunting grails or deals"],
      steps=["Know the vectors: AliExpress is the primary direct-to-consumer KO source (listings like 'Maximum Series Spider-Man'); Shopee (SE Asia) lists KOs at near-real prices (₱2,491–₱2,677 for a 'Retro VENOM', observed Oct 2026) — the danger zone is KOs priced LIKE genuine, i.e. fraud, distinct from knowing KO purchase.",
             "Know the price bands: ~$10–16 KO vs $25–100+ genuine (reviewer anecdote). A $40 'SDCC exclusive' is not a deal, it's a tell.",
             "Know the quality spectrum (anecdotal): 'mixed bag' — brittle plastic (KO Black Cat leg snapped in hand); Chinese Deadpool KOs reportedly better. Never assume 'good enough'.",
             "Know the tells: neck ball peg differences, elbow/hand pegs, gaps at elbow/knee joints; KO Carnage has silver eyes (stillfigurineout.com comparisons).",
             "Know the demand drivers: custom fodder (cheap kitbash bodies), stand-ins for expensive grails, knowing buyers accepting lower quality. Not every KO sale is a scam — but every misrepresented one is.",
             "This is not new: MWCToys documented bootleg action-figure lines back in 2000. The modern shift is direct-to-consumer shipping from China."],
      example="Shopee listing at 90% of genuine price with stock photos: fraud-zone KO — run the full authentication wizard before even messaging the seller.",
      refs=["data/encyclopedia.json"],
      pitfalls=["'Too good to be true' is always true in the KO market.",
                "Assuming all KOs are junk — some are good enough to fool you, which is exactly the problem."]),
 # --- agents: agentic playbooks (6)
 dict(id="preorder-hunter", cat="agents", title="Hunt upcoming pre-orders (what's coming, when, where)",
      desc="Turn the pre-order tracker and radar into a timed hunt plan: what's dropping, exact dates, and retailer search links.",
      use="You want to know what's coming, when pre-orders open, and where to look — this month or next.",
      inputs=["A time window (e.g. this month, the next 60 days)", "Optional character or line focus"],
      steps=["Load `api/v1/preorders.json` — 15 researched upcoming releases (wave-12 research, observed 2026-10-11). Each item: `status` (`preorder`/`revealed`/`available`), `preorderDate` (exact YYYY-MM-DD when reported, `null` when unreported — never invented), `releaseWindow`, `price` (announced MSRP at reveal, never a market price), `retailers` (retailer search-pattern ids), `sources` (hobby-press links).",
             "Sort by status then date: exact-`preorderDate` items first ('pre-order opens in N days'), then `revealed` items by `releaseWindow`, then `available` items to buy now.",
             "Cross-check the radar (`radar.html`) for newly spotted items not yet in the tracker — radar cards are research notes; the tracker is the canonical schedule.",
             "For each target, use the item's `query` with the retailer search patterns to find listings — the archive links search pages, never product URLs, so links don't rot.",
             "Report what you know vs. don't: exact-date items are actionable, season-only items are watchlist material, `null` preorderDate means no date has been reported yet."],
      example="Asked 'what should I pre-order this month': Mini Comics Wave 3 (pre-order opened 2026-10-06, $27.99 MSRP) is available now via retailer search; the X-Men '97 retro wave pre-order opens 2026-10-21 — set the reminder; the Avengers: Doomsday wave (Fall 2026, revealed) goes on the watchlist.",
      refs=["api/v1/preorders.json"],
      pitfalls=["Treating `releaseWindow` as a pre-order date — only `preorderDate` is a real date; everything else is a watch.",
                "Quoting `price` as market value — it's the announced MSRP at reveal, not what the item is worth now."]),
 dict(id="market-brief-reader", cat="agents", title="Read the market briefing honestly (reported solds, never an index)",
      desc="Interpret the 2026 market briefing and price-trend data without turning reported listings into a market index.",
      use="You want the market's temperature: what's hot, what's cooling, and what the data actually supports.",
      inputs=["The claim you want to check (e.g. 'is X hot right now?')"],
      steps=["Load `api/v1/encyclopedia.json` → `priceMethod` for the methodology: the Chronicle works from reported eBay sold listings only. There is no price index here — every number is a reported transaction, never a market quote.",
             "Frame every price as reported or user-logged: 'reported eBay solds at $115–$200' — never 'the market says $157'. Give the range and the count of reports, never a single index number.",
             "Check the briefing's 2026 themes: (a) modern chases are effectively dead ('largely abandoned'); (b) the reissue program is cooling aftermarket premiums — availability-driven prices collapse on reissue; (c) grail resilience sorts by reissue radar: `resilient` (prototypes, true chases, pre-2020 con exclusives, crowdfund caps) vs `vulnerable` (availability-driven).",
             "Flag single-source claims: entries marked `verified: false` come from one or tabloid source — present them as lore, not data.",
             "When in doubt, say what would change your mind: which sold listings, which reissue announcement, which new data source."],
      example="Asked 'is white Dr. Doom hot?': Epic Heroes white Dr. Doom shows reported eBay solds of $115–$200 vs $60 retail (actionfigure411) — a hot *reported* band. But Epic Heroes figures get reissued, so frame it as a reported range with reissue risk, never 'worth $150'.",
      refs=["api/v1/encyclopedia.json"],
      pitfalls=["Averaging three solds into an index number — the archive's whole method forbids this.",
                "Quoting the $7.5K Wasp prototype ask as a sale — it's an asking price for an unproduced Toy Biz Series 15 blue/white Wasp chase prototype (~10 carded), not a transaction."]),
 dict(id="ko-spotter", cat="agents", title="Spot a likely bootleg (KO market intel + auth-wizard logic)",
      desc="Run the KO risk pass: market vectors, price logic, photo tells, and the authentication-wizard flow.",
      use="You have an eBay or marketplace listing lead and need a KO risk verdict before buying.",
      inputs=["Listing URL or photos", "Asking price", "Figure identity (wave, year)"],
      steps=["Load `api/v1/encyclopedia.json` → `bootlegGuide` for the six checklists (packaging, paint, joints, targets, listings, price-logic) — run all six, not just one.",
             "Apply the vectors: AliExpress is the primary direct-to-consumer KO source ('Maximum Series Spider-Man'-style listings); Shopee (SE Asia) lists KOs at near-genuine prices (₱2,491–₱2,677 for a 'Retro VENOM', observed Oct 2026) — the fraud zone is KOs priced LIKE genuine, distinct from knowing KO purchases.",
             "Apply price logic: ~$10–16 KO band vs $25–100+ genuine (reviewer anecdote). 40%+ under 90-day reported solds = assume bootleg until proven otherwise. A $40 'SDCC exclusive' is a tell, not a deal.",
             "Apply photo tells: stock photos vs real photos; neck ball-peg differences, elbow/hand pegs, joint gaps; documented tells like KO Carnage's silver eyes (stillfigurineout.com comparisons).",
             "For grails demand provenance: where from, when, any receipts. When in doubt, pass — another listing always comes."],
      example="A $45 'Retro Venom' listing with stock photos and a 3-feedback seller: price-logic fail + photo fail + seller fail — high KO risk; walk away or demand real photos first.",
      refs=["api/v1/encyclopedia.json"],
      pitfalls=["Trusting a near-retail KO price — Shopee fraud-zone listings price like genuine on purpose.",
                "FOMO buying — scarcity pressure is the bootlegger's best tool."]),
 dict(id="grail-evaluator", cat="agents", title="Evaluate a grail candidate (rarity signals, reissue radar)",
      desc="Assess whether a figure deserves grail money: hall-of-fame signals, variant/chase data, and what the archive does and doesn't know.",
      use="You found a high-ticket listing and need to know if the premium is real or reissue-vulnerable.",
      inputs=["Figure name + wave/year"],
      steps=["Look up the figure in `api/v1/figures.json` (stable id `<waveId>::<figureName>`) — confirm the exact release, `variant`/`exclusive` flags, and year. Never evaluate from a bare name.",
             "Check the hall of fame in `api/v1/encyclopedia.json` (23 entries) and the 20 grail stories for documented narratives — legend, hunt, and reissue saga. Quote `priceNote` + `verified`; `verified: false` = single-source, treat as lore.",
             "Read the `reissueRadar`: `resilient` premiums rest on true rarity (prototypes, true chases, pre-2020 con exclusives, crowdfund caps); `vulnerable` ones rest on availability and collapse when Hasbro reissues.",
             "Check the variant/chase data in the variants guide (chase/case ratios, exclusives taxonomy) — modern chases are effectively dead, so post-2020 'chase' premiums are suspect.",
             "State what the archive doesn't know: spike numbers are rarely published; price bands are reported solds, not quotes. End with a max-pay rule: resilient radar = pay the premium with confidence; vulnerable radar = cap at reissue price + a small premium, or wait."],
      example="Asked about the Toy Biz Series 15 blue/white Wasp chase prototype: ~10 carded, unproduced, $7.5K ask — resilient (prototype, true rarity), but the number is an asking price not a sale, and the entry is single-sourced → present as lore, not data.",
      refs=["api/v1/figures.json", "api/v1/encyclopedia.json"],
      pitfalls=["Treating 'sold out' as 'rare' — sold out is a week, rare is forever.",
                "Paying a 2021-style premium in a 2026 reissue environment — check the Retro program first."]),
 dict(id="baf-strategist", cat="agents", title="Plan Build-A-Figure completion from your owned state",
      desc="Turn a wave's piece checklist and your owned figures into a cheapest-first BAF completion plan.",
      use="You want to complete a Build-A-Figure and need the optimal buy order.",
      inputs=["Target BAF name + wave", "Your owned/wanted figures (from the site tracker)"],
      steps=["Find the BAF skill in `skills/index.json` (101 completion checklists, `baf-*`) — it lists every piece-carrying figure in the wave, built from `api/v1/figures.json` (`bafPiece` per figure).",
             "Subtract figures you already own: owned figure = owned piece. Missing pieces map to missing figures.",
             "Prioritize: figures you want anyway first, then the cheapest piece-carriers. Watch for variants that DON'T include the piece — check `bafPiece` notes before buying.",
             "Cross-check cost with BAF-economics logic: cost-to-complete from your own journal sold sightings; pieces with no logged sightings have no data, not zero cost.",
             "Verify each piece against the BAF's assembly (some waves split one piece across variants) and authenticate the figures first — bootleg BAF pieces don't fit right. Keep boxes until the build is complete."],
      example="Missing the Box BAF torso? The `baf-box` skill says Marrina Smallwood (2026 Box Wave) carries it — she is the cheapest-path figure to check sold listings for.",
      refs=["api/v1/figures.json", "skills/index.json"],
      pitfalls=["Buying a figure for the piece, then discovering the variant doesn't include it — check `bafPiece` notes first.",
                "Using zero-data pieces as zero cost — no sightings means unknown, not free."]),
 dict(id="collection-auditor", cat="agents", title="Audit a collection shelf (gaps, era splits, next acquisitions)",
      desc="Summarize a shelf from owned/wanted state: era coverage, near-complete wins, gaps, and the smartest next pickups.",
      use="You want a read on your collection: what's strong, what's thin, and the smartest next acquisitions.",
      inputs=["Owned + wanted figures (site tracker state)", "Optional focus: character, era, or budget"],
      steps=["Use the archive's shelf-analytics template (`api/v1/stats.json` for archive totals): manufacturer split (Toy Biz vs Hasbro), era coverage (founding 2002–2006 era, transition, modern), peak collecting years.",
             "Find near-complete wins first: waves past 50%, BAFs missing 1–2 pieces, characters nearly complete — the site's 'Almost there' logic. Completing a near-finished set beats starting a new one.",
             "Spot era gaps: e.g. an all-modern shelf with zero Toy Biz, or no retro-carded representation — name the gap and the cheapest representative fix from `api/v1/figures.json`.",
             "Rank next acquisitions: near-completions first, then grail targets with resilient reissue radar, then hunt-list figures with logged max prices.",
             "Present the summary in the shareable shelf-summary shape: counts, era splits, top 3 gaps, top 3 next pickups — plain sentences, no invented prices (prices only from the user's own journal solds)."],
      example="A shelf of 40 modern Spider-Man figures and zero X-Men: coverage skew flagged; top next pickup = the wanted-list figures that complete the nearest 'almost there' X-Men wave.",
      refs=["api/v1/stats.json", "api/v1/figures.json", "api/v1/encyclopedia.json"],
      pitfalls=["Auditing from memory instead of the tracker — stale owned state produces wrong gaps.",
                "Recommending a figure whose only 'value' is an ask price — reported solds or the user's own data only."]),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.rglob("*.md"):
        f.unlink()

    figures = load("figures.json")
    ency = load("encyclopedia.json")

    skills = []
    skills += baf_skills(figures)
    skills += character_skills(figures)
    skills += grail_skills(ency)
    skills += bootleg_skills(ency)
    skills += HAND

    index = []
    for s in skills:
        cat_dir = OUT / s["cat"]
        cat_dir.mkdir(exist_ok=True)
        path = cat_dir / f"{s['id']}.md"
        path.write_text(render(s))
        index.append({"id": s["id"], "title": s["title"],
                      "description": s["desc"], "path": f"skills/{s['cat']}/{s['id']}.md"})

    (OUT / "index.json").write_text(json.dumps(
        {"version": VERSION, "count": len(index), "skills": index}, indent=2) + "\n")

    cats = {}
    for s in skills:
        cats[s["cat"]] = cats.get(s["cat"], 0) + 1
    print(f"marvel skills: {len(skills)}")
    for cat, n in sorted(cats.items()):
        print(f"  {cat}: {n}")


if __name__ == "__main__":
    main()