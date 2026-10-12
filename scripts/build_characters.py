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


# Navigation comes from the canonical source — scripts/nav_data.py.
# (The old per-script NAV_LINKS / PRIMARY_NAV_LINKS duplication is retired —
# the hardcoded footer this script used to carry was missing pages; nav_data
# restores the full 44-page registry here too.)
NAV_LINKS = nav_data.NAV


def nav(current):
    return nav_data.primary_nav_html(current, prefix="../")


FOOTER_NAV = nav_data.footer_nav_html("characters/index.html", prefix="../")
DIRECTORY_TEMPLATE = nav_data.directory_template_html(prefix="../")


PAGE_CSS = """    .char-hero { padding-block: var(--space-7); }
    .char-meta { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: var(--space-4) 0; }
    .release-list { list-style: none; margin: 0 0 var(--space-7); padding: 0; }
    .release-year { font-family: var(--font-display); font-weight: 900; font-size: 1.2rem;
      color: var(--gold); margin: var(--space-6) 0 var(--space-3); }
    .release { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-2) var(--space-3);
      padding: var(--space-3) 0; border-bottom: 1px solid var(--line-soft); }
    .release-name { font-weight: 700; }
    .release-wave { color: var(--muted); font-size: 0.85rem; }
    .release .tag-row { display: inline-flex; gap: var(--space-1); }
    .research { margin-left: auto; font-size: 0.8rem; }
    .research summary { cursor: pointer; color: var(--gold); font-weight: 600; }
    .research summary:hover { text-decoration: underline; }
    .research-list { list-style: none; margin: var(--space-2) 0; padding: 0;
      display: flex; gap: var(--space-3); flex-wrap: wrap; }
    .research-note { color: var(--muted); font-size: 0.75rem; margin: 0; max-width: 60ch; }
    .char-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: var(--space-3); margin-bottom: var(--space-7); }
    .char-card { display: block; }
    .char-card:hover { text-decoration: none; border-color: var(--red); }
    .char-card h3 { margin: 0 0 var(--space-1); font-size: 1rem; }
    .char-card p { margin: 0; color: var(--muted); font-size: 0.85rem; }
    .run-panel { padding: var(--space-5); margin-bottom: var(--space-6); }
    .run-title { font-size: 1.15rem; margin: 0 0 var(--space-2); }
    .run-summary { margin: 0 0 var(--space-3); }
    .run-bar { height: 10px; border-radius: 999px; background: var(--line-soft);
      overflow: hidden; margin-bottom: var(--space-3); }
    .run-fill { height: 100%; background: var(--gold); border-radius: 999px;
      transition: width 0.4s ease; }
    @media (prefers-reduced-motion: reduce) { .run-fill { transition: none; } }
    .run-missing { margin-top: var(--space-3); }
    .run-missing summary { cursor: pointer; color: var(--gold); font-weight: 600; }
    .run-missing summary:hover { text-decoration: underline; }
    .run-missing-list { list-style: none; margin: var(--space-3) 0 0; padding: 0;
      display: grid; gap: var(--space-2); }
    .run-missing-row { display: flex; flex-wrap: wrap; align-items: center;
      justify-content: space-between; gap: var(--space-2);
      padding: var(--space-2) 0; border-bottom: 1px solid var(--line-soft); }
    .run-missing-name { font-size: 0.9rem; }
    .run-complete { color: var(--gold); font-weight: 700; margin: var(--space-3) 0 0; }
"""


