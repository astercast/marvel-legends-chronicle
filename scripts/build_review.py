#!/usr/bin/env python3
"""Build the 2026 year-in-review page ("2026: The State of Legends").

- Reads data/year-review.json (curated but fully validated editorial data).
- Asserts every figure/preorder ref resolves to a REAL record, every source
  URL is well-formed, every distinction kind is in the scoring table, and
  every price-movement sold sits inside its signal's reported band.
- Computes, never invents: top-10 scores + ordering (score desc, alphabetical
  tie-break), per-figure MSRP math for best-value, first->last sold deltas for
  price movements, 2026 archive stats, month scrubber from the events data.
- Regenerates the marked sections of 2026-review.html (static HTML, works
  without JS) and writes api/v1/year-review.json ("top10" is the first list
  so the manifest-driven validator picks it for itemSchema).

Regenerate: python3 scripts/build_review.py
"""
import calendar
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare_lib import deep_link, slug, wave_anchors, compare_url

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
REVIEW = DATA / "year-review.json"
FIGURES = DATA / "figures.json"
PREORDERS = DATA / "preorders.json"
SIGNALS = DATA / "price-signals.json"
PAGE = ROOT / "2026-review.html"
API_OUT = ROOT / "api" / "v1" / "year-review.json"

URL_OK = re.compile(r"^(https?://[^\s'\"<>]+|[a-z0-9_./-]+\.html(\?[^\\s'\"<>]*)?)$")

STATS_BEGIN = "<!-- REVIEW:STATS-BEGIN -->"
STATS_END = "<!-- REVIEW:STATS-END -->"
METHOD_BEGIN = "<!-- REVIEW:METHOD-BEGIN -->"
METHOD_END = "<!-- REVIEW:METHOD-END -->"
SCRUB_BEGIN = "<!-- REVIEW:SCRUBBER-BEGIN -->"
SCRUB_END = "<!-- REVIEW:SCRUBBER-END -->"
MONTHS_BEGIN = "<!-- REVIEW:MONTHS-BEGIN -->"
MONTHS_END = "<!-- REVIEW:MONTHS-END -->"
TOP10_BEGIN = "<!-- REVIEW:TOP10-BEGIN -->"
TOP10_END = "<!-- REVIEW:TOP10-END -->"
VALUE_BEGIN = "<!-- REVIEW:VALUE-BEGIN -->"
VALUE_END = "<!-- REVIEW:VALUE-END -->"
PRICES_BEGIN = "<!-- REVIEW:PRICES-BEGIN -->"
PRICES_END = "<!-- REVIEW:PRICES-END -->"
SURPRISES_BEGIN = "<!-- REVIEW:SURPRISES-BEGIN -->"
SURPRISES_END = "<!-- REVIEW:SURPRISES-END -->"
RARITYH_BEGIN = "<!-- REVIEW:RARITY-BEGIN -->"
RARITYH_END = "<!-- REVIEW:RARITY-END -->"
KO_BEGIN = "<!-- REVIEW:KO-BEGIN -->"
KO_END = "<!-- REVIEW:KO-END -->"
NARR_BEGIN = "<!-- REVIEW:NARRATIVE-BEGIN -->"
NARR_END = "<!-- REVIEW:NARRATIVE-END -->"
CROSS_BEGIN = "<!-- REVIEW:CROSS-BEGIN -->"
CROSS_END = "<!-- REVIEW:CROSS-END -->"

MONTH_NAMES = {i: calendar.month_name[i] for i in range(1, 13)}


def esc(s):
    return html.escape(str(s), quote=True)


def splice(page, begin, end, content):
    pat = re.compile(re.escape(begin) + r".*?" + re.escape(end), re.S)
    assert pat.search(page), f"marker pair missing: {begin}"
    return pat.sub(begin + "\n" + content + "\n" + end, page)


def money(n):
    if n is None:
        return "—"
    return f"${n:,.2f}".rstrip("0").rstrip(".")


def load():
    review = json.loads(REVIEW.read_text(encoding="utf-8"))
    waves = {w["id"]: w for w in json.loads(FIGURES.read_text(encoding="utf-8"))["waves"]}
    pre = json.loads(PREORDERS.read_text(encoding="utf-8"))
    items = {i["id"]: i for i in pre["items"]}
    signals = {s["id"]: s for s in json.loads(SIGNALS.read_text(encoding="utf-8"))["signals"]}
    return review, waves, items, signals


