#!/usr/bin/env python3
"""Check every figure picture in data/v1/figure-images.json and write what the
plates need: w, h, fit, matte, status, checkedAt. Run weekly (see
.github/workflows/images.yml) or by hand:

    python3 scripts/verify_images.py                 # whole manifest
    python3 scripts/verify_images.py --limit 40      # first 40, for a quick run
    python3 scripts/verify_images.py --dry           # report only, write nothing

Rules it enforces
- A picture is ALIVE when the shop answers 200, the type is image/*, the file decodes,
  and both sides are at least 200 px (a "coming soon" gif or a tracking pixel is not a photo).
- It never stores the picture. It reads the bytes once, measures them, and drops them.
- One request per host per second, with a User-Agent that says who is asking.
- If the main source is dead and an alt is alive, the alt is promoted. If nothing is alive
  the entry is marked status "dead" and every page treats the figure as not pictured.
- A dead entry is retried on the next run, so a shop that comes back brings its photos back.
Needs Pillow (pip install pillow). The site itself needs nothing.
"""
import argparse, collections, datetime, io, json, sys, time, urllib.request, urllib.parse
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "data" / "v1" / "figure-images.json"
HEALTH = ROOT / "data" / "v1" / "image-health.json"
UA = "Mozilla/5.0 (compatible; MarvelLegendsChronicle-imagecheck/1.0; +https://github.com/astercast/marvel-legends-chronicle)"
MIN_SIDE = 200
last_hit = collections.defaultdict(float)


def polite(host):
    wait = 1.0 - (time.time() - last_hit[host])
    if wait > 0:
        time.sleep(wait)
    last_hit[host] = time.time()


def fetch(url, host):
    """Read the whole body. Some CDNs close early on some network paths
    (measured here: BigBadToyStore transfers dying at random byte offsets),
    and a short read is not a dead photo — so the read RESUMES with a Range
    request from the last byte received instead of restarting, and only a
    body that stays incomplete after several resumes counts as a failure.
    Raises the last error."""
    import http.client
    last = None
    for attempt in range(4):
        polite(host)
        try:
            body, ctype, want = b"", None, None
            stalls = 0
            while stalls < 8:
                headers = {"User-Agent": UA, "Accept-Encoding": "identity"}
                if body:
                    headers["Range"] = f"bytes={len(body)}-"
                status = None
                try:
                    req = urllib.request.Request(url, headers=headers)
                    with urllib.request.urlopen(req, timeout=25) as r:
                        status = r.status
                        if ctype is None:
                            ctype = (r.headers.get("content-type") or "").split(";")[0].strip().lower()
                        if status == 200:
                            cl = r.headers.get("content-length")
                            want = int(cl) if cl and cl.isdigit() else None
                            body = r.read()
                        else:  # 206: the Range was honoured, append
                            cr = (r.headers.get("content-range") or "").rsplit("/", 1)[-1]
                            if cr.isdigit():
                                want = int(cr)
                            body += r.read()
                except http.client.IncompleteRead as e:
                    part = e.partial or b""
                    if body and status == 200:
                        body = part if len(part) > len(body) else body  # Range ignored: keep the longer copy
                    elif body:
                        body += part
                    else:
                        body = part
                if want is not None and len(body) >= want:
                    return ctype, body[:want]
                if want is None and body:
                    return ctype, body
                stalls += 1
                time.sleep(0.5)
            raise IOError(f"incomplete after resumes: {len(body)} of {want}")
        except Exception as e:
            last = e
            time.sleep(1.0 * (attempt + 1))
    raise last


def probe(url):
    """Return (ok, info). info has w, h, matte, fit when ok, else a short reason."""
    host = urllib.parse.urlparse(url).netloc
    try:
        ctype, body = fetch(url, host)
    except Exception as e:
        return False, {"why": str(e)[:60]}
    if not ctype.startswith("image/"):
        return False, {"why": "not an image: " + ctype}
    im = None
    for attempt in range(2):
        try:
            im = Image.open(io.BytesIO(body)).convert("RGB")
            break
        except Exception:
            if attempt == 1:
                return False, {"why": "does not decode"}
            # a truncated body can slip past a chunked read; fetch once more
            try:
                ctype, body = fetch(url, host)
            except Exception as e:
                return False, {"why": str(e)[:60]}
    w, h = im.size
    if min(w, h) < MIN_SIDE:
        return False, {"why": f"too small {w}x{h}"}
    return True, {"w": w, "h": h, "matte": matte_of(im), "fit": fit_of(w, h)}


def matte_of(im):
    """Average colour of the four corner patches, or "" when the corners disagree
    (a photo taken in a room, a packaging shot with a busy edge)."""
    s = im.resize((48, max(1, round(48 * im.size[1] / im.size[0]))))
    W, H = s.size
    px = s.load()
    patches = []
    for x0, y0 in ((0, 0), (W - 4, 0), (0, H - 4), (W - 4, H - 4)):
        pts = [px[x, y] for x in range(x0, x0 + 4) for y in range(y0, y0 + 4)]
        patches.append(tuple(sum(p[i] for p in pts) / len(pts) for i in range(3)))
    mean = tuple(sum(p[i] for p in patches) / 4 for i in range(3))
    if max(abs(p[i] - mean[i]) for p in patches for i in range(3)) > 14:
        return ""
    return "#%02x%02x%02x" % tuple(round(v) for v in mean)


def fit_of(w, h):
    r = w / h
    if r >= 0.93:
        return "square"
    if r >= 0.70:
        return "fill"      # tight bust crops, 3:4 and near it
    return "box"           # tall packaging shots


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    doc = json.loads(MANIFEST.read_text())
    entries = doc["entries"][: a.limit] if a.limit else doc["entries"]
    today = datetime.date.today().isoformat()
    stats = collections.Counter()
    dead, promoted = [], []
    for e in entries:
        ok, info = probe(e["imageUrl"])
        if not ok:
            for alt in e.get("alts") or []:
                ok2, info2 = probe(alt["imageUrl"])
                if ok2:
                    promoted.append(e["figureId"])
                    e["alts"] = [x for x in e["alts"] if x is not alt] + [
                        {k: e[k] for k in ("imageUrl", "imageSource", "sourceUrl") if k in e}]
                    e.update({k: alt[k] for k in ("imageUrl", "imageSource", "sourceUrl") if k in alt})
                    ok, info = True, info2
                    break
        if ok:
            e.update(info)
            e["status"] = "ok"
            stats["ok"] += 1
        else:
            e["status"] = "dead"
            e["why"] = info.get("why", "")
            dead.append({"figureId": e["figureId"], "host": urllib.parse.urlparse(e["imageUrl"]).netloc, "why": e["why"]})
            stats["dead"] += 1
        e["checkedAt"] = today
    report = {"checkedAt": today, "checked": len(entries), "ok": stats["ok"], "dead": stats["dead"],
              "promoted": promoted, "deadList": dead}
    print(json.dumps({k: v for k, v in report.items() if k != "deadList"}, indent=1))
    for d in dead[:25]:
        print("DEAD", d["host"], d["why"], d["figureId"])
    if not a.dry:
        MANIFEST.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
        HEALTH.write_text(json.dumps(report, indent=1) + "\n")
    # exit non-zero when more than 10 percent are dead, so a scheduled run flags a broken source
    return 1 if entries and stats["dead"] / len(entries) > 0.10 else 0


if __name__ == "__main__":
    sys.exit(main())
