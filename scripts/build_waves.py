#!/usr/bin/env python3
"""Generate static wave pages: waves/<wave-id>.html for all 167 waves,
plus waves/index.html and waves/manifest.json.

Usage: python3 scripts/build_waves.py
Regenerate after data/figures.json changes; commit the outputs.

Each wave page: wave meta, BAF info, every figure with inline Owned/Wanted
toggles (assets/js/wave-page.js + tracker.js), one research apparatus
per page with per-row Research buttons (assets/js/research-apparatus.js),
prev/next wave navigation,
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


# Navigation comes from the canonical source, scripts/nav_data.py.
# (The old per-script NAV_LINKS / PRIMARY_NAV_LINKS duplication is retired.)
NAV_LINKS = nav_data.NAV


def nav(current):
    return nav_data.primary_nav_html(current, prefix="../")


FOOTER_NAV = nav_data.footer_nav_html("waves/index.html", prefix="../")
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


PAGE_CSS = """    .wave-hero { padding-block: var(--space-7); }
    .wave-meta { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: var(--space-4) 0; }
    .wave-baf-callout { border: 1px solid var(--line); border-left: 4px solid var(--ink);
      padding: var(--space-4); margin: 0 0 var(--space-6); background: transparent; }
    .wave-baf-callout p { margin: 0; }
    .wave-baf-callout .baf-name { font-weight: 800; }
    .fig-list { list-style: none; margin: 0 0 var(--space-7); padding: 0; }
    .fig { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-2) var(--space-3);
      padding: var(--space-3) 0; border-bottom: 1px solid var(--line-soft); }
    .fig-name { font-weight: 700; }
    .fig-notes { color: var(--muted); font-size: 0.85rem; flex-basis: 100%; }
    .fig-facts { color: var(--muted); font-size: 0.85rem; flex-basis: 100%; }
    .fig .cat-no { white-space: normal; overflow-wrap: anywhere; }
    .track-slot { margin-left: auto; display: inline-flex; gap: var(--space-1); }
    .fig-tools { flex-basis: 100%; }
    .research-btn { font: inherit; font-size: 0.78rem; font-weight: 600;
      color: var(--blue); background: none; border: 0; padding: 0; cursor: pointer; }
    .research-btn:hover { text-decoration: underline; }
    .research-apparatus { border-top: 1px solid var(--line-soft);
      border-bottom: 1px solid var(--line-soft); padding: var(--space-4) 0;
      margin: 0 0 var(--space-6); max-width: 75ch; }
    .research-apparatus h2 { font-family: var(--font-body); font-size: 0.72rem;
      font-weight: 400; letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--muted); margin: 0 0 var(--space-2); }
    .research-apparatus p { color: var(--muted); font-size: 0.85rem; margin: 0 0 var(--space-2); }
    .research-apparatus ul { list-style: none; margin: 0; padding: 0;
      display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); }
    .research-apparatus .research-for { color: var(--ink); font-weight: 700; }
    .research-note { color: var(--muted); font-size: 0.75rem; margin: 0; max-width: 60ch; }
    .wave-nav { display: flex; justify-content: space-between; gap: var(--space-3);
      margin: var(--space-7) 0; flex-wrap: wrap; }
    .wave-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-bottom: var(--space-5); }
    .wave-index-year { font-family: var(--font-display); font-weight: 600; font-size: 1.3rem;
      color: var(--muted); margin: var(--space-6) 0 var(--space-3); }
    /* The waves index: ruled rows grouped by year, count at the right */
    .wave-rows { list-style: none; margin: 0 0 var(--space-4); padding: 0; }
    .wave-row { border-bottom: 1px solid var(--line); }
    .wave-row a { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-2) var(--space-5);
      align-items: baseline; padding: var(--space-3) 0; text-decoration: none; color: var(--ink); }
    .wave-row-name { font-family: var(--font-display); font-size: 1.05rem; font-weight: 600; }
    .wave-row-note { color: var(--muted); font-style: italic; font-size: 0.88rem; }
    .wave-row-count { font-variant-numeric: tabular-nums; text-align: right; }
    .wave-row a:hover .wave-row-name { color: var(--blue); }
    /* The chapter census (hero) + the chapter plate's spacing */
    .wave-census { max-width: 75ch; margin: var(--space-4) 0; }
    .wave-owned { color: var(--muted); font-size: 0.9rem; margin: var(--space-3) 0 0; }
    .chapter-plate { margin: 0 0 var(--space-6); max-width: 560px; }
    /* Wave 26 deep-link overhaul: per-figure anchors + cross-link rows. */
    .fig { scroll-margin-top: 90px; border-radius: var(--radius-m); }
    .fig:target { outline: 2px solid var(--line-bright); outline-offset: 6px;
      background: rgba(30, 27, 22, 0.04); }
    .fig-xref { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-3);
      margin-top: var(--space-2); font-size: 0.8rem; }
    .xref-link { color: var(--ink-dim); text-decoration: none;
      border-bottom: 1px dotted var(--line); white-space: nowrap; }
    .xref-link:hover { color: var(--blue); border-bottom-style: solid; }
    .fig-ko { margin: var(--space-2) 0 0; font-size: 0.82rem; color: var(--ink-dim);
      border-left: 3px solid var(--ink); padding-left: var(--space-2); }
    @media print {
      .site-header, .site-footer, .wave-nav, .wave-actions, .research-apparatus,
      .fig-tools, .track-slot, .skip-link { display: none !important; }
      .wave-hero { padding-block: 0; }
      .fig { break-inside: avoid; }
    }