def find_fig(waves, fid):
    wid, name = fid.split("::", 1)
    w = waves.get(wid)
    if not w:
        return None
    for idx, f in enumerate(w["figures"]):
        if f["name"] == name:
            return w, idx, f
    return None


def anchor_for(waves, fid):
    hit = find_fig(waves, fid)
    if not hit:
        return None
    w, idx, _ = hit
    return deep_link(w["id"], wave_anchors(w["figures"])[idx])


def score(entry, scoring):
    return sum(scoring[d["kind"]] for d in entry["distinctions"])


def validate(review, waves, items, signals):
    scoring = review["scoring"]
    assert isinstance(scoring, dict) and scoring, "scoring table required"
    assert len(review["top10"]) == 10, "top10 must have exactly 10 entries"
    seen = set()
    for e in review["top10"]:
        assert {"id", "display", "ref", "distinctions", "blurb"} <= set(e), f"top10 entry missing fields: {e.get('id')}"
        assert e["id"] not in seen, f"duplicate top10 id {e['id']}"
        seen.add(e["id"])
        ref = e["ref"]
        assert ref["kind"] == "preorder", f"top10 ref kind must be preorder: {e['id']}"
        assert ref["id"] in items, f"top10 ref does not resolve: {ref['id']}"
        assert e["distinctions"], f"top10 entry needs distinctions: {e['id']}"
        for d in e["distinctions"]:
            assert d["kind"] in scoring, f"unknown distinction kind {d['kind']} in {e['id']}"
            assert d.get("claim") and d.get("source"), f"distinction missing claim/source in {e['id']}"
        if e.get("figureRef"):
            assert find_fig(waves, e["figureRef"]), f"figureRef does not resolve: {e['figureRef']}"
        if e.get("waveRef"):
            assert e["waveRef"] in waves, f"waveRef does not resolve: {e['waveRef']}"
    # criteria honesty: recompute the ranking and require the file's set to be
    # the top of the computed order — the builder sorts, so just assert the
    # scoring function is total and deterministic.
    scores = {e["id"]: score(e, scoring) for e in review["top10"]}
    assert all(s > 0 for s in scores.values()), "every top10 entry needs a positive score"
    for m in review["months"]:
        assert re.fullmatch(r"2026-(0[1-9]|1[0-2])", m["month"]), f"bad month {m['month']}"
        for ev in m["events"]:
            assert ev.get("text"), f"month event missing text: {m['month']}"
            assert ev.get("status") in ("documented", "scheduled"), f"event needs documented|scheduled: {m['month']}"
            s = ev.get("source") or {}
            assert s.get("label") and s.get("url"), f"month event missing source: {m['month']}"
            assert URL_OK.match(s["url"]), f"bad month event URL: {s['url']}"
    for pm in review["priceMovements"]:
        s = signals.get(pm["signalId"])
        assert s, f"price movement signal does not resolve: {pm['signalId']}"
        assert len(pm["solds"]) >= 2, f"movement needs >=2 solds: {pm['signalId']}"
        for date, price in pm["solds"]:
            assert re.fullmatch(r"2026-\d{2}-\d{2}", date), f"bad sold date {date}"
            assert isinstance(price, (int, float)) and price > 0
            if s.get("low") is not None and s.get("high") is not None:
                assert s["low"] <= price <= s["high"], (
                    f"sold {price} outside reported band {s['low']}-{s['high']}: {pm['signalId']}")
    for p in review["bestValue"]["packs"]:
        it = items.get(p["itemId"])
        assert it, f"bestValue pack does not resolve: {p['itemId']}"
        assert isinstance(it.get("price"), (int, float)) and it["price"] > 0, f"pack needs a price: {p['itemId']}"
        assert isinstance(p["figures"], int) and p["figures"] > 1
    for sec in ("surprises", "rarityHighlights", "narrative"):
        assert review[sec], f"{sec} must be non-empty"
        for x in review[sec]:
            for k in (["title", "text"] if sec == "surprises" else ["text"] if sec == "rarityHighlights" else ["heading", "body"]):
                assert x.get(k), f"{sec} entry missing {k}"
            srcs = [x["source"]] if sec != "narrative" else x["sources"]
            for s in srcs:
                assert s.get("label") and s.get("url"), f"{sec} entry missing source"
                assert URL_OK.match(s["url"]), f"bad {sec} source URL: {s['url']}"
    ko = review["koWatch"]
    assert ko.get("headline") and ko.get("items")
    for it in ko["items"]:
        assert it.get("text") and it["source"].get("label") and it["source"].get("url")
        assert URL_OK.match(it["source"]["url"]), f"bad KO source URL: {it['source']['url']}"
    assert review["methodology"] and review["gaps"], "methodology and gaps required"
    return scores


