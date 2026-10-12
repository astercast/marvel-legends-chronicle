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
CAPTURE_PHASES = {"before", "at-open", "first-hour", "close"}
REPORT_FILLS = {"captureLog.listings", "captureLog.sellouts", "priceWatch"}
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

    # --- drop-day capture protocol (Drop Day readiness, 2026-10-12) ---
    proto = data.get("captureProtocol")
    if not isinstance(proto, dict) or proto.get("dropId") != pw.get("dropId"):
        fail("captureProtocol must be an object for the priceWatch drop")
    doors = proto.get("retailers")
    if not isinstance(doors, list) or len(doors) < 3:
        fail("captureProtocol.retailers must list at least the 3 named capture doors")
    door_names: list[str] = []
    for i, r in enumerate(doors):
        where = f"captureProtocol.retailers[{i}]"
        if not r.get("name") or not r.get("role"):
            fail(f"{where}: needs name + role")
        if r["name"] in door_names:
            fail(f"{where}: duplicate retailer {r['name']!r}")
        door_names.append(r["name"])
        if r.get("order") != i + 1:
            fail(f"{where}: order must run 1..n in capture order")
    for named in ("Hasbro Pulse", "BigBadToyStore", "Entertainment Earth"):
        if named not in door_names:
            fail(f"captureProtocol.retailers: the named capture door {named!r} is missing")
    steps = proto.get("steps")
    if not isinstance(steps, list) or len(steps) < 5:
        fail("captureProtocol.steps must be a list of at least 5 steps")
    seen_steps: set[str] = set()
    for i, st in enumerate(steps):
        where = f"captureProtocol.steps[{i}]"
        for key in ("id", "phase", "label", "detail"):
            if not st.get(key):
                fail(f"{where}: missing {key!r}")
        if st["id"] in seen_steps:
            fail(f"{where}: duplicate step id {st['id']!r}")
        seen_steps.add(st["id"])
        if st["phase"] not in CAPTURE_PHASES:
            fail(f"{where}: bad phase {st['phase']!r}")
    rules_blob = " ".join(proto.get("rules", [])).lower()
    if "asking" not in rules_blob or "sold" not in rules_blob:
        fail("captureProtocol.rules must state the asking/sold lane discipline")

    # --- capture log: asking listings + sellout events, lanes never mixed ---
    clog = data.get("captureLog")
    if not isinstance(clog, dict) or clog.get("dropId") != pw.get("dropId"):
        fail("captureLog must be an object for the priceWatch drop")
    if clog.get("status") not in {"awaiting-window", "capturing", "closed"}:
        fail(f"captureLog: bad status {clog.get('status')!r}")

    def _check_stamp(value, where):
        try:
            datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            fail(f"{where}: unparseable timestamp {value!r}")

    listings = clog.get("listings")
    if not isinstance(listings, list):
        fail("captureLog.listings must be a list (empty before the window)")
    for i, e in enumerate(listings):
        where = f"captureLog.listings[{i}]"
        if e.get("figure") not in drop_names:
            fail(f"{where}: figure {e.get('figure')!r} is not in the drop lineup")
        if e.get("retailer") not in door_names:
            fail(f"{where}: retailer {e.get('retailer')!r} is not a capture door")
        if not isinstance(e.get("price"), (int, float)) or e["price"] <= 0:
            fail(f"{where}: a listing entry needs a positive asking price")
        if not e.get("observedAt"):
            fail(f"{where}: a listing entry needs a real observedAt timestamp")
        _check_stamp(e["observedAt"], where)
    sellouts = clog.get("sellouts")
    if not isinstance(sellouts, list):
        fail("captureLog.sellouts must be a list (empty before the window)")
    for i, e in enumerate(sellouts):
        where = f"captureLog.sellouts[{i}]"
        if e.get("figure") not in drop_names:
            fail(f"{where}: figure {e.get('figure')!r} is not in the drop lineup")
        if e.get("retailer") not in door_names:
            fail(f"{where}: retailer {e.get('retailer')!r} is not a capture door")
        if "price" in e:
            fail(f"{where}: a sellout is an event, not a price — no price field allowed")
        if not e.get("observedAt"):
            fail(f"{where}: a sellout entry needs a real observedAt timestamp")
        _check_stamp(e["observedAt"], where)

    # --- post-window report scaffold: fills only from the capture lanes ---
    report = data.get("windowReport")
    if not isinstance(report, dict) or report.get("dropId") != pw.get("dropId"):
        fail("windowReport must be an object for the priceWatch drop")
    if report.get("status") not in {"awaiting-window", "filled"}:
        fail(f"windowReport: bad status {report.get('status')!r}")
    msrps = {f["msrp"] for f in pw["figures"]}
    if len(msrps) != 1 or report.get("announcedMsrp") not in msrps:
        fail("windowReport.announcedMsrp must equal the priceWatch announced MSRP")
    sections = report.get("sections")
    if not isinstance(sections, list) or len(sections) < 3:
        fail("windowReport.sections must be a list of at least 3 sections")
    seen_sec: set[str] = set()
    for i, sec in enumerate(sections):
        where = f"windowReport.sections[{i}]"
        for key in ("id", "title", "prompt", "fillsFrom"):
            if not sec.get(key):
                fail(f"{where}: missing {key!r}")
        if sec["id"] in seen_sec:
            fail(f"{where}: duplicate section id {sec['id']!r}")
        seen_sec.add(sec["id"])
        if sec["fillsFrom"] not in REPORT_FILLS:
            fail(f"{where}: fillsFrom {sec['fillsFrom']!r} is not a capture lane")
    for need in ("sellouts", "first-spread", "thirty-claim"):
        if need not in seen_sec:
            fail(f"windowReport.sections: required section {need!r} is missing")
    if report.get("verdicts", {}).get("thirtyClaim") not in {
            "pending", "at-msrp", "above-msrp", "mixed"}:
        fail("windowReport.verdicts.thirtyClaim must be a known verdict state")

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
            "captureProtocol": {"type": "object"},
            "captureLog": {"type": "object"},
            "windowReport": {"type": "object"},
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
        "captureProtocol": proto,
        "captureLog": clog,
        "windowReport": report,
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
