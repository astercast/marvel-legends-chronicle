/* api/health.js — GET /api/health (marvel-radar).
 * §1.4 health endpoint. No auth. Edge-cacheable (s-maxage=60).
 * Never returns 5xx: status flips to "degraded" instead.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { ok, err, nowIso } = require("../lib/envelope");
const { checkLimit, getClientIp } = require("../lib/ratelimit");

const SERVICE = "marvel-radar";
const VERSION = "1.0.0";
const STARTED_AT = nowIso();

// Must match the §7.3 roster exactly (wave A test asserts this).
const FUNCTIONS = ["reveals", "preorders", "cron/radar"];

const SLA_S = 86400; // 24h — matches the daily radar cadence (§7.3)

function readBundleFile(name) {
  try {
    const p = path.join(__dirname, "v1", name);
    return { ok: true, text: fs.readFileSync(p, "utf8") };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

// generated_at for a static file: the freshest data timestamp it carries.
function freshnessOf(name, parsed) {
  const now = Date.now();
  let generatedAt = null;
  try {
    if (name === "radar-candidates.json" && Array.isArray(parsed)) {
      for (const c of parsed) {
        if (c && c.detected_at) {
          const t = Date.parse(c.detected_at);
          if (!Number.isNaN(t) && (!generatedAt || t > Date.parse(generatedAt))) {
            generatedAt = new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
          }
        }
      }
    } else if (parsed && typeof parsed.observed === "string") {
      // "2026-10-11" -> start of that UTC day; honest lower bound.
      const t = Date.parse(parsed.observed + "T00:00:00Z");
      if (!Number.isNaN(t)) generatedAt = new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
    }
  } catch (e) {
    generatedAt = null;
  }
  if (!generatedAt) {
    return { generated_at: null, age_s: null, sla_s: SLA_S, within_sla: false };
  }
  const ageS = Math.max(0, Math.floor((now - Date.parse(generatedAt)) / 1000));
  return { generated_at: generatedAt, age_s: ageS, sla_s: SLA_S, within_sla: ageS <= SLA_S };
}

module.exports = (req, res) => {
  if (req.method !== "GET") {
    return err(res, SERVICE, VERSION, 400, "BAD_INPUT", "Only GET is supported on /api/health.", {
      fields: ["method"],
    });
  }

  const ip = getClientIp(req);
  const limit = checkLimit(ip, "public");
  if (!limit.allowed) {
    // Per §1.7: log a hash of the IP, never the raw IP. crypto is cheap here.
    const crypto = require("crypto");
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 12);
    console.log(`[ratelimit] ip=${ipHash} bucket=public path=/api/health`);
    res.setHeader("Retry-After", String(limit.retryAfter));
    return err(res, SERVICE, VERSION, 429, "RATE_LIMITED", "Rate limit exceeded. Try again shortly.", {
      retry_after_s: limit.retryAfter,
    });
  }

  const dataFreshness = {};
  let staticOk = true;
  for (const name of ["radar-candidates.json", "preorders.json"]) {
    const f = readBundleFile(name);
    if (!f.ok) {
      staticOk = false;
      dataFreshness[name] = { generated_at: null, age_s: null, sla_s: SLA_S, within_sla: false };
      continue;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(f.text);
    } catch (e) {
      parsed = null;
    }
    dataFreshness[name] = freshnessOf(name, parsed);
  }

  const checks = {
    static_fallback_present: staticOk,
    cron_secret_configured: !!process.env.CRON_SECRET,
    github_token_configured: !!process.env.GITHUB_REPO_TOKEN,
  };
  const freshOk = Object.values(dataFreshness).every((d) => d.within_sla);
  const status = checks.static_fallback_present && checks.cron_secret_configured && freshOk ? "ok" : "degraded";

  const data = {
    status,
    service: SERVICE,
    version: VERSION,
    started_at: STARTED_AT,
    uptime_s: Math.floor((Date.now() - Date.parse(STARTED_AT)) / 1000),
    node: process.version,
    functions: FUNCTIONS,
    data_freshness: dataFreshness,
    checks,
  };

  // §1.4: edge-cacheable with s-maxage=60 (fresher than the 600s default).
  return ok(res, SERVICE, VERSION, data, {
    source: "live",
    degraded: status !== "ok",
    stale_since: status !== "ok" ? STARTED_AT : null,
    note:
      status !== "ok"
        ? "One or more health checks failed; see data.checks and data.data_freshness."
        : null,
    cacheMaxAge: 60,
  });
};
