/* api/preorders.js — GET /api/preorders (marvel-radar).
 * Upcoming pre-order dates feeding the pre-order tracker (§7.3).
 *
 * Reads the committed data/v1/preorders.json (the wave-research pre-order
 * tracker payload) from the deployment bundle and projects each item into
 * the §7.3 shape: figure/wave, goes_live_at, retailers, price_or_tbd.
 *
 * Honesty rules:
 * - price is the researched number or null; price_tbd=true whenever it is
 *   null. Prices are never assumed or interpolated.
 * - goes_live_at comes from the item's preorderDate (date only in the source
 *   file, so midnight UTC — never an invented 1 PM ET even though many 2026
 *   windows opened at 1 PM ET; the file does not carry times).
 * - status is explicit per item (preorder | revealed | available).
 *
 * No query inputs. Fallback: data/v1/preorders.json
 */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { ok, err } = require("../lib/envelope");
const { checkLimit, getClientIp } = require("../lib/ratelimit");

const SERVICE = "marvel-radar";
const VERSION = "1.0.0";

const STATUS_ORDER = { preorder: 0, revealed: 1, available: 2 };

function toGoesLiveAt(preorderDate) {
  if (!preorderDate || typeof preorderDate !== "string") return null;
  // Source carries YYYY-MM-DD only. Midnight UTC is the honest boundary —
  // the file does not carry window times, so none are invented.
  const t = Date.parse(preorderDate + "T00:00:00Z");
  return Number.isNaN(t) ? null : new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function projectItem(item) {
  const price = typeof item.price === "number" && Number.isFinite(item.price) ? item.price : null;
  return {
    id: String(item.id || ""),
    name: String(item.name || ""),
    status: String(item.status || "revealed"),
    goes_live_at: toGoesLiveAt(item.preorderDate),
    retailers: Array.isArray(item.retailers) ? item.retailers.map(String) : [],
    price, // number or null — never assumed
    price_tbd: price === null,
    release_window: item.releaseWindow != null ? String(item.releaseWindow) : null,
    venue: item.venue != null ? String(item.venue) : null,
    details: item.details != null ? String(item.details) : null,
    sources: Array.isArray(item.sources)
      ? item.sources.map((s) => ({
          label: s && s.label != null ? String(s.label) : "",
          url: s && s.url != null ? String(s.url) : "",
        }))
      : [],
  };
}

module.exports = (req, res) => {
  if (req.method !== "GET") {
    return err(res, SERVICE, VERSION, 400, "BAD_INPUT", "Only GET is supported on /api/preorders.", {
      fields: ["method"],
    });
  }

  const ip = getClientIp(req);
  const limitCheck = checkLimit(ip, "public");
  if (!limitCheck.allowed) {
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 12);
    console.log(`[ratelimit] ip=${ipHash} bucket=public path=/api/preorders`);
    res.setHeader("Retry-After", String(limitCheck.retryAfter));
    return err(res, SERVICE, VERSION, 429, "RATE_LIMITED", "Rate limit exceeded. Try again shortly.", {
      retry_after_s: limitCheck.retryAfter,
    });
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "v1", "preorders.json"), "utf8"));
  } catch (e) {
    console.log(`[upstream] preorders.json fail error=${String((e && e.message) || e).slice(0, 120)}`);
    return err(
      res, SERVICE, VERSION, 502, "UPSTREAM_UNAVAILABLE",
      "The committed pre-order tracker could not be read; no usable data exists.",
      { sources: ["preorders.json"] }
    );
  }

  const items = Array.isArray(raw.items) ? raw.items : [];
  const projected = items.map(projectItem);
  // Upcoming first: status order, then earliest goes_live_at (nulls last).
  projected.sort((a, b) => {
    const so = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    if (so !== 0) return so;
    if (a.goes_live_at && b.goes_live_at) return a.goes_live_at.localeCompare(b.goes_live_at);
    if (a.goes_live_at) return -1;
    if (b.goes_live_at) return 1;
    return 0;
  });

  const upcomingCount = projected.filter((p) => p.status === "preorder").length;

  return ok(
    res, SERVICE, VERSION,
    {
      observed: typeof raw.observed === "string" ? raw.observed : null,
      source_note: typeof raw.source === "string" ? raw.source : null,
      count: projected.length,
      upcoming_count: upcomingCount,
      preorders: projected,
    },
    { source: "live", degraded: false, upstream: [], note: null }
  );
};
