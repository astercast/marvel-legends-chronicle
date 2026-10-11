#!/usr/bin/env python3
"""Build api/v1/*.json from the Chronicle source data.

Regenerate after any data change:  python3 scripts/build_api.py
Outputs are committed to the repo so the API is static and versioned.
"""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
API = ROOT / "api" / "v1"
VERSION = "1.0.0"
OBSERVED = "2026-10-11"  # observation date for the dataset


def load_json(path):
    return json.loads(Path(path).read_text())


def main():
    # NEVER rmtree api/v1 wholesale: hand-maintained files (radar-candidates.json,
    # radar-seen.json, anything else not in `outputs`) must survive a rebuild.
    # Only write/replace the files this script generates.
    (API / "schema").mkdir(parents=True, exist_ok=True)

    raw = load_json(ROOT / "data" / "figures.json")
    encyc = load_json(ROOT / "data" / "encyclopedia.json")
    preorders_raw = load_json(ROOT / "data" / "preorders.json")
    waves = raw["waves"]

    figures = []
    wave_summaries = []
    for w in waves:
        wave_summaries.append({
            "id": w["id"],
            "year": w["year"],
            "manufacturer": w["manufacturer"],
            "series": w["series"],
            "baf": w.get("baf"),
            "source": w.get("source"),  # "mcu" | "animated" | "videogame" | null (unclassified)
            "figureCount": len(w["figures"]),
        })
        for f in w["figures"]:
            figures.append({
                "id": f"{w['id']}::{f['name']}",
                "name": f["name"],
                "variant": f.get("variant"),
                "exclusive": f.get("exclusive"),
                "bafPiece": f.get("bafPiece"),
                "notes": f.get("notes"),
                "waveId": w["id"],
                "waveSeries": w["series"],
                "year": w["year"],
                "manufacturer": w["manufacturer"],
                "waveBaf": w.get("baf"),
                "source": w.get("source"),
            })

    by_year, by_mfr = {}, {}
    for w in waves:
        by_year[str(w["year"])] = by_year.get(str(w["year"]), 0) + len(w["figures"])
        by_mfr[w["manufacturer"]] = by_mfr.get(w["manufacturer"], 0) + len(w["figures"])
    stats = {
        "version": VERSION,
        "observed": OBSERVED,
        "waves": len(waves),
        "figures": len(figures),
        "yearMin": min(w["year"] for w in waves),
        "yearMax": max(w["year"] for w in waves),
        "bafWaves": sum(1 for w in waves if w.get("baf")),
        "exclusiveFigures": sum(1 for f in figures if f["exclusive"]),
        "variantFigures": sum(1 for f in figures if f["variant"]),
        "byYear": by_year,
        "byManufacturer": by_mfr,
    }

    endpoints = {
        "index": "api/v1/index.json",
        "stats": "api/v1/stats.json",
        "waves": "api/v1/waves.json",
        "figures": "api/v1/figures.json",
        "encyclopedia": "api/v1/encyclopedia.json",
        "preorders": "api/v1/preorders.json",
        "schemas": {
            "wave": "api/v1/schema/wave.json",
            "figure": "api/v1/schema/figure.json",
            "preorder": "api/v1/schema/preorder.json",
        },
    }
    skills_index = {}
    skills_idx_path = ROOT / "skills" / "index.json"
    if skills_idx_path.exists():
        skills_index = json.loads(skills_idx_path.read_text())

    index = {
        "name": "Marvel Legends Chronicle API",
        "version": VERSION,
        "observed": OBSERVED,
        "repository": "https://github.com/astercast/marvel-legends-chronicle",
        "for_agents": "Start at api/v1/index.json. For task procedures, read skills/index.json and load the relevant skill file — skills are the primary agentic interface for doing work, the JSON endpoints are the data layer.",
        "provenance": "Fan-compiled archive. Within-year ordering is year-accurate but not audited to the month; some BAF pieces and disputed wave numbers are flagged in notes.",
        "skills": {
            "directory": "skills/",
            "index": "skills/index.json",
            "count": skills_index.get("count", 0),
            "usage": "Each skill is a markdown file with frontmatter (name, description), then: Use when, Inputs, Procedure, Worked example, Data references, Pitfalls. Load the skill whose task matches the user's request.",
        },
        "endpoints": endpoints,
    }

    wave_schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Wave",
        "type": "object",
        "required": ["id", "year", "manufacturer", "series", "figureCount"],
        "properties": {
            "id": {"type": "string", "description": "Stable kebab-case wave id"},
            "year": {"type": "integer"},
            "manufacturer": {"type": "string", "enum": ["Toy Biz", "Hasbro"]},
            "series": {"type": "string"},
            "baf": {"type": ["string", "null"]},
            "figureCount": {"type": "integer"},
        },
    }
    figure_schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Figure",
        "type": "object",
        "required": ["id", "name", "waveId", "waveSeries", "year", "manufacturer"],
        "properties": {
            "id": {"type": "string", "description": "Stable id: <waveId>::<figureName>"},
            "name": {"type": "string"},
            "variant": {"type": ["string", "null"]},
            "exclusive": {"type": ["string", "null"]},
            "bafPiece": {"type": ["string", "null"]},
            "notes": {"type": ["string", "null"]},
            "waveId": {"type": "string"},
            "waveSeries": {"type": "string"},
            "year": {"type": "integer"},
            "manufacturer": {"type": "string", "enum": ["Toy Biz", "Hasbro"]},
            "waveBaf": {"type": ["string", "null"]},
        },
    }

    preorder_schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "PreorderItem",
        "type": "object",
        "required": ["id", "name", "status"],
        "properties": {
            "id": {"type": "string", "description": "Stable kebab-case item id"},
            "name": {"type": "string"},
            "status": {"type": "string", "enum": ["preorder", "revealed", "available"]},
            "preorderDate": {"type": ["string", "null"], "description": "Exact pre-order date YYYY-MM-DD, null when unreported"},
            "releaseWindow": {"type": ["string", "null"], "description": "Season/year label from research, e.g. 'Fall 2026'"},
            "price": {"type": ["number", "null"], "description": "Announced MSRP at reveal, never a market price"},
            "query": {"type": "string", "description": "Search query used for retailer search links"},
            "venue": {"type": ["string", "null"]},
            "details": {"type": ["string", "null"]},
            "retailers": {"type": "array", "items": {"type": "string"}},
            "sources": {"type": "array", "items": {"type": "object"}},
        },
    }

    outputs = {
        "index.json": index,
        "stats.json": stats,
        "waves.json": wave_summaries,
        "figures.json": figures,
        "encyclopedia.json": encyc,
        "preorders.json": {
            "version": VERSION,
            "observed": OBSERVED,
            "source": preorders_raw.get("source"),
            "note": preorders_raw.get("note"),
            "count": len(preorders_raw["items"]),
            "items": preorders_raw["items"],
        },
        "schema/wave.json": wave_schema,
        "schema/figure.json": figure_schema,
        "schema/preorder.json": preorder_schema,
    }
    for name, payload in outputs.items():
        # Minified on the wire: api/v1/figures.json is 732KB pretty-printed.
        # Nulls are KEPT (API contract: absent != null for consumers).
        (API / name).write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n")

    print(f"API v{VERSION}: {len(wave_summaries)} waves, {len(figures)} figures -> {API}")


if __name__ == "__main__":
    main()
