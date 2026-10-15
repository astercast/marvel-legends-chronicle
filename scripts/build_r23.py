#!/usr/bin/env python3
"""R23 Marvel correction build. Generates the 9 top-level surface files plus
the wave and character families from data/v1, in the R23 design system.
Presented catalogue identifiers are derived here; the raw census key never
reaches a generated page (the schema-as-prose ban). Run: python3 scripts/build_r23.py
"""
import json, re, shutil
from collections import Counter, defaultdict
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "data" / "v1"
CHECKED = "14 October 2026"

def load(name):
    return json.loads((D / name).read_text())

FIGS = load("figures.json")
WAVES = {w["id"]: w for w in load("waves.json")}
CHARS = load("characters.json")["characters"]
IMAGES = {e["figureId"]: e for e in load("figure-images.json")["entries"]}
SIGNALS = load("price-signals.json")["signals"]
STATS = load("stats.json")
PREORDERS = load("preorders.json")["items"]
DROPWEEK = load("drop-week.json")
ENC = load("encyclopedia.json")
RARITY = load("rarity.json")
RADAR = load("radar-candidates.json")

def slugify(raw):
    return re.sub(r"[^a-z0-9]+", "-", raw.lower()).strip("-")

def base_name(n):
    return re.sub(r"\s*\(.*?\)\s*", "", n).strip()

CHAR_BY_NAME = {c["name"]: c for c in CHARS}
# presented identifier: year, wave series, position in wave. No raw key.
# The census reuses one id for distinct variant entries in the same wave
# (234 repeated ids), so slugs and identifiers are occurrence-aware.
_pos = Counter(); _occ = Counter(); META = []
for f in FIGS:
    _pos[f["waveId"]] += 1; _occ[f["id"]] += 1
    slug = slugify(f["id"]) + (f'-{_occ[f["id"]]}' if _occ[f["id"]] > 1 else "")
    META.append({"slug": slug, "pid": f'{f["year"]} · {f["manufacturer"]} {f["waveSeries"]} · No. {_pos[f["waveId"]]}'})
assert len(set(m["pid"] for m in META)) == len(FIGS), "presented id collision"
assert len(set(m["slug"] for m in META)) == len(FIGS), "slug collision"

def rowdata(f, slug, pid):
    img = IMAGES.get(f["id"])
    facts = [f["waveSeries"], str(f["year"]), f["manufacturer"]]
    if f.get("exclusive"): facts.append(f'{f["exclusive"]} exclusive')
    if f.get("bafPiece"): facts.append(f'Build A Figure piece: {f["bafPiece"]}')
    return {
        "slug": slug, "pid": pid, "name": f["name"],
        "fact": ", ".join(facts),
        "path": f'{base_name(f["name"])} · {f["waveSeries"]} · {f["year"]}',
        "img": img["imageUrl"] if img else None,
        "year": f["year"], "wave": f["waveSeries"], "waveId": f["waveId"],
        "character": base_name(f["name"]), "maker": f["manufacturer"],
        "exclusive": f.get("exclusive") or "", "baf": bool(f.get("bafPiece")),
        "pictured": bool(img),
    }

ROWS = [rowdata(f, m["slug"], m["pid"]) for f, m in zip(FIGS, META)]
BY_SLUG = {r["slug"]: r for r in ROWS}

def state_btns(slug):
    return (f'<div class="state">'
            f'<button class="statebtn" data-state="owned" data-slug="{slug}" aria-pressed="false">Owned</button>'
            f'<button class="statebtn" data-state="wanted" data-slug="{slug}" aria-pressed="false">Wanted</button></div>')

def row_html(r, prefix=""):
    media = (f'<img class="thumb" src="{escape(r["img"])}" alt="" loading="lazy" referrerpolicy="no-referrer">' if r["img"]
             else '<span class="notpic">Not pictured</span>')
    return (f'<li class="row">{media}<div><div class="pid">{escape(r["pid"])}</div>'
            f'<div class="name"><a href="{prefix}spec-sheet.html?f={r["slug"]}">{escape(r["name"])}</a></div>'
            f'<div class="fact">{escape(r["fact"])}</div></div>{state_btns(r["slug"])}</li>')

def tile_html(r, prefix=""):
    """The wall's unit: the plate is the largest element; name under it; one
    fact line; the state pair on one row. Absence is the same 4:5 plate in
    typographic form, so pictured and unpictured hold one rhythm."""
    if r["img"]:
        media = (f'<a class="platewrap" href="{prefix}spec-sheet.html?f={r["slug"]}">'
                 f'<img src="{escape(r["img"])}" alt="{escape(r["name"])} figure photograph" loading="lazy" referrerpolicy="no-referrer"></a>')
    else:
        media = (f'<a class="platewrap absence" href="{prefix}spec-sheet.html?f={r["slug"]}">'
                 f'<span class="absname">{escape(r["name"])}</span><span class="micro">Not pictured</span></a>')
    marks = []
    if r["exclusive"]: marks.append(f'{r["exclusive"]} exclusive')
    if r["baf"]: marks.append("Build A Figure piece")
    fact = f'{r["wave"]} · {r["year"]}' + (f' · {" · ".join(marks)}' if marks else "")
    return (f'<li class="tile">{media}<div class="pid">{escape(r["pid"])}</div>'
            f'<div class="name"><a href="{prefix}spec-sheet.html?f={r["slug"]}">{escape(r["name"])}</a></div>'
            f'<div class="fact">{escape(fact)}</div>{state_btns(r["slug"])}</li>')

NAV = [("Catalog", "visual-database.html"), ("Upcoming", "radar.html"), ("Compare", "compare.html"),
       ("My Collection", "my-vault.html"), ("Guide", "encyclopedia.html")]

def chrome(title, desc, current, prefix="", extra_head=""):
    nav = "".join(
        f'<a href="{prefix}{href}"{" aria-current=\"page\"" if label == current else ""}>{label}</a>'
        for label, href in NAV)
    wm_current = ' aria-current="page"' if current == "Home" else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)}</title>
<meta name="description" content="{escape(desc)}">
<link rel="icon" href="{prefix}favicon.ico" sizes="48x48">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{prefix}assets/css/r23.css">
{extra_head}</head>
<body>
<header class="topbar"><a class="wordmark" href="{prefix}index.html"{wm_current}>Marvel Legends Chronicle</a>
<nav>{nav}</nav>
<form action="{prefix}visual-database.html" method="get" role="search"><input type="search" name="q" placeholder="Search" aria-label="Search figures" required></form></header>
<main>
"""

FOOT_LINKS = [("Home", "index.html")] + NAV

def foot(prefix=""):
    links = "".join(f'<a href="{prefix}{href}">{label}</a>' for label, href in FOOT_LINKS)
    return f"""</main>
