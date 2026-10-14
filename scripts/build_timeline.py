#!/usr/bin/env python3
"""Build the Legends Timeline from data/timeline-content.json + data/figures.json.

Outputs:
  - data/timeline.json ......... full year records (the API source)
  - timeline.html .............. year sections regenerated between the
                                 <!-- TIMELINE-YEARS:START --> markers

Wave links are resolved automatically from the archive (every year gets its
real wave ids); spotlight figure ids and every milestone source are
asserted here. Any unresolvable id or source-less claim fails the build,
the timeline must never name a figure, wave, or date the archive (or a
source) cannot back.
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "data" / "timeline-content.json"
FIGURES = ROOT / "data" / "figures.json"
OUT_DATA = ROOT / "data" / "timeline.json"
PAGE = ROOT / "timeline.html"

START = "<!-- TIMELINE-YEARS:START -->"
END = "<!-- TIMELINE-YEARS:END -->"


def esc(s):
    return html.escape(str(s), quote=True)


def era_of(year):
    return "Toy Biz" if year <= 2006 else "Hasbro"


def main():
    content = json.loads(CONTENT.read_text())
    archive = json.loads(FIGURES.read_text())
    waves = archive["waves"]
    by_id = {w["id"]: w for w in waves}
    fig_ids = {f"{w['id']}::{f['name']}" for w in waves for f in w["figures"]}

    years_in = content["years"]
    expected = list(range(2002, 2027))
    got = [y["year"] for y in years_in]
    assert got == expected, f"timeline must cover 2002-2026 contiguously, got {got}"

    years_out = []
    sections = []
    for y in years_in:
        year = y["year"]
        era = era_of(year)
        # Waves resolve automatically from the archive, the one true source.
        ywaves = [w for w in waves if w["year"] == year]
        assert ywaves, f"no archive waves for {year}"
        wave_recs = [{
            "id": w["id"],
            "series": w["series"],
            "figureCount": len(w["figures"]),
            "baf": w.get("baf"),
            "page": f"waves/{w['id']}.html",
        } for w in ywaves]

        for m in y.get("milestones", []):
            srcs = m.get("sources") or []
            assert srcs, f"{year}: milestone has no sources: {m['text'][:60]}"
            for s in srcs:
                assert s.get("label") and s.get("url"), f"{year}: bad source {s}"
                assert re.match(r"^(https?://|[a-z0-9_-]+\.html(#.*)?$)", s["url"]), f"{year}: bad url {s['url']}"

        spot = []
        for s in y.get("spotlight", []):
            fid = f"{s['wave']}::{s['name']}"
            assert s["wave"] in by_id, f"{year}: unknown wave {s['wave']}"
            assert fid in fig_ids, f"{year}: unknown figure id {fid}"
            w = by_id[s["wave"]]
            spot.append({
                "id": fid, "name": s["name"], "waveId": s["wave"],
                "waveSeries": w["series"], "why": s["why"],
                "page": f"waves/{s['wave']}.html",
            })

        years_out.append({
            "year": year,
            "era": era,
            "headline": y["headline"],
            "summary": y["summary"],
            "packaging": y.get("packaging"),
            "milestones": y.get("milestones", []),
            "waves": wave_recs,
            "spotlight": spot,
        })
        sections.append(render_year(year, era, y, wave_recs, spot))

    payload = {
        "version": "1.0.0",
        "observed": content["observed"],
        "title": content["title"],
        "lede": content["lede"],
        "yearMin": 2002,
        "yearMax": 2026,
        "count": len(years_out),
        "years": years_out,
        "packagingEras": content["packagingEras"],
        "sourcesNote": content["sourcesNote"],
    }
    OUT_DATA.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")

    page = PAGE.read_text()
    assert START in page and END in page, "timeline.html missing TIMELINE-YEARS markers"
    new = (page[:page.index(START) + len(START)] + "\n"
           + "\n".join(sections) + "\n"
           + page[page.index(END):])
    PAGE.write_text(new)
    print(f"timeline: {len(years_out)} years, {sum(len(r['waves']) for r in years_out)} waves "
          f"-> {OUT_DATA.relative_to(ROOT)}, {PAGE.name} sections rebuilt")


def render_year(year, era, y, wave_recs, spot):
    era_badge = "badge-toybiz" if era == "Toy Biz" else ""
    parts = [
        f'<section class="tl-year" id="year-{year}" data-era="{era.lower().replace(" ", "")}" aria-labelledby="year-{year}-h">',
        '  <div class="tl-year-head">',
        f'    <h2 id="year-{year}-h"><span class="tl-year-num">{year}</span> {esc(y["headline"])}</h2>',
        f'    <span class="badge {era_badge}">{esc(era)}</span>',
        '  </div>',
        f'  <p class="tl-summary">{esc(y["summary"])}</p>',
    ]
    if y.get("milestones"):
        parts.append('  <ul class="tl-milestones">')
        for m in y["milestones"]:
            links = []
            for s in m["sources"]:
                if s["url"].startswith("http"):
                    links.append(
                        f'<a href="{esc(s["url"])}" target="_blank" rel="noopener noreferrer">{esc(s["label"])}</a>')
                else:
                    links.append(f'<a href="{esc(s["url"])}">{esc(s["label"])}</a>')
            srcs = " ".join(links)
            parts.append(f'    <li>{esc(m["text"])} <span class="tl-sources">[{srcs}]</span></li>')
        parts.append('  </ul>')
    if y.get("packaging"):
        parts.append(f'  <p class="tl-packaging"><strong>Packaging:</strong> {esc(y["packaging"])}</p>')
    parts.append(f'  <h3 class="tl-sub" id="year-{year}-waves">Waves this year ({len(wave_recs)})</h3>')
    parts.append(f'  <ul class="tl-waves" aria-labelledby="year-{year}-waves">')
    for w in wave_recs:
        baf = f' <span class="badge badge-baf">BAF: {esc(w["baf"])}</span>' if w["baf"] else ""
        parts.append(
            f'    <li><a href="{esc(w["page"])}">{esc(w["series"])}</a>'
            f'<span class="tl-wave-meta"> {w["figureCount"]} figures</span>{baf}</li>')
    parts.append('  </ul>')
    if spot:
        parts.append(f'  <h3 class="tl-sub" id="year-{year}-spot">Spotlight</h3>')
        parts.append(f'  <ul class="tl-spotlight" aria-labelledby="year-{year}-spot">')
        for s in spot:
            parts.append(
                f'    <li><a href="{esc(s["page"])}">{esc(s["name"])}</a>'
                f'<span class="tl-spot-why">, {esc(s["why"])}</span></li>')
        parts.append('  </ul>')
    parts.append('</section>')
    return "\n".join(parts)


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print(f"BUILD FAILED: {e}", file=sys.stderr)
        sys.exit(1)
