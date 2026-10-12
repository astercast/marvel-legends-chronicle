#!/usr/bin/env python3
"""Wave 32 — build the Drop Week API payload from data/drop-week.json.

Validates the editorial source (required fields, parseable ISO datetimes,
well-formed source URLs, price kinds, no stray dollar figures) and writes:
  - data/v1/drop-week.json          (envelope: version/observed/methodology/count/drops)
  - data/v1/schema/drop-week.json
  - data/v1/schema/drop-week-item.json

MANIFEST NOTE (for the merge worker): register the endpoint in build_api.py so
data/v1/index.json gains a "drop-week" entry pointing at these files — the
manifest-driven validator only checks registered endpoints, so this script
deliberately does NOT touch index.json or build_api.py (parallel lanes).
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "drop-week.json"
OUT = ROOT / "data" / "v1" / "drop-week.json"
SCHEMA_DIR = ROOT / "data" / "v1" / "schema"

KINDS = {"preorder", "sale-day", "deadline"}
PRICE_KINDS = {"msrp", "unannounced"}
URL_RE = re.compile(r"^https?://\S+$")
# dollar amounts the source is allowed to name (announced MSRPs / reported listings)
ALLOWED_AMOUNTS = {"27.99", "74.99", "39.97", "55", "69.95", "46.99", "47.99", "64.99", "39.99"}


def fail(msg: str) -> None:
    print(f"build_dropweek: FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))

    for key in ("version", "observed", "methodology", "drops"):
        if key not in data:
            fail(f"missing top-level key {key!r}")

    drops = data["drops"]
    if not isinstance(drops, list) or not drops:
        fail("drops must be a non-empty list")

    seen_ids: set[str] = set()
    prev_ms: int | None = None
    for i, d in enumerate(drops):
        where = f"drops[{i}]"
        for key in ("id", "title", "kind", "kindLabel", "windowLabel",
                    "retailers", "figures", "price", "shipWindow", "sources"):
            if key not in d:
                fail(f"{where}: missing key {key!r}")
        if d["id"] in seen_ids:
            fail(f"{where}: duplicate id {d['id']!r}")
        seen_ids.add(d["id"])
        if d["kind"] not in KINDS:
            fail(f"{where}: bad kind {d['kind']!r}")
        if not isinstance(d["figures"], list) or not d["figures"]:
            fail(f"{where}: figures must be a non-empty list")
        for f in d["figures"]:
            if not f.get("name"):
                fail(f"{where}: figure missing name")
        if d["price"].get("kind") not in PRICE_KINDS:
            fail(f"{where}: bad price.kind {d['price'].get('kind')!r}")
        if not isinstance(d["sources"], list) or not d["sources"]:
            fail(f"{where}: sources must be a non-empty list")
        for s in d["sources"]:
            if not s.get("label") or not URL_RE.match(s.get("url", "")):
                fail(f"{where}: source needs a label and an http(s) url: {s!r}")

        # chronological order, exact-time or date-only
        stamp = d.get("windowAt") or (d.get("windowDate") + "T00:00:00" if d.get("windowDate") else None)
        if not stamp:
            fail(f"{where}: needs windowAt or windowDate")
        try:
            ms = int(datetime.fromisoformat(stamp).timestamp() * 1000)
        except ValueError:
            fail(f"{where}: unparseable datetime {stamp!r}")
        if prev_ms is not None and ms < prev_ms:
            fail(f"{where}: drops must be in chronological order")
        prev_ms = ms

    # no invented prices: every $N in the payload must be an allowed amount
    blob = json.dumps(data)
    for m in re.finditer(r"\$(\d[\d,]*(?:\.\d{2})?)", blob):
        if m.group(1).replace(",", "") not in ALLOWED_AMOUNTS:
            fail(f"unlisted dollar amount ${m.group(1)} — add to ALLOWED_AMOUNTS or remove")

    SCHEMA_DIR.mkdir(parents=True, exist_ok=True)
    (SCHEMA_DIR / "drop-week.json").write_text(json.dumps({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "drop-week",
        "type": "object",
        "required": ["version", "observed", "methodology", "count", "drops"],
        "properties": {
            "version": {"type": "integer"},
            "observed": {"type": "string"},
            "methodology": {"type": "string"},
            "count": {"type": "integer"},
            "drops": {"type": "array"},
        },
    }, indent=2) + "\n", encoding="utf-8")
    (SCHEMA_DIR / "drop-week-item.json").write_text(json.dumps({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "drop-week-item",
        "type": "object",
        "required": ["id", "title", "kind", "kindLabel", "windowLabel",
                     "retailers", "figures", "price", "shipWindow", "sources"],
        "properties": {
            "id": {"type": "string"},
            "title": {"type": "string"},
            "kind": {"type": "string", "enum": sorted(KINDS)},
            "kindLabel": {"type": "string"},
            "windowAt": {"type": ["string", "null"]},
            "windowDate": {"type": ["string", "null"]},
            "windowLabel": {"type": "string"},
            "retailers": {"type": "array"},
            "figures": {"type": "array"},
            "price": {"type": "object"},
            "shipWindow": {"type": "string"},
            "notes": {"type": "array"},
            "sources": {"type": "array"},
        },
    }, indent=2) + "\n", encoding="utf-8")

    payload = {
        "version": data["version"],
        "observed": data["observed"],
        "methodology": data["methodology"],
        "count": len(drops),
        "drops": drops,
    }
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"build_dropweek: wrote {OUT.relative_to(ROOT)} ({len(drops)} drops) + schemas")

    # noscript fallback inside drop-week.html (same source of truth)
    page = ROOT / "drop-week.html"
    html = page.read_text(encoding="utf-8")
    lines = ["<ul>"]
    for d in drops:
        names = ", ".join(f["name"] for f in d["figures"])
        lines.append(f"<li><strong>{d['title']}</strong> — {d['windowLabel']}: {names}.</li>")
    lines.append("</ul>")
    block = "<!-- DROPS:NOSCRIPT-BEGIN -->\n" + "\n".join(lines) + "\n<!-- DROPS:NOSCRIPT-END -->"
    new_html, n = re.subn(
        r"<!-- DROPS:NOSCRIPT-BEGIN -->.*?<!-- DROPS:NOSCRIPT-END -->",
        block, html, flags=re.DOTALL)
    if n != 1:
        fail("drop-week.html noscript markers not found exactly once")
    page.write_text(new_html, encoding="utf-8")
    print("build_dropweek: drop-week.html noscript block regenerated")


if __name__ == "__main__":
    main()