<footer class="site"><nav class="footmap" aria-label="Site map">{links}</nav>
<p>Marvel Legends Chronicle · Figure data from the Chronicle census, 2002–2026 · Updated 14 October 2026</p></footer>
</body>
</html>
"""

def crumbs(prefix, trail):
    """Breadcrumb for leaf/hub pages. trail: [(label, href-or-None), ...];
    the last item is the current page (plain text, aria-current)."""
    parts = []
    for label, href in trail:
        if href:
            parts.append(f'<a href="{prefix}{href}">{escape(label)}</a>')
        else:
            parts.append(f'<span aria-current="page">{escape(label)}</span>')
    return f'<nav class="backline crumbs" aria-label="Breadcrumb">{" · ".join(parts)}</nav>'

def wire(prefix):
    return WIRE.replace("{p}", prefix if prefix else "./")

WIRE = """<script type="module">
import { wireState, loadSet, guardImages } from "{p}assets/js/r23.js";
guardImages();
document.querySelectorAll("[data-slug]").forEach(b=>{
  const set = loadSet(b.dataset.state); b.setAttribute("aria-pressed", set.has(b.dataset.slug));
});
wireState(document);
</script>
"""

def write(rel, text):
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    assert "::" not in text, f"schema string leaked into {rel}"
    assert not re.search(r"`[A-Za-z_]+:[A-Za-z0-9_]+`", text), f"backticked schema literal leaked into {rel}"
    visible = re.sub(r"<script.*?</script>", " ", text, flags=re.S)
    assert "`" not in visible, f"backticked field literal in presented copy of {rel}"
    p.write_text(text)
    return rel

# ---------- generated data: browse chunks, search index, figure shards ----------
def gen_data():
    # Browse order is presentation, not census: newest first, pictured first
    # within the year, so the catalog's first paint is its best shelf. The
    # census files themselves are never reordered.
    browse_rows = sorted(ROWS, key=lambda r: (-r["year"], not r["pictured"], r["name"]))
    bdir = D / "browse"; shutil.rmtree(bdir, ignore_errors=True); bdir.mkdir(parents=True)
    for i in range(0, len(browse_rows), 50):
        (bdir / f"chunk-{i//50:03d}.json").write_text(json.dumps(browse_rows[i:i+50]))
    (D / "search-index.json").write_text(json.dumps(
        [{k: r[k] for k in ("slug", "pid", "name", "fact", "path", "img", "year", "wave", "character", "maker", "exclusive", "baf", "pictured")} for r in ROWS]))
    sdir = D / "figures"; shutil.rmtree(sdir, ignore_errors=True); sdir.mkdir(parents=True)
    sig_by_fig = defaultdict(list)
    for s in SIGNALS: sig_by_fig[s["figId"]].append(s)
    by_base = defaultdict(list)
    for i, f in enumerate(FIGS): by_base[base_name(f["name"])].append(i)
    for i, f in enumerate(FIGS):
        r = ROWS[i]; img = IMAGES.get(f["id"])
        others = [{"slug": ROWS[j]["slug"], "pid": ROWS[j]["pid"], "name": ROWS[j]["name"],
                   "fact": ROWS[j]["fact"], "img": ROWS[j]["img"]} for j in by_base[base_name(f["name"])] if j != i]
        others.sort(key=lambda o: o["fact"])
        shard = {
            "slug": r["slug"], "pid": r["pid"], "name": f["name"], "wave": f["waveSeries"],
            "waveSlug": f["waveId"], "year": f["year"], "maker": f["manufacturer"],
            "character": base_name(f["name"]),
            "charSlug": CHAR_BY_NAME[base_name(f["name"])]["slug"] if base_name(f["name"]) in CHAR_BY_NAME else None,
            "exclusive": f.get("exclusive"), "bafPiece": f.get("bafPiece"),
            "variant": f.get("variant"), "notes": f.get("notes"), "waveBaf": f.get("waveBaf"),
            "img": ({"url": img["imageUrl"], "source": img["imageSource"], "sourceUrl": img["sourceUrl"],
                     "verifiedAt": img["verifiedAt"]} if img else None),
            "buy": (img.get("buy", []) if img else []),
            "sold": [{"display": s["display"], "asOf": s["asOf"], "source": s["source"], "kind": s["kind"]}
                     for s in sig_by_fig.get(f["id"], [])],
            "others": others[:12],
            "sourceLine": (f'Source: {img["imageSource"]} product photography, verified {img["verifiedAt"]}; '
                           f'census record checked {CHECKED}.' if img else
                           f'Source: Chronicle census record, {f["waveSeries"]} ({f["year"]}); checked {CHECKED}.'),
        }
        (sdir / f'{r["slug"]}.json').write_text(json.dumps(shard))

# ---------- Surface 1: Catalog home ----------
def home():
    pictured = [r for r in ROWS if r["pictured"]]
    # The featured figure demonstrates the whole record on the first screen:
    # the newest pictured figure that also carries buy doors (photograph,
    # price door, state). Falls back to the newest pictured figure.
    with_buy = [i for i, f in enumerate(FIGS)
                if f["id"] in IMAGES and IMAGES[f["id"]].get("buy")]
    pool = with_buy or [i for i, r in enumerate(ROWS) if r["pictured"]]
    lead_i = max(pool, key=lambda i: ROWS[i]["year"])
    lead, lead_f = ROWS[lead_i], FIGS[lead_i]
    lead_img = IMAGES[lead_f["id"]]
    lead_sold = "".join(
        f'<div class="priceline"><span>Reported sold: {escape(s["display"])}</span>'
        f'<span class="num">{escape(s["asOf"])} · {escape(s["source"])}</span></div>'
        for s in SIGNALS if s["figId"] == lead_f["id"])
    lead_buy = "".join(
        f'<div class="buyrow"><span>{escape(b["retailer"])}</span>'
        f'<a href="{escape(b["url"])}" rel="noopener">Buy</a></div>'
        f'<div class="priceline"><span>Asking at {escape(b["retailer"])}</span>'
        f'<span class="num">${b["priceUSD"]} · seen {escape(b["priceSeen"])}</span></div>'
        for b in lead_img.get("buy", []))
    wall = sorted((r for r in pictured if r["slug"] != lead["slug"]),
                  key=lambda r: (-r["year"], r["name"]))[:12]
    wall_tiles = "".join(tile_html(r) for r in wall)
    def wave_door(w):
        rows_w = [r for f, r in zip(FIGS, ROWS) if f["waveId"] == w["id"]]
        pic = next((r for r in rows_w if r["pictured"]), None)
        n_pic = sum(1 for r in rows_w if r["pictured"])
        if pic:
            media = (f'<span class="wdplate"><img src="{escape(pic["img"])}" '
                     f'alt="{escape(pic["name"])} figure photograph" loading="lazy" referrerpolicy="no-referrer"></span>')
        else:
            media = f'<span class="wdplate absence"><span class="micro">Not pictured yet</span></span>'
        return (f'<li class="wavedoor"><a href="waves/{w["id"]}.html">{media}'
                f'<span class="wd-name">{escape(w["series"])}</span>'
                f'<span class="wd-fact">{w["year"]} · {len(rows_w)} figures · {n_pic} pictured</span></a></li>')
    doors = "".join(wave_door(w) for w in
                    sorted(WAVES.values(), key=lambda w: (-w["year"], w["series"]))[:6])
    newest = sorted(ROWS, key=lambda r: (-r["year"], r["name"]))[:10]
    up = PREORDERS[:3]
    up_rows = "".join(
        f'<li class="row compact"><div>'
        f'<div class="pid">{escape(u.get("preorderDate") or u.get("releaseWindow") or "")}</div>'
        f'<div class="name">{escape(u["name"])}</div>'
        f'<div class="fact"><span class="micro red">Announced</span> · {escape(u.get("releaseWindow") or "")}</div></div></li>'
        for u in up)
    counts = {
        "By character": (len(CHARS), "characters/index.html"),
        "By wave": (len(WAVES), "waves/index.html"),
        "By year": (len(set(r["year"] for r in ROWS)), "visual-database.html?sort=year"),
        "Toy Biz": (sum(1 for r in ROWS if r["maker"] == "Toy Biz"), "visual-database.html?maker=Toy+Biz"),
        "Hasbro": (sum(1 for r in ROWS if r["maker"] == "Hasbro"), "visual-database.html?maker=Hasbro"),
        "Exclusives": (sum(1 for r in ROWS if r["exclusive"]), "visual-database.html?exclusive=1"),
        "Build A Figure waves": (STATS["bafWaves"], "visual-database.html?baf=1"),
        "Pictured": (len(pictured), "visual-database.html?picture=Pictured"),
        "Not pictured": (len(ROWS) - len(pictured), "visual-database.html?picture=Not+pictured"),
    }
    index_lines = "".join(
        f'<li><a href="{href}"><span>{escape(k)}</span><span class="count">{v:,}</span></a></li>'
        for k, (v, href) in counts.items())
    body = f"""
