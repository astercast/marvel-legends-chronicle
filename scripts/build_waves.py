#!/usr/bin/env python3
"""Generate static wave pages: waves/<wave-id>.html for all 167 waves,
plus waves/index.html and waves/manifest.json.

Usage: python3 scripts/build_waves.py
Regenerate after data/figures.json changes; commit the outputs.

Each wave page: wave meta, BAF info, every figure with inline Owned/Wanted
toggles (assets/js/wave-page.js + tracker.js), static research affordances
(same URL patterns as assets/js/listings.js), prev/next wave navigation,
and a print-checklist button.
"""
import json
import re
import sys
from collections import defaultdict
from html import escape
from pathlib import Path
from urllib.parse import quote, quote_plus

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare_lib import profiles_by_position
import nav_data  # canonical nav: scripts/nav_data.py

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "waves"


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


# Navigation comes from the canonical source — scripts/nav_data.py.
# (The old per-script NAV_LINKS / PRIMARY_NAV_LINKS duplication is retired.)
NAV_LINKS = nav_data.NAV


def nav(current):
    return nav_data.primary_nav_html(current, prefix="../")


FOOTER_NAV = nav_data.footer_nav_html("waves/index.html", prefix="../")
DIRECTORY_TEMPLATE = nav_data.directory_template_html(prefix="../")

PAGE_CSS = """    .wave-hero { padding-block: var(--space-7); }
    .wave-meta { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: var(--space-4) 0; }
    .wave-baf-callout { border: 1px solid var(--line); border-left: 4px solid var(--gold);
      padding: var(--space-4); margin: 0 0 var(--space-6); background: var(--panel); }
    .wave-baf-callout p { margin: 0; }
    .wave-baf-callout .baf-name { font-weight: 800; }
    .fig-list { list-style: none; margin: 0 0 var(--space-7); padding: 0; }
    .fig { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-2) var(--space-3);
      padding: var(--space-3) 0; border-bottom: 1px solid var(--line-soft); }
    .fig-name { font-weight: 700; }
    .fig-notes { color: var(--muted); font-size: 0.85rem; flex-basis: 100%; }
    .fig .tag-row { display: inline-flex; gap: var(--space-1); flex-wrap: wrap; }
    .track-slot { margin-left: auto; display: inline-flex; gap: var(--space-1); }
    .research { margin-left: auto; font-size: 0.8rem; flex-basis: 100%; }
    .research summary { cursor: pointer; color: var(--gold); font-weight: 600; }
    .research summary:hover { text-decoration: underline; }
    .research-list { list-style: none; margin: var(--space-2) 0; padding: 0;
      display: flex; gap: var(--space-3); flex-wrap: wrap; }
    .research-note { color: var(--muted); font-size: 0.75rem; margin: 0; max-width: 60ch; }
    .wave-nav { display: flex; justify-content: space-between; gap: var(--space-3);
      margin: var(--space-7) 0; flex-wrap: wrap; }
    .wave-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-bottom: var(--space-5); }
    .wave-index-year { font-family: var(--font-display); font-weight: 900; font-size: 1.3rem;
      color: var(--gold); margin: var(--space-6) 0 var(--space-3); }
    .wave-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: var(--space-3); margin-bottom: var(--space-4); }
    .wave-card { display: block; }
    .wave-card:hover { text-decoration: none; border-color: var(--red); }
    .wave-card h3 { margin: 0 0 var(--space-1); font-size: 1rem; }
    .wave-card p { margin: 0; color: var(--muted); font-size: 0.85rem; }
    /* Wave 26 deep-link overhaul: per-figure anchors + cross-link rows. */
    .fig { scroll-margin-top: 90px; border-radius: var(--radius-m); }
    .fig:target { outline: 2px solid var(--gold); outline-offset: 6px;
      background: rgba(245, 179, 1, 0.05); }
    .fig-xref { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-3);
      margin-top: var(--space-2); font-size: 0.8rem; }
    .xref-link { color: var(--ink-dim); text-decoration: none;
      border-bottom: 1px dotted var(--line); white-space: nowrap; }
    .xref-link:hover { color: var(--gold); border-bottom-style: solid; }
    .fig-ko { margin: var(--space-2) 0 0; font-size: 0.82rem; color: var(--ink-dim);
      border-left: 3px solid var(--red); padding-left: var(--space-2); }
    @media print {
      .site-header, .site-footer, .wave-nav, .wave-actions, .research,
      .track-slot, .skip-link { display: none !important; }
      .wave-hero { padding-block: 0; }
      .fig { break-inside: avoid; }
    }
"""


