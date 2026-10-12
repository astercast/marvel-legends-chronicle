#!/usr/bin/env python3
"""Build api/v1/*.json from the Chronicle source data.

Regenerate after any data change:  python3 scripts/build_api.py
Outputs are committed to the repo so the API is static and versioned.

The manifest (api/v1/index.json) is self-describing: every endpoint lists
its path, description, schema URL, item-schema URL, ISO-8601 UTC `updated`
timestamp, record count, and deprecation notes. validate.sh reads the
manifest and validates every endpoint against its schema — the manifest is
the single source of truth for the API surface.
"""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
API = ROOT / "api" / "v1"
VERSION = "1.0.0"
OBSERVED = "2026-10-11"  # observation date for the dataset
UPDATED = OBSERVED + "T00:00:00Z"  # deterministic ISO-8601 UTC stamp for the manifest


def load_json(path):
    return json.loads(Path(path).read_text())


def ep(path, description, schema=None, item_schema=None, records=None, notes=None):
    """One self-describing manifest entry for an endpoint."""
    return {
        "path": path,
        "description": description,
        "schema": schema,          # schema URL for the endpoint's top-level JSON value
        "itemSchema": item_schema,  # schema URL for one record (array/envelope endpoints)
        "updated": UPDATED,
        "records": records,
        "notes": notes,            # deprecation notes, or null
    }