<h1 class="claim">1,949 figures · 170 waves · 2002–2026</h1>
<form class="bigsearch" action="visual-database.html" method="get" role="search">
<input type="search" name="q" placeholder="Search figures" aria-label="Search figures" required>
<button type="submit">Search</button></form>
<section class="hero">
<figure class="plate"><div class="frame"><img src="{escape(lead["img"])}" alt="{escape(lead["name"])} figure photograph" referrerpolicy="no-referrer" fetchpriority="high"></div></figure>
<div class="heroside">
<p class="micro">Featured figure</p>
<div class="pid">{escape(lead["pid"])}</div>
<h2 class="heroname"><a href="spec-sheet.html?f={lead["slug"]}">{escape(lead["name"])}</a></h2>
<p class="factline">{escape(lead["fact"])}</p>
{lead_sold}
{lead_buy}
<div class="ownwant">{state_btns(lead["slug"])}</div>
<p><a href="spec-sheet.html?f={lead["slug"]}">Full record for {escape(lead["name"])}</a></p>
</div>
</section>
<h2>Pictured figures</h2>
<ul class="tiles">{wall_tiles}</ul>
<p><a href="visual-database.html?picture=Pictured">See all {len(pictured):,} pictured figures</a></p>
<h2>Latest waves</h2>
<ul class="wavedoors">{doors}</ul>
<p><a href="waves/index.html">All 170 waves</a></p>
<h2>Upcoming</h2>
<ul class="rows">{up_rows}</ul>
<p><a href="radar.html">All upcoming releases</a></p>
<h2>Browse</h2>
<ul class="indexlines">{index_lines}</ul>
<h2>Newest additions</h2>
<ul class="rows">{''.join(row_html(r) for r in newest)}</ul>
"""
    write("index.html", chrome("Marvel Legends Chronicle",
          "1,949 Marvel Legends figures, 170 waves, 2002–2026. Search the catalog.", "Home") + body + wire("") + foot())

# ---------- Surface 2: Catalog browse ----------
def browse():
    years = sorted(set(r["year"] for r in ROWS))
    waves_sorted = sorted(WAVES.values(), key=lambda w: (w["year"], w["series"]))
    chars_sorted = sorted(CHARS, key=lambda c: c["name"])
    retailers = sorted(set(r["exclusive"] for r in ROWS if r["exclusive"]))
    def facet(name, values):
        items = "".join(f'<label><span><input type="checkbox" data-facet="{name}" value="{escape(str(v))}"> {escape(str(v))}</span><span class="count">{c:,}</span></label>' for v, c in values)
        return f'<fieldset><legend>{name}</legend>{items}</fieldset>'
    def facet_select(name, values):
        opts = "".join(f'<option value="{escape(str(v))}">{escape(str(v))} ({c:,})</option>' for v, c in values)
        return f'<fieldset><legend>{name}</legend><select data-facet-select="{name}" aria-label="{name}" style="width:100%"><option value="">All</option>{opts}</select></fieldset>'
    facets = (
        facet("Year", [(y, c) for y, c in sorted(Counter(r["year"] for r in ROWS).items())]) +
        facet_select("Wave", [(w["series"], sum(1 for r in ROWS if r["waveId"] == w["id"])) for w in waves_sorted]) +
        facet_select("Character", [(c["name"], c["count"]) for c in chars_sorted]) +
        facet("Maker", [(m, c) for m, c in Counter(r["maker"] for r in ROWS).items()]) +
        facet("Exclusive retailer", [(x, c) for x, c in Counter(r["exclusive"] for r in ROWS if r["exclusive"]).items()]) +
        facet("Build A Figure", [("Has piece", sum(1 for r in ROWS if r["baf"]))]) +
        facet("Picture", [("Pictured", sum(1 for r in ROWS if r["pictured"])), ("Not pictured", sum(1 for r in ROWS if not r["pictured"]))]) +
        facet("My state", [("Owned", 0), ("Wanted", 0), ("Neither", 0)]))
    nchunks = (len(ROWS) + 49) // 50
    body = f"""