"""


def page(title, desc, current, body, extra_head="", rel_path="waves/index.html", ld=None):
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
      <p>Marvel Legends Chronicle, a fan-made archive. Not affiliated with Marvel, Hasbro, or Toy Biz.</p>
      <nav aria-label="Footer">{FOOTER_NAV}</nav>
    </div>
  </footer>
  <script src="../assets/js/vault.js" defer></script>
  <script src="../assets/js/research-apparatus.js" defer></script>
</body>
</html>
"""


def badges(fig):
    """The figure's variant facts as ONE plain-text line (the light
    build retires badges from listing surfaces estate-wide): the
    variant, the exclusive channel, the piece it builds, in the
    row's own prose, never as chips."""
    parts = []
    if fig.get("variant"):
        parts.append(f"Variant: {escape(fig['variant'])}")
    if fig.get("exclusive"):
        parts.append(f"Exclusive: {escape(fig['exclusive'])}")
    if fig.get("bafPiece"):
        parts.append(f"Builds: {escape(fig['bafPiece'])}")
    return f'<span class="fig-facts">{" · ".join(parts)}</span>' if parts else ""


def fig_xref(prof):
    """Per-figure cross-link block (wave 26 deep-link overhaul): stable deep-link
    anchor, VS-mode compare entry, rarity-tier link, reported price signals,
    KO-spotter note, and Grail Quest relevance, all from real data only."""
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
        title = f'{escape(s["label"])}, reported {s["kind"].replace("-", " ")}, {escape(s["source"])}'
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


def research_button(name, variant):
    """One Research button per row (L13 collapse, Release 189 ruling).

    At the pre-collapse build every figure row carried the full
    Research disclosure block verbatim: 1,939 research-note elements
    across the 167 wave pages carrying 1 distinct text (113 on
    hasbro-2023-exclusives alone). The note now prints ONCE per page
    in the apparatus below, and the per-figure links are generated on
    interaction by assets/js/research-apparatus.js from the row's own
    data, the same pattern the character registers shipped in R21.
    Same URL patterns as assets/js/listings.js; no prices scraped,
    no reviews invented."""
    v = f' data-variant="{escape(variant, quote=True)}"' if variant else ""
    return (f'<span class="fig-tools"><button type="button" class="research-btn" '
            f'data-name="{escape(name, quote=True)}"{v}>Research</button></span>')


def apparatus_html(series):
    """The one-per-page research apparatus: the disclosure note printed
    once, with the generated links landing beside it."""
    return f"""      <aside class="research-apparatus" id="research-apparatus" aria-label="Research for figures in {escape(series)}">
        <h2>Research</h2>
        <p class="research-note">External searches: eBay sold listings show actual sale prices, not asking prices. Reviews and web results are third-party content, unverified.</p>
        <p class="research-target" aria-live="polite">Choose Research on any figure in this wave and its links appear here, generated from that figure's own row.</p>
        <ul class="research-links"></ul>
        <noscript><p>Research links are generated in your browser; without JavaScript, search any figure's name together with its catalog number, printed at the right of its row.</p></noscript>
      </aside>"""


