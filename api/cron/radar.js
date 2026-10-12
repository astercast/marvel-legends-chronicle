/* api/cron/radar.js — GET /api/cron/radar (marvel-radar).
 * Daily Reveal Radar heartbeat (§7.3): poll collector press -> extract reveal
 * detections -> dedupe vs radar-seen.json -> append candidates -> commit
 * radar-candidates.json + radar-seen.json on change.
 *
 * Schedule: 0 15 * * * UTC (vercel.json). Cron only: CRON_SECRET bearer
 * required, fail closed. 60s global cooldown for duplicate deliveries.
 * Cache-Control: no-store. Designed to fit the 10s Hobby function budget:
 * all upstream fetches run in parallel with a 4000ms per-source timeout.
 *
 * JS port of the repo's proven scanner (scripts/refresh/check_radar.py):
 * same sources, same keyword filter, same {title,url,source,detected_at}
 * candidate shape. Two deliberate divergences, both per the server spec:
 *  1. APPEND + prune-to-90d instead of overwrite (spec §5.1 / §7.3 "append
 *     candidates"). The old overwrite behavior would clobber this job's
 *     history; the VM refresh.sh job should be reconciled by the wave engine.
 *  2. Identifying User-Agent (spec §8.7) instead of the repo's browser UA.
 *     Known consequence: Toyark 404s and Bleeding Cool 307s non-browser UAs
 *     (see check_radar.py's UA comment). Those sources will report ok:false
 *     honestly rather than being scraped in disguise; Google News RSS is
 *     UA-tolerant and carries the load. If press coverage collapses, that is
 *     a visible, honest signal — not a silent gap.
 *
 * Commit-back: via lib/github.js. The fine-grained PAT is still pending the
 * user's decision (open decision 1) — without GITHUB_REPO_TOKEN the job
 * degrades gracefully to READ-ONLY: it still polls, still computes exactly
 * what would change, returns it in the envelope, and persists nothing.
 */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { ok, err, nowIso } = require("../../lib/envelope");
const { fetchTimeout, DEFAULT_UA } = require("../../lib/fetchx");
const { assertCron } = require("../../lib/cronauth");
const github = require("../../lib/github");

const SERVICE = "marvel-radar";
const VERSION = "1.0.0";
const FETCH_TIMEOUT_MS = 4000;
const RETENTION_MS = 90 * 24 * 3600 * 1000; // §5.1: reveal candidates, 90 days
const COOLDOWN_MS = 60 * 1000; // §4.3 duplicate-delivery guard

const SOURCES = [
  {
    name: "toyark",
    label: "Toyark",
    rss: ["https://www.toyark.com/feed/"],
    html: "https://www.toyark.com/",
  },
  {
    name: "marveltoynews",
    label: "Marvel Toy News",
    rss: ["https://marveltoynews.com/feed/"],
    html: "https://marveltoynews.com/",
  },
  {
    name: "bleedingcool",
    label: "Bleeding Cool",
    rss: [
      "https://bleedingcool.com/collectibles/feed/",
      "https://bleedingcool.com/feed/",
    ],
    html: "https://bleedingcool.com/collectibles/",
  },
  {
    name: "googlenews",
    label: "Google News",
    multi: true, // aggregate ACROSS all query feeds (like check_radar.py), not first-hit
    rss: [
      "https://news.google.com/rss/search?q=%22Marvel%20Legends%22&hl=en-US&gl=US&ceid=US%3Aen",
      "https://news.google.com/rss/search?q=%22Marvel%20Legends%22%20wave&hl=en-US&gl=US&ceid=US%3Aen",
      "https://news.google.com/rss/search?q=%22Marvel%20Legends%22%20exclusive&hl=en-US&gl=US&ceid=US%3Aen",
      "https://news.google.com/rss/search?q=%22Marvel%20Legends%22%20revealed&hl=en-US&gl=US&ceid=US%3Aen",
    ],
    html: null,
  },
];