<h1>Catalog</h1>
<div class="controls">
<input type="search" id="q" placeholder="Find a figure" aria-label="Find a figure">
<select id="scope" aria-label="Search scope"><option>All</option><option>Character</option><option>Wave</option></select>
<select id="sort" aria-label="Sort"><option value="new" selected>Sort: Newest</option><option value="name">Sort: Name</option><option value="year">Sort: Year</option><option value="wave">Sort: Wave order</option></select>
<button class="plain" id="filtersBtn" type="button">Filters</button>
<button class="plain" id="viewBtn" type="button">List view</button>
</div>
<p class="resultsline" id="results">1,949 figures</p>
<div class="layout">
<div class="facets" id="facets">{facets}<button type="button" id="applyBtn">Show results</button></div>
<div><ul class="rows tiles" id="rows"></ul>
<p class="resultsline" id="shown"></p>
<button class="plain" id="more" type="button">Load more</button></div>
</div>
<script>
// First-paint truth for linked views: a filtered or sorted URL must never
// sit under the unfiltered 1,949 heading with an empty results area while
// the catalog loads. This runs during parsing, before the module below;
// counts for the home-linked filters are computed by the generator.
(function(){{
  var p=new URLSearchParams(location.search); if(!p.toString()) return;
  var counts={{"picture": {json.dumps({k: sum(1 for r in ROWS if (r["pictured"] and k == "Pictured") or (not r["pictured"] and k == "Not pictured")) for k in ("Pictured", "Not pictured")})}, "maker": {json.dumps({m: sum(1 for r in ROWS if r["maker"] == m) for m in sorted(set(r["maker"] for r in ROWS))})}, "exclusive": {sum(1 for r in ROWS if r["exclusive"])}, "baf": {sum(1 for r in ROWS if r["baf"])}}};
  var msg=null;
  if(p.get("picture")&&counts.picture[p.get("picture")]!=null) msg=counts.picture[p.get("picture")].toLocaleString()+" figures · Filters on · Picture: "+p.get("picture");
  else if(p.get("maker")&&counts.maker[p.get("maker")]!=null) msg=counts.maker[p.get("maker")].toLocaleString()+" figures · Filters on · Maker: "+p.get("maker");
  else if(p.get("exclusive")) msg=counts.exclusive.toLocaleString()+" figures · Filters on · Exclusive retailer";
  else if(p.get("baf")) msg=counts.baf.toLocaleString()+" figures · Filters on · Build A Figure: Has piece";
  else if(p.get("sort")==="year") msg="{len(ROWS):,} figures · Sorted by year";
  else if(p.get("sort")==="wave") msg="{len(ROWS):,} figures · Sorted by wave order";
  else msg="Loading the filtered catalog";
  document.getElementById("results").textContent=msg;
  document.getElementById("rows").innerHTML='<li class="row compact"><div><div class="name">Loading figures</div><div class="fact">The matching figures load here.</div></div></li>';
  document.getElementById("shown").textContent="Loading";
}})();
</script>
<script type="module">
import {{ getJSON, esc, stateButtons, wireState, loadSet, guardImages }} from "./assets/js/r23.js";
guardImages(document);
const NCH={nchunks}; let all=null, view=[], shown=0, grid=true;
const params=new URLSearchParams(location.search);
async function loadAll(){{
  if(all) return all;
  const chunks=await Promise.all(Array.from({{length:NCH}},(_,i)=>getJSON(`data/v1/browse/chunk-${{String(i).padStart(3,"0")}}.json`)));
  all=chunks.flat(); return all;
}}
function activeFilters(){{
  const f={{}}; document.querySelectorAll("[data-facet]:checked").forEach(c=>{{ (f[c.dataset.facet] ||= []).push(c.dataset.facet==="Year"?+c.value:c.value); }});
  document.querySelectorAll("[data-facet-select]").forEach(sel=>{{ if(sel.value) (f[sel.dataset.facetSelect] ||= []).push(sel.value); }});
  return f;
}}
function describe(f,q){{
  const parts=[]; if(q) parts.push(`matching "${{q}}"`);
  for(const [k,vs] of Object.entries(f)) parts.push(`${{k}}: ${{vs.join(", ")}}`);
  const s=document.getElementById("sort").value;
  if(s==="new") parts.push("Sorted by newest"); if(s==="year") parts.push("Sorted by year"); if(s==="wave") parts.push("Sorted by wave order");
  return parts.length?`Filters on · ${{parts.join(" · ")}}`:"No filters on";
}}
let applySeq=0;
async function apply(){{
  const seq=++applySeq;
  const data=await loadAll(); if(seq!==applySeq) return;
  const f=activeFilters(); const q=document.getElementById("q").value.trim().toLowerCase();
  const scope=document.getElementById("scope").value; const owned=loadSet("owned"), wanted=loadSet("wanted");
  view=data.filter(r=>{{
    if(q){{ const hay=scope==="Character"?r.character:scope==="Wave"?r.wave:r.name+" "+r.character+" "+r.wave;
      if(!hay.toLowerCase().includes(q)) return false; }}
    for(const [k,vs] of Object.entries(f)){{
      if(k==="Year"&&!vs.includes(r.year)) return false;
      if(k==="Wave"&&!vs.includes(r.wave)) return false;
      if(k==="Character"&&!vs.includes(r.character)) return false;
      if(k==="Maker"&&!vs.includes(r.maker)) return false;
      if(k==="Exclusive retailer"&&!vs.includes(r.exclusive)) return false;
      if(k==="Build A Figure"&&!r.baf) return false;
      if(k==="Picture"&&!vs.includes(r.pictured?"Pictured":"Not pictured")) return false;
      if(k==="My state"){{ const st=owned.has(r.slug)?"Owned":wanted.has(r.slug)?"Wanted":"Neither"; if(!vs.includes(st)) return false; }}
    }} return true;
  }});
  const s=document.getElementById("sort").value;
  view.sort((a,b)=> s==="new"? b.year-a.year||(b.pictured-a.pictured)||a.name.localeCompare(b.name) : s==="year"? a.year-b.year||a.name.localeCompare(b.name) : s==="wave"? a.wave.localeCompare(b.wave)||a.pid.localeCompare(b.pid) : a.name.localeCompare(b.name));
  shown=0; document.getElementById("rows").innerHTML=""; renderMore();
  const n=Object.values(f).flat().length+(q?1:0);
  document.getElementById("filtersBtn").textContent=`Filters${{n?` (${{n}})`:""}}`;
  document.getElementById("results").innerHTML=`${{view.length.toLocaleString()}} figures · ${{esc(describe(f,q))}} <a class="clear" href="visual-database.html">Clear</a>`;
}}
function tileHTML(r){{
  const marks=(r.exclusive?` · ${{esc(r.exclusive)}} exclusive`:"")+(r.baf?` · Build A Figure piece`:"");
  const media=r.img?`<a class="platewrap" href="spec-sheet.html?f=${{r.slug}}"><img src="${{esc(r.img)}}" alt="${{esc(r.name)}} figure photograph" loading="lazy" referrerpolicy="no-referrer"></a>`:`<a class="platewrap absence" href="spec-sheet.html?f=${{r.slug}}"><span class="absname">${{esc(r.name)}}</span><span class="micro">Not pictured</span></a>`;
  return `<li class="tile">${{media}}<div class="pid">${{esc(r.pid)}}</div><div class="name"><a href="spec-sheet.html?f=${{r.slug}}">${{esc(r.name)}}</a></div><div class="fact">${{esc(r.wave)}} · ${{r.year}}${{marks}}</div>${{stateButtons(r.slug)}}</li>`;
}}
function rowHTML(r){{
  return `<li class="row">${{r.img?`<img class="thumb" src="${{esc(r.img)}}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span class="notpic">Not pictured</span>`}}<div><div class="pid">${{esc(r.pid)}}</div><div class="name"><a href="spec-sheet.html?f=${{r.slug}}">${{esc(r.name)}}</a></div><div class="fact">${{esc(r.fact)}}</div></div>${{stateButtons(r.slug)}}</li>`;
}}
function renderMore(){{
  const ul=document.getElementById("rows"); const next=view.slice(shown,shown+50);
  ul.insertAdjacentHTML("beforeend", next.map(r=> grid? tileHTML(r) : rowHTML(r)).join(""));
  shown+=next.length;
  document.getElementById("shown").textContent=`Showing ${{shown.toLocaleString()}} of ${{view.length.toLocaleString()}} · ${{(view.length-shown).toLocaleString()}} remain`;
  document.getElementById("more").style.display=shown<view.length?"":"none";
}}
// First paint: chunk 0 only (50 rows). The full census is fetched only when
// a search, filter, sort, or load-more action asks for it. URL parameters
// set the controls directly (no .click(), so no change event fires a second
// concurrent apply) and a single apply() renders the linked view.
(async()=>{{
  const q0=params.get("q")||"";
  if([...params.keys()].length){{
    document.getElementById("q").value=q0;
    const setBox=(facet,val)=>{{ const el=document.querySelector(`[data-facet="${{facet}}"][value="${{val}}"]`); if(el) el.checked=true; }};
    if(params.get("maker")) setBox("Maker",params.get("maker"));
    if(params.get("picture")) setBox("Picture",params.get("picture"));
    if(params.get("year")) setBox("Year",params.get("year"));
    if(params.get("baf")) setBox("Build A Figure","Has piece");
    if(params.get("exclusive")) document.querySelectorAll('[data-facet="Exclusive retailer"]').forEach(c=>c.checked=true);
    const setSel=(name,val)=>{{ const el=document.querySelector(`[data-facet-select="${{name}}"]`); if(el&&val) el.value=val; }};
    setSel("Character",params.get("character")); setSel("Wave",params.get("wave"));
    if(params.get("sort")) document.getElementById("sort").value=params.get("sort");
    await apply(); return;
  }}
  const first=await getJSON("data/v1/browse/chunk-000.json");
  view=first; renderMore();
  document.getElementById("shown").textContent=`Showing 50 of 1,949 · 1,889 remain`;
  document.getElementById("more").style.display="";
}})();
document.getElementById("more").addEventListener("click", async()=>{{ if(!all){{ view=await loadAll(); }} renderMore(); }});
let deb; document.getElementById("q").addEventListener("input",()=>{{ clearTimeout(deb); deb=setTimeout(apply,200); }});
document.getElementById("scope").addEventListener("change",apply);
document.getElementById("sort").addEventListener("change",apply);
document.querySelectorAll("[data-facet]").forEach(c=>c.addEventListener("change",()=>{{ if(innerWidth>700) apply(); }}));
document.querySelectorAll("[data-facet-select]").forEach(c=>c.addEventListener("change",()=>{{ if(innerWidth>700) apply(); }}));
document.getElementById("filtersBtn").addEventListener("click",()=>document.getElementById("facets").classList.add("open"));
document.getElementById("applyBtn").addEventListener("click",()=>{{ document.getElementById("facets").classList.remove("open"); apply(); }});
document.getElementById("viewBtn").addEventListener("click",e=>{{ grid=!grid; const ul=document.getElementById("rows"); ul.classList.toggle("tiles",grid); e.target.textContent=grid?"List view":"Grid view"; shown=0; ul.innerHTML=""; renderMore(); }});
wireState(document);
</script>
"""
    write("visual-database.html", chrome("Catalog | Marvel Legends Chronicle",
          "Browse 1,949 Marvel Legends figures by year, wave, character, maker, and picture.", "Catalog") + body + foot())

# ---------- Surface 3: Figure page (spec-sheet pattern) ----------
def figure_page():
    body = """
