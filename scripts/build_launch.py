#!/usr/bin/env python3
"""Wave 30: build the Launch Curve page from data/launch-curves.json.

Validates every curve (figId resolves in the archive, every point has an ISO
date + numeric price + labeled kind, every source is a labeled well-formed URL,
>=3 points per curve), computes peak/latest/drop stats, and regenerates the
per-curve sections of launch-curve.html between markers (static HTML + static
SVG — works without JS, no animation, reduced-motion safe).
"""
import json
import re
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
PAGE = ROOT / "launch-curve.html"
BEGIN = "<!--LAUNCH-CURVES:START-->"
END = "<!--LAUNCH-CURVES:END-->"

URL_RE = re.compile(r"^https?://[^\s]+$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
KINDS = {"sold", "presale", "asking"}


def fail(msg):
    raise SystemExit(f"build_launch: FAIL: {msg}")


def figure_ids():
    raw = json.loads((DATA / "figures.json").read_text())
    ids = set()
    for w in raw["waves"]:
        for f in w["figures"]:
            ids.add(f"{w['id']}::{f['name']}")
    return ids


def check_source(src, where):
    if not isinstance(src, dict) or not src.get("label") or not URL_RE.match(src.get("url", "")):
        fail(f"{where}: source must have a label and a well-formed http(s) URL, got {src!r}")


def iso(d, where):
    if not isinstance(d, str) or not DATE_RE.match(d):
        fail(f"{where}: bad ISO date {d!r}")
    return date.fromisoformat(d)


def chart_svg(curve, stats):
    pts = sorted(curve["points"], key=lambda p: (p["date"], p["price"]))
    ds = [iso(p["date"], curve["id"]) for p in pts]
    lo, hi = ds[0].toordinal(), ds[-1].toordinal()
    span = max(hi - lo, 1)
    maxp = max(p["price"] for p in pts) * 1.12
    W, H, PL, PR, PT, PB = 640, 260, 46, 14, 18, 34
    iw, ih = W - PL - PR, H - PT - PB

    def x(d):
        return PL + (d.toordinal() - lo) / span * iw

    def y(v):
        return PT + ih - (v / maxp) * ih

    poly = " ".join(f"{x(d):.1f},{y(p['price']):.1f}" for d, p in zip(ds, pts))
    circles = []
    for d, p in zip(ds, pts):
        tip = f"{p['date']}: {'presale' if p['kind'] == 'presale' else 'sold'} ${p['price']:.2f}"
        if p["kind"] == "presale":
            circles.append(
                f'<circle tabindex="0" cx="{x(d):.1f}" cy="{y(p["price"]):.1f}" r="4.5" fill="none" '
                f'stroke="var(--gold)" stroke-width="2"><title>{tip}</title></circle>')
        else:
            circles.append(
                f'<circle tabindex="0" cx="{x(d):.1f}" cy="{y(p["price"]):.1f}" r="4.5" fill="var(--gold)">'
                f'<title>{tip}</title></circle>')
    msrp_y = y(curve["msrp"])
    aria = (f"Sold-price timeline for {curve['figureName']}: peak ${stats['peak']:.2f} on "
            f"{stats['peak_date']}, latest ${stats['latest']:.2f} on {stats['latest_date']}, "
            f"MSRP ${curve['msrp']:.2f}.")
    return f"""<svg viewBox="0 0 {W} {H}" role="img" aria-label="{escape(aria)}">
<title>{escape(curve['figureName'])} launch curve</title>
<line x1="{PL}" y1="{msrp_y:.1f}" x2="{W-PR}" y2="{msrp_y:.1f}" stroke="var(--ink-dim)" stroke-dasharray="6 4" stroke-width="1.5"/>
<text x="{W-PR}" y="{msrp_y-6:.1f}" text-anchor="end" font-size="11" fill="var(--ink-dim)">MSRP ${curve['msrp']:.2f}</text>
<polyline class="curve-draw" pathLength="1" points="{poly}" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
{''.join(circles)}
<text x="{PL}" y="{H-10}" font-size="11" fill="var(--ink-dim)">{ds[0].isoformat()}</text>
<text x="{W-PR}" y="{H-10}" text-anchor="end" font-size="11" fill="var(--ink-dim)">{ds[-1].isoformat()}</text>
<text x="6" y="{PT+4}" font-size="11" fill="var(--ink-dim)">${max(p['price'] for p in pts):.0f}</text>
<text x="6" y="{PT+ih}" font-size="11" fill="var(--ink-dim)">$0</text>
</svg>"""


def render_curve(curve):
    pts = sorted(curve["points"], key=lambda p: (p["date"], p["price"]))
    peak = max(pts, key=lambda p: p["price"])
    latest = pts[-1]
    peak_d, latest_d = iso(peak["date"], curve["id"]), iso(latest["date"], curve["id"])
    drop = (peak["price"] - latest["price"]) / peak["price"] * 100
    days = (latest_d - peak_d).days
    stats = {"peak": peak["price"], "peak_date": peak["date"],
             "latest": latest["price"], "latest_date": latest["date"]}
    rows = "\n".join(
        f'<tr><td>{p["date"]}</td><td class="num">${p["price"]:.2f}</td>'
        f'<td><span class="kind-badge">{p["kind"]}</span></td></tr>' for p in pts)
    events = "\n".join(
        f"<li><strong>{e['date']}</strong> — {escape(e['label'])}</li>" for e in curve["events"])
    src = curve["source"]
    return f"""<article class="curve-card card" aria-labelledby="curve-{curve['id']}">
<span class="curve-kicker">{escape(curve['waveName'])}</span>
<h2 id="curve-{curve['id']}">{escape(curve['figureName'])}</h2>
<div class="stat-strip" aria-label="{escape(curve['figureName'])} curve stats">
<span class="stat">Peak <strong>${peak['price']:.2f}</strong> ({peak['date']})</span>
<span class="stat">Latest <strong>${latest['price']:.2f}</strong> ({latest['date']})</span>
<span class="stat">Drop <strong>{drop:.0f}%</strong> in {days} days</span>
<span class="stat">MSRP <strong>${curve['msrp']:.2f}</strong></span>
</div>
{chart_svg(curve, stats)}
<p>{escape(curve['note'])}</p>
<ul style="color:var(--ink-dim);font-size:0.9rem;list-style:none;padding-left:0">{events}</ul>
<table class="points-table">
<caption class="sr-only">Reported sold points for {escape(curve['figureName'])}</caption>
<thead><tr><th scope="col">Date</th><th scope="col">Price</th><th scope="col">Kind</th></tr></thead>
<tbody>{rows}</tbody>
</table>
<a class="src" href="{src['url']}" target="_blank" rel="noopener">{escape(src['label'])}</a>
</article>"""


def main():
    raw = json.loads((DATA / "launch-curves.json").read_text())
    curves = raw["curves"]
    ids = figure_ids()
    seen = set()
    for c in curves:
        if c["id"] in seen:
            fail(f"duplicate curve id {c['id']}")
        seen.add(c["id"])
        if c["figId"] not in ids:
            fail(f"curve {c['id']}: figId {c['figId']} does not resolve in the archive")
        if not isinstance(c.get("msrp"), (int, float)) or c["msrp"] <= 0:
            fail(f"curve {c['id']}: msrp must be a positive number")
        if len(c.get("points", [])) < 3:
            fail(f"curve {c['id']}: need >=3 points, got {len(c.get('points', []))}")
        for p in c["points"]:
            iso(p.get("date"), f"{c['id']} point")
            if not isinstance(p.get("price"), (int, float)) or p["price"] <= 0:
                fail(f"{c['id']}: bad price {p.get('price')!r}")
            if p.get("kind") not in KINDS:
                fail(f"{c['id']}: bad kind {p.get('kind')!r}")
        for e in c.get("events", []):
            iso(e.get("date"), f"{c['id']} event")
            if not e.get("label"):
                fail(f"{c['id']}: event missing label")
            check_source(e.get("source"), f"{c['id']} event")
        check_source(c.get("source"), f"curve {c['id']}")
        if not c.get("note"):
            fail(f"curve {c['id']}: missing note")

    html = PAGE.read_text()
    if BEGIN not in html or END not in html:
        fail("launch-curve.html is missing the LAUNCH-CURVES markers")
    body = "\n".join(render_curve(c) for c in curves)
    before, rest = html.split(BEGIN, 1)
    _, after = rest.split(END, 1)
    PAGE.write_text(before + BEGIN + "\n" + body + "\n" + END + after)
    print(f"build_launch: {len(curves)} curves rendered into launch-curve.html")


if __name__ == "__main__":
    main()
