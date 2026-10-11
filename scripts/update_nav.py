#!/usr/bin/env python3
"""Rewrite primary + footer nav on every root HTML page from the canonical list.
- Dedupes the accidental double Start/Waves links.
- Adds Exclusives + Watchlist after Journal.
- Sets aria-current="page" on the matching primary-nav link.
Idempotent: nav blocks are rebuilt from scratch each run.
Keep in sync with scripts/build_waves.py NAV_LINKS (relative form)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

NAV = [
    ("index.html", "Timeline"),
    ("start.html", "Start"),
    ("waves/index.html", "Waves"),
    ("stats.html", "Stats"),
    ("encyclopedia.html", "Encyclopedia"),
    ("baf-planner.html", "BAF Planner"),
    ("characters/index.html", "Characters"),
    ("price-guide.html", "Price Guide"),
    ("auth-wizard.html", "Auth Wizard"),
    ("shelf.html", "Your Shelf"),
    ("journal.html", "Journal"),
    ("collection-value.html", "Ledger"),
    ("exclusives.html", "Exclusives"),
    ("watchlist.html", "Watchlist"),
    ("radar.html", "Radar"),
    ("compare.html", "Compare"),
    ("grails.html", "Grails"),
    ("variants.html", "Variants"),
    ("checklist.html", "Checklist"),
    ("skills.html", "Skills"),
    ("community.html", "Community"),
    ("api.html", "API"),
]

PRIMARY_RE = re.compile(r'(<nav class="site-nav" aria-label="Primary">\s*)(.*?)(\s*</nav>)', re.S)
FOOTER_RE = re.compile(r'(<nav aria-label="Footer">\s*)(.*?)(\s*</nav>)', re.S)


def primary_nav(current):
    items = []
    for href, label in NAV:
        cur = ' aria-current="page"' if href == current else ""
        items.append(f'        <a href="{href}"{cur}>{label}</a>')
    return "\n".join(items)


def footer_nav():
    return "".join(f'<a href="{href}">{label}</a>' for href, label in NAV)


def main():
    changed = []
    for path in sorted(ROOT.glob("*.html")):
        text = path.read_text()
        name = path.name

        def repl_primary(m):
            return m.group(1) + primary_nav(name) + m.group(3)

        def repl_footer(m):
            return m.group(1) + footer_nav() + m.group(3)

        new = PRIMARY_RE.sub(repl_primary, text, count=1)
        new = FOOTER_RE.sub(repl_footer, new, count=1)
        if new != text:
            path.write_text(new)
            changed.append(name)
    print(f"nav updated on {len(changed)} pages: {', '.join(changed)}")


if __name__ == "__main__":
    main()