""" + crumbs("", [("Home", "index.html"), ("Catalog", "visual-database.html"), ("Figure record", None)]) + """
<div id="fig"><p class="method">Loading the record.</p></div>
<script type="module">
import { getJSON, esc, stateButtons, wireState, guardImages } from "./assets/js/r23.js";
guardImages(document);
const slug=new URLSearchParams(location.search).get("f");
const el=document.getElementById("fig");
function detail(k,v){ return v?`<li><span class="k">${k}</span><span>${v}</span></li>`:""; }
try{
  const s=await getJSON(`data/v1/figures/${slug}.json`);
  document.title=`${s.name} | Marvel Legends Chronicle`;
  const media=s.img
    ? `<figure class="plate"><div class="frame"><img src="${esc(s.img.url)}" alt="${esc(s.name)} figure photograph" referrerpolicy="no-referrer" fetchpriority="high"></div></figure>`
    : `<div class="notplate"><div class="np-name">${esc(s.name)}</div><p class="micro">Not pictured</p></div>`;
  const sold=s.sold.length? s.sold.map(x=>`<div class="priceline"><span>Reported sold: ${esc(x.display)}</span><span class="num">${esc(x.asOf)} · ${esc(x.source)}</span></div>`).join("")
    : `<p> No reported sales recorded for this figure.</p>`.replace(" ","");
  const buy=s.buy.length? s.buy.map(b=>`<div class="buyrow"><span>${esc(b.retailer)}</span><a href="${esc(b.url)}" rel="noopener">Buy</a></div><div class="priceline"><span>Asking at ${esc(b.retailer)}</span><span class="num">$${b.priceUSD} · seen ${esc(b.priceSeen)}</span></div>`).join("")
    : `<div class="buyrow"><span>Search this figure at a retailer</span><a href="https://www.bigbadtoystore.com/Search?SearchText=${encodeURIComponent("Marvel Legends "+s.name)}" rel="noopener">Search at BigBadToyStore</a></div>`;
  el.innerHTML=`
  <p class="backline"><a href="waves/${esc(s.waveSlug)}.html">← ${esc(s.wave)}</a></p>
  <div class="figlayout">
  <div class="figmedia">${media}</div>
  <div class="figside">
  <h1>${esc(s.name)}</h1>
  <p class="factline">${esc(s.wave)}, ${s.year}, ${esc(s.maker)}</p>
  <p class="idline">${esc(s.pid)}</p>
  <div class="ownwant">${stateButtons(s.slug)}</div>
  <h2 class="sideh">Price</h2>
  <div class="priceblock">${sold}</div>
  <h2 class="sideh">Buy</h2>
  <div class="buyblock">${buy}</div>
  <p class="method">Prices are reported sales, recorded with their date and source. Asking prices and announced MSRP are labeled separately and never mixed with reported sold prices.</p>
  </div>
  </div>
  <h2>Details</h2>
  <ul class="details">
    ${detail("Character", s.charSlug?`<a href="characters/${esc(s.charSlug)}.html">${esc(s.character)}</a>`:esc(s.character))}
    ${detail("Wave", `<a href="waves/${esc(s.waveSlug)}.html">${esc(s.wave)}</a>`)}
    ${detail("Year", String(s.year))}
    ${detail("Maker", esc(s.maker))}
    ${detail("Exclusive retailer", s.exclusive?esc(s.exclusive):"General release")}
    ${detail("Build A Figure piece", s.bafPiece?esc(s.bafPiece):"None")}
    ${detail("Variant", s.variant?esc(s.variant):"")}
    ${detail("Note", s.notes?esc(s.notes):"")}
  </ul>
  ${s.others.length?`<h2>Other versions</h2><ul class="tiles">${s.others.map(o=>{ const m=o.img?`<a class="platewrap" href="spec-sheet.html?f=${esc(o.slug)}"><img src='${esc(o.img)}' alt="${esc(o.name)} figure photograph" loading="lazy" referrerpolicy="no-referrer"></a>`:`<a class="platewrap absence" href="spec-sheet.html?f=${esc(o.slug)}"><span class="absname">${esc(o.name)}</span><span class="micro">Not pictured</span></a>`; return `<li class="tile">${m}<div class="pid">${esc(o.pid)}</div><div class="name"><a href="spec-sheet.html?f=${esc(o.slug)}">${esc(o.name)}</a></div><div class="fact">${esc(o.fact)}</div><p class="tilelink"><a href="compare.html?a=${esc(s.slug)}&b=${esc(o.slug)}">Compare with this figure</a></p></li>`; }).join("")}</ul>`:""}
  <p class="sourceline">${esc(s.sourceLine)}</p>`;
  wireState(el);
}catch(e){ el.innerHTML=`<h1>Figure not found</h1><p>Search the <a href="visual-database.html">catalog</a>.</p>`; }
</script>
"""
    write("spec-sheet.html", chrome("Figure | Marvel Legends Chronicle",
          "The figure record: wave, year, maker, reported prices, and where to buy it.", "") + body + foot())

# ---------- Surface 4: Waves and Characters ----------
def wave_pages():
    by_wave = defaultdict(list)
    for f, r in zip(FIGS, ROWS): by_wave[f["waveId"]].append((f, r))
    index_rows = []
    for w in sorted(WAVES.values(), key=lambda w: (w["year"], w["series"])):
        rows = by_wave[w["id"]]
        baf_line = f' · Build A Figure: {w["baf"]}' if w.get("baf") else ""
        index_rows.append(
            f'<li class="row"><span class="notpic">{w["year"]}</span><div>'
            f'<div class="pid">{w["year"]} · {escape(w["manufacturer"])}</div>'
            f'<div class="name"><a href="{w["id"]}.html">{escape(w["series"])}</a></div>'
            f'<div class="fact">{escape(w["manufacturer"])}, {w["year"]}, {len(rows)} figures{baf_line}</div></div></li>')
        contents = "".join(tile_html(r, prefix="../") for _, r in rows)
        pictured = sum(1 for _, r in rows if r["pictured"])
        strip = ""
        pic_rows = [r for _, r in rows if r["pictured"]]
        # The strip is the at-a-glance photo index for LONG waves only; on a
        # short wave the tile wall below already shows every figure.
        if pic_rows and len(rows) > 12:
            strip = ('<div class="strip" aria-label="Pictured figures in this wave">' + "".join(
                f'<a class="stripplate" href="../spec-sheet.html?f={r["slug"]}">'
                f'<img src="{escape(r["img"])}" alt="{escape(r["name"])} figure photograph" loading="lazy" referrerpolicy="no-referrer"></a>'
                for r in pic_rows) + "</div>")
        excl = sum(1 for f, _ in rows if f.get("exclusive"))
        bafsec = ""
        if w.get("baf"):
            pieces = "".join(f'<li class="row baf"><div><div class="name">{escape(f["name"])}</div><div class="fact">Piece: {escape(f.get("bafPiece") or "None recorded")}</div></div>{state_btns(r["slug"])}</li>' for f, r in rows if f.get("bafPiece"))
            bafsec = f'<h2>Build A Figure: {escape(w["baf"])}</h2><ul class="rows">{pieces}</ul><p class="method">Pieces you still need are the rows above not marked Owned.</p>'
        body = f"""
{crumbs("../", [("Home", "index.html"), ("Waves", "waves/index.html"), (w["series"], None)])}
<h1>{escape(w["series"])}</h1>
<p class="factline">{escape(w["manufacturer"])}, {w["year"]}, {len(rows)} figures</p>
{strip}
<ul class="tiles">{contents}</ul>
{bafsec}
<p class="sourceline">Summary: {len(rows)} figures · {excl} exclusives · {pictured} pictured<br>
Source: Chronicle census record for this wave; checked {CHECKED}.<br>
Credit: figure records compiled in the Chronicle census, 2002–2026.</p>
"""
        write(f'waves/{w["id"]}.html', chrome(f'{w["series"]} ({w["year"]}) | Marvel Legends Chronicle',
              f'Every figure in {w["series"]} ({w["year"]}, {w["manufacturer"]}).', "", prefix="../") + body + wire("../") + foot("../"))
    body = f"""
{crumbs("../", [("Home", "index.html"), ("Waves", None)])}
<h1>Waves</h1>
<form class="bigsearch" action="../visual-database.html" method="get" role="search"><input type="search" name="q" placeholder="Search figures" aria-label="Search figures" required><button type="submit">Search</button></form>
<ul class="rows">{''.join(index_rows)}</ul>
"""
    write("waves/index.html", chrome("Waves | Marvel Legends Chronicle",
          "170 Marvel Legends waves, 2002–2026, grouped by year.", "", prefix="../") + body + foot("../"))

def character_pages():
    by_base = defaultdict(list)
    for f, r in zip(FIGS, ROWS): by_base[base_name(f["name"])].append((f, r))
    lines = "".join(
        f'<li><a href="{c["slug"]}.html"><span>{escape(c["name"])}</span><span class="count">{c["count"]} figures · {c["first"]}–{c["last"]}</span></a></li>'
        for c in sorted(CHARS, key=lambda c: c["name"]))
    write("characters/index.html", chrome("Characters | Marvel Legends Chronicle",
          "66 characters, counted: figures, first and latest release years.", "", prefix="../") +
          crumbs("../", [("Home", "index.html"), ("Characters", None)]) +
          f'<h1>Characters</h1><ul class="indexlines">{lines}</ul>' + foot("../"))
    for c in CHARS:
        rows = sorted(by_base.get(c["name"], []), key=lambda x: (x[0]["year"], x[0]["name"]))
        body_rows = "".join(tile_html(r, prefix="../") for _, r in rows)
        completion = f'<p class="factline" id="completion"></p>' if rows else ""
        body = f"""
{crumbs("../", [("Home", "index.html"), ("Characters", "characters/index.html"), (c["name"], None)])}
<h1>{escape(c["name"])}</h1>
<p class="factline">{len(rows)} figures · {c["first"]}–{c["last"]}</p>
{completion}
<ul class="tiles">{body_rows}</ul>
<script type="module">
import {{ loadSet }} from "../assets/js/r23.js";
const owned=loadSet("owned"); const slugs=[{','.join('"%s"' % r["slug"] for _, r in rows)}];
const n=slugs.filter(s=>owned.has(s)).length;
if(n) document.getElementById("completion").textContent=`You have ${{n}} of ${{slugs.length}}.`;
</script>
"""
        write(f'characters/{c["slug"]}.html', chrome(f'{c["name"]} | Marvel Legends Chronicle',
              f'{len(rows)} {c["name"]} figures, {c["first"]} to {c["last"]}.', "", prefix="../") + body + wire("../") + foot("../"))

# ---------- Surface 5: Upcoming ----------
def upcoming():
    drops = DROPWEEK.get("drops", [])
    drop_html = ""
    if drops:
        items = "".join(
            f'<li class="row compact"><div>'
            f'<div class="pid">{escape(d.get("windowStart") or d.get("date") or "")}</div>'
            f'<div class="name">{escape(fig["name"])}</div>'
            f'<div class="fact"><span class="micro red">Announced</span> · {escape(d.get("kindLabel") or "Pre-order window")}</div></div></li>'
            for d in drops for fig in d.get("figures", []))
        drop_html = f'<h2>Current drop window</h2><ul class="rows">{items}</ul>'
    groups = defaultdict(list)
    for u in PREORDERS: groups[u.get("releaseWindow") or "Date to be confirmed"].append(u)
    announced = ""
    for window, items in groups.items():
        rows = "".join(
            f'<li class="row compact"><div>'
            f'<div class="pid">{escape(u.get("preorderDate") or "")}</div>'
            f'<div class="name">{escape(u["name"])}</div>'
            f'<div class="fact"><span class="micro red">Announced</span> · Expected {escape(window)} · Hasbro</div>'
            + (f'<div class="path">Announced MSRP ${u["price"]}</div>' if u.get("price") else "")
            + f'</div></li>' for u in items)
        announced += f'<h2>{escape(window)}</h2><ul class="rows">{rows}</ul>'
    latest = sorted(RADAR, key=lambda x: x.get("detected_at", ""), reverse=True)[:10]
    unconf = "".join(
        f'<li class="row compact"><div><div class="pid">{escape((x.get("detected_at") or "")[:10])}</div>'
        f'<div class="name" style="font-size:17px"><a href="{escape(x["url"])}" rel="noopener">{escape(x["title"])}</a></div>'
        f'<div class="fact"><span class="micro red">Unconfirmed</span> · {escape(x.get("source") or "")}</div></div></li>'
        for x in latest)
    body = f"""
