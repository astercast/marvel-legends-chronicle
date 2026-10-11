/* Stats dashboard — figures-per-year chart from api/v1/stats.json. */
(function () {
  "use strict";
  var els = {
    chart: document.getElementById("stats-chart"),
    table: document.getElementById("stats-table-body"),
    kpis: document.getElementById("stats-kpis"),
    note: document.getElementById("stats-note")
  };
  if (!els.chart) return;

  function barColor(year) {
    return year <= 2006 ? "#ffb37f" : "#e62429"; /* Toy Biz era vs Hasbro era */
  }

  fetch("api/v1/stats.json")
    .then(function (r) { if (!r.ok) throw new Error("stats fetch failed"); return r.json(); })
    .then(function (s) {
      var years = Object.keys(s.byYear).map(Number).sort(function (a, b) { return a - b; });
      var max = Math.max.apply(null, years.map(function (y) { return s.byYear[y]; }));
      var W = 960, H = 320, padL = 44, padB = 34, padT = 12;
      var cw = W - padL - 8, ch = H - padT - padB;
      var slot = cw / years.length;
      var bw = Math.max(4, slot * 0.62);

      var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Bar chart of Marvel Legends figures released per year, 2002 to 2026">';
      /* gridlines */
      [0.25, 0.5, 0.75, 1].forEach(function (f) {
        var y = padT + ch * (1 - f);
        var v = Math.round(max * f);
        svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (padL + cw) + '" y2="' + y + '" class="grid"/>';
        svg += '<text x="' + (padL - 8) + '" y="' + (y + 4) + '" class="axis" text-anchor="end">' + v + "</text>";
      });
      years.forEach(function (year, i) {
        var v = s.byYear[year];
        var h = Math.max(2, (v / max) * ch);
        var x = padL + i * slot + (slot - bw) / 2;
        var y = padT + ch - h;
        svg += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) +
          '" fill="' + barColor(year) + '" rx="2"><title>' + year + ": " + v + " figures</title></rect>";
        if (i % 2 === 0) {
          svg += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 10) + '" class="axis" text-anchor="middle">' + year + "</text>";
        }
      });
      svg += "</svg>";
      els.chart.innerHTML = svg;

      /* KPI cards */
      var peak = years.reduce(function (a, b) { return s.byYear[a] >= s.byYear[b] ? a : b; });
      var kpis = [
        [s.figures.toLocaleString("en-US"), "Figures archived"],
        [s.waves, "Waves"],
        [s.bafWaves, "BAF waves"],
        [s.exclusiveFigures.toLocaleString("en-US"), "Exclusives"],
        [s.variantFigures, "Variants"],
        [peak + " (" + s.byYear[peak] + ")", "Peak year"]
      ];
      els.kpis.innerHTML = kpis.map(function (k) {
        return '<div class="stat"><div class="stat-value">' + k[0] + '</div><div class="stat-label">' + k[1] + "</div></div>";
      }).join("");

      /* Accessible data table */
      els.table.innerHTML = years.map(function (y) {
        return "<tr><td>" + y + "</td><td>" + s.byYear[y] + "</td><td>" + (y <= 2006 ? "Toy Biz" : "Hasbro") + "</td></tr>";
      }).join("");
      els.note.textContent = "Era coloring is by year (Toy Biz 2002–2006, Hasbro 2007–2026). Data: api/v1/stats.json, observed " + s.observed + ".";
    })
    .catch(function () {
      els.chart.innerHTML = '<div class="empty-state"><p>Could not load statistics. Check your connection and reload.</p></div>';
      if (els.kpis) els.kpis.innerHTML = '<div class="empty-state"><p>Statistics unavailable.</p></div>';
      if (els.table) els.table.innerHTML = '<tr><td colspan="3">Statistics unavailable.</td></tr>';
      if (els.note) els.note.textContent = "Statistics could not be loaded.";
    });
})();
