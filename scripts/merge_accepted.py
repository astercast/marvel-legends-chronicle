#!/usr/bin/env python3
"""Fold accepted-pictures.json (from review-images.html) into data/v1/figure-images.json.
Never overwrites an existing live entry; a figure that already has a picture keeps it and
the new one is stored as an alt, so a dead main photo has a second chance.
    python3 scripts/merge_accepted.py accepted-pictures.json && python3 scripts/verify_images.py
"""
import json, sys
from pathlib import Path
M = Path(__file__).resolve().parent.parent / "data" / "v1" / "figure-images.json"
doc = json.loads(M.read_text())
by = {e["figureId"]: e for e in doc["entries"]}
added = alt = 0
for n in json.loads(Path(sys.argv[1]).read_text()):
    cur = by.get(n["figureId"])
    if cur and cur.get("status") != "dead":
        if n["imageUrl"] != cur["imageUrl"] and all(a["imageUrl"] != n["imageUrl"] for a in cur.get("alts", [])):
            cur.setdefault("alts", []).append({k: n[k] for k in ("imageUrl", "imageSource", "sourceUrl")}); alt += 1
    else:
        doc["entries"].append(n); by[n["figureId"]] = n; added += 1
doc["updatedAt"] = __import__("datetime").date.today().isoformat()
M.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
print(f"added {added}, stored {alt} as backups")
