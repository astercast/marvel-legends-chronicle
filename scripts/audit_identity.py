#!/usr/bin/env python3
"""scripts/audit_identity.py, wave 34 consistency audit of the Collector's Vault identity.

Checks every HTML page (277: 42 root + 168 waves + 67 characters) for the
identity wiring that makes the site recognizable blind:
  1. vault.css linked, AFTER components.css
  2. vault.js loaded with defer
  3. Cinzel WOFF2 preloaded
  4. motion toggle present in the footer
  5. no remote font dependency (fonts.googleapis.com)
  6. wave pages: accession line carrying the wave id
  7. character pages: accession line carrying the character slug
  8. signature page types carry their identity markers

Prints a summary; exits non-zero on any failure. Optionally writes a JSON
report with --json <path>.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SIGNATURE_PAGES = {
    "index.html": ["rope-rule", "accession"],
    "quest.html": ["accession", "ach-icon"],
    "drop-week.html": ["accession", "dw-card"],
    "launch-curve.html": ["accession", "curve-card"],
    "market-briefing.html": ["accession", "brief-card"],
    "api.html": ["accession"],
    "agents.html": ["accession"],
    "encyclopedia.html": ["accession", "hof-card"],
    "vault-room.html": ["accession", "vault-room"],
}

fails = []
warns = []


def fail(page, msg):
    fails.append(f"{page}: {msg}")


def warn(page, msg):
    warns.append(f"{page}: {msg}")


def pages():
    out = []
    for p in sorted(ROOT.glob("*.html")):
        out.append(("root", p))
    for p in sorted((ROOT / "waves").glob("*.html")):
        out.append(("waves", p))
    for p in sorted((ROOT / "characters").glob("*.html")):
        out.append(("characters", p))
    return out


def check_page(kind, path):
    rel = path.relative_to(ROOT).as_posix()
    t = path.read_text(encoding="utf-8")

    # 1. vault.css after components.css
    css_links = re.findall(r'<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"', t)
    css_links += re.findall(r'<link[^>]+href="([^"]+\.css)"[^>]*rel="stylesheet"', t)
    vault = [h for h in css_links if h.endswith("vault.css")]
    comp = [h for h in css_links if h.endswith("components.css")]
    if not vault:
        fail(rel, "vault.css not linked")
    elif comp and css_links.index(comp[0]) > css_links.index(vault[0]):
        fail(rel, "vault.css linked BEFORE components.css (identity layer must load last)")

    # 2. vault.js with defer
    if not re.search(r'<script[^>]+src="[^"]*vault\.js"[^>]*>', t):
        fail(rel, "vault.js not loaded")
    elif not re.search(r'<script[^>]*defer[^>]*src="[^"]*vault\.js"', t) and not re.search(
        r'<script[^>]*src="[^"]*vault\.js"[^>]*defer', t
    ):
        fail(rel, "vault.js loaded without defer")

    # 3. Cinzel preload
    if "cinzel-latin-normal.woff2" not in t:
        fail(rel, "Cinzel preload missing")

    # 4. motion toggle in footer
    if 'class="motion-toggle"' not in t:
        fail(rel, "motion toggle missing")

    # 5. no remote fonts
    if "fonts.googleapis.com" in t:
        fail(rel, "remote font dependency (fonts.googleapis.com)")

    # 6/7. accession lines on generated pages
    if kind == "waves" and path.name != "index.html":
        wid = path.stem
        if f'<span class="acc-no">{wid}</span>' not in t:
            fail(rel, f"accession line missing wave id {wid}")
    if kind == "characters" and path.name != "index.html":
        slug = path.stem
        if f'<span class="acc-no">{slug}</span>' not in t:
            fail(rel, f"accession line missing character slug {slug}")

    # 8. signature page-type markers
    if kind == "root" and path.name in SIGNATURE_PAGES:
        for marker in SIGNATURE_PAGES[path.name]:
            if marker == "accession":
                if '<p class="accession"' not in t and '"dw-dispatch accession"' not in t:
                    fail(rel, "no accession line")
            elif marker not in t:
                warn(rel, f"marker '{marker}' not found in markup (may be JS-rendered)")


def main():
    all_pages = pages()
    for kind, p in all_pages:
        check_page(kind, p)

    n_root = sum(1 for k, _ in all_pages if k == "root")
    n_waves = sum(1 for k, _ in all_pages if k == "waves")
    n_chars = sum(1 for k, _ in all_pages if k == "characters")
    print(f"pages audited: {len(all_pages)} (root {n_root} + waves {n_waves} + characters {n_chars})")
    print(f"failures: {len(fails)}")
    for f in fails[:40]:
        print("  FAIL", f)
    if len(fails) > 40:
        print(f"  ... and {len(fails) - 40} more")
    print(f"warnings: {len(warns)}")
    for w in warns[:20]:
        print("  WARN", w)

    if "--json" in sys.argv:
        out = sys.argv[sys.argv.index("--json") + 1]
        Path(out).write_text(
            json.dumps(
                {"pages": len(all_pages), "failures": fails, "warnings": warns},
                indent=2,
            ),
            encoding="utf-8",
        )
        print(f"report written to {out}")

    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
