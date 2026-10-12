#!/usr/bin/env python3
"""
check_radar.py — hobby-press reveal scanner for the Marvel Legends release radar.

Polls hobby-press RSS feeds plus a multi-query Google News RSS search for
Marvel Legends reveal / announcement items, filters by keyword, and writes
NEW items to data/v1/radar-candidates.json.

Dedup is handled against data/v1/radar-seen.json (a persistent seen-URL store
this script maintains itself). Nothing here ever touches radar.html — the
candidates file is the product; a human (or the builder agent) reviews it and
promotes VERIFIED reveals into radar.html. Unverified reveals must never be
auto-added; that would violate the site's honesty standards.

Stdlib only (urllib + xml.etree). Per-source errors never kill the run.
Exit 0 with a printed summary.
"""

import datetime
import html as html_lib
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

# Repo root is three levels above this file: scripts/refresh/check_radar.py
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
API_DIR = os.path.join(ROOT, "data", "v1")
CANDIDATES_PATH = os.path.join(API_DIR, "radar-candidates.json")
SEEN_PATH = os.path.join(API_DIR, "radar-seen.json")

# Both hosts block non-browser user-agents on their feeds (toyark 404s,
# bleedingcool 307s a bot check), so identify as a compatible browser client.
UA = {"User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                     "AppleWebKit/537.36 (KHTML, like Gecko) "
                     "Chrome/126.0 Safari/537.36 "
                     "(compatible; MarvelLegendsChronicle-RadarBot/1.0)")}
TIMEOUT = 20

SOURCES = [
    {
        "name": "Toyark",
        "rss": ["https://www.toyark.com/feed/"],
        "html": "https://www.toyark.com/",
    },
    {
        "name": "Marvel Toy News",
        "rss": ["https://marveltoynews.com/feed/"],
        "html": "https://marveltoynews.com/",
    },
    {
        "name": "Bleeding Cool",
        "rss": [
            "https://bleedingcool.com/collectibles/feed/",
            "https://bleedingcool.com/feed/",
        ],
        "html": "https://bleedingcool.com/collectibles/",
    },
    # Google News: public no-key RSS, aggregated across several query variants.
    # No accounts, no spend, no private data — just the public search feed.
    {
        "name": "Google News",
        "multi": True,
        "rss": [
            "https://news.google.com/rss/search?q=%22Marvel%20Legends%22&hl=en-US&gl=US&ceid=US%3Aen",
            "https://news.google.com/rss/search?q=%22Marvel%20Legends%22%20wave&hl=en-US&gl=US&ceid=US%3Aen",
            "https://news.google.com/rss/search?q=%22Marvel%20Legends%22%20exclusive&hl=en-US&gl=US&ceid=US%3Aen",
            "https://news.google.com/rss/search?q=%22Marvel%20Legends%22%20revealed&hl=en-US&gl=US&ceid=US%3Aen",
        ],
        "html": None,
    },
]

# Title must contain "marvel legends" (case-insensitive) AND at least one of
# these reveal/announcement markers.
ANCHOR = "marvel legends"
MARKERS = (
    "reveal", "reveals", "revealed", "announced", "announcement", "announce",
    "exclusive", "exclusives", "wave", "pre-order", "preorder", "preorders",
    "first look", "unveiled", "unveil",
)

LINK_RE = re.compile(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', re.S | re.I)
TAG_RE = re.compile(r"<[^>]+>")


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_rss_items(payload):
    """Parse an RSS/Atom payload into [(title, url)]. Raises on bad XML."""
    root = ET.fromstring(payload)
    items = []
    for item in root.iter("item"):  # RSS
        title = item.findtext("title") or ""
        link = item.findtext("link") or ""
        items.append((title.strip(), link.strip()))
    for entry in root.iter("{http://www.w3.org/2005/Atom}entry"):  # Atom
        title = entry.findtext("{http://www.w3.org/2005/Atom}title") or ""
        link = ""
        for ln in entry.iter("{http://www.w3.org/2005/Atom}link"):
            if ln.get("rel", "alternate") == "alternate":
                link = ln.get("href") or ""
                break
        items.append((title.strip(), link.strip()))
    return items


def parse_html_items(payload, base_url):
    """Fallback: scrape <a> links out of HTML. Returns [(title, url)]."""
    items = []
    seen = set()
    for href, text in LINK_RE.findall(payload):
        if not href.startswith("http"):
            continue
        text = html_lib.unescape(TAG_RE.sub(" ", text)).strip()
        text = re.sub(r"\s+", " ", text)
        if len(text) < 12 or "feed" in href:
            continue
        if href in seen:
            continue
        seen.add(href)
        items.append((text, href))
    return items


def matches(title):
    t = title.lower()
    return ANCHOR in t and any(m in t for m in MARKERS)


def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def save_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, path)


def main():
    seen = load_json(SEEN_PATH, [])           # list of {"url": ...} or plain urls
    seen_urls = set()
    for s in seen:
        seen_urls.add(s["url"] if isinstance(s, dict) else s)

    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    new_candidates = []
    status = []

    for src in SOURCES:
        items, mode, err = [], "failed", None
        multi = src.get("multi", False)
        gathered = []
        for rss_url in src.get("rss") or []:
            try:
                payload = fetch(rss_url)
                parsed = parse_rss_items(payload)
                if parsed:
                    if not multi:
                        gathered = parsed
                        break
                    gathered.extend(parsed)
                # Fetched fine but no items and not multi: try the next RSS
                # URL before falling back to HTML scanning.
            except Exception as e:  # noqa: BLE001 - per-source isolation
                err = str(e)[:120]
        if gathered:
            items, mode = gathered, "rss"
        if not items and src.get("html"):
            try:
                payload = fetch(src["html"])
                items = parse_html_items(payload, src["html"])
                if items:
                    mode = "html-fallback"
            except Exception as e:  # noqa: BLE001 - per-source isolation
                err = str(e)[:120]
                mode = "failed"
        found = 0
        for title, url in items:
            if not title or not url:
                continue
            if url in seen_urls:
                continue
            seen_urls.add(url)
            if matches(title):
                new_candidates.append({
                    "title": title,
                    "url": url,
                    "source": src["name"],
                    "detected_at": now,
                })
                found += 1
        status.append({"source": src["name"], "mode": mode, "new": found,
                       "error": err if mode == "failed" else None})

    os.makedirs(API_DIR, exist_ok=True)
    save_json(CANDIDATES_PATH, new_candidates)
    save_json(SEEN_PATH, sorted(seen_urls))

    # Summary to stdout; exit 0 always (per-source errors are reported, not fatal).
    print("radar refresh summary (UTC %s)" % now)
    for s in status:
        line = "  %-16s %-13s new=%d" % (s["source"], s["mode"], s["new"])
        if s["error"]:
            line += " error=%s" % s["error"]
        print(line)
    print("wrote %d candidate(s) to %s" % (len(new_candidates),
          os.path.relpath(CANDIDATES_PATH, ROOT)))
    print("seen store: %d url(s) at %s" % (len(seen_urls),
          os.path.relpath(SEEN_PATH, ROOT)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
