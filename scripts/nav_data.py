#!/usr/bin/env python3
"""scripts/nav_data.py — canonical navigation data for the Chronicle.

Single source of truth for every nav surface. Imported by:
  - scripts/update_nav.py      (41 root pages)
  - scripts/build_waves.py     (167 wave pages)
  - scripts/build_characters.py (66 character pages)
All three must import from here — never redefine these lists locally.

EXTREME MAKEOVER (2026-10-12): the primary nav is the front desk —
six doors, not forty-four. The full Index of Halls lives behind the
directory button (a real <template> injected into every page, opened
in the shared modal by assets/js/vault.js). The footer stays the full
registry for no-JS readers.
"""
from html import escape

# All 45 pages, in the canonical order. The footer registry + directory use this.
NAV = [
    ("index.html", "Timeline"),
    ("timeline.html", "Legends Timeline"),
    ("2026-review.html", "2026 Review"),
    ("start.html", "Start"),
    ("waves/index.html", "Waves"),
    ("stats.html", "Stats"),
    ("encyclopedia.html", "Encyclopedia"),
    ("baf-planner.html", "BAF Planner"),
    ("characters/index.html", "Characters"),
    ("price-guide.html", "Price Guide"),
    ("market-briefing.html", "Market Briefing"),
    ("launch-curve.html", "Launch Curve"),
    ("drop-week.html", "Drop Week"),
    ("auth-wizard.html", "Auth Wizard"),
    ("shelf.html", "Your Shelf"),
    ("my-vault.html", "My Vault"),
    ("journal.html", "Journal"),
    ("baf-economics.html", "BAF Economics"),
    ("hunt.html", "Hunt Planner"),
    ("gift.html", "Gift Finder"),
    ("holiday.html", "Holiday Guide"),
    ("grading.html", "Grading"),
    ("display.html", "Display"),
    ("collection-value.html", "Ledger"),
    ("exclusives.html", "Exclusives"),
    ("watchlist.html", "Watchlist"),
    ("budget.html", "Budget"),
    ("radar.html", "Radar"),
    ("preorders.html", "Pre-orders"),
    ("calendar.html", "Release Calendar"),
    ("compare.html", "Compare"),
    ("grails.html", "Grails"),
    ("quest.html", "Grail Quest"),
    ("variants.html", "Variants"),
    ("variant-spotlight.html", "Variant Spotlight"),
    ("rarity.html", "Rarity Guide"),
    ("checklist.html", "Checklist"),
    ("explore.html", "Explore"),
    ("retro.html", "Retro"),
    ("showcase.html", "Showcase"),
    ("vault-room.html", "Vault Room"),
    ("skills.html", "Skills"),
    ("agents.html", "Agents"),
    ("community.html", "Community"),
    ("api.html", "API"),
]

# The front desk: six doors a first-time visitor can read at a glance.
PRIMARY_NAV = [
    ("index.html", "Timeline"),
    ("vault-room.html", "Vault Room"),
    ("drop-week.html", "Drop Week"),
    ("preorders.html", "Pre-orders"),
    ("encyclopedia.html", "Encyclopedia"),
    ("quest.html", "Grail Quest"),
]