def fig_plate(entry, name):
    """The Visual Database plate (rotation 20): a pictured figure's
    embedded product photograph + outbound places to buy, generated
    from data/v1/figure-images.json. Static twin of
    assets/js/figure-images.js, same fallback law: the img's error
    handler removes the plate, leaving the typographic row. A
    figure with no manifest entry gets no plate at all."""
    if not entry:
        return ""
    img = escape(entry["imageUrl"], quote=True)
    src = escape(entry["sourceUrl"], quote=True)
    source = escape(entry["imageSource"])
    buys = ""
    links = []
    for b in entry.get("buy") or []:
        price = (f', ${b["priceUSD"]:.2f} listed {escape(b.get("priceSeen") or "")}'.rstrip()
                 if isinstance(b.get("priceUSD"), (int, float)) else ", price at the retailer")
        links.append(
            f'<a class="buy-link" href="{escape(b["url"], quote=True)}" target="_blank" '
            f'rel="noopener noreferrer">{escape(b["retailer"])}{price} ↗</a>')
    if links:
        buys = (f'<p class="fig-buy"><span class="fig-buy-label">Places to buy</span>'
                f'{"".join(links)}</p>')
    return (
        f'<figure class="fig-plate"><a href="{src}" target="_blank" rel="noopener noreferrer" '
        f'title="Product page at {source}">'
        f'<img src="{img}" alt="{escape(name, quote=True)}, product photograph from {source}" '
        f'loading="lazy" decoding="async" referrerpolicy="no-referrer" '
        f'onerror="this.closest(\'.fig-plate\').remove()"></a>'
        f'<figcaption>Product photograph, {source} · Hasbro product photography, '
        f'embedded from the retailer</figcaption></figure>{buys}')


def chapter_plate(entry, name, wave, fig_id):
    """The chapter's head PLATE (MARVEL-LIGHT 3.4): the wave's first
    pictured figure, presented as a printed plate at the chapter
    head: Mat white, Ink keyline, red PLATE 1 mark, one-line
    caption (maker, title, date) closing with the catalog number
    in blue, and the figure's places to buy under it. Static twin
    of assets/js/figure-images.js plateFigureHtml, same fallback
    law: a failed embed removes the plate and the rows stand."""
    if not entry:
        return ""
    img = escape(entry["imageUrl"], quote=True)
    src = escape(entry["sourceUrl"], quote=True)
    source = escape(entry["imageSource"])
    links = []
    for b in entry.get("buy") or []:
        price = (f', ${b["priceUSD"]:.2f} listed {escape(b.get("priceSeen") or "")}'.rstrip()
                 if isinstance(b.get("priceUSD"), (int, float)) else ", price at the retailer")
        links.append(
            f'<a class="buy-link" href="{escape(b["url"], quote=True)}" target="_blank" '
            f'rel="noopener noreferrer">{escape(b["retailer"])}{price} ↗</a>')
    buys = (f'<p class="fig-buy"><span class="fig-buy-label">Places to buy</span>'
            f'{"".join(links)}</p>') if links else ""
    return (
        f'<figure class="plate chapter-plate"><div class="plate-mat">'
        f'<a href="{src}" target="_blank" rel="noopener noreferrer" title="Product page at {source}">'
        f'<img src="{img}" alt="{escape(name, quote=True)}, product photograph from {source}" '
        f'loading="lazy" decoding="async" referrerpolicy="no-referrer" '
        f'onerror="this.closest(\'.plate\').remove()"></a>'
        f'<span class="plate-mark" aria-hidden="true">PLATE 1</span></div>'
        f'<figcaption class="plate-caption">{escape(wave["manufacturer"])}, {escape(name)}, '
        f'{wave["year"]}<span class="cat-no">{escape(fig_id)}</span></figcaption>{buys}</figure>')