def page(title, desc, current, body, extra_scripts=""):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(title)} — Marvel Legends Chronicle</title>
  <meta name="description" content="{escape(desc)}">
  <link rel="preload" href="../assets/fonts/cinzel-latin-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../assets/css/tokens.css">
  <link rel="stylesheet" href="../assets/css/base.css">
  <link rel="stylesheet" href="../assets/css/layout.css">
  <link rel="stylesheet" href="../assets/css/components.css">
  <link rel="stylesheet" href="../assets/css/vault.css">
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
      <p>Marvel Legends Chronicle — a fan-made archive. Not affiliated with Marvel, Hasbro, or Toy Biz.</p>
      <nav aria-label="Footer">{FOOTER_NAV}</nav>
    </div>
  </footer>
  <script src="../assets/js/vault.js" defer></script>
{extra_scripts}</body>
</html>
"""


def badges(variant, exclusive):
    out = []
    if variant:
        out.append(f'<span class="badge badge-variant">{escape(variant)}</span>')
    if exclusive:
        out.append(f'<span class="badge badge-exclusive">{escape(exclusive)}</span>')
    return f'<span class="tag-row">{"".join(out)}</span>' if out else ""


def research_details(name, variant):
    """Per-release research affordance: three pre-filled external searches.
    Same URL patterns as assets/js/listings.js — no prices scraped, no reviews
    invented."""
    q = " ".join(["Marvel Legends", name] + ([variant] if variant else []))
    links = [
        ("eBay sold listings",
         f"https://www.ebay.com/sch/i.html?_nkw={quote_plus(q)}&LH_Sold=1&LH_Complete=1"),
        ("YouTube reviews",
         f"https://www.youtube.com/results?search_query={quote_plus(q + ' review')}"),
        ("Web search",
         f"https://www.google.com/search?q={quote_plus(q)}"),
    ]
    items = "".join(
        f'<li><a href="{url}" target="_blank" rel="noopener noreferrer">{label}</a></li>'
        for label, url in links)
    return (
        '<details class="research"><summary>Research</summary>'
        f'<ul class="research-list">{items}</ul>'
        '<p class="research-note">External searches — eBay solds show actual sale prices, '
        'not asking prices. Reviews and web results are third-party content; unverified.</p>'
        '</details>')


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
                era_cls = "badge-toybiz" if r["manufacturer"] == "Toy Biz" else ""
                rels.append(
                    f'          <li class="release" data-fig-id="{escape(r["fid"])}"><span class="release-name">{escape(r["name"])}</span>'
                    f'{badges(r["variant"], r["exclusive"])}'
                    f'<span class="release-wave">{escape(r["series"])} · <span class="badge {era_cls}">{escape(r["manufacturer"])}</span></span>'
                    f'{research_details(r["name"], r["variant"])}</li>')
            sections.append(f'        <h2 class="release-year">{y}</h2>\n        <ul class="release-list">\n' + "\n".join(rels) + "\n        </ul>")
        body = f"""    <section class="hero char-hero" aria-labelledby="char-title">
      <div class="container hero-inner">
        <span class="hero-kicker">Character archive</span>
        <h1 id="char-title">Every {escape(char)} <span class="accent">ever.</span></h1>
        <p class="lede">{n} Marvel Legends releases, {min(years)}–{max(years)}, in chronological order.</p>
        <p class="accession"><span class="acc-label">Archive №</span> <span class="acc-no">{escape(s)}</span></p>
        <div class="char-meta">
          <span class="badge badge-baf">{n} releases</span>
          <span class="badge">{min(years)}–{max(years)}</span>
          <a class="badge" href="index.html" style="text-decoration:none;">← All characters</a>
        </div>
      </div>
    </section>
    <div class="container">
      <section class="card run-panel" id="run-panel" data-char="{escape(char)}" aria-label="Your {escape(char)} run">
        <h2 class="run-title">Your {escape(char)} run</h2>
        <p class="run-summary">Reading your tracker…</p>
        <noscript><p class="method-note">Run progress needs JavaScript — it reads your on-device tracker (nothing is uploaded).</p></noscript>
      </section>
{chr(10).join(sections)}
    </div>"""
        (OUT / f"{s}.html").write_text(
            page(f"Every {char} Marvel Legends release",
                 f"All {n} Marvel Legends {char} figures ({min(years)}–{max(years)}) in chronological order.",
                 "characters/index.html", body,
                 '\n  <script type="module" src="../assets/js/char-run.js"></script>'))

    cards = []
    for m in manifest:
        cards.append(
            f'      <a class="card char-card" href="{m["slug"]}.html">'
            f'<h3>{escape(m["name"])}</h3>'
            f'<p>{m["count"]} releases · {m["first"]}–{m["last"]}</p></a>')
    index_body = """    <section class="hero char-hero" aria-labelledby="chars-title">
      <div class="container hero-inner">
        <span class="hero-kicker">Browse by character</span>
        <h1 id="chars-title">Characters, <span class="accent">complete.</span></h1>
        <p class="lede">Every release of the line's most-collected characters, in chronological order — the "every Spider-Man ever" view. Generated from the figure database.</p>
      </div>
    </section>
    <div class="container">
      <div class="char-grid">
""" + "\n".join(cards) + """
      </div>
    </div>"""
    (OUT / "index.html").write_text(
        page("Characters", "Every release of Marvel Legends' most-collected characters, chronological.",
             "characters/index.html", index_body))
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    print(f"character pages: {len(manifest)}")


if __name__ == "__main__":
    main()
