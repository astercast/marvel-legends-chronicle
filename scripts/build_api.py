#!/usr/bin/env python3
"""Build api/v1/*.json from the Chronicle source data.

Regenerate after any data change:  python3 scripts/build_api.py
Outputs are committed to the repo so the API is static and versioned.
"""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = ROOT / "api" / "v1"
VERSION = "1.0.0"
OBSERVED = "2026-10-10"  # observation date for the dataset


def load_json(path):
    return json.loads(Path(path).read_text())


def main():
    shutil.rmtree(API, ignore_errors=True)
    (API / "schema").mkdir(parents=True)

    raw = load_json(ROOT / "data" / "figures.json")
    encyc = load_json(ROOT / "data" / "encyclopedia.json")
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
        "schemas": {
            "wave": "api/v1/schema/wave.json",
            "figure": "api/v1/schema/figure.json",
        },
    }
    index = {
        "name": "Marvel Legends Chronicle API",
        "version": VERSION,
        "observed": OBSERVED,
        "provenance": "Fan-compiled archive. Within-year ordering is year-accurate but not audited to the month; some BAF pieces and disputed wave numbers are flagged in notes.",
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

    outputs = {
        "index.json": index,
        "stats.json": stats,
        "waves.json": wave_summaries,
        "figures.json": figures,
        "encyclopedia.json": encyc,
        "schema/wave.json": wave_schema,
        "schema/figure.json": figure_schema,
    }
    for name, payload in outputs.items():
        (API / name).write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")

    print(f"API v{VERSION}: {len(wave_summaries)} waves, {len(figures)} figures -> {API}")


if __name__ == "__main__":
    main()