def main():
    figures = json.loads((DATA / "figures.json").read_text())
    waves = figures["waves"]

    images_path = DATA / "v1" / "figure-images.json"
    image_entries = {}
    if images_path.exists():
        image_doc = json.loads(images_path.read_text())
        image_entries = {e["figureId"]: e for e in image_doc.get("entries", [])}

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

        rows = []
        prof_by_idx = profiles_by_position()
        plated_id = next((f"{wid}::{f['name']}" for f in figs
                          if image_entries.get(f"{wid}::{f['name']}")), None)
        plate_block = ""
        if plated_id:
            pf = next(f for f in figs if f"{wid}::{f['name']}" == plated_id)
            plate_block = chapter_plate(image_entries[plated_id], pf["name"], w, plated_id)
        pictured_n = sum(1 for f in figs if image_entries.get(f"{wid}::{f['name']}"))
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
                f'<span class="cat-no">{escape(fig_id)}</span>'
                f'{note}'
                f'{"" if fig_id == plated_id else fig_plate(image_entries.get(fig_id), f["name"])}'
                f'{fig_xref(prof)}'
                f'{research_button(f["name"], f.get("variant"))}</li>')

        baf_block = ""
        if w.get("baf"):
            baf_block = (
                '      <div class="wave-baf-callout" role="note">'
                f'<p>Build-A-Figure: <span class="baf-name">{escape(w["baf"])}</span>, '
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
        <div class="wave-census">
          <p class="census-line"><span class="census-value">{n}</span><span class="census-label">figures in this wave</span></p>
          <p class="census-line"><span class="census-value">{pictured_n}</span><span class="census-label">pictured in the Visual Database</span></p>
          <p class="census-line"><span class="census-value">{len(owned_baf)}</span><span class="census-label">figures carry a piece of the Build-A-Figure{": " + escape(w["baf"]) if w.get("baf") else " (this wave has none)"}</span></p>
          <p class="wave-owned" id="owned-count" aria-live="polite">You own 0 of {n}</p>
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
{apparatus_html(w["series"])}
{plate_block}
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
                 extra_head='  <script type="module" src="../assets/js/wave-page.js"></script>\n',
                 rel_path=f"waves/{wid}.html",
                 ld={"@context": "https://schema.org", "@type": "ItemList",
                     "name": f"{w['series']} ({w['year']})",
                     "numberOfItems": n,
                     "itemListElement": [
                         {"@type": "ListItem", "position": j + 1, "name": f["name"]}
                         for j, f in enumerate(figs)]}))

    # waves/index.html, grouped by year
    by_year = defaultdict(list)
    for m in manifest:
        by_year[m["year"]].append(m)
    sections = []
    for y in sorted(by_year):
        cards = []
        for m in by_year[y]:
            baf = f"Build-A-Figure: {escape(m['baf'])}" if m["baf"] else "No Build-A-Figure"
            cards.append(
                f'      <li class="wave-row"><a href="{m["id"]}.html">'
                f'<span class="wave-row-name">{escape(m["series"])}</span>'
                f'<span class="wave-row-note">{escape(m["manufacturer"])} · {baf}</span>'
                f'<span class="wave-row-count">{m["figureCount"]} figures</span></a></li>')
        sections.append(
            f'      <h2 class="wave-index-year">{y}</h2>\n      <ul class="wave-rows">\n'
            + "\n".join(cards) + "\n      </ul>")
    index_body = """    <section class="hero wave-hero" aria-labelledby="waves-title">
      <div class="container hero-inner">
        <span class="hero-kicker">Deep browse</span>
        <h1 id="waves-title">Every wave, <span class="accent">ever.</span></h1>
        <p class="lede">All 167 Marvel Legends waves, 2002–2026, each with its figures, BAF breakdown, and your owned/wanted tracking. Generated from the figure database.</p>
      </div>
    </section>
    <div class="container">
""" + "\n".join(sections) + """
    </div>"""
    (OUT / "index.html").write_text(
        page("Waves", "All 167 Marvel Legends waves 2002–2026, each with its figures and BAF breakdown.",
             "waves/index.html", index_body,
             rel_path="waves/index.html",
             ld={"@context": "https://schema.org", "@type": "ItemList",
                 "name": "Marvel Legends waves, 2002-2026",
                 "numberOfItems": len(manifest),
                 "itemListElement": [
                     {"@type": "ListItem", "position": j + 1,
                      "name": f"{m['series']} ({m['year']})",
                      "url": canonical_url(f"waves/{m['id']}.html")}
                     for j, m in enumerate(manifest)]}))
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    print(f"wave pages: {len(manifest)}")


if __name__ == "__main__":
    main()
