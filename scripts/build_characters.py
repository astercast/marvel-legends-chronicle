#!/usr/bin/env python3
"""Generate static character pages: characters/<slug>.html for the top 66
characters by release count, plus characters/index.html and
characters/manifest.json.

Usage: python3 scripts/build_characters.py
Regenerate after data/figures.json changes; commit the outputs.
"""
import json
import re
from collections import Counter, defaultdict
from html import escape
from pathlib import Path
from urllib.parse import quote_plus
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
import nav_data  # canonical nav: scripts/nav_data.py

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "characters"
TOP_N = 66  # top 66 characters by release count (was: 8+ releases = 46 pages)


def base_name(n):
    return re.sub(r"\s*\(.*?\)\s*", "", n).strip()


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


# Navigation comes from the canonical source, scripts/nav_data.py.
# (The old per-script NAV_LINKS / PRIMARY_NAV_LINKS duplication is retired,
# the hardcoded footer this script used to carry was missing pages; nav_data
# restores the full 45-page registry here too.)
NAV_LINKS = nav_data.NAV


def nav(current):
    return nav_data.primary_nav_html(current, prefix="../")


FOOTER_NAV = nav_data.footer_nav_html("characters/index.html", prefix="../")
DIRECTORY_TEMPLATE = nav_data.directory_template_html(prefix="../")

SITE_ORIGIN = "https://marvel-legends-chronicle-live.vercel.app"
OG_IMAGE = SITE_ORIGIN + "/assets/og-card.png"


def canonical_url(rel):
    """Absolute cleanUrls canonical for a generated page path."""
    p = rel[:-len(".html")] if rel.endswith(".html") else rel
    if p == "index":
        p = ""
    elif p.endswith("/index"):
        p = p[:-len("index")]
    return f"{SITE_ORIGIN}/{p}" if p else f"{SITE_ORIGIN}/"