// Same keyword gate as scripts/refresh/check_radar.py: the title must contain
// "marvel legends" AND at least one reveal/announcement marker.
const ANCHOR = "marvel legends";
const MARKERS = [
  "reveal", "reveals", "revealed", "announced", "announcement", "announce",
  "exclusive", "exclusives", "wave", "pre-order", "preorder", "preorders",
  "first look", "unveiled", "unveil",
];

function matches(title) {
  const t = String(title || "").toLowerCase();
  return t.includes(ANCHOR) && MARKERS.some((m) => t.includes(m));
}

/* ---------- tiny tolerant feed parsers (zero deps) ---------- */

function unescapeEntities(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#0*39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => {
      const c = parseInt(n, 10);
      return Number.isFinite(c) ? String.fromCodePoint(c) : _;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => {
      const c = parseInt(n, 16);
      return Number.isFinite(c) ? String.fromCodePoint(c) : _;
    });
}

function firstTag(block, tag) {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
  return m ? unescapeEntities(m[1]).trim() : "";
}

function parseRssItems(payload) {
  // RSS 2.0 <item> blocks...
  const items = [];
  const itemRe = /<item[\s>][\s\S]*?<\/item>/gi;
  let m;
  while ((m = itemRe.exec(payload)) !== null) {
    const title = firstTag(m[0], "title");
    const link = firstTag(m[0], "link");
    if (title || link) items.push([title, link]);
  }
  // ...plus Atom <entry> blocks.
  const entryRe = /<entry[\s>][\s\S]*?<\/entry>/gi;
  while ((m = entryRe.exec(payload)) !== null) {
    const block = m[0];
    const title = firstTag(block, "title");
    let link = "";
    const linkRe = /<link\b[^>]*>/gi;
    let lm;
    let fallback = "";
    while ((lm = linkRe.exec(block)) !== null) {
      const href = /href="([^"]+)"/i.exec(lm[0]);
      const rel = /rel="([^"]+)"/i.exec(lm[0]);
      if (href) {
        if (!fallback) fallback = href[1];
        if (!rel || rel[1] === "alternate") {
          link = href[1];
          break;
        }
      }
    }
    if (!link) link = fallback;
    if (title || link) items.push([title, link]);
  }
  return items;
}

function parseHtmlItems(payload) {
  const items = [];
  const seen = new Set();
  const aRe = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = aRe.exec(payload)) !== null) {
    const href = m[1];
    if (!href.startsWith("http") || seen.has(href) || href.includes("feed")) continue;
    let text = unescapeEntities(m[2].replace(/<[^>]+>/g, " "));
    text = text.replace(/\s+/g, " ").trim();
    if (text.length < 12) continue;
    seen.add(href);
    items.push([text, href]);
  }
  return items;
}

/* ---------- reveal normalizer (duplicated from api/reveals.js) ---------- */
/* NOTE (spec §1.11): lib/ holds exactly the five shared helpers, so this
 * normalizer is intentionally duplicated here and in api/reveals.js. The two
 * copies must stay in sync; both are pure functions of the raw candidates. */
