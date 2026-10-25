"""Marvel Legends Chronicle heartbeat. Runs every 6 hours (cron 17 */6,
.github/workflows/heartbeat.yml) and writes data/v1/pulse.json plus its own
watch state. Sources:

- CMDStore catalog (Shopify /products.json): count + new-product changes.
- ToyArena catalog (Shopify /products.json): count + new-product changes.
- Google News RSS for "Marvel Legends": new-story changes.
- Preorder check: reads the repo's own data/v1/preorders.json and
  data/v1/drop-week.json, counts dated windows, flags any opening in the
  next 7 days. Local files only; nothing is fetched for this source.

MECHANISM GATE (owner decision, 2026-10-24, binding): pictures stay on the
hotlink mechanism. This job NEVER downloads, saves, converts or stores a
photograph. The photo hunt from the design bundle is present below only as
a disabled stub (photo_hunt) and must stay disabled until the owner picks
the self-host mechanism himself.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

STATE = "heartbeat-state.json"
NEWS_URL = ("https://news.google.com/rss/search?q=%22Marvel+Legends%22"
            "&hl=en-US&gl=US&ceid=US:en")
SHOPS = [
    ("cmdstore", "CMDStore catalog", "https://cmdstore.com/products.json?limit=250"),
    ("toyarena", "ToyArena catalog", "https://toyarena.com/products.json?limit=250"),
]


def shopify_catalog(p, state, sid, label, url):
    products, err = [], None
    for page in range(1, 5):
        data, err = get_json(f"{url}&page={page}")
        if not data or not isinstance(data.get("products"), list):
            break
        products += data["products"]
        if len(data["products"]) < 250:
            break
    if not products:
        p.source(sid, label, False, 0, err or "bad catalog", url)
        return
    prods = {}
    for prod in products:
        title = (prod.get("title") or "").strip()
        if "marvel legends" not in title.lower():
            continue
        handle = prod.get("handle") or str(prod.get("id"))
        prods[handle] = {"title": title,
                         "url": url.split("/products.json")[0] + "/products/" + handle}
    old = state.get(sid, {})
    for handle, info in prods.items():
        if handle not in old:
            p.change("catalog", f"{label.split()[0]}: {info['title']}", info["url"])
    state[sid] = prods
    p.source(sid, label, True, len(prods), None, url)


def google_news(p, state):
    raw, err = get(NEWS_URL)
    if raw is None:
        p.source("gnews", "Google News: Marvel Legends", False, 0, err, NEWS_URL)
        return
    try:
        root = ET.fromstring(raw)
        items = []
        for it in root.iter("item"):
            title = (it.findtext("title") or "").strip()
            link = (it.findtext("link") or "").strip()
            if title and link:
                items.append({"title": title, "link": link})
    except Exception:
        p.source("gnews", "Google News: Marvel Legends", False, 0, "bad rss", NEWS_URL)
        return
    seen = set(state.get("gnews_seen", []))
    fresh = [i for i in items if i["link"] not in seen]
    for i in fresh[:10]:
        p.change("story", i["title"], i["link"])
    state["gnews_seen"] = [i["link"] for i in items] + [s for s in state.get("gnews_seen", [])
                                                        if s not in {i["link"] for i in items}][:200]
    p.source("gnews", "Google News: Marvel Legends", True, len(items), None, NEWS_URL)


def preorder_check(p):
    pre = read("preorders.json", {})
    drops = read("drop-week.json", {})
    items = pre.get("items", []) if isinstance(pre, dict) else []
    windows = drops.get("drops", []) if isinstance(drops, dict) else []
    ok = bool(items or windows)
    if not ok:
        p.source("preorders", "Preorder + drop windows", False, 0, "local data unreadable")
        return
    soon = datetime.now(timezone.utc) + timedelta(days=7)
    flagged = 0
    for d in windows:
        at = d.get("windowAt")
        if at:
            try:
                t = datetime.fromisoformat(at)
                if datetime.now(timezone.utc) <= t <= soon:
                    p.change("preorder", f"Drop window opens soon: {d.get('title', d.get('id', 'window'))}",
                             "radar.html")
                    flagged += 1
            except Exception:
                pass
    p.source("preorders", "Preorder + drop windows", True,
             len(items) + len(windows), None, None)


def photo_hunt():
    """DISABLED — owner mechanism gate (2026-10-24). The bundle's photo hunt
    (match a shop listing, download the picture, save it into the repo) is
    NOT authorized: pictures stay hotlinked. Do not call this, do not wire
    it into the workflow, and do not re-enable it without the owner's own
    pick of the self-host mechanism. Kept as a stub so the fork is visible
    in the code, not forgotten."""
    return None


def main():
    p = Pulse()
    state = read(STATE, {})
    if not isinstance(state, dict):
        state = {}
    for sid, label, url in SHOPS:
        shopify_catalog(p, state, sid, label, url)
    google_news(p, state)
    preorder_check(p)
    write_if_changed(STATE, state, volatile=())
    p.write()
    print("heartbeat done:", p.sources)


if __name__ == "__main__":
    main()