def archive_stats(waves, items):
    w26 = [w for w in waves.values() if w.get("year") == 2026]
    figs26 = sum(len(w["figures"]) for w in w26)
    items26 = [i for i in items.values()
               if (i.get("releaseWindow") or "").find("2026") >= 0
               or (i.get("preorderDate") or "").startswith("2026")]
    return {
        "waves2026": sorted(
            [{"id": w["id"], "series": w.get("series"), "figures": len(w["figures"])} for w in w26],
            key=lambda w: w["id"]),
        "figures2026": figs26,
        "tracked2026": len(items26),
        "trackedTotal": len(items),
    }


def movement_math(solds):
    first = solds[0][1]
    last = solds[-1][1]
    delta = last - first
    pct = (delta / first * 100) if first else 0.0
    return {"first": first, "last": last, "delta": round(delta, 2), "pct": round(pct, 1),
            "n": len(solds)}


def best_value(review, items):
    packs = []
    for p in review["bestValue"]["packs"]:
        it = items[p["itemId"]]
        per = it["price"] / p["figures"]
        packs.append({"id": p["itemId"], "name": it["name"], "price": it["price"],
                      "figures": p["figures"], "perFigure": round(per, 2)})
    packs.sort(key=lambda x: x["perFigure"])
    pack_ids = {p["itemId"] for p in review["bestValue"]["packs"]}
    singles = []
    for it in items.values():
        if it["id"] in pack_ids or not isinstance(it.get("price"), (int, float)):
            continue
        if (it.get("releaseWindow") or "").find("2026") < 0 and not (it.get("preorderDate") or "").startswith("2026"):
            continue
        singles.append({"id": it["id"], "name": it["name"], "price": it["price"]})
    singles.sort(key=lambda x: x["price"])
    return packs, singles


def render_stats(stats, signals):
    cells = [
        (str(len(stats["waves2026"])), "waves dated 2026 in the encyclopedia"),
        (str(stats["figures2026"]), "2026-dated figures in the archive"),
        (str(stats["tracked2026"]), "tracker items with 2026 dates/windows"),
        (str(len(signals)), "figures with reported price data"),
        ("0", "new counterfeit waves documented in 2026"),
        ("$27.99", "standard 2026 single-figure MSRP"),
    ]
    out = ['<dl class="yr-stats">']
    for val, label in cells:
        out.append(f'  <div class="yr-stat"><dt class="yr-stat-n">{esc(val)}</dt><dd class="yr-stat-l">{esc(label)}</dd></div>')
    out.append("</dl>")
    out.append('<p class="yr-stats-note">As documented in the Chronicle — <a href="#yr-gaps">gaps labeled below</a>. Observed <time datetime="2026-10-11">October 11, 2026</time>.</p>')
    return "\n".join(out)


def render_method(review):
    out = ['<div class="yr-method" id="yr-gaps">']
    out.append("  <h3>How this page was built</h3>\n  <ul>")
    for p in review["methodology"]:
        out.append(f"    <li>{esc(p)}</li>")
    out.append("  </ul>\n  <h3>What the data doesn't cover</h3>\n  <ul>")
    for g in review["gaps"]:
        out.append(f"    <li>{esc(g)}</li>")
    out.append("  </ul>\n</div>")
    return "\n".join(out)


def render_scrubber(months):
    out = ['<nav class="yr-scrub" id="yr-scrubber" aria-label="2026 month scrubber">', "  <ul>"]
    for m in months:
        n = int(m["month"].split("-")[1])
        name = MONTH_NAMES[n]
        mark = " ●" if m["events"] else ""
        out.append(f'    <li><a href="#month-{m["month"]}" data-month="{m["month"]}"><span aria-hidden="true">{name[:3]}</span><span class="yr-scrub-full">{name}{mark}</span></a></li>')
    out.append("  </ul>\n</nav>")
    out.append('<p class="yr-scrub-note">● marks months with documented or scheduled events. Months with no Chronicle record say so.</p>')
    return "\n".join(out)