def head_meta(title, desc, rel, ld=None):
    """Placement Pass (rotation 13): the shared head block, canonical,
    Open Graph / Twitter card (typographic OG card, absolute URL),
    theme-color + favicon from the site's own tokens, and honest
    JSON-LD built from real catalog data only. og:title mirrors the
    page's own <title>; og:description mirrors its meta description."""
    full = f"{escape(title)}: Marvel Legends Chronicle"
    url = canonical_url(rel)
    lines = [
        f'  <link rel="canonical" href="{url}">',
        '  <meta property="og:type" content="website">',
        f'  <meta property="og:title" content="{full}">',
        f'  <meta property="og:description" content="{escape(desc)}">',
        f'  <meta property="og:url" content="{url}">',
        f'  <meta property="og:image" content="{OG_IMAGE}">',
        '  <meta property="og:image:width" content="1200">',
        '  <meta property="og:image:height" content="630">',
        '  <meta name="twitter:card" content="summary_large_image">',
        f'  <meta name="twitter:title" content="{full}">',
        f'  <meta name="twitter:description" content="{escape(desc)}">',
        f'  <meta name="twitter:image" content="{OG_IMAGE}">',
        '  <meta name="theme-color" content="#FAF6EC">',
        '  <link rel="icon" href="/favicon.ico" sizes="48x48">',
        '  <link rel="icon" href="/favicon.svg" type="image/svg+xml">',
        '  <link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    ]
    if ld:
        lines.append('  <script type="application/ld+json">'
                     + json.dumps(ld, ensure_ascii=False) + "</script>")
    return "\n".join(lines) + "\n"



PAGE_CSS = """    .char-hero { padding-block: var(--space-7); }
    .char-meta { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: var(--space-4) 0; }
    .release-list { list-style: none; margin: 0 0 var(--space-7); padding: 0; }
    .release-year { font-family: var(--font-display); font-weight: 600; font-size: 1.2rem;
      color: var(--muted); margin: var(--space-6) 0 var(--space-3); }
    .release { padding: var(--space-3) 0; border-bottom: 1px solid var(--line-soft); }
    /* Row anatomy, record and research-apparatus styles live in
       assets/css/museum.css (the R21 museum sheet): three-line rows,
       the catalog number at its fixed position, one apparatus. */
    /* The characters index: ruled contents rows (name, note, count at right) */
    .char-index { list-style: none; margin: 0 0 var(--space-7); padding: 0; }
    .char-index-row { border-bottom: 1px solid var(--line); }
    .char-index-row:first-child { border-top: 1px solid var(--line); }
    .char-index-row a { display: grid; grid-template-columns: minmax(8rem, auto) minmax(0, 1fr) auto;
      gap: var(--space-2) var(--space-5); align-items: baseline; padding: var(--space-4) 0;
      text-decoration: none; color: var(--ink); }
    .char-index-name { font-family: var(--font-display); font-size: 1.15rem; font-weight: 600; }
    .char-index-note { color: var(--muted); font-style: italic; font-size: 0.9rem; }
    .char-index-count { font-variant-numeric: tabular-nums; text-align: right; }
    .char-index-row a:hover .char-index-name { color: var(--blue); }
    @media (max-width: 640px) { .char-index-row a { grid-template-columns: minmax(0, 1fr) auto; } .char-index-note { grid-column: 1 / -1; } }
    /* The character head is a tombstone on Board (MARVEL-LIGHT 3.6) */
    .char-tombstone { background: var(--board); border: 1px solid var(--line); padding: var(--space-5); }
    .char-tombstone .accession { margin: var(--space-2) 0; }
    /* The run tracker is an ownership BOOKPLATE on Board: an ex libris
       panel whose inscription renders in full, in normal flow, with
       room at the foot. It replaces the dark run panel wholesale;
       the R21 capture's clipped closing line closes here, by
       replacement (no fixed height, no hidden overflow, generous
       foot padding). */
    .bookplate { background: var(--board); border: 1px solid var(--line-bright);
      outline: 3px double var(--line-bright); outline-offset: 4px;
      padding: var(--space-6); margin-bottom: var(--space-7); overflow: visible; }
    .bookplate-mark { font-size: 0.72rem; letter-spacing: 0.22em; text-transform: uppercase;
      color: var(--muted); margin: 0 0 var(--space-2); }
    .run-title { font-family: var(--font-display); font-weight: 600; font-size: 1.15rem; margin: 0 0 var(--space-2); }
    .run-summary { margin: 0 0 var(--space-3); }
    .run-bar { height: 10px; border-radius: 999px; background: var(--line-soft);
      overflow: hidden; margin-bottom: var(--space-3); }
    .run-fill { height: 100%; background: var(--ink); border-radius: 0;
      transition: width 0.4s ease; }
    @media (prefers-reduced-motion: reduce) { .run-fill { transition: none; } }
    .run-missing { margin-top: var(--space-3); }
    .run-missing summary { cursor: pointer; color: var(--ink); font-weight: 600; }
    .run-missing summary:hover { text-decoration: underline; }
    .run-missing-list { list-style: none; margin: var(--space-3) 0 0; padding: 0;
      display: grid; gap: var(--space-2); }
    .run-missing-row { display: flex; flex-wrap: wrap; align-items: center;
      justify-content: space-between; gap: var(--space-2);
      padding: var(--space-2) 0; border-bottom: 1px solid var(--line-soft); }
    .run-missing-name { font-size: 0.9rem; }
    .run-complete { color: var(--ink); font-weight: 700; margin: var(--space-3) 0 0; }
"""


def page(title, desc, current, body, extra_scripts="", rel_path="characters/index.html", ld=None):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(title)}: Marvel Legends Chronicle</title>
  <meta name="description" content="{escape(desc)}">
{head_meta(title, desc, rel_path, ld)}  <link rel="preload" href="../assets/fonts/cinzel-latin-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../assets/css/tokens.css">
  <link rel="stylesheet" href="../assets/css/base.css">
  <link rel="stylesheet" href="../assets/css/layout.css">
  <link rel="stylesheet" href="../assets/css/components.css">
  <link rel="stylesheet" href="../assets/css/vault.css">
  <link rel="stylesheet" href="../assets/css/museum.css">
  <style>
{PAGE_CSS}  </style>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>

  <header class="site-header">
    <div class="container header-bar">
      <a class="brand" href="../index.html" aria-label="Marvel Legends Chronicle home">
        <span class="brand-mark" aria-hidden="true">ML</span>
        <span class="brand-name">MARVEL LEGENDS<small>CHRONICLE</small></span>
      </a>
      <nav class="site-nav" aria-label="Primary">
{nav(current)}
      </nav>
    </div>
  </header>
{DIRECTORY_TEMPLATE}

  <main id="main">
{body}
  </main>

  <footer class="site-footer">
    <div class="container footer-grid">
      <p>Marvel Legends Chronicle, a fan-made archive. Not affiliated with Marvel, Hasbro, or Toy Biz.</p>
      <nav aria-label="Footer">{FOOTER_NAV}</nav>
    </div>
  </footer>
  <script src="../assets/js/vault.js" defer></script>
  <script src="../assets/js/research-apparatus.js" defer></script>
{extra_scripts}</body>
</html>
"""


def third_line(variant, exclusive):
    """The row's third TEXT line, present only when the catalog carries
    a variant or an exclusive channel for the figure. Plain text, the
    Rijksmuseum label manner: no badges on the listing surface."""
    parts = []
    if variant:
        parts.append(f"Variant: {escape(variant)}")
    if exclusive:
        parts.append(f"Exclusive: {escape(exclusive)}")
    if not parts:
        return ""
    return f'<span class="release-variant">{" · ".join(parts)}</span>'


def research_button(name, variant):
    """One Research button per row. The links themselves are generated
    on interaction by assets/js/research-apparatus.js, from this row's
    own data, into the page's single research apparatus (L13 fix: the
    explanatory note and link set are no longer repeated per figure)."""
    v = f' data-variant="{escape(variant, quote=True)}"' if variant else ""
    return (f'<span class="release-tools"><button type="button" class="research-btn" '
            f'data-name="{escape(name, quote=True)}"{v}>Research</button></span>')


def apparatus_html(char):
    """The one-per-page research apparatus: the note printed once, in
    the margin, with the generated links landing beside it."""
    return f"""      <aside class="research-apparatus" id="research-apparatus" aria-label="Research for {escape(char)} figures">
        <h2>Research</h2>
        <p class="research-note">External searches: eBay sold listings show actual sale prices, not asking prices. Reviews and web results are third-party content, unverified.</p>
        <p class="research-target" aria-live="polite">Choose Research on any figure below and its links appear here, generated from that figure's own row.</p>
        <ul class="research-links"></ul>
        <noscript><p>Research links are generated in your browser; without JavaScript, search any figure's name together with its catalog number, printed at the head of its row.</p></noscript>
      </aside>"""


def main():
    figures = json.loads((DATA / "figures.json").read_text())
    counts = Counter()
    by_char = defaultdict(list)
    for w in figures["waves"]:
        for f in w["figures"]:
            b = base_name(f["name"])
            if not b:
                continue
            counts[b] += 1
            by_char[b].append({
                "fid": f"{w['id']}::{f['name']}",
                "year": w["year"], "series": w.get("series", ""),
                "name": f["name"], "variant": f.get("variant"),
                "exclusive": f.get("exclusive"),
                "manufacturer": w["manufacturer"],
            })

    chars = list(counts.most_common(TOP_N))

    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.html"):
        f.unlink()

    manifest = []
    for char, n in chars:
        s = slug(char)
        rows = sorted(by_char[char], key=lambda r: (r["year"], r["series"]))
        years = [r["year"] for r in rows]
        manifest.append({"slug": s, "name": char, "count": n,
                         "first": min(years), "last": max(years)})

        by_year = defaultdict(list)
        for r in rows:
            by_year[r["year"]].append(r)
        sections = []
        for y in sorted(by_year):
            rels = []
            for r in by_year[y]:
                rels.append(
                    f'          <li class="release" data-fig-id="{escape(r["fid"])}">'
                    f'<span class="cat-no">{escape(r["fid"])}</span>'
                    f'<span class="release-main"><span class="release-name">{escape(r["name"])}</span>'
                    f'<span class="release-wave">{escape(r["series"])}, {escape(r["manufacturer"])}</span>'
                    f'{third_line(r["variant"], r["exclusive"])}</span>'
                    f'<span class="release-year-cell">{y}</span>'
                    f'{research_button(r["name"], r["variant"])}</li>')
            sections.append(f'        <h2 class="release-year">{y}</h2>\n        <ul class="release-list">\n' + "\n".join(rels) + "\n        </ul>")
        body = f"""    <section class="hero char-hero" aria-labelledby="char-title">
      <div class="container hero-inner">
        <div class="char-tombstone">
          <span class="hero-kicker">Character archive</span>
          <h1 id="char-title">Every {escape(char)} <span class="accent">ever.</span></h1>
          <p class="tombstone-line">Character register, Marvel Legends</p>
          <p class="accession"><span class="acc-label">Archive №</span> <span class="acc-no">{escape(s)}</span></p>
          <p class="tombstone-year">{min(years)}–{max(years)}</p>
          <p class="tombstone-variant">{n} releases in the line, in chronological order</p>
          <div class="char-meta">
            <a href="index.html">← All characters</a>
          </div>
        </div>
      </div>
    </section>
    <div class="container">
      <section class="bookplate" id="run-panel" data-char="{escape(char)}" aria-label="Your {escape(char)} run">
        <p class="bookplate-mark">Ex Libris: this copy belongs to its collector</p>
        <h2 class="run-title">Your {escape(char)} run</h2>
        <p class="run-summary">Reading your tracker…</p>
        <noscript><p class="method-note">Run progress needs JavaScript: it reads your on-device tracker (nothing is uploaded).</p></noscript>
      </section>
{apparatus_html(char)}
{chr(10).join(sections)}
    </div>"""
        (OUT / f"{s}.html").write_text(
            page(f"Every {char} Marvel Legends release",
                 f"All {n} Marvel Legends {char} figures ({min(years)}–{max(years)}) in chronological order.",
                 "characters/index.html", body,
                 '\n  <script type="module" src="../assets/js/char-run.js"></script>',
                 rel_path=f"characters/{s}.html",
                 ld={"@context": "https://schema.org", "@type": "ItemList",
                     "name": f"Every {char} Marvel Legends release",
                     "numberOfItems": n,
                     "itemListElement": [
                         {"@type": "ListItem", "position": j + 1, "name": r["name"]}
                         for j, r in enumerate(rows)]}))

    cards = []
    for m in manifest:
        cards.append(
            f'      <li class="char-index-row"><a href="{m["slug"]}.html">'
            f'<span class="char-index-name">{escape(m["name"])}</span>'
            f'<span class="char-index-note">Character register</span>'
            f'<span class="char-index-count">{m["count"]} releases · {m["first"]}–{m["last"]}</span></a></li>')
    index_body = """    <section class="hero char-hero" aria-labelledby="chars-title">
      <div class="container hero-inner">
        <span class="hero-kicker">Browse by character</span>
        <h1 id="chars-title">Characters, <span class="accent">complete.</span></h1>
        <p class="lede">Every release of the line's most-collected characters, in chronological order: the "every Spider-Man ever" view. Generated from the figure database.</p>
      </div>
    </section>
    <div class="container">
      <ul class="char-index">
""" + "\n".join(cards) + """
      </ul>
    </div>"""
    (OUT / "index.html").write_text(
        page("Characters", "Every release of Marvel Legends' most-collected characters, chronological.",
             "characters/index.html", index_body,
             rel_path="characters/index.html",
             ld={"@context": "https://schema.org", "@type": "ItemList",
                 "name": "Marvel Legends characters",
                 "numberOfItems": len(manifest),
                 "itemListElement": [
                     {"@type": "ListItem", "position": j + 1,
                      "name": m["name"],
                      "url": canonical_url(f"characters/{m['slug']}.html")}
                     for j, m in enumerate(manifest)]}))
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    print(f"character pages: {len(manifest)}")


if __name__ == "__main__":
    main()