<h1>Upcoming</h1>
{drop_html}
{announced}
<h2>Unconfirmed reports</h2>
<ul class="rows">{unconf}</ul>
<p><a href="visual-database.html">Past releases: browse the current year</a></p>
"""
    write("radar.html", chrome("Upcoming | Marvel Legends Chronicle",
          "Announced Marvel Legends figures, expected dates, and unconfirmed reports, kept apart.", "Upcoming") + body + foot())

# ---------- Surface 6: Compare ----------
def compare():
    body = """
<h1>Compare</h1>
<p class="method">Name two to four figures above, or start from the <a href="visual-database.html">catalog</a> or the <a href="characters/index.html">character index</a> if you need the names first.</p>
<div class="pickers" id="pickers"></div>
<div class="comparegrid" id="panels"></div>
<script type="module">
import { getJSON, esc } from "./assets/js/r23.js";
const params=new URLSearchParams(location.search);
let slots=[params.get("a")||"", params.get("b")||"", "", ""];
let index=null, profiles=null;
const FIELDS=[["Character","character"],["Wave","wave"],["Year","year"],["Maker","maker"],["Exclusive retailer","exclusive"],["Build A Figure piece","bafPiece"],["Variant","variant"],["Note","notes"]];
async function ensure(){ if(!index) index=await getJSON("data/v1/search-index.json"); if(!profiles){ const c=await getJSON("data/v1/compare.json"); profiles=new Map(c.profiles.map(p=>[p.id,p])); } }
function renderPickers(){
  document.getElementById("pickers").innerHTML=slots.map((s,i)=>`<div><label class="f" for="pick${i}">Figure ${i+1}</label><input type="text" id="pick${i}" list="figs" value="${esc(nameFor(s))}" placeholder="Search a figure" style="width:100%"></div>`).join("")+`<datalist id="figs"></datalist>`;
  slots.forEach((s,i)=>document.getElementById("pick"+i).addEventListener("change", async e=>{
    await ensure(); const hit=index.find(r=>r.name===e.target.value||r.slug===e.target.value);
    if(hit){ slots[i]=hit.slug; render(); }
  }));
  if(index) document.getElementById("figs").innerHTML=index.slice(0,4000).map(r=>`<option value="${esc(r.name)}">`).join("");
}
function nameFor(slug){ if(!slug||!index) return slug?slug.replaceAll("-"," "):""; const r=index.find(x=>x.slug===slug); return r?r.name:""; }
async function render(){
  renderPickers();
  const chosen=slots.filter(Boolean);
  if(!chosen.length){ document.getElementById("panels").innerHTML=`<p class="method">Pick two to four figures. Fields are shown in the same order for each figure.</p>`; return; }
  await ensure();
  const bySlug=new Map(); for(const p of profiles.values()) bySlug.set(p.id.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""), p);
  document.getElementById("panels").innerHTML=chosen.map(slug=>{
    const r=index.find(x=>x.slug===slug); const p=bySlug.get(slug);
    const price=p&&p.priceSignals&&p.priceSignals.length? p.priceSignals.map(x=>`Reported: ${esc(x.display||"")} (${esc(x.asOf||"")})`).join("<br>") : "No reported sales recorded for this figure.";
    const rows=FIELDS.map(([k,key])=>{ const v=(p&&p[key])||((key!=="bafPiece"&&key!=="variant"&&key!=="notes"&&r)?r[key]:null)||(key==="maker"&&p?p.manufacturer:null); return `<li><span class="k">${k}</span><span>${v?esc(v):(key==="exclusive"?"General release":key==="bafPiece"?"None":key==="variant"?"Standard release":"No notes recorded")}</span></li>`; }).join("");
    const media=r&&r.img?`<img class="panelplate" src='${esc(r.img)}' alt="${esc(r.name)} figure photograph" loading="lazy" referrerpolicy="no-referrer">`:r?`<div class="panelplate absence"><span class="absname">${esc(r.name)}</span><span class="micro">Not pictured</span></div>`:"";
    return `<section class="panel">${media}<p class="pid micro">${esc(r?r.pid:"")}</p><h3>${esc(r?r.name:slug)}</h3>
    <p class="factline">${esc(r?r.fact:"")}</p><ul class="details">${rows}
    <li><span class="k">Reported sold</span><span>${price}</span></li>
    <li><span class="k">Buy</span><span><a href="spec-sheet.html?f=${esc(slug)}">Figure record and buy doors</a></span></li></ul></section>`;
  }).join("");
}
render();
</script>
"""
    write("compare.html", chrome("Compare | Marvel Legends Chronicle",
          "Two to four figures side by side on the same fields, in the same order.", "Compare") + body + foot())

# ---------- Surface 7: My Collection ----------
def my_collection():
    body = """