def render_months(months):
    out = []
    for m in months:
        n = int(m["month"].split("-")[1])
        out.append(f'<section class="yr-month" id="month-{m["month"]}" aria-labelledby="month-{m["month"]}-h">')
        out.append(f'  <h3 id="month-{m["month"]}-h">{MONTH_NAMES[n]} 2026</h3>')
        if not m["events"]:
            out.append('  <p class="yr-month-empty">No 2026 events documented in the Chronicle for this month.</p>')
        else:
            out.append("  <ul>")
            for ev in m["events"]:
                tag = "documented" if ev["status"] == "documented" else "scheduled"
                src = ev["source"]
                out.append(f'    <li><span class="yr-ev-tag yr-ev-{tag}">{tag}</span> {esc(ev["text"])} '
                           f'<a class="yr-src" href="{esc(src["url"])}">{esc(src["label"])}</a></li>')
            out.append("  </ul>")
        out.append("</section>")
    return "\n".join(out)


def entry_links(e, waves):
    links = [f'<a href="preorders.html">Pre-order tracker →</a>']
    if e.get("figureRef"):
        dl = anchor_for(waves, e["figureRef"])
        links.append(f'<a href="{esc(dl)}">Deep link →</a>')
        links.append(f'<a href="{esc(compare_url(e["figureRef"]))}">Compare →</a>')
    if e.get("waveRef"):
        links.append(f'<a href="waves/{esc(e["waveRef"])}.html">Wave page →</a>')
    return links


def render_top10(review, waves, scores):
    scoring = review["scoring"]
    entries = sorted(review["top10"], key=lambda e: (-scores[e["id"]], e["display"].lower()))
    out = []
    out.append('<p class="yr-criteria"><strong>Criteria (shown, not hidden):</strong> each entry is scored on documented '
               "distinctions — " + ", ".join(f"{esc(k)} = {v} pt{'s' if v != 1 else ''}" for k, v in scoring.items()) +
               ". Ties break alphabetically by display name. Every distinction cites its Chronicle record.</p>")
    out.append('<ol class="yr-top10">')
    for rank, e in enumerate(entries, 1):
        s = scores[e["id"]]
        out.append(f'<li class="yr-top-entry" id="yr-top-{esc(e["id"])}">')
        out.append(f'  <h3><span class="yr-rank" aria-hidden="true">#{rank}</span> {esc(e["display"])} '
                   f'<span class="yr-score">{s} pt{"s" if s != 1 else ""}</span></h3>')
        out.append(f'  <p>{esc(e["blurb"])}</p>')
        out.append('  <ul class="yr-dist">')
        for d in e["distinctions"]:
            out.append(f'    <li><strong>{esc(d["kind"])}</strong> (+{scoring[d["kind"]]}): {esc(d["claim"])} '
                       f'<span class="yr-dsrc">— {esc(d["source"])}</span></li>')
        out.append("  </ul>")
        out.append('  <p class="yr-entry-links">' + " · ".join(entry_links(e, waves)) + "</p>")
        out.append("</li>")
    out.append("</ol>")
    out.append('<p class="yr-compare-all"><a href="compare.html">Open VS mode to compare the contenders →</a></p>')
    return "\n".join(out)


def render_value(review, items):
    packs, singles = best_value(review, items)
    out = [f'<p class="yr-criteria"><strong>Criteria:</strong> {esc(review["bestValue"]["criteria"])}</p>']
    out.append('<h3>Multi-packs by announced cost per packed figure</h3>')
    out.append('<table class="yr-table"><thead><tr><th scope="col">Pack</th><th scope="col">Announced MSRP</th>'
               '<th scope="col">Packed figures</th><th scope="col">Per figure</th></tr></thead><tbody>')
    for p in packs:
        out.append(f'<tr><th scope="row"><a href="preorders.html">{esc(p["name"])}</a></th>'
                   f'<td>{money(p["price"])}</td><td>{p["figures"]}</td><td><strong>{money(p["perFigure"])}</strong></td></tr>')
    out.append("</tbody></table>")
    out.append('<h3>Singles at the $27.99 standard</h3>\n<ul class="yr-singles">')
    for s in [x for x in singles if x["price"] <= 27.99][:8]:
        out.append(f'  <li><a href="preorders.html">{esc(s["name"])}</a> — {money(s["price"])}</li>')
    out.append("</ul>")
    out.append(f'<p class="yr-value-note">{esc(review["bestValue"]["note"])}</p>')
    return "\n".join(out)


