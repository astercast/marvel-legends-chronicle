/* radar-live.js, Release Radar dynamic wiring (Vercel Wave B).
 *
 * Renders the "Latest press scan" section on radar.html through the
 * ARCHITECTURE.md §3 fallback contract:
 *   1. Try the live function  /api/reveals?limit=N   (7s timeout)
 *   2. On failure, fall back to data/v1/radar-candidates.json (static)
 *   3. On total failure, hide the section, the hand-curated radar cards
 *      below it are the pre-rendered static page and always remain.
 *
 * The badge next to the section heading is the honesty mechanism:
 * live (green) / waking / cached · updated HH:MM (amber) / none (hidden).
 * Honesty rules inherited from the API: statuses are rumor until two
 * distinct sources confirm; price is always TBA here, no MSRP is ever
 * assumed from a headline.
 */
(function () {
  "use strict";

  var MAX_ITEMS = 8;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* Only https: URLs become links, feed data is third-party; a
   * javascript: or data: URL must never reach an href. */
  function safeUrl(u) {
    if (typeof u !== "string") return null;
    var t = u.trim();
    if (!/^https:\/\/[^\/\s]+/i.test(t)) return null;
    return t;
  }

  function fmtDate(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }

  var ACRONYMS = { MARVEL:1, HASBRO:1, SDCC:1, NYCC:1, MCU:1, TAS:1, BAF:1, X:1, "X-MEN":1, "'97":1, II:1, III:1 };
  /* Presentation transform only: raw syndicated titles arrive in
     ALL-CAPS; set them in readable case, same words, same data.
     Dash normalization is display-layer only (Release 189 ruling):
     these titles are genuine quotations of manufacturer, retailer,
     and press copy, so the stored record in
     data/v1/radar-candidates.json is never rewritten; a spaced em
     or en dash used as punctuation renders as a comma here, the
     same remedy as the readable-case transform above. Unspaced
     ranges and compounds in a title stay exactly as published. */
  function readableCase(title) {
    var s = String(title == null ? "" : title);
    s = s.replace(/\s+[—–]\s+/g, ", ").replace(/^\s*[—–]\s+/, "").replace(/\s+[—–]\s*$/, "");
    return s.split(" - ").map(function (seg) {
      var letters = seg.replace(/[^A-Za-z]/g, "");
      if (!letters || letters.replace(/[a-z]/g, "").length / letters.length < 0.65) return seg;
      return seg.toLowerCase().replace(/(^|[^a-z0-9'])([a-z])/g, function (m, p1, p2) { return p1 + p2.toUpperCase(); })
        .replace(/\b(Marvel|Hasbro|Sdcc|Nycc|Mcu|Tas|Baf)\b/g, function (m) { return m.toUpperCase(); });
    }).join(" - ");
  }

  var STATUS_LABEL = {
    rumor: "Rumor",
    confirmed: "Confirmed",
    "preorder-live": "Pre-order",
    released: "Available",
  };

  /* The sale room (MARVEL-LIGHT 3.6): each entry is a LOT, numbered
     in Catalogue Blue at its head; the status word stands where a
     price realised would, and a live pre-order's word stands in
     Plate Red, the page's rationed red. */
  function revealCard(r, i) {
    var status = STATUS_LABEL[r.status] || "Rumor";
    var live = r.status === "preorder-live";
    var statusClass = "status-" + String(r.status || "rumor").replace(/[^a-z-]/g, "");
    var announced = fmtDate(r.announced_at);
    var srcLinks = (Array.isArray(r.sources) ? r.sources : [])
      .map(function (s) {
        var u = safeUrl(s && s.url);
        if (!u) return "";
        return '<a class="src" href="' + esc(u) + '" target="_blank" rel="noopener">' +
          esc(s.name || "source") + "</a>";
      })
      .filter(Boolean).join("<br>");
    return '<article class="card radar-card">' +
      '<p class="lot-no">LOT ' + (i + 1) + "</p>" +
      "<h3>" + esc(readableCase(r.title) || "Untitled reveal") + "</h3>" +
      '<div class="radar-meta">' +
        '<span class="status ' + esc(statusClass) + (live ? " lot-status-live" : "") + '">' + esc(status) + "</span>" +
        (announced ? '<span class="venue">Spotted ' + esc(announced) + "</span>" : "") +
        '<span class="price">Price TBA</span>' +
      "</div>" +
      '<p class="chart-sub" style="margin-bottom:var(--space-2)">' +
        "Raw press detection, wave, figures, and price arrive with research, never from a headline." +
      "</p>" +
      srcLinks +
    "</article>";
  }

  function candidateCard(c, i) {
    var detected = fmtDate(c.detected_at);
    var u = safeUrl(c.url);
    var link = u
      ? '<a class="src" href="' + esc(u) + '" target="_blank" rel="noopener">Read at ' +
        esc(c.source || "source") + " →</a>"
      : '<span class="venue">' + esc(c.source || "source") + "</span>";
    return '<article class="card radar-card">' +
      '<p class="lot-no">LOT ' + (i + 1) + "</p>" +
      "<h3>" + esc(readableCase(c.title) || "Untitled detection") + "</h3>" +
      '<div class="radar-meta">' +
        '<span class="status status-rumor">Unverified</span>' +
        (detected ? '<span class="venue">Detected ' + esc(detected) + "</span>" : "") +
      "</div>" +
      link +
    "</article>";
  }

  /* Static JSON carries no top-level generated_at; the honest freshness of
   * the fallback is the newest detected_at in the file. Refines the badge
   * the api-client already set to "cached". */
  function refineCachedBadge(badgeEl, items) {
    if (!badgeEl) return;
    var newest = null;
    for (var i = 0; i < items.length; i++) {
      var t = Date.parse(items[i] && items[i].detected_at);
      if (!isNaN(t) && (newest === null || t > newest)) newest = t;
    }
    if (newest === null) return; // keep the client's honest "unknown time"
    var hhmm = new Date(newest).toISOString().slice(11, 16) + " UTC";
    badgeEl.textContent = "cached · updated " + hhmm;
    badgeEl.title = "Server unreachable, showing last published data · " + hhmm;
  }

  function newestFirst(list, key) {
    return list.slice().sort(function (a, b) {
      return String(b[key] || "").localeCompare(String(a[key] || ""));
    });
  }

  function init() {
    var section = document.getElementById("radar-scan");
    var badgeEl = document.getElementById("radar-scan-badge");
    if (!section || !window.ApiClient) return;

    window.ApiClient.fetchWithFallback("/api/reveals?limit=" + MAX_ITEMS,
      "/data/v1/radar-candidates.json", { badgeEl: badgeEl })
      .then(function (result) {
        if (result.source === "live" && result.data && Array.isArray(result.data.reveals)) {
          section.innerHTML = result.data.reveals.map(function (r, i) { return revealCard(r, i); }).join("");
          return;
        }
        if (result.source === "static" && Array.isArray(result.data)) {
          var items = newestFirst(result.data, "detected_at").slice(0, MAX_ITEMS);
          section.innerHTML = items.map(function (c, i) { return candidateCard(c, i); }).join("");
          refineCachedBadge(badgeEl, items);
          return;
        }
        // "none": hide the dynamic section entirely; the curated radar
        // cards below are the pre-rendered page and stay put (§3.3).
        var wrap = document.getElementById("radar-scan-wrap");
        if (wrap) wrap.hidden = true;
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
