#!/usr/bin/env python3
"""compare_lib.py — shared logic for Wave 26's VS mode + encyclopedia deep-link overhaul.

Single source of truth for:
  * figure deep-link anchors:  waves/<waveId>.html#fig-<slug>  (stable, derived from
    wave id + figure name; disambiguated when a name repeats inside one wave)
  * per-figure cross-link data: rarity tier (w23), reported price signal (w25),
    KO-spotter note (encyclopedia bootleg guide / holiday guide research)
  * "upgrade paths": other documented releases of the same character (real archive
    data only — variants, documented reissues, exclusives), with honest relations

Used by scripts/build_waves.py (wave-page anchors + per-figure xref blocks) and
scripts/build_api.py (the data/v1/compare.json endpoint). Nothing here invents
figures, dates, or prices — every field is derived from committed data files.

ABSOLUTE RULE: no invented figures/dates/prices. Articulation counts and
accessory lists are NOT in the archive; the compare UI says so honestly instead
of fabricating them.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")


def load_data():
    figures_raw = json.loads((DATA / "figures.json").read_text())
    rarity = json.loads((DATA / "rarity-guide.json").read_text())
    prices = json.loads((DATA / "price-signals.json").read_text())
    return figures_raw, rarity, prices


def figure_id(wave_id, name):
    """Stable figure id, same format as assets/js/data.js: <waveId>::<figureName>."""
    return f"{wave_id}::{name}"


def wave_anchors(figures):
    """Map each figure's position in a wave to a unique, stable anchor id.

    Base form: fig-<slug(name)>. When a name repeats inside one wave (e.g. two
    Hulks in Toy Biz Series 1), disambiguate with the variant slug when present,
    else a 1-based index. Deterministic — depends only on the data.
    """
    seen = {}
    anchors = {}
    for i, f in enumerate(figures):
        base = "fig-" + slug(f["name"])
        n = seen.get(base, 0) + 1
        seen[base] = n
        if n == 1:
            anchors[i] = base
        else:
            # Second and later figures sharing the base slug get a suffix.
            suffix = slug(f.get("variant") or "") or str(n)
            anchors[i] = f"{base}-{suffix}"
    # Retro-fix: any base slug shared by 2+ figures gets its first figure
    # suffixed too, so every anchor in the wave is unambiguous.
    for i, f in enumerate(figures):
        base = "fig-" + slug(f["name"])
        if seen[base] > 1 and anchors[i] == base:
            suffix = slug(f.get("variant") or "") or "1"
            anchors[i] = f"{base}-{suffix}"
    return anchors


def deep_link(wave_id, anchor):
    return f"waves/{wave_id}.html#{anchor}"


def compare_url(fig_id):
    from urllib.parse import quote
    return f"compare.html?a={quote(fig_id, safe='')}"


# KO targets — MUST stay in sync with assets/js/ko-targets.js (the JS is the
# display copy; this is the build-time copy). tests/test-compare.js cross-checks.
KO_TARGETS = [
    {"match": "dragon man",
     "note": "Known KO target — buy at retail or run the Auth Wizard before paying.",
     "source": "Encyclopedia bootleg guide"},
    {"match": "ronan",
     "note": "Known KO target — buy at retail or run the Auth Wizard before paying.",
     "source": "Encyclopedia bootleg guide"},
    {"match": "juggernaut",
     "note": "Juggernaut BAF recast is a known KO target — verify the piece before buying.",
     "source": "Encyclopedia bootleg guide"},
    {"match": "carnage",
     "note": "KO tell documented: silver eyes on the fake. Compare before buying.",
     "source": "Encyclopedia bootleg guide"},
    {"match": "maximum spider-man",
     "note": "Maximum Series Spider-Man KO reviewed in video (Apr 2026) — retail or Hasbro Pulse only.",
     "source": "2026 Holiday Guide"},
    {"match": "x-men '97 cyclops",
     "note": "X-Men '97 Cyclops KO (Mustang Toyz) reviewed in video (Sep 2026) — retail or Hasbro Pulse only.",
     "source": "2026 Holiday Guide"},
]


def _tokens(s):
    return [t for t in re.split(r"[^a-z0-9']+", str(s or "").lower()) if len(t) >= 2]


def ko_note_for(name):
    name_toks = set(_tokens(name))
    if not name_toks:
        return None
    for t in KO_TARGETS:
        need = _tokens(t["match"])
        if need and all(tok in name_toks for tok in need):
            return {"note": t["note"], "source": t["source"]}
    return None


def rarity_map(rarity):
    """figId -> {tier, tierName, questAchievement} for documented rarity examples."""
    # Quest-achievement mapping lives in build_rarity.py (single source of truth).
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from build_rarity import QUEST_MAPPING
    out = {}
    for t in rarity["tiers"]:
        for ex in t.get("examples", []):
            out[ex["id"]] = {
                "tier": t["id"],
                "tierName": t["name"],
                "questAchievement": QUEST_MAPPING.get(t["id"]),
            }
    return out


def price_map(prices):
    """figId -> [reported price signals] (list: wave 25 keyed two Doom signals to one
    archive id — a list loses nothing; each signal's own label disambiguates)."""
    out = {}
    for s in prices["signals"]:
        out.setdefault(s["figId"], []).append({
            "id": s["id"],
            "label": s["label"],
            "display": s["display"],
            "low": s["low"],
            "high": s.get("high"),
            "kind": s["kind"],
            "source": s["source"],
            "sourceUrl": s.get("sourceUrl"),
            "note": s.get("note"),
            "singleSource": s.get("singleSource"),
            "asOf": s.get("asOf"),
        })
    return out


def _relation(self_fig, cand):
    """Honest relation label between two same-named figures. Real data only.
    The human-readable trade-off note is generated client-side from the relation
    (see assets/js/compare-guide.js UPGRADE_NOTES) — the path record stays lean."""
    notes = (cand.get("notes") or "").lower()
    if re.search(r"\bre-?issue[ds]?\b", notes):
        return "reissue"
    if cand.get("variant"):
        return "variant"
    if self_fig.get("variant") and not cand.get("variant"):
        return "base-release"
    if cand.get("exclusive"):
        return "exclusive"
    return "same-character"


def upgrade_paths(fig_id, name, self_fig, by_name, max_paths=8):
    """Other documented releases of the same character. Capped, honestly labeled."""
    cands = [c for c in by_name.get(name, []) if c["id"] != fig_id]
    scored = []
    prio = {"variant": 0, "base-release": 1, "reissue": 2, "exclusive": 3, "same-character": 4}
    for c in cands:
        rel = _relation(self_fig, c["fig"])
        scored.append((prio[rel], -c["year"], rel, c))
    scored.sort(key=lambda x: (x[0], x[1]))
    return [
        {
            # name omitted: every path shares the profile's own name (same character)
            "id": c["id"],
            "waveSeries": c["waveSeries"],
            "year": c["year"],
            "variant": c["fig"].get("variant"),
            "exclusive": c["fig"].get("exclusive"),
            "relation": rel,
            # compare URL + deep link are derivable: compare.html?a=<encoded id>,
            # and the profile's own deepLink for the target id.
        }
        for _, _, rel, c in scored[:max_paths]
    ]


def build_profiles():
    """Full per-figure compare profile list. Asserts every cross-reference resolves."""
    figures_raw, rarity, prices = load_data()
    waves = figures_raw["waves"]
    rmap = rarity_map(rarity)
    pmap = price_map(prices)

    # Index every figure; assert rarity/price cross-refs resolve to real figures.
    all_ids = set()
    by_name = {}
    flat = []  # (wave, fig, idx)
    for w in waves:
        anchors = wave_anchors(w["figures"])
        for i, f in enumerate(w["figures"]):
            fid = figure_id(w["id"], f["name"])
            all_ids.add(fid)
            entry = {
                "id": fid, "fig": f, "waveId": w["id"], "waveSeries": w["series"],
                "year": w["year"], "manufacturer": w["manufacturer"],
                "deepLink": deep_link(w["id"], anchors[i]),
                "compareUrl": compare_url(fid),
            }
            flat.append(entry)
            by_name.setdefault(f["name"], []).append(entry)

    for fid in rmap:
        assert fid in all_ids, f"rarity example id does not resolve: {fid}"
    for fid in pmap:
        assert fid in all_ids, f"price-signal figId does not resolve: {fid}"

    # Anchor uniqueness per wave (deep links must be stable + unambiguous).
    for w in waves:
        anchors = list(wave_anchors(w["figures"]).values())
        assert len(anchors) == len(set(anchors)), f"anchor collision in wave {w['id']}"

    profiles = []
    seen_ids = set()
    for e in flat:
        fid = e["id"]
        ko = ko_note_for(e["fig"]["name"])
        # Cross-reference attachments (rarity tier, reported price signal) follow
        # the archive's own id semantics: assets/js/data.js figureById returns the
        # FIRST figure matching an id, so only the first occurrence carries them.
        first = fid not in seen_ids
        seen_ids.add(fid)
        profiles.append({
            "id": fid,
            "name": e["fig"]["name"],
            "variant": e["fig"].get("variant"),
            "exclusive": e["fig"].get("exclusive"),
            "bafPiece": e["fig"].get("bafPiece"),
            "notes": e["fig"].get("notes"),
            "waveId": e["waveId"],
            "waveSeries": e["waveSeries"],
            "year": e["year"],
            "manufacturer": e["manufacturer"],
            "deepLink": e["deepLink"],
            "compareUrl": e["compareUrl"],
            "rarity": rmap.get(fid) if first else None,
            "priceSignals": pmap.get(fid, []) if first else [],
            "koWatch": ko,
            "upgradePaths": upgrade_paths(fid, e["fig"]["name"], e["fig"], by_name),
        })
    return profiles


_PROFILES_CACHE = None


def profiles_by_position():
    """(waveId, figureIndex) -> profile dict. Lets page builders (build_waves.py)
    attach anchors + cross-links without recomputing anything."""
    global _PROFILES_CACHE
    if _PROFILES_CACHE is None:
        figures_raw, _, _ = load_data()
        profiles = build_profiles()
        _PROFILES_CACHE = {}
        idx = 0
        for w in figures_raw["waves"]:
            for i in range(len(w["figures"])):
                _PROFILES_CACHE[(w["id"], i)] = profiles[idx]
                idx += 1
    return _PROFILES_CACHE
    import sys
    profiles = build_profiles()
    with_ko = sum(1 for p in profiles if p["koWatch"])
    with_rarity = sum(1 for p in profiles if p["rarity"])
    with_price = sum(1 for p in profiles if p["priceSignals"])
    with_up = sum(1 for p in profiles if p["upgradePaths"])
    print(f"profiles={len(profiles)} rarity={with_rarity} price={with_price} "
          f"ko={with_ko} upgradePaths={with_up}")
    if "--write" in sys.argv:
        out = DATA / "compare-profiles.json"
        out.write_text(json.dumps({"profiles": profiles}, indent=1) + "\n")
        print(f"wrote {out} ({out.stat().st_size} bytes)")
