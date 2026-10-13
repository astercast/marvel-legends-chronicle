/* api/reveals.js — GET /api/reveals (marvel-radar).
 * Latest-reveals API feeding the pre-order tracker and release radar (§7.3).
 *
 * Reads the committed data/v1/radar-candidates.json (the file the daily cron
 * job maintains) from the deployment bundle and normalizes each raw press
 * detection into the §7.3 reveal shape. No upstream is touched per request —
 * the cron owns polling; this endpoint owns honest serving.
 *
 * Honesty rules (spec §6 / §7.3):
 * - wave/figures are null/[] for raw detections: never invented.
 * - price_tbd is ALWAYS true here: the candidates feed carries no price data,
 *   and no stated MSRP is ever published as fact (the NYCC-2026 lesson).
 * - status is 'rumor' unless the same underlying reveal is reported by 2+
 *   distinct sources (title-grouped), in which case 'confirmed'. A rumor is
 *   never upgraded on a single source.
 *
 * Query: ?since= (ISO date, default 30d ago) ?limit= (default 50, clamp 1-200)
 * Fallback: data/v1/radar-candidates.json
 */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { ok, err, nowIso } = require("../lib/envelope");
const { checkLimit, getClientIp } = require("../lib/ratelimit");

const SERVICE = "marvel-radar";
const VERSION = "1.0.0";

/* NOTE (spec §1.11): lib/ holds exactly the five shared helpers, so the
 * reveal normalizer below is intentionally duplicated in api/cron/radar.js
 * (which needs the same shape for its new_reveals[] report). The two copies
 * must stay in sync; both are pure functions of the raw candidate list. */

function normalizeTitleKey(title) {
  let t = String(title || "").toLowerCase();
  // Strip a trailing " - <outlet>" source suffix when it looks like one.
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
  // Group by normalized title to find second-source confirmations.
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
      wave: null, // never inferred from a headline — null until researched
      figures: [], // same: the raw feed does not carry figure lists
      announced_at: Number.isNaN(t) ? null : new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z"),
      sources,
      status: distinctSources.size >= 2 ? "confirmed" : "rumor",
      price_tbd: true, // never-assume-prices: the feed carries no price data
    });
  }
  reveals.sort((a, b) => String(b.announced_at || "").localeCompare(String(a.announced_at || "")));
  return reveals;
}

function badInput(res, fields, message) {
  return err(res, SERVICE, VERSION, 400, "BAD_INPUT", message, { fields });
}

/* Memoized bundle read (rotation 12 audit): the candidates file is
 * immutable within a deployment, so re-reading + re-parsing + regrouping
 * it on every request is wasted work on a free-tier function budget.
 * The cache key is the file's mtime+size — a changed file (new deploy,
 * local test fixture) is picked up on the next request, never served
 * stale. Errors propagate to the handler's existing 502 path. */
let bundleCache = null; // { mtimeMs, size, rawList, normalized }
function readCandidates() {
  const p = path.join(__dirname, "..", "data", "v1", "radar-candidates.json");
  const st = fs.statSync(p);
  if (bundleCache && bundleCache.mtimeMs === st.mtimeMs && bundleCache.size === st.size) {
    return bundleCache;
  }
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  const rawList = Array.isArray(raw) ? raw : [];
  bundleCache = { mtimeMs: st.mtimeMs, size: st.size, rawList, normalized: normalizeReveals(rawList) };
  return bundleCache;
}

module.exports = (req, res) => {
  if (req.method !== "GET") {
    return badInput(res, ["method"], "Only GET is supported on /api/reveals.");
  }

  const ip = getClientIp(req);
  const limitCheck = checkLimit(ip, "public");
  if (!limitCheck.allowed) {
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 12);
    console.log(`[ratelimit] ip=${ipHash} bucket=public path=/api/reveals`);
    res.setHeader("Retry-After", String(limitCheck.retryAfter));
    return err(res, SERVICE, VERSION, 429, "RATE_LIMITED", "Rate limit exceeded. Try again shortly.", {
      retry_after_s: limitCheck.retryAfter,
    });
  }

  const q = (req.query && typeof req.query === "object" ? req.query : {});

  // ?since= : ISO date, default 30 days ago. Unparseable -> 400 (§8.5).
  let sinceMs;
  let sinceIso;
  if (q.since === undefined || q.since === "") {
    sinceMs = Date.now() - 30 * 24 * 3600 * 1000;
    sinceIso = new Date(sinceMs).toISOString().replace(/\.\d{3}Z$/, "Z");
  } else {
    sinceMs = Date.parse(String(q.since));
    if (Number.isNaN(sinceMs)) {
      return badInput(res, ["since"], "?since= must be a parseable ISO-8601 date, e.g. 2026-09-01.");
    }
    sinceIso = new Date(sinceMs).toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  // ?limit= : coerce with bounds — default 50, clamp 1..200 (§8.5).
  let limit = 50;
  if (q.limit !== undefined && q.limit !== "") {
    const n = Number(String(q.limit).trim());
    if (!Number.isFinite(n)) {
      return badInput(res, ["limit"], "?limit= must be a number between 1 and 200.");
    }
    limit = Math.min(200, Math.max(1, Math.floor(n)));
  }

  let bundle;
  try {
    bundle = readCandidates();
  } catch (e) {
    console.log(`[upstream] radar-candidates.json fail error=${String((e && e.message) || e).slice(0, 120)}`);
    return err(
      res, SERVICE, VERSION, 502, "UPSTREAM_UNAVAILABLE",
      "The committed reveal feed could not be read; no usable reveal data exists.",
      { sources: ["radar-candidates.json"] }
    );
  }

  const rawList = bundle.rawList;
  const all = bundle.normalized;
  const filtered = all.filter(
    (r) => r.announced_at && Date.parse(r.announced_at) >= sinceMs
  );
  const page = filtered.slice(0, limit);

  return ok(
    res, SERVICE, VERSION,
    {
      since: sinceIso,
      limit,
      count: page.length,
      total_matching: filtered.length,
      total_candidates: rawList.length, // raw file rows; reveals[] is title-grouped, so <= this
      generated_note:
        "Raw press detections from the collector-press poll, grouped by story. " +
        "status=rumor until 2+ distinct sources report the same reveal; wave/figures " +
        "are null until researched; price_tbd is always true — no price is ever assumed.",
      reveals: page,
    },
    { source: "live", degraded: false, upstream: [], note: null }
  );
};

// Exported for the local test harness and for parity checks with cron/radar.js.
module.exports._normalizeReveals = normalizeReveals;
module.exports._normalizeTitleKey = normalizeTitleKey;
