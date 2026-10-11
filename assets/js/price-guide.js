/* Price guide page — renders the transparent price methodology from data/encyclopedia.json. */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function confBadge(conf) {
    var labels = { "single-source": "Single source", anecdote: "Anecdote", unverified: "Unverified", analysis: "Analysis" };
    if (!labels[conf]) return "";
    return ' <span class="badge-conf ' + esc(conf) + '">' + labels[conf] + "</span>";
  }

  function setList(id, items) {
    var el = document.getElementById(id);
    el.innerHTML = "";
    items.forEach(function (t) {
      var li = document.createElement("li");
      li.textContent = t;
      el.appendChild(li);
    });
  }

  async function init() {
    try {
      var res = await fetch("data/encyclopedia.json");
      if (!res.ok) throw new Error("encyclopedia.json: " + res.status);
      var data = await res.json();
      var pm = data.priceMethod;
      if (!pm) throw new Error("priceMethod missing");

      document.getElementById("pg-principle").textContent = pm.principle;
      setList("pg-steps", pm.steps);
      setList("pg-rules", pm.rules);
      setList("pg-gaps", pm.honestGaps);

      var aggs = document.getElementById("pg-aggs");
      aggs.innerHTML = "";
      pm.aggregators.forEach(function (a) {
        var card = document.createElement("article");
        card.className = "card agg-card";
        var link = a.url ? ' <a href="' + esc(a.url) + '" target="_blank" rel="noopener noreferrer">↗</a>' : "";
        card.innerHTML = "<h3>" + esc(a.name) + confBadge(a.confidence) + link + "</h3><p>" + esc(a.note) + "</p>";
        aggs.appendChild(card);
      });

      var hist = document.getElementById("pg-history");
      hist.innerHTML = "";
      pm.priceHistory.forEach(function (h) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" + esc(h.figure) + (h.note ? '<br><span style="color:var(--muted);font-size:0.78rem;">' + esc(h.note) + "</span>" : "") + "</td>" +
          '<td class="obs">' + esc(h.observation) + "</td>" +
          "<td>" + esc(h.source) + "</td>" +
          "<td>" + confBadge(h.confidence) + "</td>";
        hist.appendChild(tr);
      });

      document.getElementById("pg-reissue-mech").textContent = pm.reissueEffect.mechanism;
      var cases = document.getElementById("pg-reissue-cases");
      cases.innerHTML = "";
      pm.reissueEffect.cases.forEach(function (c) {
        var li = document.createElement("li");
        li.innerHTML = "<strong>" + esc(c.case) + ".</strong> " + esc(c.detail) + confBadge(c.confidence);
        cases.appendChild(li);
      });
    } catch (err) {
      console.error(err);
      document.getElementById("pg-main").innerHTML =
        '<div class="empty-state"><p>Could not load the price methodology data.</p></div>';
    }
  }

  init();
})();
