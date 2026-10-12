/* lib/ratelimit.js — shared per-instance token bucket (marvel-legends-chronicle).
 * Canonical copy per ARCHITECTURE.md §1.11. Copy verbatim between repos;
 * do not fork behavior.
 *
 * Best-effort: state is in-memory per instance and resets on cold start
 * (documented, not hidden — spec §1.7).
 *
 * Buckets: public (60 req/min), compute (20 req/min).
 * Key on x-forwarded-for (first entry), not the socket IP.
 *
 * checkLimit(ip, bucket) -> { allowed: true } | { allowed: false, retryAfter }
 */
"use strict";

const BUCKETS = {
  public: { limit: 60, windowMs: 60 * 1000 },
  compute: { limit: 20, windowMs: 60 * 1000 },
};

// key -> { count, resetAt }
const store = new Map();

function getClientIp(req) {
  const fwd = req.headers && req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0].trim();
  }
  if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
  return "unknown";
}

function checkLimit(ip, bucket) {
  const cfg = BUCKETS[bucket] || BUCKETS.public;
  const now = Date.now();
  const key = bucket + ":" + ip;
  let entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + cfg.windowMs };
    store.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > cfg.limit) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { allowed: false, retryAfter };
  }
  // Opportunistic cleanup so the map cannot grow unbounded on a warm instance.
  if (store.size > 5000) {
    for (const [k, v] of store) {
      if (now >= v.resetAt) store.delete(k);
      if (store.size <= 4000) break;
    }
  }
  return { allowed: true, retryAfter: 0 };
}

module.exports = { checkLimit, getClientIp, BUCKETS };
