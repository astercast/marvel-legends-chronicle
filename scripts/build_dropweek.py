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
CHECKLIST_PHASES = {"before", "morning", "at-open", "after"}
POLL_FLAGS = {"confirmed", "reported", "single-source", "uncertain"}
URL_RE = re.compile(r"^https?://\S+$")
# dollar amounts the source is allowed to name (announced MSRPs / reported listings /
# reported solds from the Launch Curve trackers / the flagged $30 price-rise rumor)
ALLOWED_AMOUNTS = {"27.99", "74.99", "39.97", "55", "69.95", "46.99", "47.99", "64.99", "39.99",
                   "83.97", "79.99", "25.99", "40.99", "52.99", "30"}


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

    # --- buyer checklist (Drop Week flagship refresh, 2026-10-12) ---
    checklist = data.get("checklist")
    if not isinstance(checklist, list) or len(checklist) < 5:
        fail("checklist must be a list of at least 5 items")
    seen_ck: set[str] = set()
    for i, item in enumerate(checklist):
        where = f"checklist[{i}]"
        for key in ("id", "phase", "label", "detail"):
            if not item.get(key):
                fail(f"{where}: missing {key!r}")
        if item["id"] in seen_ck:
            fail(f"{where}: duplicate checklist id {item['id']!r}")
        seen_ck.add(item["id"])
        if item["phase"] not in CHECKLIST_PHASES:
            fail(f"{where}: bad phase {item['phase']!r}")

    # --- price tracker: figures must be the target drop's, MSRPs explicit ---
    pw = data.get("priceWatch")
    if not isinstance(pw, dict):
        fail("priceWatch must be an object")
    target = next((d for d in drops if d["id"] == pw.get("dropId")), None)
    if target is None:
        fail(f"priceWatch.dropId {pw.get('dropId')!r} is not a drop id")
    drop_names = [f["name"] for f in target["figures"]]
    pw_names = [f.get("name") for f in pw.get("figures", [])]
    if pw_names != drop_names:
        fail(f"priceWatch figures {pw_names} must match drop figures {drop_names}")
    for f in pw["figures"]:
        if not isinstance(f.get("msrp"), (int, float)) or f["msrp"] <= 0:
            fail(f"priceWatch figure {f.get('name')!r}: msrp must be a positive number")
    for c in pw.get("context", []):
        if not c.get("figure") or not c.get("text"):
            fail(f"priceWatch context entry needs figure + text: {c!r}")
    if not pw.get("contextSource", {}).get("label"):
        fail("priceWatch.contextSource needs a label")

    # --- reveal radar poll: every finding flagged + sourced ---
    poll = data.get("radarPoll")
    if not isinstance(poll, dict) or not poll.get("polledAt"):
        fail("radarPoll must be an object with polledAt")
    findings = poll.get("findings")
    if not isinstance(findings, list) or not findings:
        fail("radarPoll.findings must be a non-empty list")
    for i, fd in enumerate(findings):
        where = f"radarPoll.findings[{i}]"
        if fd.get("flag") not in POLL_FLAGS:
            fail(f"{where}: bad flag {fd.get('flag')!r}")
        if not fd.get("headline") or not fd.get("detail"):
            fail(f"{where}: needs headline + detail")
        if not isinstance(fd.get("sources"), list) or not fd["sources"]:
            fail(f"{where}: sources must be a non-empty list")
        for s in fd["sources"]:
            if not s.get("label") or not URL_RE.match(s.get("url", "")):
                fail(f"{where}: source needs a label and an http(s) url: {s!r}")

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
            "intel": {"type": "object"},
            "checklist": {"type": "array"},
            "priceWatch": {"type": "object"},
            "radarPoll": {"type": "object"},
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
        "intel": data.get("intel", {}),
        "checklist": checklist,
        "priceWatch": pw,
        "radarPoll": poll,
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