<h1>My Collection</h1>
<p class="census" id="summary">Owned 0 · Wanted 0 · Waves complete 0 · Build A Figures complete 0</p>
<h2>Owned</h2>
<div id="owned"><p class="method">Nothing marked Owned yet. Mark figures Owned in the <a href="visual-database.html">catalog</a>.</p></div>
<p><button class="plain" type="button" onclick="window.print()">Print checklist</button></p>
<h2>Wanted</h2>
<div id="wanted"><p class="method">Nothing marked Wanted yet.</p></div>
<p><button class="plain" type="button" onclick="window.print()">Print hunt list</button></p>
<h2>Build A Figures</h2>
<div id="baf"></div>
<h2>Your numbers</h2>
<form id="logform">
<label class="f" for="lf-name">Figure</label><input type="text" id="lf-name" required>
<label class="f" for="lf-date">Date</label><input type="date" id="lf-date" required>
<label class="f" for="lf-amt">Amount paid ($)</label><input type="number" id="lf-amt" step="0.01" min="0" required>
<p><button type="submit">Add to log</button></p></form>
<div id="numbers"></div>
<h2>Top figures</h2>
<p class="method">Your top 10, in your order. Add figures from the Owned list above.</p>
<div id="top"></div>
<div class="printonly" id="printarea"></div>
<script type="module">
import { getJSON, esc, loadSet } from "./assets/js/r23.js";
const index=await getJSON("data/v1/search-index.json");
const bySlug=new Map(index.map(r=>[r.slug,r]));
const owned=[...loadSet("owned")].map(s=>bySlug.get(s)).filter(Boolean);
const wanted=[...loadSet("wanted")].map(s=>bySlug.get(s)).filter(Boolean);
const waves=new Map(); for(const r of index){ if(!waves.has(r.wave)) waves.set(r.wave,[]); waves.get(r.wave).push(r); }
const completeWaves=[...waves.values()].filter(ws=>ws.every(r=>loadSet("owned").has(r.slug))).length;
const bafWaves=[...waves.entries()].filter(([,ws])=>ws.some(r=>r.baf));
const bafDone=bafWaves.filter(([,ws])=>ws.filter(r=>r.baf).every(r=>loadSet("owned").has(r.slug))).length;
document.getElementById("summary").innerHTML=`Owned <b>${owned.length}</b> · Wanted <b>${wanted.length}</b> · Waves complete <b>${completeWaves}</b> · Build A Figures complete <b>${bafDone}</b>`;
function rowList(list, extra=()=>""){ if(!list.length) return ""; return `<ul class="rows">${list.map(r=>`<li class="row">${r.img?`<img class="thumb" src="${esc(r.img)}" alt="" referrerpolicy="no-referrer">`:`<span class="notpic">Not pictured</span>`}<div><div class="pid">${esc(r.pid)}</div><div class="name"><a href="spec-sheet.html?f=${r.slug}">${esc(r.name)}</a></div><div class="fact">${esc(r.fact)}</div>${extra(r)}</div></li>`).join("")}</ul>`; }
const targets=JSON.parse(localStorage.getItem("mlc_targets_r23")||"{}");
document.getElementById("owned").innerHTML=rowList(owned)||document.getElementById("owned").innerHTML;
document.getElementById("wanted").innerHTML=rowList(wanted, r=>`<p><label>Target price ($) <input type="number" step="0.01" min="0" data-target="${r.slug}" value="${targets[r.slug]??""}"></label></p>`)||document.getElementById("wanted").innerHTML;
document.querySelectorAll("[data-target]").forEach(inp=>inp.addEventListener("change",()=>{ targets[inp.dataset.target]=inp.value; localStorage.setItem("mlc_targets_r23",JSON.stringify(targets)); }));
document.getElementById("baf").innerHTML=bafWaves.map(([w,ws])=>{ const pieces=ws.filter(r=>r.baf); const have=pieces.filter(r=>loadSet("owned").has(r.slug)); return `<p><b>${esc(w)}</b>: ${have.length} of ${pieces.length} pieces owned; still need: ${pieces.filter(r=>!loadSet("owned").has(r.slug)).map(r=>esc(r.name)).join(", ")||"none"}</p>`; }).join("");
let log=JSON.parse(localStorage.getItem("mlc_log_r23")||"[]");
function renderNumbers(){
  const total=log.reduce((a,x)=>a+ +x.amt,0);
  const byYear={}; for(const x of log){ const y=x.date.slice(0,4); byYear[y]=(byYear[y]||0)+ +x.amt; }
  document.getElementById("numbers").innerHTML=
   `<p>Spending logged: <span class="num">$${total.toFixed(2)}</span> across ${log.length} entries.</p>`+
   Object.entries(byYear).map(([y,v])=>`<p>${y}: <span class="num">$${v.toFixed(2)}</span></p>`).join("")+
   `<p class="method">Collection value here is the total of your own logged purchase prices. Figures with no logged price count as $0; no market value is estimated.</p>`+
   (log.length?`<ul>${log.map(x=>`<li>${esc(x.date)} · ${esc(x.name)} · <span class="num">$${(+x.amt).toFixed(2)}</span></li>`).join("")}</ul>`:"");
}
document.getElementById("logform").addEventListener("submit",e=>{ e.preventDefault();
  log.push({name:document.getElementById("lf-name").value,date:document.getElementById("lf-date").value,amt:document.getElementById("lf-amt").value});
  localStorage.setItem("mlc_log_r23",JSON.stringify(log)); renderNumbers(); e.target.reset(); });
renderNumbers();
let top=JSON.parse(localStorage.getItem("mlc_top10_r23")||"[]");
function renderTop(){
  document.getElementById("top").innerHTML=(top.map((s,i)=>{ const r=bySlug.get(s); return r?`<p>${i+1}. ${esc(r.name)} <button class="plain" data-rm="${i}" type="button">Remove</button></p>`:""; }).join("")||"")+
   (owned.length&&top.length<10?`<label class="f">Add an owned figure <select id="addtop">${owned.filter(r=>!top.includes(r.slug)).map(r=>`<option value="${r.slug}">${esc(r.name)}</option>`).join("")}</select></label><p><button class="plain" id="addbtn" type="button">Add to top figures</button></p>`:"");
  document.querySelectorAll("[data-rm]").forEach(b=>b.addEventListener("click",()=>{ top.splice(+b.dataset.rm,1); localStorage.setItem("mlc_top10_r23",JSON.stringify(top)); renderTop(); }));
  const ab=document.getElementById("addbtn"); if(ab) ab.addEventListener("click",()=>{ top.push(document.getElementById("addtop").value); localStorage.setItem("mlc_top10_r23",JSON.stringify(top)); renderTop(); });
}
renderTop();
document.getElementById("printarea").innerHTML=`<h2>Checklist: Owned and Wanted by wave</h2>`+
 [...waves.entries()].map(([w,ws])=>{ const rel=ws.filter(r=>loadSet("owned").has(r.slug)||loadSet("wanted").has(r.slug)); return rel.length?`<h3>${esc(w)}</h3><ul>${rel.map(r=>`<li>${loadSet("owned").has(r.slug)?"Owned":"Wanted"} · ${esc(r.name)}</li>`).join("")}</ul>`:""; }).join("");
