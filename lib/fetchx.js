/* lib/fetchx.js — shared bounded-fetch helper (marvel-legends-chronicle).
 * Canonical copy per ARCHITECTURE.md §1.11. Copy verbatim between repos;
 * do not fork behavior.
 *
 * fetchTimeout(url, { timeoutMs, headers, ua }) -> Promise<{
 *   ok, status, text, ms, error
 * }>
 * Default 4000ms via AbortController. All upstream calls go through this.
 * The User-Agent always identifies the service (spec §8.7) — never disguised
 * as a browser, even when a source prefers browser UAs (such sources are
 * reported ok:false honestly instead).
 */
"use strict";

const DEFAULT_TIMEOUT_MS = 4000;
const DEFAULT_UA = "marvel-radar/1.0.0 (+https://marvel-legends-chronicle.vercel.app)";

async function fetchTimeout(url, opts) {
  opts = opts || {};
  const timeoutMs = opts.timeoutMs != null ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
  const ua = opts.ua || DEFAULT_UA;
  const headers = Object.assign(
    { "User-Agent": ua, Accept: "*/*" },
    opts.headers || {}
  );

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal, redirect: "follow" });
    const text = await r.text();
    const ms = Date.now() - start;
    clearTimeout(timer);
    if (r.status >= 200 && r.status < 300) {
      return { ok: true, status: r.status, text, ms, error: null };
    }
    return { ok: false, status: r.status, text: "", ms, error: `http ${r.status}` };
  } catch (e) {
    const ms = Date.now() - start;
    clearTimeout(timer);
    const reason =
      e && e.name === "AbortError" ? `timeout after ${timeoutMs}ms` : String((e && e.message) || e);
    return { ok: false, status: 0, text: "", ms, error: reason };
  }
}

module.exports = { fetchTimeout, DEFAULT_TIMEOUT_MS, DEFAULT_UA };