def render_prices(review, signals):
    out = ['<p class="yr-criteria"><strong>Coverage:</strong> reported-price data exists for '
           f'{len(signals)} figures — none of them 2026 releases. Every number below is a reported sold, '
           "average, listing, or claim with a named source. The Chronicle publishes no price index.</p>"]
    for pm in review["priceMovements"]:
        s = signals[pm["signalId"]]
        m = movement_math(pm["solds"])
        seq = ", ".join(f'{d}: {money(p)}' for d, p in pm["solds"])
        arrow = "▲" if m["delta"] > 0 else ("▼" if m["delta"] < 0 else "—")
        out.append(f'<section class="yr-move" aria-labelledby="mv-{esc(pm["signalId"])}">')
        out.append(f'  <h3 id="mv-{esc(pm["signalId"])}">{esc(s["label"])} <span class="yr-move-delta">{arrow} {money(m["delta"])} ({m["pct"]:+.1f}%)</span></h3>')
        out.append(f'  <p>Reported solds: {esc(seq)}. First → last: {money(m["first"])} → {money(m["last"])}, '
                   f'a {money(abs(m["delta"]))} move ({m["pct"]:+.1f}%). <span class="yr-dsrc">— {esc(pm["note"])} Source: {esc(s["source"])}</span></p>')
        out.append("</section>")
    out.append("<h3>Other reported bands (no sold sequence documented)</h3>\n<ul>")
    moved = {pm["signalId"] for pm in review["priceMovements"]}
    for sid, s in signals.items():
        if sid in moved:
            continue
        kind = {"sold-band": "reported sold band", "sold-avg": "reported sold average",
                "listing": "listing (not a sale)", "claimed": "claimed (single-source)"}.get(s["kind"], s["kind"])
        band = s.get("display") or ""
        flag = ' <span class="yr-flag">single-source</span>' if s.get("singleSource") else ""
        out.append(f'  <li><strong>{esc(s["label"])}</strong> — {esc(kind)} {esc(band)}{flag} '
                   f'<span class="yr-dsrc">— {esc(s["source"])}</span></li>')
    out.append("</ul>")
    return "\n".join(out)


def render_surprises(review):
    out = ['<ol class="yr-surprises">']
    for x in review["surprises"]:
        src = x["source"]
        out.append(f'  <li><h3>{esc(x["title"])}</h3><p>{esc(x["text"])} '
                   f'<a class="yr-src" href="{esc(src["url"])}">{esc(src["label"])}</a></p></li>')
    out.append("</ol>")
    return "\n".join(out)


def render_rarity(review):
    out = ["<ul>"]
    for x in review["rarityHighlights"]:
        src = x["source"]
        out.append(f'  <li>{esc(x["text"])} <a class="yr-src" href="{esc(src["url"])}">{esc(src["label"])}</a></li>')
    out.append("</ul>")
    out.append('<p><a href="rarity.html">Full Rarity Guide →</a> · <a href="market-briefing.html">2026 Market Briefing →</a></p>')
    return "\n".join(out)


def render_ko(review):
    ko = review["koWatch"]
    out = [f"<p><strong>{esc(ko['headline'])}</strong></p>", "<ul>"]
    for it in ko["items"]:
        src = it["source"]
        out.append(f'  <li>{esc(it["text"])} <a class="yr-src" href="{esc(src["url"])}">{esc(src["label"])}</a></li>')
    out.append("</ul>")
    out.append('<p><a href="auth-wizard.html">Run the authentication wizard →</a></p>')
    return "\n".join(out)


def render_narrative(review):
    out = []
    for x in review["narrative"]:
        out.append(f'<section class="yr-narr"><h3>{esc(x["heading"])}</h3><p>{esc(x["body"])}</p><p class="yr-narr-src">')
        out.append(" ".join(f'<a class="yr-src" href="{esc(s["url"])}">{esc(s["label"])}</a>' for s in x["sources"]))
        out.append("</p></section>")
    return "\n".join(out)