</script>
"""
    write("my-vault.html", chrome("My Collection | Marvel Legends Chronicle",
          "Your own figures and numbers: owned, wanted, Build A Figure progress, spending, and your top 10. Stored in your browser only.", "My Collection") + body + foot())

# ---------- Surface 8: Help ----------
def help_page():
    pm = ENC["priceMethod"]
    steps = "".join(f"<li>{escape(s)}</li>" for s in pm.get("steps", []))
    rules = "".join(f"<li>{escape(s)}</li>" for s in pm.get("rules", []))
    fake = ""
    n = 0
    for sec in ENC["bootlegGuide"]["sections"]:
        fake += f'<h3>{escape(sec["title"])}</h3><ol>'
        for item in sec["items"]:
            n += 1; fake += f"<li>{escape(item)}</li>"
        fake += "</ol>"
    rarity = "".join(f'<li><b>{escape(t["name"])}</b>: {escape(t["tagline"])}</li>' for t in RARITY["tiers"])
    history = "".join(f'<li><b>{h["year"]}</b>: {escape(h["detail"])}</li>' for h in ENC["history"])
    grading = ""
    for sec in ENC["gradingGuide"]["sections"][:2]:
        grading += f'<p><b>{escape(sec["title"])}</b></p>' + "".join(
            f'<p>{escape(i["text"])}</p>' for i in sec["items"][:1])
    variants_how = ""
    for sec in ENC["variantsGuide"]["sections"][:1]:
        variants_how = "".join(f"<li>{escape(i['text'])}</li>" for i in sec["items"][:3])
    body = f"""
<h1>Guide</h1>
<div class="helpsec">
<h2>Start here</h2>
<p>Search the <a href="visual-database.html">catalog</a> by name, character, or wave. Open a figure to see its wave, year, maker, reported prices, and where to buy it. Mark figures Owned or Wanted; your marks stay in your browser.</p>
<h2>Prices</h2>
<p>{escape(pm.get("principle", ""))}</p>
<ol>{steps}</ol>
<ul>{rules}</ul>
<h2>Rarity words</h2>
<ul>{rarity}</ul>
<h2>Spotting fakes</h2>
{fake}
<h2>Grading, briefly</h2>
{grading}
<h2>Spotting variants</h2>
<ul>{variants_how}</ul>
<h2>Line history</h2>
<ul>{history}</ul>
<h2>Buying as a gift</h2>
<p>Set a budget, then search by the character the person collects.</p>
<form class="bigsearch" action="visual-database.html" method="get" role="search"><input type="search" name="q" placeholder="Character name" aria-label="Character name" required><button type="submit">Search</button></form>
<h2>What the census covers</h2>
<ul>
<li>1,949 figures in 170 waves, released 2002–2026.</li>
<li>Two makers: Toy Biz (229 figures) and Hasbro (1,710 figures).</li>
<li>66 character pages cover the most-collected characters; every figure is in the catalog and on its wave page.</li>
<li>Pictures: {len(IMAGES):,} figures have a verified retailer photograph. The other {len(FIGS)-len(IMAGES):,} are listed without a picture and are never shown with a substitute image.</li>
<li>Prices: reported sales are partial: 10 figures carry a reported sold range. A figure with no reported sales says so on its page.</li>
</ul>
</div>
"""
    write("encyclopedia.html", chrome("Guide | Marvel Legends Chronicle",
          "Start here, how reported prices work, rarity words, spotting fakes, grading, and line history.", "Guide") + body + foot())

# ---------- Surface 9: Developers ----------
def developers():
    idx = load("index.json")
    eps = idx.get("endpoints", {})
    ep_rows = "".join(
        f'<li><b>{escape(k)}</b>: <a href="{escape(v.get("path", ""))}">{escape(v.get("path", ""))}</a> · {escape(v.get("description", "").replace("(<waveId>::<figureName>)", "(wave and figure name)").replace("::", " / "))}</li>'
        for k, v in eps.items())
    body = f"""
{crumbs("", [("Home", "index.html"), ("Developers", None)])}
<h1>Developers</h1>
<div class="helpsec">
<h2>API</h2>
<p>Static data endpoints, version 1, under <span class="num">data/v1/</span>. Live functions: <span class="num">/api/health</span>, <span class="num">/api/reveals</span>, <span class="num">/api/preorders</span>, and the daily Radar cron at <span class="num">/api/cron/radar</span>.</p>
<ul>{ep_rows}</ul>
<h2>Agent procedures</h2>
<p>Start at the manifest endpoint above. Read the schema beside each endpoint before parsing it. Counts in the manifest are the census: 1,949 figures, 170 waves, 66 characters.</p>
<h2>Skills</h2>
<p>The skills manifest is published with the API documentation in this repository (skills/ and data/v1/index.json). Procedures that change data run through the generator, scripts/build_r23.py, and the result is verified against the census before it is committed.</p>
</div>
"""
    write("api.html", chrome("Developers | Marvel Legends Chronicle",
          "API endpoints, data schemas, agent procedures, and the skills manifest.", "") + body + foot())

def not_found():
    body = """
""" + crumbs("", [("Home", "index.html"), ("Page not found", None)]) + """
<h1>Page not found</h1>
<form class="bigsearch" action="/visual-database.html" method="get" role="search"><input type="search" name="q" placeholder="Search figures" aria-label="Search figures" required><button type="submit">Search</button></form>
"""
    write("404.html", chrome("Page not found | Marvel Legends Chronicle", "Page not found.", "") + body + foot())

KEEP_TOP = {"index.html", "visual-database.html", "spec-sheet.html", "radar.html", "compare.html",
            "my-vault.html", "encyclopedia.html", "api.html", "404.html"}
REDIRECTS = {
    "timeline.html": "/visual-database.html", "explore.html": "/visual-database.html",
    "retro.html": "/visual-database.html", "exclusives.html": "/visual-database.html?exclusive=1",
    "debuts.html": "/visual-database.html", "variants.html": "/encyclopedia.html",
    "variant-spotlight.html": "/encyclopedia.html", "stats.html": "/index.html",
    "roll-call.html": "/visual-database.html", "two-houses.html": "/visual-database.html",
    "display.html": "/spec-sheet.html", "preorders.html": "/radar.html",
    "calendar.html": "/radar.html", "drop-week.html": "/radar.html",
    "checklist.html": "/my-vault.html", "shelf.html": "/my-vault.html",
    "showcase.html": "/my-vault.html", "watchlist.html": "/my-vault.html",
    "grails.html": "/my-vault.html", "budget.html": "/my-vault.html",
    "journal.html": "/my-vault.html", "collection-value.html": "/my-vault.html",
    "build-ledger.html": "/my-vault.html", "wave-ledger.html": "/my-vault.html",
    "year-ledger.html": "/my-vault.html", "hunt.html": "/my-vault.html",
    "completionist.html": "/my-vault.html", "baf-planner.html": "/my-vault.html",
    "baf-economics.html": "/my-vault.html", "price-guide.html": "/encyclopedia.html",
    "grading.html": "/encyclopedia.html", "auth-wizard.html": "/encyclopedia.html",
    "rarity.html": "/encyclopedia.html", "start.html": "/encyclopedia.html",
    "gift.html": "/encyclopedia.html", "holiday.html": "/encyclopedia.html",
    "long-wait.html": "/encyclopedia.html", "2026-review.html": "/encyclopedia.html",
    "agents.html": "/api.html", "skills.html": "/api.html",
    "quest.html": "/index.html", "vault-room.html": "/visual-database.html",
    "archive-tour.html": "/index.html", "community.html": "/index.html",
    "market-briefing.html": "/encyclopedia.html", "launch-curve.html": "/spec-sheet.html",
}

def main():
    gen_data()
    home(); browse(); figure_page(); wave_pages(); character_pages()
    upcoming(); compare(); my_collection(); help_page(); developers(); not_found()
    # remove merged/cut top-level pages; redirects in vercel.json carry their URLs
    for p in ROOT.glob("*.html"):
        if p.name not in KEEP_TOP: p.unlink()
    # vercel.json: build through R23 only, explicit functions kept, redirects added
    v = json.loads((ROOT / "vercel.json").read_text())
    v["buildCommand"] = "python3 scripts/build_r23.py"
    v["redirects"] = [{"source": f"/{k}", "destination": dest, "permanent": False}
                      for k, dest in sorted(REDIRECTS.items())]
    (ROOT / "vercel.json").write_text(json.dumps(v, indent=2) + "\n")
    print(f"figures={len(FIGS)} waves={len(WAVES)} characters={len(CHARS)} pictured={len(IMAGES)}")

if __name__ == "__main__":
    main()
