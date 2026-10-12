/* lib/envelope.js — shared §1.1 envelope helpers (marvel-legends-chronicle).
 * Canonical copy per ARCHITECTURE.md §1.11. Copy verbatim between repos;
 * do not fork behavior.
 *
 * ok(res, service, version, data, opts)   -> 200 + success envelope
 * err(res, service, version, http, code, message, details) -> error envelope
 * newRequestId(), nowIso()
 */
"use strict";

const crypto = require("crypto");

function nowIso() {
  // Second precision in the envelope per §1.3 (ms allowed inside data payloads).
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function newRequestId() {
  return "req_" + crypto.randomBytes(3).toString("hex");
}

function baseMeta(service, version) {
  return {
    service,
    version,
    generated_at: nowIso(),
    request_id: newRequestId(),
  };
}

/* opts: { source, degraded, stale_since, upstream, note,
 *         cacheMaxAge (default 600), swr (default 86400), noStore }
 * Cache headers per §1.6: public GET -> s-maxage=600, SWR=86400.
 * Pass cacheMaxAge: 60 for /api/health (§1.4); noStore: true for cron/admin.
 */
function ok(res, service, version, data, opts) {
  opts = opts || {};
  const meta = baseMeta(service, version);
  meta.source = opts.source || "live";
  meta.degraded = !!opts.degraded;
  meta.stale_since = opts.stale_since || null;
  meta.upstream = Array.isArray(opts.upstream) ? opts.upstream : [];
  meta.note = opts.note || null;

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (opts.noStore) {
    res.setHeader("Cache-Control", "no-store");
  } else {
    const maxAge = opts.cacheMaxAge != null ? opts.cacheMaxAge : 600;
    const swr = opts.swr != null ? opts.swr : 86400;
    res.setHeader(
      "Cache-Control",
      `public, s-maxage=${maxAge}, stale-while-revalidate=${swr}`
    );
  }
  res.end(JSON.stringify({ ok: true, data, meta }));
  return meta.request_id;
}

/* Error envelope per §1.1/§1.2. 4xx and 5xx both use the envelope;
 * the frontend treats any non-ok as "use static fallback". */
function err(res, service, version, httpStatus, code, message, details) {
  const meta = baseMeta(service, version);
  res.statusCode = httpStatus;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const body = { ok: false, data: null, meta, error: { code, message } };
  if (details !== undefined && details !== null) body.error.details = details;
  res.end(JSON.stringify(body));
  return meta.request_id;
}

module.exports = { ok, err, newRequestId, nowIso };
