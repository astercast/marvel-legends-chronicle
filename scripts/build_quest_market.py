#!/usr/bin/env python3
"""Build the quest-market endpoint from the editorial market-intel source.

Reads data/quest-market.json (the machine-readable mirror of the 2026 Market
Briefing research, every number already published on the Chronicle), validates
it hard, and writes:
  data/v1/quest-market.json          (API envelope; "tiers" is the first list,
                                      so the manifest-driven validator takes
                                      the tier records for itemSchema checks)
  data/v1/schema/quest-market.json
  data/v1/schema/quest-market-tier.json

The no-invented-prices rule: every dollar in the source must be one of the
published 2026 MSRP / reported-signal values (pinned below). Cross-checks tie
the file to the existing research so it cannot drift from what the Chronicle
already says:
  - the white-Doom $115–$200 band must match data/price-signals.json's own
    white-Doom sold-band (same source, same numbers);
  - the launch-curve peaks must match data/launch-curves.json's point data;
  - every figId referenced must resolve in data/figures.json.
Run: python3 scripts/build_quest_market.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "quest-market.json"
V1 = ROOT / "data" / "v1" / "quest-market.json"
SCHEMA_DIR = ROOT / "data" / "v1" / "schema"

# Published 2026 MSRP values (Toy Fair 2026 coverage via Toyark; Pulse product
# pages). These are the only dollars the quest engine is allowed to state.
PINNED_TIERS = {
    "standard": {"usd": 27.99},
    "deluxe": {"low": 34.99, "high": 46.99},
    "mtg": {"usd": 39.99},
    "milesMask": {"usd": 139.99},
    "apocalypse12": {"usd": 119.99},
    "madeToOrder": {"usd": 74.99},
}
PINNED_WHITE_DOOM_BAND = [115, 200]  # actionfigure411 sold history, checked Oct 12
PINNED_WASP_ASK = 7500  # asking price, not a sale


def fail(msg):
    print(f"build_quest_market: ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def load(p):
    try:
        return json.loads(p.read_text())
    except FileNotFoundError:
        fail(f"missing {p}")
    except json.JSONDecodeError as e:
        fail(f"invalid JSON in {p}: {e}")


def figure_ids():
    raw = load(ROOT / "data" / "figures.json")
    ids = set()
    for w in raw["waves"]:
        for f in w.get("figures", []):
            ids.add(f"{w['id']}::{f['name']}")
    return ids


def main():
    doc = load(SRC)
    for key in ("observed", "methodology", "priceTiers", "chaseEra",
                "reissueProgram", "koWatch", "launchCurveNote", "honestGaps"):
        if key not in doc:
            fail(f"missing top-level key {key!r}")

    # --- price-tier pins: only published dollars, never invented ---
    tiers = doc["priceTiers"]
    for tid, pins in PINNED_TIERS.items():
        t = tiers.get(tid)
        if not t:
            fail(f"priceTiers missing {tid!r}")
        for field, want in pins.items():
            if t.get(field) != want:
                fail(f"priceTiers.{tid}.{field} = {t.get(field)!r}, expected published {want!r}")
        if not t.get("label") or not t.get("source"):
            fail(f"priceTiers.{tid} needs label + source")

    # --- chase era: white-Doom band must match the Price Watch's own signal ---
    doom = doc["chaseEra"]["whiteDoom"]
    if doom["band"] != PINNED_WHITE_DOOM_BAND:
        fail(f"whiteDoom.band = {doom['band']!r}, expected published {PINNED_WHITE_DOOM_BAND!r}")
    if doc["chaseEra"]["waspPrototype"]["ask"] != PINNED_WASP_ASK:
        fail("waspPrototype.ask drifted from the published $7,500 ask")
    signals = load(ROOT / "data" / "price-signals.json")["signals"]
    doom_signals = [s for s in signals
                    if s["figId"] == doom["figId"] and s.get("kind") == "sold-band"]
    if not doom_signals:
        fail("white-Doom sold-band signal missing from data/price-signals.json")
    if not any(s["low"] == 115 and s["high"] == 200 for s in doom_signals):
        fail("white-Doom band no longer matches data/price-signals.json, fix one of them, never both silently")

    # --- launch-curve cross-checks ---
    curves = {c["figId"]: c for c in load(ROOT / "data" / "launch-curves.json")["curves"]}
    for fig_id, peak in (
        (doc["launchCurveNote"]["gambit"]["figId"], doc["launchCurveNote"]["gambit"]["peak"]),
        (doc["launchCurveNote"]["cyclops"]["figId"], doc["launchCurveNote"]["cyclops"]["peak"]),
    ):
        curve = curves.get(fig_id)
        if not curve:
            fail(f"no launch curve for {fig_id}")
        hi = max(p["price"] for p in curve["points"])
        if hi != peak:
            fail(f"launch-curve peak for {fig_id} is {hi}, quest-market says {peak}")

    # --- every referenced figId resolves ---
    ids = figure_ids()
    for fig_id in (doom["figId"],
                   doc["launchCurveNote"]["gambit"]["figId"],
                   doc["launchCurveNote"]["cyclops"]["figId"]):
        if fig_id not in ids:
            fail(f"figId {fig_id!r} does not resolve in data/figures.json")

    # --- reissue cases carry named sources ---
    for case in doc["reissueProgram"]["cases"]:
        if not case.get("case") or not case.get("detail") or not case.get("source"):
            fail("reissueProgram case missing case/detail/source")
    if not doc["koWatch"].get("detail") or not doc["koWatch"].get("sources"):
        fail("koWatch needs detail + named sources")
    if not isinstance(doc["honestGaps"], list) or not doc["honestGaps"]:
        fail("honestGaps must be a non-empty list")

    # --- build the API envelope: "tiers" is the first list in the envelope ---
    tier_records = []
    for tid in ("standard", "deluxe", "mtg", "milesMask", "apocalypse12", "madeToOrder"):
        t = tiers[tid]
        rec = {"id": tid, "label": t["label"], "source": t["source"]}
        if "usd" in t:
            rec["usd"] = t["usd"]
        else:
            rec["low"], rec["high"] = t["low"], t["high"]
        if t.get("examples"):
            rec["examples"] = t["examples"]
        tier_records.append(rec)

    envelope = {
        "version": "1.0.0",
        "observed": doc["observed"],
        "source": "data/quest-market.json",
        "methodology": doc["methodology"],
        "count": len(tier_records),
        "tiers": tier_records,
        "chaseEra": doc["chaseEra"],
        "reissueProgram": doc["reissueProgram"],
        "koWatch": doc["koWatch"],
        "launchCurveNote": doc["launchCurveNote"],
        "honestGaps": doc["honestGaps"],
    }
    V1.write_text(json.dumps(envelope, indent=2, ensure_ascii=False) + "\n")

    SCHEMA_DIR.mkdir(parents=True, exist_ok=True)
    (SCHEMA_DIR / "quest-market.json").write_text(json.dumps({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "QuestMarket",
        "type": "object",
        "required": ["version", "observed", "methodology", "count", "tiers",
                     "chaseEra", "reissueProgram", "koWatch", "launchCurveNote"],
        "properties": {
            "version": {"type": "string"},
            "observed": {"type": "string"},
            "source": {"type": "string"},
            "methodology": {"type": "string"},
            "count": {"type": "integer"},
            "tiers": {"type": "array"},
            "chaseEra": {"type": "object"},
            "reissueProgram": {"type": "object"},
            "koWatch": {"type": "object"},
            "launchCurveNote": {"type": "object"},
            "honestGaps": {"type": "array"},
        },
    }, indent=2) + "\n")
    (SCHEMA_DIR / "quest-market-tier.json").write_text(json.dumps({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "QuestMarketTier",
        "type": "object",
        "required": ["id", "label", "source"],
        "properties": {
            "id": {"type": "string"},
            "label": {"type": "string"},
            "source": {"type": "string"},
            "usd": {"type": "number"},
            "low": {"type": "number"},
            "high": {"type": "number"},
            "examples": {"type": "string"},
        },
    }, indent=2) + "\n")

    print(f"build_quest_market: OK, {len(tier_records)} tiers, envelope -> {V1}")


if __name__ == "__main__":
    main()