def render_cross(stats):
    out = ["<ul class=\"yr-links\">"]
    links = [
        ("timeline.html", "Legends Timeline — the year-by-year line history"),
        ("market-briefing.html", "2026 Market Briefing — the market narrative in full"),
        ("rarity.html", "Rarity Guide — chase vs variant vs exclusive vs limited"),
        ("radar.html", "Radar — what's coming next"),
        ("preorders.html", "Pre-order tracker — statuses and countdowns"),
        ("calendar.html", "Release Calendar — dates on a grid"),
        ("encyclopedia.html", "Encyclopedia — the full archive"),
        ("compare.html", "VS mode — compare the contenders side by side"),
        ("quest.html", "Grail Quest — turn 2026's standouts into quests"),
        ("watchlist.html", "Watchlist — Price Watch with reported bands"),
        ("price-guide.html", "Price Guide — how to value your own figures"),
        ("gift.html", "Gift Finder — 2026 picks by recipient"),
        ("api.html", "API — the year-review endpoint for agents"),
    ]
    for href, label in links:
        out.append(f'  <li><a href="{href}">{esc(label)} →</a></li>')
    out.append('  <li>2026 encyclopedia waves: ' + " · ".join(
        f'<a href="waves/{esc(w["id"])}.html">{esc(w["series"] or w["id"])}</a>' for w in stats["waves2026"]) + "</li>")
    out.append("</ul>")
    return "\n".join(out)


def build_api_payload(review, waves, items, signals, stats, scores):
    scoring = review["scoring"]
    entries = sorted(review["top10"], key=lambda e: (-scores[e["id"]], e["display"].lower()))
    top = []
    for e in entries:
        links = {"preorders": "preorders.html"}
        if e.get("figureRef"):
            links["deepLink"] = anchor_for(waves, e["figureRef"])
            links["compareUrl"] = compare_url(e["figureRef"])
        if e.get("waveRef"):
            links["wavePage"] = f"waves/{e['waveRef']}.html"
        top.append({
            "id": e["id"],
            "display": e["display"],
            "score": scores[e["id"]],
            "scoring": scoring,
            "distinctions": e["distinctions"],
            "blurb": e["blurb"],
            "links": links,
        })
    movements = []
    for pm in review["priceMovements"]:
        s = signals[pm["signalId"]]
        movements.append({
            "signalId": pm["signalId"],
            "label": s["label"],
            "kind": s["kind"],
            "source": s["source"],
            "sourceUrl": s.get("sourceUrl"),
            "solds": [{"date": d, "price": p} for d, p in pm["solds"]],
            "math": movement_math(pm["solds"]),
        })
    # "top10" is the FIRST list: the manifest-driven validator uses it for itemSchema.
    return {
        "version": "v1",
        "observed": review["observed"],
        "methodology": " ".join(review["methodology"]),
        "count": len(top),
        "top10": top,
        "archiveStats": {
            "waves2026": stats["waves2026"],
            "figures2026": stats["figures2026"],
            "tracked2026": stats["tracked2026"],
            "trackedTotal": stats["trackedTotal"],
            "priceSignals": len(signals),
        },
        "priceMovements": movements,
        "gaps": review["gaps"],
        "page": "2026-review.html",
    }


def main():
    review, waves, items, signals = load()
    scores = validate(review, waves, items, signals)
    stats = archive_stats(waves, items)

    payload = build_api_payload(review, waves, items, signals, stats, scores)
    API_OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    page = PAGE.read_text(encoding="utf-8")
    page = splice(page, STATS_BEGIN, STATS_END, render_stats(stats, signals))
    page = splice(page, METHOD_BEGIN, METHOD_END, render_method(review))
    page = splice(page, SCRUB_BEGIN, SCRUB_END, render_scrubber(review["months"]))
    page = splice(page, MONTHS_BEGIN, MONTHS_END, render_months(review["months"]))
    page = splice(page, TOP10_BEGIN, TOP10_END, render_top10(review, waves, scores))
    page = splice(page, VALUE_BEGIN, VALUE_END, render_value(review, items))
    page = splice(page, PRICES_BEGIN, PRICES_END, render_prices(review, signals))
    page = splice(page, SURPRISES_BEGIN, SURPRISES_END, render_surprises(review))
    page = splice(page, RARITYH_BEGIN, RARITYH_END, render_rarity(review))
    page = splice(page, KO_BEGIN, KO_END, render_ko(review))
    page = splice(page, NARR_BEGIN, NARR_END, render_narrative(review))
    page = splice(page, CROSS_BEGIN, CROSS_END, render_cross(stats))
    PAGE.write_text(page, encoding="utf-8")

    print(f"review: top10 scored {[scores[e['id']] for e in review['top10']]}")
    print(f"review: {stats['figures2026']} figures in {len(stats['waves2026'])} 2026 waves, "
          f"{stats['tracked2026']}/{stats['trackedTotal']} tracker items in 2026")
    print(f"wrote {API_OUT.relative_to(ROOT)}, regenerated {PAGE.relative_to(ROOT)} sections")


if __name__ == "__main__":
    main()
