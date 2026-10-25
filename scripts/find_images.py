#!/usr/bin/env python3
"""Find pictures for figures that have none, and file them as CANDIDATES for a human.
Nothing here ever edits data/v1/figure-images.json. A person accepts each match in
review-images.html, which exports entries to paste into the manifest.

    python3 scripts/find_images.py                       # crawl ActionFigure411 guides (about 3 minutes), match
    python3 scripts/find_images.py --cache af.json       # reuse a saved crawl
    python3 scripts/find_images.py --save-cache af.json  # save the crawl for next time

Source adapters live in ADAPTERS. Each returns rows of
  {"page": url, "pageTitle": str, "alt": str, "imageUrl": str, "imageSource": str}
To add a shop, write one function that returns those rows and register it.

Matching never guesses across years: the shop guides carry no year or SKU, so a match needs
(a) the figure's name tokens to equal the listing's name once the wave words are removed,
(b) a wave word in common, and (c) exactly one listing for that figure and one figure for that
listing. That is tier A. Looser pairs are tier B and need a human eye. Names with no listing
at all stay "not pictured", which is the honest answer.
Etiquette: one request per second, a User-Agent that says who is asking, robots.txt respected
(ActionFigure411 allows the guide pages). Ask the site owner before relying on their images.
"""
import argparse, collections, html, json, re, time, unicodedata, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "data" / "v1"
UA = "Mozilla/5.0 (compatible; MarvelLegendsChronicle-find/1.0; +https://github.com/astercast/marvel-legends-chronicle)"
STOP = set("marvel legends series the of a and wave baf build figure action visual guide pack 6 inch".split())
GEN = {"pack", "build", "figure", "2", "3", "4", "exclusive", "exclusives", "legends", "marvel", "and", "amp"}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=30).read().decode("utf8", "replace")


def adapter_af411():
    base = "https://www.actionfigure411.com"
    sm = get(base + "/sitemap.xml")
    urls = sorted(set(re.findall(r"https://www\.actionfigure411\.com/marvel/marvel-legends[^<\"]*visual-guide[^<\"]*", sm)))
    rows = []
    for u in urls:
        time.sleep(1.0)
        try:
            t = get(u)
        except Exception:
            continue
        title = html.unescape((re.search(r"<title>(.*?)</title>", t, re.S) or [None, ""])[1].strip())
        for m in re.finditer(r'<img[^>]+src="([^"]*?/marvel/images/thumbs/[^"]+)"[^>]*?alt="([^"]*)"', t):
            thumb = m.group(1)
            full = (base + thumb if thumb.startswith("/") else thumb).replace("/thumbs/", "/")
            rows.append({"page": u, "pageTitle": title, "alt": html.unescape(m.group(2)),
                         "imageUrl": full, "imageSource": "ActionFigure411"})
    return rows


ADAPTERS = {"af411": adapter_af411}


def toks(s):
    s = unicodedata.normalize("NFKD", s).lower().replace("&", " and ")
    return [t for t in re.sub(r"[^a-z0-9 ]+", " ", s).split() if t]


def name_tokens(n):
    return set(toks(re.sub(r"\(.*?\)", "", n))) - GEN


def wave_tokens(f):
    return (set(toks(f["waveSeries"] + " " + (f.get("waveBaf") or ""))) - STOP - {str(f["year"])}) | ({"baf"} if f.get("waveBaf") else set())


def match(figures, have, rows):
    L = []
    for r in rows:
        r["pt"] = set(toks(r["pageTitle"].replace("Visual Guide", ""))) - STOP
        r["at"] = set(toks(r["alt"]))
        r["resid"] = r["at"] - r["pt"] - STOP - GEN
    todo = [f for f in figures if f["id"] not in have]
    best = {}
    for f in todo:
        nt, wt = name_tokens(f["name"]), wave_tokens(f)
        if not nt:
            continue
        hits = [r for r in rows if r["resid"] == nt and (wt & (r["pt"] | r["at"]))]
        loose = [r for r in rows if nt <= r["at"] and (wt & (r["pt"] | r["at"]))]
        if len(hits) == 1:
            best[f["id"]] = ("A", hits[0])
        elif loose:
            best[f["id"]] = ("B", loose[0])
    use = collections.Counter(r["imageUrl"] for t, r in best.values())
    out = []
    for fid, (tier, r) in best.items():
        if tier == "A" and use[r["imageUrl"]] > 1:
            tier = "B"        # one listing claimed by several figures: a person must pick
        f = next(x for x in figures if x["id"] == fid)
        out.append({"figureId": fid, "tier": tier, "name": f["name"], "wave": f["waveSeries"], "year": f["year"],
                    "imageUrl": r["imageUrl"], "imageSource": r["imageSource"], "sourceUrl": r["page"], "listing": r["alt"]})
    out.sort(key=lambda c: (c["tier"], -c["year"], c["name"]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="af411", choices=ADAPTERS)
    ap.add_argument("--cache")
    ap.add_argument("--save-cache")
    ap.add_argument("--permission-granted", action="store_true",
                    help="the site owner has given permission to use this source")
    a = ap.parse_args()
    # OWNER GATE (2026-10-24): ActionFigure411 is permission-first. Nothing
    # may fetch it until the owner confirms permission was asked and granted.
    # A saved cache is not a loophole: matching cached AF411 rows is gated too.
    if a.source == "af411" and not a.permission_granted:
        raise SystemExit("ActionFigure411 is permission-first (owner gate, 2026-10-24): "
                         "ask the site owner first, then re-run with --permission-granted.")
    if a.cache:
        rows = json.loads(Path(a.cache).read_text())
    else:
        rows = ADAPTERS[a.source]()
        if a.save_cache:
            Path(a.save_cache).write_text(json.dumps(rows))
    figures = json.loads((D / "figures.json").read_text())
    have = {e["figureId"] for e in json.loads((D / "figure-images.json").read_text())["entries"] if e.get("status") != "dead"}
    cands = match(figures, have, rows)
    doc = {"generatedAt": time.strftime("%Y-%m-%d"), "source": a.source, "listings": len(rows),
           "unpictured": sum(1 for f in figures if f["id"] not in have),
           "tierA": sum(c["tier"] == "A" for c in cands), "tierB": sum(c["tier"] == "B" for c in cands),
           "candidates": cands}
    (D / "image-candidates.json").write_text(json.dumps(doc, indent=1) + "\n")
    print({k: v for k, v in doc.items() if k != "candidates"})


if __name__ == "__main__":
    main()
