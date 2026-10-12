#!/usr/bin/env python3
"""Build the Rarity Guide from data/rarity-guide.json.

- Asserts every example id resolves in data/figures.json (real figures only).
- Asserts every tier/source is well-formed and every source URL is valid
  (http(s) or a relative .html page, query strings allowed).
- Regenerates the tier sections of rarity.html between markers (static HTML,
  works without JS).
- Writes api/v1/rarity.json (tier definitions, example figure refs with
  wave context, archive counts, quest mapping).

Regenerate: python3 scripts/build_rarity.py
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GUIDE = ROOT / "data" / "rarity-guide.json"
FIGURES = ROOT / "data" / "figures.json"
PAGE = ROOT / "rarity.html"
API_OUT = ROOT / "api" / "v1" / "rarity.json"

TIER_FIELDS = {"id", "name", "icon", "tagline", "body", "howToSpot", "valueNote", "examples", "sources"}
CROSS_FIELDS = {"id", "name", "icon", "body", "links"}
URL_OK = re.compile(r"^(https?://[^\s'\"<>]+|[a-z0-9_.-]+\.html(\?[^\s'\"<>]*)?)$")
TIERS_BEGIN = "<!-- RARITY:TIERS-BEGIN -->"
TIERS_END = "<!-- RARITY:TIERS-END -->"
CROSS_BEGIN = "<!-- RARITY:CROSS-BEGIN -->"
CROSS_END = "<!-- RARITY:CROSS-END -->"
TOC_BEGIN = "<!-- RARITY:TOC-BEGIN -->"
TOC_END = "<!-- RARITY:TOC-END -->"
STATS_BEGIN = "<!-- RARITY:STATS-BEGIN -->"
STATS_END = "<!-- RARITY:STATS-END -->"
METHOD_BEGIN = "<!-- RARITY:METHOD-BEGIN -->"
METHOD_END = "<!-- RARITY:METHOD-END -->"

QUEST_MAPPING = {
    "chase": "chase-hunter",
    "running-change": "variant-vault",
    "deco-variant": "variant-vault",
    "unmasked": "variant-vault",
    "convention": "convention-floor",
    "retailer": None,
    "pulse-fanchannel": None,
    "haslab": "haslab-backer",
    "made-to-order": "made-to-order",
}

CONVENTION = {"San Diego Comic-Con", "New York Comic-Con", "HASCON", "Hasbro PulseCon"}


def esc(s):
    return html.escape(str(s), quote=True)


def main():
    guide = json.loads(GUIDE.read_text(encoding="utf-8"))
    waves = {w["id"]: w for w in json.loads(FIGURES.read_text(encoding="utf-8"))["waves"]}
    figs = []
    for w in waves.values():
        for f in w["figures"]:
            figs.append({**f, "_waveId": w["id"], "_year": w.get("year"), "_series": w.get("series")})

    def find(eid):
        wid, name = eid.split("::", 1)
        w = waves.get(wid)
        if not w:
            return None
        for f in w["figures"]:
            if f["name"] == name:
                return {**f, "_waveId": wid, "_year": w.get("year"), "_series": w.get("series")}
        return None

    tiers = guide["tiers"]
    assert isinstance(tiers, list) and tiers, "tiers must be a non-empty list"
    seen = set()
    for t in tiers:
        assert TIER_FIELDS <= set(t), f"tier missing fields: {t.get('id')}"
        assert t["id"] not in seen, f"duplicate tier id {t['id']}"
        seen.add(t["id"])
        for e in t["examples"]:
            assert find(e["id"]), f"example id does not resolve: {e['id']}"
            assert e.get("note"), f"example missing note: {e['id']}"
        for s in t["sources"]:
            assert s.get("label") and s.get("url") and s.get("note"), f"source incomplete in {t['id']}"
            assert URL_OK.match(s["url"]), f"bad source URL in {t['id']}: {s['url']}"
    for c in guide["crossCutting"]:
        assert CROSS_FIELDS <= set(c), f"cross-cutting missing fields: {c.get('id')}"
        for l in c["links"]:
            assert URL_OK.match(l["url"]), f"bad cross link URL: {l['url']}"

    # Archive counts per rarity signal (nothing invented).
    counts = {
        "chaseFlagged": sum(1 for f in figs if re.search(r"chase", f"{f.get('notes','')} {f.get('variant','')}", re.I)),
        "variantFigures": sum(1 for f in figs if f.get("variant")),
        "sdcc": sum(1 for f in figs if f.get("exclusive") == "San Diego Comic-Con"),
        "conventionExclusive": sum(1 for f in figs if f.get("exclusive") in CONVENTION),
        "haslab": sum(1 for f in figs if f.get("exclusive") == "HasLab"),
        "madeToOrder": sum(1 for f in figs if f.get("exclusive") == "Made-to-order"),
        "hasbroPulse": sum(1 for f in figs if f.get("exclusive") == "Hasbro Pulse"),
        "fanChannel": sum(1 for f in figs if f.get("exclusive") == "Fan channel"),
        "exclusiveFigures": sum(1 for f in figs if f.get("exclusive")),
    }

    # ---- API payload ("tiers" is the first list so the manifest-driven
    # validator picks it for itemSchema) ----
    api_tiers = []
    for t in tiers:
        api_tiers.append({
            "id": t["id"],
            "name": t["name"],
            "icon": t["icon"],
            "tagline": t["tagline"],
            "body": t["body"],
            "howToSpot": t["howToSpot"],
            "valueNote": t["valueNote"],
            "archiveSignal": signal_for(t["id"]),
            "questAchievement": QUEST_MAPPING.get(t["id"]),
            "examples": [
                {
                    "id": e["id"],
                    "name": find(e["id"])["name"],
                    "waveId": find(e["id"])["_waveId"],
                    "year": find(e["id"])["_year"],
                    "series": find(e["id"])["_series"],
                    "wavePage": f"waves/{find(e['id'])['_waveId']}.html",
                    "note": e["note"],
                }
                for e in t["examples"]
            ],
            "sources": t["sources"],
        })
    payload = {
        "tiers": api_tiers,
        "title": guide["title"],
        "lede": guide["lede"],
        "observed": guide["observed"],
        "methodology": guide["methodology"],
        "archiveCounts": counts,
        "crossCutting": guide["crossCutting"],
        "page": "rarity.html",
    }
    API_OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    # ---- rarity.html regeneration ----
    page = PAGE.read_text(encoding="utf-8")
    page = splice(page, TOC_BEGIN, TOC_END, render_toc(tiers, guide["crossCutting"]))
    page = splice(page, STATS_BEGIN, STATS_END, render_stats(counts))
    page = splice(page, METHOD_BEGIN, METHOD_END, render_method(guide["methodology"]))
    page = splice(page, TIERS_BEGIN, TIERS_END, render_tiers(tiers, figs))
    page = splice(page, CROSS_BEGIN, CROSS_END, render_cross(guide["crossCutting"]))
    PAGE.write_text(page, encoding="utf-8")

    print(f"rarity: {len(tiers)} tiers, {sum(len(t['examples']) for t in tiers)} examples, "
          f"counts={counts}")
    print(f"wrote {API_OUT.relative_to(ROOT)}, regenerated {PAGE.relative_to(ROOT)} sections")


def signal_for(tier_id):
    return {
        "chase": "notes/variant text says 'chase'",
        "running-change": "variant field (mid-production change)",
        "deco-variant": "variant field (deco)",
        "unmasked": "variant field says 'Unmasked'",
        "convention": "exclusive in {SDCC, NYCC, HASCON, PulseCon}",
        "retailer": "exclusive names a retailer",
        "pulse-fanchannel": "exclusive is 'Hasbro Pulse' or 'Fan channel'",
        "haslab": "exclusive is 'HasLab'",
        "made-to-order": "exclusive is 'Made-to-order'",
    }[tier_id]



def render_toc(tiers, cross):
    out = ['<nav class="rar-toc" aria-label="Rarity guide contents">', "  <h2>On this page</h2>", "  <ul>"]
    for t in tiers:
        out.append(f'    <li><a href="#tier-{esc(t["id"])}"><span aria-hidden="true">{esc(t["icon"])}</span> {esc(t["name"])}</a></li>')
    for c in cross:
        out.append(f'    <li><a href="#cc-{esc(c["id"])}"><span aria-hidden="true">{esc(c["icon"])}</span> {esc(c["name"])}</a></li>')
    out.append("  </ul>\n</nav>")
    return "\n".join(out)


def render_stats(counts):
    cells = [
        ("9", "rarity tiers"),
        (str(counts["chaseFlagged"]), "chase-style figures flagged"),
        (str(counts["variantFigures"]), "documented variants"),
        (str(counts["sdcc"]), "SDCC exclusives"),
        (str(counts["haslab"]), "HasLab figures"),
        (str(counts["madeToOrder"]), "made-to-order figures"),
        (str(counts["exclusiveFigures"]), "exclusives in the archive"),
    ]
    out = ['<dl class="rar-stats">']
    for val, label in cells:
        out.append(f'  <div class="rar-stat"><dt class="rar-stat-n">{esc(val)}</dt><dd class="rar-stat-l">{esc(label)}</dd></div>')
    out.append("</dl>")
    out.append('<p class="rar-stats-note">Counts come straight from the archive — nothing estimated.</p>')
    return "\n".join(out)


def render_method(lines):
    out = ['<section class="rar-method" aria-labelledby="rar-method-h">',
           '  <h2 id="rar-method-h">Methodology</h2>', "  <ul>"]
    for l in lines:
        out.append(f"    <li>{esc(l)}</li>")
    out.append("  </ul>\n</section>")
    return "\n".join(out)


def render_tiers(tiers, figs):
    out = []
    for t in tiers:
        parts = [f'<section class="rar-tier" id="tier-{esc(t["id"])}" aria-labelledby="tier-{esc(t["id"])}-h">']
        parts.append(f'  <h2 id="tier-{esc(t["id"])}-h"><span aria-hidden="true">{esc(t["icon"])}</span> {esc(t["name"])}</h2>')
        parts.append(f'  <p class="rar-tagline">{esc(t["tagline"])}</p>')
        for p in t["body"]:
            parts.append(f"  <p>{esc(p)}</p>")
        parts.append('  <h3>How to spot</h3>\n  <ul class="rar-spot">')
        for s in t["howToSpot"]:
            parts.append(f"    <li>{esc(s)}</li>")
        parts.append("  </ul>")
        parts.append('  <h3>What it means for value</h3>')
        for p in t["valueNote"]:
            parts.append(f"  <p>{esc(p)}</p>")
        parts.append('  <h3>Documented examples</h3>\n  <ul class="rar-examples">')
        for e in t["examples"]:
            wid, _ = e["id"].split("::", 1)
            parts.append(f'    <li><a href="waves/{esc(wid)}.html">{esc(find_name(figs, e["id"]))}</a>'
                         f' <span class="rar-ex-note">— {esc(e["note"])}</span></li>')
        parts.append("  </ul>")
        parts.append('  <h3>Sources</h3>\n  <ul class="rar-sources">')
        for s in t["sources"]:
            parts.append(f'    <li><a href="{esc(s["url"])}">{esc(s["label"])}</a>'
                         f' <span class="rar-src-note">— {esc(s["note"])}</span></li>')
        parts.append("  </ul>\n</section>")
        out.append("\n".join(parts))
    return "\n".join(out)


def find_name(figs, eid):
    wid, name = eid.split("::", 1)
    f = next((x for x in figs if x["_waveId"] == wid and x["name"] == name), None)
    return f["name"] if f else eid


def render_cross(sections):
    out = []
    for c in sections:
        parts = [f'<section class="rar-cross" id="cc-{esc(c["id"])}" aria-labelledby="cc-{esc(c["id"])}-h">']
        parts.append(f'  <h2 id="cc-{esc(c["id"])}-h"><span aria-hidden="true">{esc(c["icon"])}</span> {esc(c["name"])}</h2>')
        for p in c["body"]:
            parts.append(f"  <p>{esc(p)}</p>")
        parts.append('  <ul class="rar-links">')
        for l in c["links"]:
            parts.append(f'    <li><a href="{esc(l["url"])}">{esc(l["label"])} →</a></li>')
        parts.append("  </ul>\n</section>")
        out.append("\n".join(parts))
    return "\n".join(out)


def splice(page, begin, end, inner):
    b = page.index(begin) + len(begin)
    e = page.index(end)
    return page[:b] + "\n" + inner + "\n" + page[e:]


if __name__ == "__main__":
    main()
