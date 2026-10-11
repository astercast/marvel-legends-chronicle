#!/usr/bin/env python3
"""Generate static character pages: characters/<slug>.html for every character
with 8+ releases (same threshold as the character collector skills), plus
characters/index.html and characters/manifest.json.

Usage: python3 scripts/build_characters.py
Regenerate after data/figures.json changes; commit the outputs.
"""
import json
import re
from collections import Counter, defaultdict
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "characters"
MIN_RELEASES = 8


def base_name(n):
    return re.sub(r"\s*\(.*?\)\s*", "", n).strip()


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


NAV_LINKS = [
    ("index.html", "Timeline"), ("stats.html", "Stats"),
    ("encyclopedia.html", "Encyclopedia"), ("baf-planner.html", "BAF Planner"),
    ("characters/index.html", "Characters"), ("price-guide.html", "Price Guide"),
    ("auth-wizard.html", "Auth Wizard"), ("skills.html", "Skills"),
    ("community.html", "Community"), ("api.html", "API"),
]


def nav(current):
    items = []
    for href, label in NAV_LINKS:
        cur = ' aria-current="page"' if href == current else ""
        items.append(f'        <a href="../{href}"{cur}>{label}</a>')
    return "\n".join(items)


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
    .char-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: var(--space-3); margin-bottom: var(--space-7); }
    .char-card { display: block; }
    .char-card:hover { text-decoration: none; border-color: var(--red); }
    .char-card h3 { margin: 0 0 var(--space-1); font-size: 1rem; }
    .char-card p { margin: 0; color: var(--muted); font-size: 0.85rem; }
"""


def page(title, desc, current, body):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(title)} — Marvel Legends Chronicle</title>
  <meta name="description" content="{escape(desc)}">
  <link rel="stylesheet" href="../assets/css/tokens.css">
  <link rel="stylesheet" href="../assets/css/base.css">
  <link rel="stylesheet" href="../assets/css/layout.css">
  <link rel="stylesheet" href="../assets/css/components.css">
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

  <main id="main">
{body}
  </main>

  <footer class="site-footer">
    <div class="container footer-grid">
      <p>Marvel Legends Chronicle — a fan-made archive. Not affiliated with Marvel, Hasbro, or Toy Biz.</p>
      <nav aria-label="Footer"><a href="../index.html">Timeline</a><a href="../characters/index.html">Characters</a><a href="../api.html">API</a></nav>
    </div>
  </footer>
</body>
</html>
"""


def badges(variant, exclusive):
    out = []
    if variant:
        out.append(f'<span class="badge badge-variant">{escape(variant)}</span>')
    if exclusive:
        out.append(f'<span class="badge badge-exclusive">{escape(exclusive)}</span>')
    return f'<span class="tag-row">{"".join(out)}</span>' if out else ""


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
                "year": w["year"], "series": w.get("series", ""),
                "name": f["name"], "variant": f.get("variant"),
                "exclusive": f.get("exclusive"),
                "manufacturer": w["manufacturer"],
            })

    chars = [(c, n) for c, n in counts.most_common() if n >= MIN_RELEASES]

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
                    f'          <li class="release"><span class="release-name">{escape(r["name"])}</span>'
                    f'{badges(r["variant"], r["exclusive"])}'
                    f'<span class="release-wave">{escape(r["series"])} · <span class="badge {era_cls}">{escape(r["manufacturer"])}</span></span></li>')
            sections.append(f'        <h2 class="release-year">{y}</h2>\n        <ul class="release-list">\n' + "\n".join(rels) + "\n        </ul>")
        body = f"""    <section class="hero char-hero" aria-labelledby="char-title">
      <div class="container hero-inner">
        <span class="hero-kicker">Character archive</span>
        <h1 id="char-title">Every {escape(char)} <span class="accent">ever.</span></h1>
        <p class="lede">{n} Marvel Legends releases, {min(years)}–{max(years)}, in chronological order.</p>
        <div class="char-meta">
          <span class="badge badge-baf">{n} releases</span>
          <span class="badge">{min(years)}–{max(years)}</span>
          <a class="badge" href="index.html" style="text-decoration:none;">← All characters</a>
        </div>
      </div>
    </section>
    <div class="container">
{chr(10).join(sections)}
    </div>"""
        (OUT / f"{s}.html").write_text(
            page(f"Every {char} Marvel Legends release",
                 f"All {n} Marvel Legends {char} figures ({min(years)}–{max(years)}) in chronological order.",
                 "characters/index.html", body))

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