def main():
    # NEVER rmtree api/v1 wholesale: hand-maintained files (radar-candidates.json,
    # radar-seen.json, anything else not in `outputs`) must survive a rebuild.
    # Only write/replace the files this script generates.
    (API / "schema").mkdir(parents=True, exist_ok=True)

    raw = load_json(ROOT / "data" / "figures.json")
    encyc = load_json(ROOT / "data" / "encyclopedia.json")
    preorders_raw = load_json(ROOT / "data" / "preorders.json")
    characters_raw = load_json(ROOT / "characters" / "manifest.json")
    timeline_raw = load_json(ROOT / "data" / "timeline.json")
    price_raw = load_json(ROOT / "data" / "price-signals.json")
    radar_candidates = load_json(API / "radar-candidates.json")
    radar_seen = load_json(API / "radar-seen.json")
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

    characters = [
        {
            "slug": c["slug"],
            "name": c["name"],
            "count": c["count"],
            "first": c["first"],
            "last": c["last"],
            "page": f"characters/{c['slug']}.html",
        }
        for c in characters_raw
    ]

    preorder_items = preorders_raw["items"]
    preorders_envelope = {
        "version": VERSION,
        "observed": OBSERVED,
        "source": preorders_raw.get("source"),
        "note": preorders_raw.get("note"),
        "count": len(preorder_items),
        "items": preorder_items,
    }
    characters_envelope = {
        "version": VERSION,
        "observed": OBSERVED,
        "count": len(characters),
        "characters": characters,
    }
    # "years" is the first list in the envelope: the manifest-driven validator
    # takes the first list value as the item array for itemSchema checks.
    timeline_envelope = {
        "version": VERSION,
        "observed": OBSERVED,
        "title": timeline_raw["title"],
        "lede": timeline_raw["lede"],
        "yearMin": timeline_raw["yearMin"],
        "yearMax": timeline_raw["yearMax"],
        "count": timeline_raw["count"],
        "years": timeline_raw["years"],
        "packagingEras": timeline_raw["packagingEras"],
        "sourcesNote": timeline_raw["sourcesNote"],
    }

    # "signals" is the first list in the envelope: the manifest-driven validator
    # takes the first list value as the item array for itemSchema checks.
    price_envelope = {
        "version": VERSION,
        "observed": price_raw.get("observed", OBSERVED),
        "methodology": price_raw["methodology"],
        "count": len(price_raw["signals"]),
        "signals": price_raw["signals"],
    }

    skills_index = {}
    skills_idx_path = ROOT / "skills" / "index.json"
    if skills_idx_path.exists():
        skills_index = json.loads(skills_idx_path.read_text())

    endpoints = {
        "index": ep(
            "api/v1/index.json",
            "Self-describing manifest: every endpoint with path, description, schema URLs, "
            "ISO-8601 UTC updated timestamp, record counts, and deprecation notes. Start here.",
            schema="api/v1/schema/manifest.json", records=1),
        "stats": ep(
            "api/v1/stats.json",
            "Archive totals: wave/figure counts, year range, BAF/exclusive/variant tallies, "
            "per-year and per-manufacturer breakdowns. Cheapest entry point for overview questions.",
            schema="api/v1/schema/stats.json", records=1),
        "waves": ep(
            "api/v1/waves.json",
            "One summary per wave: id, year, manufacturer, series, BAF name (nullable), "
            "story source (nullable), figure count.",
            schema="api/v1/schema/waves.json", item_schema="api/v1/schema/wave.json",
            records=len(wave_summaries)),
        "figures": ep(
            "api/v1/figures.json",
            "Flat list of every figure with wave context and stable ids (<waveId>::<figureName>). "
            "Filter client-side by year, manufacturer, waveId, exclusive, variant, bafPiece.",
            schema="api/v1/schema/figures.json", item_schema="api/v1/schema/figure.json",
            records=len(figures)),
        "encyclopedia": ep(
            "api/v1/encyclopedia.json",
            "Collector encyclopedia: line history, packaging evolution, variant/chase/exclusive "
            "taxonomy, hall of fame (with reissue-radar flags), grading guide, transparent price "
            "methodology, bootleg-spotting guide, resources directory. Editorial knowledge, not catalog data.",
            schema="api/v1/schema/encyclopedia.json", records=1),
        "preorders": ep(
            "api/v1/preorders.json",
            "Researched upcoming releases: status (preorder/revealed/available), exact preorderDate "
            "(YYYY-MM-DD, null when unreported — never invented), releaseWindow, announced MSRP "
            "(never a market price), retailer search patterns, hobby-press sources.",
            schema="api/v1/schema/preorders.json", item_schema="api/v1/schema/preorder.json",
            records=len(preorder_items)),
        "characters": ep(
            "api/v1/characters.json",
            "Character guides: every character with a dedicated page — slug, display name, release "
            "count, first/last year, and the page path. Join to figures.json by character name for shelf audits.",
            schema="api/v1/schema/characters.json", item_schema="api/v1/schema/character.json",
            records=len(characters)),
        "timeline": ep(
            "api/v1/timeline.json",
            "The Legends Timeline: year-by-year line history 2002-2026 — era, headline, summary, "
            "sourced milestones, packaging notes, per-year wave records (ids link into the "
            "archive), and spotlight figure ids.",
            schema="api/v1/schema/timeline.json", item_schema="api/v1/schema/timeline-year.json",
            records=len(timeline_raw["years"])),
        "rarity": ep(
            "api/v1/rarity.json",
            "The Rarity Guide: chase vs variant vs exclusive vs limited — tier definitions with "
            "sourced examples (real figure ids), how-to-spot notes, value notes (reported prices only), "
            "archive signal counts, and the quest-achievement mapping. Generated by scripts/build_rarity.py.",
            schema="api/v1/schema/rarity.json", item_schema="api/v1/schema/rarity-tier.json",
            records=len(load_json(ROOT / "api" / "v1" / "rarity.json")["tiers"])),
        "price-signals": ep(
            "api/v1/price-signals.json",
            "Reported market price signals for the Price Watch: curated, sourced sold-band / sold-avg / "
            "listing / claimed prices already published on the Chronicle (encyclopedia, market briefing) — "
            "reported ranges, not live prices; the Chronicle publishes no price index.",
            schema="api/v1/schema/price-signals.json", item_schema="api/v1/schema/price-signal.json",
            records=len(price_raw["signals"])),
        "radar-candidates": ep(
            "api/v1/radar-candidates.json",
            "Hand-maintained reissue-radar research feed: newly spotted news items (title, URL, "
            "source, detection time). Research notes, not a generated snapshot.",
            schema="api/v1/schema/radar-candidates.json", item_schema="api/v1/schema/radar-candidate.json",
            records=len(radar_candidates),
            notes="Hand-maintained — build_api.py reads it for the record count but never rewrites it."),
        "radar-seen": ep(
            "api/v1/radar-seen.json",
            "Hand-maintained dedupe list of radar URLs already processed. Array of URL strings.",
            schema="api/v1/schema/radar-seen.json", records=len(radar_seen),
            notes="Hand-maintained — build_api.py reads it for the record count but never rewrites it."),
    }

    index = {
        "name": "Marvel Legends Chronicle API",
        "version": VERSION,
        "observed": OBSERVED,
        "repository": "https://github.com/astercast/marvel-legends-chronicle",
        "for_agents": "Start at api/v1/index.json. For task procedures, read skills/index.json and load the relevant skill file — skills are the primary agentic interface for doing work, the JSON endpoints are the data layer. The full agent guide is AGENT.md at the repository root.",
        "provenance": "Fan-compiled archive. Within-year ordering is year-accurate but not audited to the month; some BAF pieces and disputed wave numbers are flagged in notes.",
        "skills": {
            "directory": "skills/",
            "index": "skills/index.json",
            "count": skills_index.get("count", 0),
            "usage": "Each skill is a markdown file with frontmatter (name, description), then: Use when, Inputs, Procedure, Worked example, Data/API references, Pitfalls. Agent-playbook skills (skills/agents/) use an 'API references' section pointing at api/v1 endpoints; the rest use 'Data references' pointing at data/*.json. Load the skill whose task matches the user's request.",
        },
        "endpoints": endpoints,
    }

    # ---- schemas (draft-07) ----
    wave_item = {
        "type": "object",
        "required": ["id", "year", "manufacturer", "series", "figureCount"],
        "properties": {
            "id": {"type": "string", "description": "Stable kebab-case wave id"},
            "year": {"type": "integer"},
            "manufacturer": {"type": "string", "enum": ["Toy Biz", "Hasbro"]},
            "series": {"type": "string"},
            "baf": {"type": ["string", "null"]},
            "source": {"type": ["string", "null"],
                       "description": "Story source when the wave name names it: mcu|animated|videogame, else null"},
            "figureCount": {"type": "integer"},
        },
    }
    figure_item = {
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
            "source": {"type": ["string", "null"]},
        },
    }
    preorder_item = {
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
    character_item = {
        "type": "object",
        "required": ["slug", "name", "count", "first", "last"],
        "properties": {
            "slug": {"type": "string", "description": "Kebab-case character slug; page at characters/<slug>.html"},
            "name": {"type": "string"},
            "count": {"type": "integer", "description": "Catalogued releases for this character"},
            "first": {"type": "integer", "description": "First release year"},
            "last": {"type": "integer", "description": "Most recent release year"},
            "page": {"type": "string"},
        },
    }
    radar_candidate_item = {
        "type": "object",
        "required": ["title", "url", "source", "detected_at"],
        "properties": {
            "title": {"type": "string"},
            "url": {"type": "string"},
            "source": {"type": "string"},
            "detected_at": {"type": "string", "description": "ISO-8601 UTC detection time"},
        },
    }
    timeline_source_item = {
        "type": "object",
        "required": ["label", "url"],
        "properties": {"label": {"type": "string"}, "url": {"type": "string"}},
    }
    timeline_year_item = {
        "type": "object",
        "required": ["year", "era", "headline", "summary", "milestones", "waves", "spotlight"],
        "properties": {
            "year": {"type": "integer"},
            "era": {"type": "string", "enum": ["Toy Biz", "Hasbro"]},
            "headline": {"type": "string"},
            "summary": {"type": "string"},
            "packaging": {"type": ["string", "null"]},
            "milestones": {"type": "array", "items": {
                "type": "object",
                "required": ["text", "sources"],
                "properties": {
                    "text": {"type": "string"},
                    "sources": {"type": "array", "items": timeline_source_item},
                }}},
            "waves": {"type": "array", "items": {
                "type": "object",
                "required": ["id", "series", "figureCount", "page"],
                "properties": {
                    "id": {"type": "string"},
                    "series": {"type": "string"},
                    "figureCount": {"type": "integer"},
                    "baf": {"type": ["string", "null"]},
                    "page": {"type": "string"},
                }}},
            "spotlight": {"type": "array", "items": {
                "type": "object",
                "required": ["id", "name", "waveId", "waveSeries", "why", "page"],
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "waveId": {"type": "string"},
                    "waveSeries": {"type": "string"},
                    "why": {"type": "string"},
                    "page": {"type": "string"},
                }}},
        },
    }

    def schema_doc(title, body):
        return {"$schema": "http://json-schema.org/draft-07/schema#",
                "title": title, **body}

    endpoint_entry = {
        "type": "object",
        "required": ["path", "description", "schema", "itemSchema", "updated", "records", "notes"],
        "properties": {
            "path": {"type": "string"},
            "description": {"type": "string"},
            "schema": {"type": ["string", "null"]},
            "itemSchema": {"type": ["string", "null"]},
            "updated": {"type": "string", "description": "ISO-8601 UTC"},
            "records": {"type": ["integer", "null"]},
            "notes": {"type": ["string", "null"]},
        },
    }

    schemas = {
        "schema/wave.json": schema_doc("Wave", wave_item),
        "schema/waves.json": schema_doc("WaveList", {"type": "array", "items": wave_item}),
        "schema/figure.json": schema_doc("Figure", figure_item),
        "schema/figures.json": schema_doc("FigureList", {"type": "array", "items": figure_item}),
        "schema/preorder.json": schema_doc("PreorderItem", preorder_item),
        "schema/preorders.json": schema_doc("PreorderList", {
            "type": "object",
            "required": ["version", "observed", "count", "items"],
            "properties": {
                "version": {"type": "string"},
                "observed": {"type": "string"},
                "source": {"type": ["string", "null"]},
                "note": {"type": ["string", "null"]},
                "count": {"type": "integer"},
                "items": {"type": "array", "items": preorder_item},
            }}),
        "schema/character.json": schema_doc("Character", character_item),
        "schema/characters.json": schema_doc("CharacterList", {
            "type": "object",
            "required": ["version", "observed", "count", "characters"],
            "properties": {
                "version": {"type": "string"},
                "observed": {"type": "string"},
                "count": {"type": "integer"},
                "characters": {"type": "array", "items": character_item},
            }}),
        "schema/radar-candidate.json": schema_doc("RadarCandidate", radar_candidate_item),
        "schema/radar-candidates.json": schema_doc("RadarCandidateList",
                                                  {"type": "array", "items": radar_candidate_item}),
        "schema/radar-seen.json": schema_doc("RadarSeenList",
                                             {"type": "array", "items": {"type": "string"}}),
        "schema/timeline-year.json": schema_doc("TimelineYear", timeline_year_item),
        "schema/timeline.json": schema_doc("LegendsTimeline", {
            "type": "object",
            "required": ["version", "observed", "title", "lede", "yearMin", "yearMax",
                         "count", "years", "packagingEras", "sourcesNote"],
            "properties": {
                "version": {"type": "string"},
                "observed": {"type": "string"},
                "title": {"type": "string"},
                "lede": {"type": "string"},
                "yearMin": {"type": "integer"},
                "yearMax": {"type": "integer"},
                "count": {"type": "integer"},
                "years": {"type": "array", "items": timeline_year_item},
                "packagingEras": {"type": "array", "items": {
                    "type": "object",
                    "required": ["name", "years", "text", "sources"],
                    "properties": {
                        "name": {"type": "string"},
                        "years": {"type": "string"},
                        "text": {"type": "string"},
                        "sources": {"type": "array", "items": {
                            "type": "object",
                            "required": ["label", "url"],
                            "properties": {"label": {"type": "string"}, "url": {"type": "string"}},
                        }},
                    }}},
                "sourcesNote": {"type": "string"},
            }}),
        "schema/stats.json": schema_doc("ArchiveStats", {
            "type": "object",
            "required": ["version", "observed", "waves", "figures", "yearMin", "yearMax",
                         "bafWaves", "exclusiveFigures", "variantFigures",
                         "byYear", "byManufacturer"],
            "properties": {
                "version": {"type": "string"},
                "observed": {"type": "string"},
                "waves": {"type": "integer"},
                "figures": {"type": "integer"},
                "yearMin": {"type": "integer"},
                "yearMax": {"type": "integer"},
                "bafWaves": {"type": "integer"},
                "exclusiveFigures": {"type": "integer"},
                "variantFigures": {"type": "integer"},
                "byYear": {"type": "object"},
                "byManufacturer": {"type": "object"},
            }}),
        "schema/encyclopedia.json": schema_doc("CollectorEncyclopedia", {
            "type": "object",
            "required": ["history", "packagingGuide", "variantsGuide", "hallOfFame",
                         "gradingGuide", "priceMethod", "bootlegGuide", "resources"],
            "properties": {
                "history": {"type": "array"},
                "packagingGuide": {"type": "object"},
                "variantsGuide": {"type": "object"},
                "hallOfFame": {"type": "array"},
                "gradingGuide": {"type": "object"},
                "priceMethod": {"type": "object"},
                "bootlegGuide": {"type": "object"},
                "resources": {"type": "array"},
            }}),
        "schema/manifest.json": schema_doc("ChronicleAPIManifest", {
            "type": "object",
            "required": ["name", "version", "observed", "repository", "for_agents",
                         "provenance", "skills", "endpoints"],
            "properties": {
                "name": {"type": "string"},
                "version": {"type": "string", "description": "Semver; breaking changes get a new v2/ path"},
                "observed": {"type": "string"},
                "repository": {"type": "string"},
                "for_agents": {"type": "string"},
                "provenance": {"type": "string"},
                "skills": {"type": "object"},
                "endpoints": {"type": "object",
                              "description": "Each key is an endpoint name; each value is an endpoint entry",
                              "properties": {name: endpoint_entry for name in
                                             ["index", "stats", "waves", "figures", "encyclopedia",
                                              "preorders", "characters", "timeline",
                                              "radar-candidates", "radar-seen"]}},
            }}),
    }

    outputs = {
        "index.json": index,
        "stats.json": stats,
        "waves.json": wave_summaries,
        "figures.json": figures,
        "encyclopedia.json": encyc,
        "preorders.json": preorders_envelope,
        "characters.json": characters_envelope,
        "timeline.json": timeline_envelope,
        "price-signals.json": price_envelope,
        **schemas,
    }
    for name, payload in outputs.items():
        # Minified on the wire: api/v1/figures.json is 732KB pretty-printed.
        # Nulls are KEPT (API contract: absent != null for consumers).
        (API / name).write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n")

    print(f"API v{VERSION}: {len(wave_summaries)} waves, {len(figures)} figures, "
          f"{len(characters)} characters -> {API}")


if __name__ == "__main__":
    main()