# The Index of Halls: every page, grouped the way a museum groups its rooms.
# Blurbs are hand-written registrar's-desk copy — no counts (the copy-count
# guard pins archive totals; years are fine), no AI filler.
HALLS = [
    ("The Archive", "The record itself — every figure, in order.", [
        ("index.html", "Timeline", "The complete chronological register — every figure, oldest to newest."),
        ("vault-room.html", "Vault Room", "Walk the room shelf by shelf — twenty-five years of drawers, each one pullable."),
        ("waves/index.html", "Waves", "Every wave on its own shelf board, with its Build-A-Figure and release notes."),
        ("characters/index.html", "Characters", "The most-released characters, each with every one of their figures."),
        ("encyclopedia.html", "Encyclopedia", "The reference desk — packaging eras, the hall of fame, and how the line actually works."),
        ("timeline.html", "Legends Timeline", "The year-by-year history, from Toy Biz's 2002 launch to the retro-blister era."),
        ("2026-review.html", "2026 Review", "The year in the line, as it happened."),
        ("stats.html", "Stats", "The archive by the numbers."),
    ]),
    ("The Hunt", "Pre-orders, drops, and the chase.", [
        ("drop-week.html", "Drop Week", "The command center for what's going live — countdowns, prices, battle plans."),
        ("preorders.html", "Pre-orders", "Everything you can still order, with the windows that matter."),
        ("calendar.html", "Release Calendar", "Dates on the wall — what's due when."),
        ("radar.html", "Radar", "The press scan — rumors and reveals as they're spotted."),
        ("hunt.html", "Hunt Planner", "Plan the hunt: where to look, what to pay, when to pounce."),
        ("watchlist.html", "Watchlist", "Your personal stakeout list."),
        ("auth-wizard.html", "Auth Wizard", "Spot the knockoffs before they spot your wallet."),
        ("exclusives.html", "Exclusives", "The retailer-only and convention pieces, all in one drawer."),
    ]),
    ("Your Shelf", "The collection at home.", [
        ("shelf.html", "Your Shelf", "Your figures, your display, your rules."),
        ("my-vault.html", "My Vault", "Every figure you've marked — Owned, Wanted, Watching — plated like a museum wall, with your completion ledgers by year and wave."),
        ("checklist.html", "Checklist", "The grand checklist — mark them off as they come home."),
        ("journal.html", "Journal", "Field notes from the hunt — log the pickups and the near-misses."),
        ("showcase.html", "Showcase", "Put your best shelf on display."),
        ("display.html", "Display", "How to show them: lighting, risers, dust, and common sense."),
        ("grading.html", "Grading", "What the grades mean, and when they actually matter."),
        ("rarity.html", "Rarity Guide", "What's genuinely hard to find — and what's just expensive."),
        ("variants.html", "Variants", "Chase variants, running changes, and the art of telling them apart."),
        ("variant-spotlight.html", "Variant Spotlight", "One variant, under the lamp."),
    ]),
    ("The Market", "Money, honestly tracked.", [
        ("market-briefing.html", "Market Briefing", "The week's market in plain language — no hype."),
        ("launch-curve.html", "Launch Curve", "What new figures actually sold for, plotted honestly."),
        ("price-guide.html", "Price Guide", "Going rates, with the receipts."),
        ("collection-value.html", "Ledger", "What your collection's worth — your numbers, your business."),
        ("baf-economics.html", "BAF Economics", "Is building that figure cheaper than buying it loose? The math."),
        ("baf-planner.html", "BAF Planner", "Plan your Build-A-Figure, piece by piece."),
        ("budget.html", "Budget", "Collect on a budget, without the guilt."),
        ("gift.html", "Gift Finder", "The right figure for the right person."),
        ("holiday.html", "Holiday Guide", "Seasonal hunting without the seasonal-markup panic."),
    ]),
    ("The Game", "Play with the archive.", [
        ("quest.html", "Grail Quest", "Twenty accessioned honors, exhibition commissions, and the growing exhibit — the collector's game."),
        ("compare.html", "Compare", "Two figures, side by side. No contest rigged."),
        ("grails.html", "Grails", "The ones that got away — and how close they are."),
        ("retro.html", "Retro", "The old days: Toy Biz glory and the figures that started it."),
        ("explore.html", "Explore", "Wander the archive with no destination."),
    ]),
    ("The Desk", "Tools and the fine print.", [
        ("start.html", "Start", "New here? Start here."),
        ("skills.html", "Skills", "Teach your assistant to hunt with you."),
        ("agents.html", "Agents", "The agent playbooks — for the machine collectors."),
        ("community.html", "Community", "The town square."),
        ("api.html", "API", "The archive as data — for builders."),
    ]),
]

# Sanity: every NAV page appears in exactly one hall.
_HALL_HREFS = [href for _, _, pages in HALLS for href, _, _ in pages]
assert sorted(_HALL_HREFS) == sorted(h for h, _ in NAV), "HALLS do not cover NAV exactly"
assert len(_HALL_HREFS) == len(set(_HALL_HREFS)), "duplicate page in HALLS"


def primary_nav_html(current, prefix=""):
    """Six front-desk links + the directory button. `current` is the page's
    own href (site-root-relative); `prefix` is "../" on subdir pages."""
    items = []
    for href, label in PRIMARY_NAV:
        cur = ' aria-current="page"' if href == current else ""
        items.append(f'        <a href="{prefix}{href}"{cur}>{label}</a>')
    items.append(
        '        <button type="button" id="directory-button" class="directory-button" '
        'aria-haspopup="dialog"><span class="directory-button-mark" aria-hidden="true">'
        "❧</span> Index of Halls</button>"
    )
    return "\n".join(items)


def footer_nav_html(current="", prefix=""):
    # The footer is the full 45-page registry — the current page is marked
    # here, so every page keeps its orientation even when it isn't one of
    # the six front-desk doors.
    links = "".join(
        f'<a href="{prefix}{href}"' + (' aria-current="page"' if href == current else "") + f">{label}</a>"
        for href, label in NAV
    )
    return links + (
        '<button type="button" class="motion-toggle" aria-pressed="false">'
        '<span class="motion-toggle-track" aria-hidden="true">'
        '<span class="motion-toggle-thumb"></span></span>'
        "Reduce motion <span class=\"motion-toggle-state\">Off</span></button>"
    )


def directory_template_html(prefix=""):
    """Inert <template> with the full Index of Halls. vault.js clones it into
    the shared modal when the directory button is pressed."""
    halls = []
    for hall_title, hall_note, pages in HALLS:
        links = "".join(
            f'<li><a href="{prefix}{escape(href)}">'
            f'<span class="dir-page">{escape(label)}</span>'
            f'<span class="dir-blurb">{escape(blurb)}</span></a></li>'
            for href, label, blurb in pages
        )
        halls.append(
            f'<section class="dir-hall" aria-label="{escape(hall_title)}">'
            f'<h3 class="dir-hall-title">{escape(hall_title)}</h3>'
            f'<p class="dir-hall-note">{escape(hall_note)}</p>'
            f'<ul class="dir-pages">{links}</ul></section>'
        )
    n_doors = sum(len(pages) for _, _, pages in HALLS)
    return (
        '<template id="directory-panel">'
        '<p class="dir-intro">Every hall in the Chronicle, the way the registrar files them. '
        f"Six rooms, {n_doors} doors.</p>"
        '<div class="dir-halls">' + "".join(halls) + "</div>"
        '<p class="dir-colophon">The registrar files new doors here first — '
        "this index is never more than one wave behind the archive.</p>"
        "</template>"
    )