function normalizeTitleKey(title) {
  let t = String(title || "").toLowerCase();
  const dash = t.lastIndexOf(" - ");
  if (dash > 0 && t.length - dash - 3 <= 30 && t.length - dash - 3 >= 2) {
    t = t.slice(0, dash);
  }
  return t.replace(/[^a-z0-9]+/g, "");
}
function revealId(url) {
  return "rv_" + crypto.createHash("sha256").update(String(url)).digest("hex").slice(0, 12);
}
function normalizeReveals(candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  const groups = new Map();
  for (const c of list) {
    if (!c || !c.title || !c.url) continue;
    const key = normalizeTitleKey(c.title) || revealId(c.url);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const reveals = [];
  for (const [, items] of groups) {
    const sources = [];
    const seenSrc = new Set();
    for (const c of items) {
      const name = String(c.source || "unknown");
      if (!seenSrc.has(name + "|" + c.url)) {
        seenSrc.add(name + "|" + c.url);
        sources.push({ name, url: c.url });
      }
    }
    const distinctSources = new Set(items.map((c) => String(c.source || "unknown")));
    const first = items[0];
    const t = Date.parse(first.detected_at);
    reveals.push({
      id: revealId(first.url),
      title: String(first.title),
      wave: null,
      figures: [],
      announced_at: Number.isNaN(t) ? null : new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z"),
      sources,
      status: distinctSources.size >= 2 ? "confirmed" : "rumor",
      price_tbd: true,
    });
  }
  reveals.sort((a, b) => String(b.announced_at || "").localeCompare(String(a.announced_at || "")));
  return reveals;
}

/* ---------- local bundle fallback (read-only degradation path) ---------- */
function readBundleJson(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "v1", name), "utf8"));
  } catch (e) {
    return null;
  }
}

/* ---------- per-source poll ---------- */
async function pollSource(src) {
  const checkedAt = nowIso();
  const urls = [...(src.rss || [])];
  if (src.html) urls.push(src.html);
  const results = await Promise.all(urls.map((u) => fetchTimeout(u, { timeoutMs: FETCH_TIMEOUT_MS, ua: DEFAULT_UA })));
  // Multi-query sources (Google News) aggregate across ALL feeds; single-feed
  // sources take the first successful parse (RSS preferred, HTML fallback last).
  let items = [];
  let usedUrl = null;
  let usedMode = "failed";
  let firstError = null;
  const isHtml = (u) => u === src.html;
  if (src.multi) {
    const agg = [];
    for (let i = 0; i < urls.length; i++) {
      const r = results[i];
      if (!r.ok) {
        if (!firstError) firstError = r.error || `http ${r.status}`;
        continue;
      }
      try {
        const parsed = parseRssItems(r.text);
        if (parsed.length > 0) {
          agg.push(...parsed);
          if (!usedUrl) {
            usedUrl = urls[i];
            usedMode = "rss";
          }
        }
      } catch (e) {
        if (!firstError) firstError = "parse error: " + String((e && e.message) || e).slice(0, 80);
      }
    }
    items = agg;
    if (items.length === 0 && !firstError) firstError = "empty feeds";
  } else {
    for (let i = 0; i < urls.length; i++) {
      const r = results[i];
      if (!r.ok) {
        if (!firstError) firstError = r.error || `http ${r.status}`;
        continue;
      }
      let parsed = [];
      try {
        parsed = isHtml(urls[i]) ? parseHtmlItems(r.text) : parseRssItems(r.text);
      } catch (e) {
        if (!firstError) firstError = "parse error: " + String((e && e.message) || e).slice(0, 80);
        continue;
      }
      if (parsed.length > 0) {
        items = parsed;
        usedUrl = urls[i];
        usedMode = isHtml(urls[i]) ? "html-fallback" : "rss";
        break;
      }
      // Fetched fine but empty: keep trying the next URL (RSS list, then HTML).
      if (!firstError) firstError = "empty feed";
    }
  }
  return {
    name: src.name,
    label: src.label,
    ok: items.length > 0,
    mode: usedMode,
    usedUrl,
    items,
    checked_at: checkedAt,
    latency_ms: results.reduce((a, r) => a + (r.ms || 0), 0),
    error: items.length > 0 ? null : firstError,
  };
}

// module-level: per-instance duplicate-delivery guard (§4.3)
let lastRunAt = 0;

