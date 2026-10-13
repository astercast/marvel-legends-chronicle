#!/usr/bin/env python3
"""Rebuild the nav blocks on every static page from scripts/nav_data.py.

Canonical pattern: fleet-commons `patterns/nav-injection` v1.0.0,
generalized from marvel-legends-chronicle's update_nav.py.

The contract:
  - nav_data.py is the ONLY place nav links are listed.
  - Each page's nav blocks are located by their stable anchors (the
    regexes below) and REPLACED wholesale — never patched, never
    inserted-into. Rebuilding is what makes the run idempotent.
  - Pages a generator owns are NOT this script's job: the generator
    imports nav_data itself and renders fresh nav every build. This
    script owns the static pages (SCAN_DIRS below).

Usage:
  python3 scripts/update_nav.py           rewrite stale pages in place
  python3 scripts/update_nav.py --check   exit 1 listing stale pages,
                                          write nothing (wave checks)

Site configuration = the constants below + the two anchor regexes.
Adjust them ONCE, here, when adopting — never per wave.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import nav_data  # noqa: E402

# Directories (relative to the repo root) whose *.html pages this
# script owns. A page's prefix is "../" per level below the root.
SCAN_DIRS = ["."]

# Anchor regexes: the site's primary and footer <nav> wrappers. The
# inner HTML between the captured groups is replaced wholesale.
PRIMARY_RE = re.compile(
    r'(<nav class="site-nav" aria-label="Primary">\s*)(.*?)(\s*</nav>)', re.S
)
FOOTER_RE = re.compile(r'(<nav aria-label="Footer">\s*)(.*?)(\s*</nav>)', re.S)

# Optional grouped-registry <template>: stripped wherever found and
# re-injected once, right after </header>. Set to None to disable.
TEMPLATE_ID = "directory-panel"
TEMPLATE_RE = re.compile(r'\s*<template id="directory-panel">.*?</template>', re.S)
HEADER_CLOSE_RE = re.compile(r"</header>")


def rebuild(text, current, prefix):
    """Return `text` with its nav surfaces rebuilt from nav_data."""
    # Canonical fix vs the source: the primary replacement normalizes
    # the whitespace group 1 captured. The source wrote group(1) back
    # verbatim, and since the renderer indents its first item, each
    # run re-captured the previous run's indent and added its own —
    # +8 spaces per run, silently (the source site's homepage first
    # link sits 64 spaces deep). The renderer owns the layout: tag,
    # one newline, then the items.
    new = PRIMARY_RE.sub(
        lambda m: m.group(1).rstrip() + "\n"
        + nav_data.primary_nav_html(current, prefix) + m.group(3),
        text, count=1,
    )
    new = FOOTER_RE.sub(
        lambda m: m.group(1) + nav_data.footer_nav_html(current, prefix) + m.group(3),
        new, count=1,
    )
    if TEMPLATE_ID and hasattr(nav_data, "directory_template_html"):
        new = TEMPLATE_RE.sub("", new, count=1)
        if "</header>" in new:
            new = HEADER_CLOSE_RE.sub(
                "</header>\n" + nav_data.directory_template_html(prefix),
                new, count=1,
            )
    return new


def pages():
    for d in SCAN_DIRS:
        base = ROOT if d == "." else ROOT / d
        prefix = "" if d == "." else "../" * len(Path(d).parts)
        for path in sorted(base.glob("*.html")):
            current = path.name if d == "." else f"{d}/{path.name}"
            yield path, current, prefix


def main():
    check = "--check" in sys.argv
    changed = []
    for path, current, prefix in pages():
        text = path.read_text(encoding="utf-8")
        new = rebuild(text, current, prefix)
        if new != text:
            changed.append(str(path.relative_to(ROOT)))
            if not check:
                path.write_text(new, encoding="utf-8")
    if check:
        if changed:
            print(f"nav STALE on {len(changed)} pages: {', '.join(changed)}")
            return 1
        print("nav in sync on all pages")
        return 0
    print(f"nav updated on {len(changed)} pages: {', '.join(changed)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
