/* api-client.js — shared fallback contract client.
 *
 * ARCHITECTURE.md §3.2 reference implementation. Copy verbatim per repo;
 * do not fork behavior. Zero dependencies, vanilla JS, ES5-safe.
 *
 * Contract: every dynamic widget calls the live function first with a short
 * timeout; on success the badge reads "live". On timeout / network error /
 * non-ok envelope it falls back to the static data/v1/*.json file and the
 * badge reads "cached · updated HH:MM" (honest timestamp from the data).
 * The badge is the honesty mechanism — never hidden when the data is stale.
 *
 * fetchWithFallback never rejects. Worst case: { data: null, source: "none" }.
 */
(function (global) {
  "use strict";

  var LIVE_TIMEOUT_MS = 7000;

  function fmtTime(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "unknown time";
      return d.toISOString().slice(11, 16) + " UTC";
    } catch (e) { return "unknown time"; }
  }

  // opts: { timeoutMs, staticPath, badgeEl }
  // livePath like "/api/trends"; staticPath like "/data/v1/trends.flat.json"
  // resolves { data, source: "live"|"static", generatedAt, degraded, note }
  // never rejects — worst case returns { data: null, source: "none" }
  function fetchWithFallback(livePath, staticPath, opts) {
    opts = opts || {};
    var timeoutMs = opts.timeoutMs || LIVE_TIMEOUT_MS;
    var badgeEl = opts.badgeEl || null;

    function setBadge(state, generatedAt, note) {
      if (!badgeEl) return;
      badgeEl.dataset.apiState = state; // live | waking | cached | none
      if (state === "live") {
        badgeEl.textContent = "live";
        badgeEl.title = "Fresh from the server · " + fmtTime(generatedAt);
      } else if (state === "cached") {
        badgeEl.textContent = "cached · updated " + fmtTime(generatedAt);
        badgeEl.title = (note || "Server unreachable — showing last published data.") +
          " · " + fmtTime(generatedAt);
      } else if (state === "waking") {
        badgeEl.textContent = "waking server…";
        badgeEl.title = "Waiting on the server; static data shown meanwhile.";
      } else {
        badgeEl.textContent = "";
      }
    }

    function getStatic() {
      return fetch(staticPath, { cache: "force-cache" })
        .then(function (r) { if (!r.ok) throw new Error("static " + r.status); return r.json(); })
        .then(function (j) {
          var gen = j.generated_at || j.checked_at || j.snapshot_at || null;
          setBadge("cached", gen, null);
          return { data: j, source: "static", generatedAt: gen, degraded: true, note: "live unreachable" };
        })
        .catch(function () {
          setBadge("none", null, null);
          return { data: null, source: "none", generatedAt: null, degraded: true, note: "no data available" };
        });
    }

    setBadge("waking", null, null);

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs);

    return fetch(livePath, { signal: ctrl.signal, headers: { "Accept": "application/json" } })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error("live " + r.status);
        return r.json();
      })
      .then(function (env) {
        if (!env || env.ok !== true) throw new Error("live envelope not ok");
        var meta = env.meta || {};
        // honest-degraded: live but stale → still show data, badge says cached
        if (meta.degraded) {
          setBadge("cached", meta.stale_since || meta.generated_at, meta.note);
          return { data: env.data, source: "live", generatedAt: meta.generated_at,
                   degraded: true, note: meta.note };
        }
        setBadge("live", meta.generated_at, null);
        return { data: env.data, source: "live", generatedAt: meta.generated_at,
                 degraded: false, note: null };
      })
      .catch(function () { clearTimeout(timer); return getStatic(); });
  }

  global.ApiClient = { fetchWithFallback: fetchWithFallback, LIVE_TIMEOUT_MS: LIVE_TIMEOUT_MS };
})(window);
