#!/bin/sh
# scripts/validate.sh — full validation pipeline for the Marvel Legends Chronicle.
#   1. node --check on every site JS file
#   2. JSON parse of every data file
#   3. JSON-Schema validation of data/v1 against data/v1/schema/
#   4. Relative-link check across all HTML pages
#   5. Element-ID cross-check (page-specific scripts vs their page)
#   6. localStorage key registry check (config.js STORE_KEYS vs literals)
#   7. Performance budgets (data size hard cap, per-page weight warnings)
#   8. The node test suite (tests/run.sh)
# Exit code is non-zero if anything fails.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FAIL=0

echo "== [1/8] node --check (site JS) =="
N=0
for f in assets/js/*.js; do
  N=$((N+1))
  if ! node --check "$f" >/dev/null 2>&1; then
    echo "FAIL syntax: $f"; FAIL=1
  fi
done
[ "$FAIL" -eq 0 ] && echo "ok: $N files parse"

echo "== [2-7/8] data, schema, links, ids, storage keys, perf =="
python3 - "$ROOT" <<'PYEOF' || FAIL=1
import json, re, sys, os
from pathlib import Path
ROOT = Path(sys.argv[1])
errs, warns = [], []
def fail(m): errs.append(m)
def warn(m): warns.append(m)

# ---- 2. JSON parses ----
json_files = sorted(ROOT.glob("data/*.json")) + sorted((ROOT/"data"/"v1").glob("*.json")) \
    + sorted((ROOT/"data"/"v1"/"schema").glob("*.json")) \
    + [ROOT/"characters"/"manifest.json", ROOT/"skills"/"index.json"]
for p in json_files:
    try:
        json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        fail(f"JSON parse: {p.relative_to(ROOT)}: {e}")
print(f"json: {len(json_files)} files parsed")

# ---- 3. schema validation (hand-rolled draft-07 subset, manifest-driven) ----
# The manifest (data/v1/index.json) is the single source of truth: every
# endpoint is validated against its `schema`; endpoints with an `itemSchema`
# get every record validated too; `records` counts are cross-checked.
def type_ok(v, t):
    return {"string": isinstance(v, str),
            "integer": isinstance(v, int) and not isinstance(v, bool),
            "number": isinstance(v, (int, float)) and not isinstance(v, bool),
            "boolean": isinstance(v, bool),
            "null": v is None, "object": isinstance(v, dict),
            "array": isinstance(v, list)}.get(t, False)
def check(v, s, path):
    t = s.get("type")
    if isinstance(t, list):
        if not any(type_ok(v, x) for x in t): fail(f"schema {path}: expected {t}, got {type(v).__name__}")
    elif t and not type_ok(v, t):
        fail(f"schema {path}: expected {t}, got {type(v).__name__}"); return
    if isinstance(v, list) and "items" in s:
        for i, item in enumerate(v): check(item, s["items"], f"{path}[{i}]")
    if isinstance(v, dict):
        for r in s.get("required", []):
            if r not in v: fail(f"schema {path}: missing required '{r}'")
        for k, sub in s.get("properties", {}).items():
            if k in v: check(v[k], sub, f"{path}.{k}")
    if "enum" in s and v not in s["enum"]:
        fail(f"schema {path}: {v!r} not in enum {s['enum']}")
manifest = json.loads((ROOT/"data"/"v1"/"index.json").read_text())
check(manifest, json.loads((ROOT/"data"/"v1"/"schema"/"manifest.json").read_text()), "index.json")
recs = 0
for name, e in manifest["endpoints"].items():
    for k in ["path", "description", "schema", "itemSchema", "updated", "records", "notes"]:
        if k not in e: fail(f"manifest: endpoint '{name}' missing key '{k}'")
    payload_path = ROOT / e["path"]
    if not payload_path.is_file():
        fail(f"manifest: endpoint '{name}' payload missing: {e['path']}"); continue
    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    items = None
    if e["itemSchema"]:
        if isinstance(payload, list):
            items = payload
        elif isinstance(payload, dict):
            for v in payload.values():
                if isinstance(v, list):
                    items = v; break
    if e["schema"]:
        sch_path = ROOT / e["schema"]
        if not sch_path.is_file():
            fail(f"manifest: endpoint '{name}' schema file missing: {e['schema']}")
        else:
            check(payload, json.loads(sch_path.read_text(encoding="utf-8")), e["path"])
    if e["itemSchema"]:
        if items is None:
            fail(f"manifest: endpoint '{name}' has itemSchema but no array in payload")
        else:
            isch = json.loads((ROOT / e["itemSchema"]).read_text(encoding="utf-8"))
            for i, it in enumerate(items):
                check(it, isch, f"{e['path']}[{i}]")
            recs += len(items)
    if e["records"] is not None:
        actual = len(items) if items is not None \
            else (len(payload) if isinstance(payload, list) else 1)
        if actual != e["records"]:
            fail(f"manifest: endpoint '{name}' records={e['records']} but payload has {actual}")
print(f"schema: manifest + {len(manifest['endpoints'])} endpoints validated ({recs} item records)")

# ---- 4. relative-link check ----
html_files = sorted(ROOT.glob("*.html")) + sorted((ROOT/"waves").glob("*.html")) + sorted((ROOT/"characters").glob("*.html"))
REF = re.compile(r'''(?:href|src)="([^"]+)"''')
FETCH = re.compile(r'''fetch\(\s*["']([^"']+)["']\s*\)''')
checked = 0
for html in html_files:
    text = html.read_text(encoding="utf-8")
    refs = set(REF.findall(text))
    # fetch() literals in this page's scripts (paths resolve against the page)
    for src in re.findall(r'<script[^>]+src="([^"]+)"', text):
        js = (html.parent / src)
        if js.is_file():
            refs.update(u for u in FETCH.findall(js.read_text(encoding="utf-8")) if "${" not in u)
    for u in refs:
        if u.startswith(("#", "http://", "https://", "//", "mailto:", "data:", "javascript:")) or not u:
            continue
        # Strip fragment and query string: "gift.html?budget=under25" -> "gift.html"
        # Leading-slash refs are site-root-absolute (the Vercel fallback contract
        # client uses "/api/..." paths); resolve those against the repo root.
        u_stripped = u.split("#")[0].split("?")[0]
        target = (ROOT / u_stripped.lstrip("/")) if u_stripped.startswith("/") else (html.parent / u_stripped)
        checked += 1
        if not target.exists():
            fail(f"broken ref: {html.relative_to(ROOT)} -> {u}")
print(f"links: {checked} relative refs checked across {len(html_files)} pages")

# ---- 5. element-ID cross-check (page-specific scripts only) ----
page_ids, page_scripts = {}, {}
for html in sorted(ROOT.glob("*.html")):
    text = html.read_text(encoding="utf-8")
    page_ids[html.name] = set(re.findall(r'''\bid="([^"]+)"''', text))
    page_scripts[html.name] = re.findall(r'<script[^>]+src="([^"]+)"', text)
use_count = {}
for pg, srcs in page_scripts.items():
    for s in srcs: use_count[s] = use_count.get(s, []) + [pg]
for src, pgs in use_count.items():
    if len(pgs) != 1: continue  # shared libs are checked by the test suite instead
    js = ROOT / src
    if not js.is_file(): continue
    js_text = js.read_text(encoding="utf-8")
    needed = set(re.findall(r'''getElementById\(\s*["']([^"']+)["']\s*\)''', js_text))
    # IDs the script itself creates dynamically (innerHTML templates etc.)
    created = set(re.findall(r'''\bid=["']([^"']+)["']''', js_text))
    missing = needed - created - page_ids[pgs[0]]
    for m in sorted(missing):
        fail(f"id check: {src} wants #{m}, missing in {pgs[0]}")
print("ids: page-specific script references cross-checked")

# ---- 6. localStorage key registry ----
cfg = (ROOT/"assets"/"js"/"config.js").read_text(encoding="utf-8")
registry = set(re.findall(r'"(mlc_[a-z0-9_]+)"', cfg))
for js in sorted((ROOT/"assets"/"js").glob("*.js")):
    for lit in set(re.findall(r'''["'](mlc_[a-z0-9_]+)["']''', js.read_text(encoding="utf-8"))):
        if lit not in registry:
            fail(f"storage key: {js.name} uses unregistered key {lit}")
print(f"storage: {len(registry)} registered keys, all literals accounted for")

# ---- 7. performance budgets ----
FIG = ROOT/"data"/"figures.json"
if FIG.stat().st_size > 225000:
    fail(f"perf: data/figures.json is {FIG.stat().st_size} bytes (budget 225000) — keep it minified")
CSS = {p.name: p for p in (ROOT/"assets"/"css").glob("*.css")}
for html in sorted(ROOT.glob("*.html")):
    text = html.read_text(encoding="utf-8")
    weight = len(text.encode())
    for c in set(re.findall(r'<link[^>]+href="assets/css/([^"]+)"', text)):
        if c in CSS: weight += CSS[c].stat().st_size
    srcs = re.findall(r'<script[^>]+src="([^"]+)"', text)
    if any("data.js" in s or "figures.json" in (ROOT/s).read_text(encoding="utf-8") if (ROOT/s).is_file() else False for s in srcs):
        weight += FIG.stat().st_size
    if weight > 500000:
        warn(f"perf: {html.name} initial weight ~{weight//1024}KB exceeds 500KB budget")
print("perf: budgets checked (figures.json cap + 500KB/page warnings)")

for w in warns: print("WARN:", w)
if errs:
    print(f"\n{len(errs)} VALIDATION ERRORS:")
    for e in errs: print("  -", e)
    sys.exit(1)
print("\nvalidation: all checks passed")
PYEOF

echo "== [8/8] test suite =="
if ! ./tests/run.sh > /tmp/mlc-tests.log 2>&1; then
  echo "FAIL: test suite failed"; tail -20 /tmp/mlc-tests.log; FAIL=1
else
  tail -1 /tmp/mlc-tests.log
fi

if [ "$FAIL" -ne 0 ]; then echo "VALIDATION FAILED"; exit 1; fi
echo "VALIDATION PASSED"