def page(title, desc, current, body, extra_head=""):
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
{extra_head}</head>
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
</body>
</html>
"""


def badges(fig):
    out = []
    if fig.get("variant"):
        out.append(f'<span class="badge badge-variant">{escape(fig["variant"])}</span>')
    if fig.get("exclusive"):
        out.append(f'<span class="badge badge-exclusive">{escape(fig["exclusive"])}</span>')
    if fig.get("bafPiece"):
        out.append(f'<span class="badge badge-baf">Builds: {escape(fig["bafPiece"])}</span>')
    return f'<span class="tag-row">{"".join(out)}</span>' if out else ""


def fig_xref(prof):
    """Per-figure cross-link block (wave 26 deep-link overhaul): stable deep-link
    anchor, VS-mode compare entry, rarity-tier link, reported price signals,
    KO-spotter note, and Grail Quest relevance — all from real data only."""
    items = []
    # Stable deep link to this exact figure (copiable fragment URL).
    anchor = prof["deepLink"].split("#", 1)[1]
    items.append(
        f'<a class="xref-link" href="#{anchor}" title="Stable deep link to this figure">'
        f'🔗 Deep link</a>')
    # VS mode entry point.
    items.append(
        f'<a class="xref-link" href="../{prof["compareUrl"]}">'
        f'⚖️ Compare</a>')
    # Rarity tier cross-link.
    if prof.get("rarity"):
        r = prof["rarity"]
        items.append(
            f'<a class="xref-link" href="../rarity.html#tier-{r["tier"]}">'
            f'💎 {escape(r["tierName"])}</a>')
    # Reported price signals (reported ranges, never invented).
    for s in prof.get("priceSignals") or []:
        title = f'{escape(s["label"])} — reported {s["kind"].replace("-", " ")}, {escape(s["source"])}'
        items.append(
            f'<a class="xref-link" href="../watchlist.html" title="{title}">'
            f'💰 Reported {escape(s["display"])}</a>')
    # KO-spotter note where applicable.
    ko_html = ""
    if prof.get("koWatch"):
        k = prof["koWatch"]
        ko_html = (
            f'<p class="fig-ko" role="note">⚠️ {escape(k["note"])} '
            f'<a href="../auth-wizard.html">Run the Auth Wizard →</a></p>')
    # Grail Quest relevance.
    quest_html = ""
    r = prof.get("rarity")
    if r and r.get("questAchievement"):
        quest_html = (
            f'<a class="xref-link" href="../quest.html">'
            f'🏆 Quest: {escape(r["questAchievement"])}</a>')
    elif prof.get("priceSignals"):
        quest_html = (
            f'<a class="xref-link" href="../watchlist.html">'
            f'🎯 Watchlist hunt candidate</a>')
    if quest_html:
        items.append(quest_html)
    return (f'<div class="fig-xref" aria-label="Figure cross-links">'
            f'{"".join(items)}</div>{ko_html}')


def research_details(name, variant):
    """Static per-figure research affordance. Same URL patterns as
    assets/js/listings.js — no prices scraped, no reviews invented."""
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
    waves = figures["waves"]

    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.html"):
        f.unlink()

    manifest = []
    for i, w in enumerate(waves):
        wid = w["id"]
        figs = w["figures"]
        n = len(figs)
        owned_baf = [f for f in figs if f.get("bafPiece")]
        manifest.append({
            "id": wid, "series": w["series"], "year": w["year"],
            "manufacturer": w["manufacturer"], "baf": w.get("baf"),
            "figureCount": n,
        })

        era_cls = "badge-toybiz" if w["manufacturer"] == "Toy Biz" else ""
        rows = []
        prof_by_idx = profiles_by_position()
        for fi, f in enumerate(figs):
            fig_id = f"{wid}::{f['name']}"
            prof = prof_by_idx[(wid, fi)]
            anchor = prof["deepLink"].split("#", 1)[1]
            note = f'<span class="fig-notes">{escape(f["notes"])}</span>' if f.get("notes") else ""
            rows.append(
                f'          <li class="fig" id="{anchor}" data-fig-id="{escape(fig_id, quote=True)}">'
                f'<span class="fig-name">{escape(f["name"])}</span>'
                f'{badges(f)}'
                f'<span class="track-slot" data-track-for="{escape(fig_id, quote=True)}"></span>'
                f'{note}'
                f'{fig_xref(prof)}'
                f'{research_details(f["name"], f.get("variant"))}</li>')

        baf_block = ""
        if w.get("baf"):
            baf_block = (
                '      <div class="wave-baf-callout" role="note">'
                f'<p>Build-A-Figure: <span class="baf-name">{escape(w["baf"])}</span> — '
                f'{len(owned_baf)} of {n} figures in this wave include a piece. '
                '<a href="../baf-planner.html">Open the BAF planner</a> to track your pieces.</p></div>')

        prev_link, next_link = "", ""
        if i > 0:
            p = waves[i - 1]
            prev_link = (f'<a class="btn" href="{p["id"]}.html" rel="prev">← {escape(p["series"])} '
                         f'({p["year"]})</a>')
        if i < len(waves) - 1:
            nx = waves[i + 1]
            next_link = (f'<a class="btn" href="{nx["id"]}.html" rel="next">{escape(nx["series"])} '
                         f'({nx["year"]}) →</a>')

        body = f"""    <section class="hero wave-hero" aria-labelledby="wave-title" data-wave-id="{escape(wid, quote=True)}">
      <div class="container hero-inner">
        <span class="hero-kicker">Wave archive</span>
        <h1 id="wave-title">{escape(w["series"])}</h1>
        <p class="lede">{w["year"]} · {escape(w["manufacturer"])} · {n} figure{"s" if n != 1 else ""}</p>
        <div class="wave-meta">
          <span class="badge {era_cls}">{escape(w["manufacturer"])}</span>
          <span class="badge">{w["year"]}</span>
          <span class="badge badge-baf">{n} figure{"s" if n != 1 else ""}</span>
          {"<span class=\"badge\">Build-A-Figure wave</span>" if w.get("baf") else ""}
          <span class="badge" id="owned-count" aria-live="polite">You own 0 of {n}</span>
        </div>
        <p class="accession"><span class="acc-label">Archive №</span> <span class="acc-no">{escape(wid)}</span></p>
        <div class="wave-actions">
          <button type="button" class="btn btn-sm" id="print-checklist">Print checklist</button>
          <a class="btn btn-sm" href="index.html">← All waves</a>
          <a class="btn btn-sm" href="../timeline.html#year-{w["year"]}">📜 {w["year"]} in the Legends Timeline</a>
        </div>
      </div>
    </section>
    <div class="container">
{baf_block}
      <ul class="fig-list" aria-label="Figures in this wave">
{chr(10).join(rows)}
      </ul>
      <nav class="wave-nav" aria-label="Previous and next wave">
        {prev_link}
        {next_link}
      </nav>
    </div>"""
        (OUT / f"{wid}.html").write_text(
            page(f"{w['series']} ({w['year']})",
                 f"Every figure in the {w['series']} Marvel Legends wave ({w['year']}, {w['manufacturer']}).",
                 "waves/index.html", body,
                 extra_head='  <script type="module" src="../assets/js/wave-page.js"></script>\n'))

    # waves/index.html — grouped by year
    by_year = defaultdict(list)
    for m in manifest:
        by_year[m["year"]].append(m)
    sections = []
    for y in sorted(by_year):
        cards = []
        for m in by_year[y]:
            era_cls = "badge-toybiz" if m["manufacturer"] == "Toy Biz" else ""
            baf = f" · BAF: {escape(m['baf'])}" if m["baf"] else ""
            cards.append(
                f'      <a class="card wave-card" href="{m["id"]}.html">'
                f'<h3>{escape(m["series"])}</h3>'
                f'<p>{m["figureCount"]} figures · <span class="badge {era_cls}">{escape(m["manufacturer"])}</span>{baf}</p></a>')
        sections.append(
            f'      <h2 class="wave-index-year">{y}</h2>\n      <div class="wave-grid">\n'
            + "\n".join(cards) + "\n      </div>")
    index_body = """    <section class="hero wave-hero" aria-labelledby="waves-title">
      <div class="container hero-inner">
        <span class="hero-kicker">Deep browse</span>
        <h1 id="waves-title">Every wave, <span class="accent">ever.</span></h1>
        <p class="lede">All 167 Marvel Legends waves, 2002–2026 — each with its figures, BAF breakdown, and your owned/wanted tracking. Generated from the figure database.</p>
      </div>
    </section>
    <div class="container">
""" + "\n".join(sections) + """
    </div>"""
    (OUT / "index.html").write_text(
        page("Waves", "All 167 Marvel Legends waves 2002–2026, each with its figures and BAF breakdown.",
             "waves/index.html", index_body))
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    print(f"wave pages: {len(manifest)}")


if __name__ == "__main__":
    main()