module.exports = async (req, res) => {
  const requestStarted = Date.now();

  if (req.method !== "GET") {
    return err(res, SERVICE, VERSION, 400, "BAD_INPUT", "Only GET is supported on /api/cron/radar.", {
      fields: ["method"],
    });
  }

  // Fail closed: no/wrong CRON_SECRET -> 401, never run the refresh.
  if (!assertCron(req)) {
    console.log("[cron] radar reject unauthorized attempt");
    return err(
      res, SERVICE, VERSION, 401, "UNAUTHORIZED",
      "Missing or wrong CRON_SECRET. This endpoint only runs on the Vercel cron schedule.",
      null
    );
  }

  const now = Date.now();
  if (now - lastRunAt < COOLDOWN_MS) {
    return ok(res, SERVICE, VERSION, { duplicate: true }, { noStore: true, source: "live" });
  }
  lastRunAt = now;

  const requestId = "req_" + crypto.randomBytes(3).toString("hex");
  console.log(`[cron] radar start request_id=${requestId}`);

  try {
    // 1. Poll upstreams in parallel (bounded, partial success is normal).
    const polls = await Promise.all(SOURCES.map(pollSource));
    const upstreamMeta = polls.map((p) => {
      const e = { source: p.name, ok: p.ok, checked_at: p.checked_at };
      if (p.ok) e.latency_ms = p.latency_ms;
      else e.error = p.error || "no items";
      return e;
    });
    for (const p of polls) {
      if (!p.ok) console.log(`[upstream] ${p.name} fail error=${(p.error || "no items").slice(0, 120)}`);
    }

    let checked = 0;
    const gathered = [];
    for (const p of polls) {
      for (const [title, url] of p.items) {
        checked++;
        if (!title || !url) continue;
        if (matches(title)) gathered.push({ title: title.trim(), url: url.trim(), source: p.label });
      }
    }

    // 2. Load current store: GitHub is the source of truth when the token is
    //    configured; otherwise read-only from the deployment bundle.
    const tokenConfigured = !!process.env.GITHUB_REPO_TOKEN;
    const repoConfigured = !!process.env.GITHUB_REPO;
    let candidates = null;
    let seen = null;
    let githubReadOk = false;
    let storeOrigin = "bundle";
    if (tokenConfigured && repoConfigured) {
      try {
        const [c, s] = await Promise.all([
          github.readJson("api/v1/radar-candidates.json"),
          github.readJson("api/v1/radar-seen.json"),
        ]);
        candidates = c.data;
        seen = s.data;
        githubReadOk = true;
        storeOrigin = "github";
        upstreamMeta.push({ source: "github-contents", ok: true, checked_at: nowIso(), latency_ms: 0 });
      } catch (e) {
        const msg = String((e && e.message) || e).slice(0, 160);
        console.log(`[cron] radar fail stage=read error=${msg} request_id=${requestId}`);
        upstreamMeta.push({ source: "github-contents", ok: false, checked_at: nowIso(), error: msg });
        return err(res, SERVICE, VERSION, 500, "REFRESH_FAILED",
          "Could not read the committed reveal store from GitHub; nothing was changed.", {
            stage: "read", error: msg,
          });
      }
    } else {
      candidates = readBundleJson("radar-candidates.json");
      seen = readBundleJson("radar-seen.json");
      upstreamMeta.push({
        source: "github-contents", ok: false, checked_at: nowIso(),
        error: "GITHUB_REPO_TOKEN not configured — read-only mode",
      });
    }
    if (!Array.isArray(candidates)) candidates = [];
    if (!Array.isArray(seen)) seen = [];

    // 3. Merge: dedupe against seen URLs (the store may hold legacy {url}
    //    objects or plain strings — handle both).
    const seenUrls = new Set();
    for (const s of seen) seenUrls.add(typeof s === "string" ? s : s && s.url);
    seenUrls.delete(undefined);
    seenUrls.delete(null);
    seenUrls.delete("");

    const detectedAt = nowIso();
    const fresh = [];
    for (const g of gathered) {
      if (seenUrls.has(g.url)) continue;
      seenUrls.add(g.url);
      fresh.push({ title: g.title, url: g.url, source: g.source, detected_at: detectedAt });
    }

    // 4. Append + prune to the 90-day window (§5.1). Undated entries are kept:
    //    never destroy data you cannot date.
    const cutoff = Date.now() - RETENTION_MS;
    const before = candidates.length;
    const merged = candidates.concat(fresh);
    const pruned = merged.filter((c) => {
      const t = Date.parse(c && c.detected_at);
      return Number.isNaN(t) || t >= cutoff;
    });
    const prunedCount = merged.length - pruned.length;
    const seenSorted = [...seenUrls].sort();
    const changed = fresh.length > 0 || prunedCount > 0;

    // 5. Commit on change (or report read-only when the PAT is pending).
    let committed = false;
    let commitSha = null;
    let commitReason = null;
    if (changed && tokenConfigured && repoConfigured && githubReadOk) {
      const [w1, w2] = await Promise.all([
        github.writeJsonIfChanged(
          "api/v1/radar-candidates.json", pruned,
          `radar: ${fresh.length} new reveal candidate(s) (${SERVICE} cron)`
        ),
        github.writeJsonIfChanged(
          "api/v1/radar-seen.json", seenSorted,
          `radar: seen-store update (${SERVICE} cron)`
        ),
      ]);
      committed = !!(w1.committed || w2.committed);
      commitSha = w1.sha || w2.sha || null;
      commitReason = w1.reason || w2.reason || null;
      if (commitReason === "conflict") {
        console.log(`[cron] radar done changed=true committed=false reason=conflict request_id=${requestId}`);
      }
    } else if (changed) {
      commitReason = "no-token";
    }

    const allCandidates = pruned;
    const normalized = normalizeReveals(allCandidates);
    const freshUrls = new Set(fresh.map((f) => f.url));
    const newReveals = normalized.filter((r) =>
      r.sources.some((s) => freshUrls.has(s.url))
    );

    const sourcesOk = polls.filter((p) => p.ok).length;
    const anySourceFailed = sourcesOk < polls.length;
    const readOnly = !tokenConfigured || !repoConfigured;
    const degraded = anySourceFailed || readOnly;

    const data = {
      checked,
      changed,
      committed,
      commit_sha: commitSha,
      commit_reason: commitReason,
      read_only: readOnly,
      store: storeOrigin,
      pruned: prunedCount,
      candidates_total: allCandidates.length,
      seen_total: seenSorted.length,
      sources_ok: `${sourcesOk}/${polls.length}`,
      new_reveals: newReveals,
    };

    let note = null;
    if (readOnly) {
      note =
        "GITHUB_REPO_TOKEN is not configured yet (pending user decision): polled press " +
        "and computed what would change, but persisted nothing. Static files update " +
        "via the wave engine until the token lands.";
    } else if (anySourceFailed) {
      const failed = polls.filter((p) => !p.ok).map((p) => p.name).join(", ");
      note = `Some press sources failed this run (${failed}); served and stored what the working sources returned.`;
    }

    console.log(
      `[cron] radar done changed=${changed} committed=${commitSha || false} ` +
      `sources_ok=${sourcesOk}/${polls.length} new=${fresh.length} pruned=${prunedCount} ` +
      `read_only=${readOnly} request_id=${requestId}`
    );

    return ok(res, SERVICE, VERSION, data, {
      noStore: true,
      source: "live",
      degraded,
      stale_since: degraded ? nowIso() : null,
      upstream: upstreamMeta,
      note,
    });
  } catch (e) {
    const msg = String((e && e.message) || e).slice(0, 200);
    console.log(`[cron] radar fail stage=run error=${msg} request_id=${requestId}`);
    return err(res, SERVICE, VERSION, 500, "REFRESH_FAILED",
      "The radar refresh threw before completing; nothing was committed.", {
        stage: "run", error: msg,
      });
  }
};

// Test hooks: parser/matcher unit surface for the local fixture test.
// (Not part of the HTTP contract; the wave-A suite exercises them directly.)
module.exports._parseRssItems = parseRssItems;
module.exports._parseHtmlItems = parseHtmlItems;
module.exports._matches = matches;
module.exports._unescapeEntities = unescapeEntities;
