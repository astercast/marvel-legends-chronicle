#!/usr/bin/env python3
"""Rewrite primary + footer nav on every root HTML page from the canonical list.
- Primary nav is the front desk: six doors + the Index of Halls button.
- Footer nav is the full 46-page registry (no-JS readers get everything).
- The Index of Halls <template> is injected after </header> (idempotent).
Idempotent: nav blocks + template are rebuilt from scratch each run.
Uses scripts/nav_data.py as the single source of truth — keep in sync with
scripts/build_waves.py and scripts/build_characters.py (relative form)."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import nav_data  # noqa: E402

PRIMARY_RE = re.compile(r'(<nav class="site-nav" aria-label="Primary">\s*)(.*?)(\s*</nav>)', re.S)
FOOTER_RE = re.compile(r'(<nav aria-label="Footer">\s*)(.*?)(\s*</nav>)', re.S)
# The directory template, injected once after the header closes.
TEMPLATE_RE = re.compile(r'\s*<template id="directory-panel">.*?</template>', re.S)
HEADER_CLOSE_RE = re.compile(r"</header>", re.S)


def main():
    changed = []
    for path in sorted(ROOT.glob("*.html")):
        text = path.read_text()
        name = path.name

        def repl_primary(m):
            return m.group(1) + nav_data.primary_nav_html(name) + m.group(3)

        def repl_footer(m):
            return m.group(1) + nav_data.footer_nav_html(name) + m.group(3)

        new = PRIMARY_RE.sub(repl_primary, text, count=1)
        new = FOOTER_RE.sub(repl_footer, new, count=1)
        # Directory template: strip any existing copy, then inject after </header>.
        new = TEMPLATE_RE.sub("", new, count=1)
        if "</header>" in new:
            new = HEADER_CLOSE_RE.sub(
                "</header>\n" + nav_data.directory_template_html(), new, count=1
            )
        if new != text:
            path.write_text(new)
            changed.append(name)
    print(f"nav updated on {len(changed)} pages: {', '.join(changed)}")


if __name__ == "__main__":
    main()
