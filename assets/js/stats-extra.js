/* Stats dashboard extensions, BAF waves over time, top 25 characters,
   exclusives share, and wave-size KPIs. All computed live from the figure
   database via data.js; no invented numbers. Vanilla SVG, no libraries. */
import { loadData } from "./data.js";

var RED = "#1E1B16"; /* Hasbro era: Ink */
var GOLD = "#1E1B16"; /* the chart accent: Ink (gold abolished as a surface color) */
var TOYBIZ = "#6E6353"; /* Toy Biz era: Pencil (Hasbro era reads in Ink) */
var MUTED = "#6E6353";
var GRID = "#D9CFB8";

function baseName(n) {
  return String(n).replace(/\s*\(.*?\)\s*/g, "").trim();
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Vertical bar chart. values: [{label, value, color?}] */
function vBarChart(values, ariaLabel, maxTicks) {
  var W = 960, H = 300, padL = 44, padB = 34, padT = 12;
  var cw = W - padL - 8, ch = H - padT - padB;
  var max = Math.max.apply(null, values.map(function (v) { return v.value; }).concat([1]));
  var slot = cw / values.length;
  var bw = Math.max(4, slot * 0.62);
  var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(ariaLabel) + '">';
  [0.25, 0.5, 0.75, 1].forEach(function (f) {
    var y = padT + ch * (1 - f);
    var v = Math.round(max * f);
    svg += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (padL + cw) + '" y2="' + y.toFixed(1) + '" stroke="' + GRID + '"/>';
    svg += '<text x="' + (padL - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="' + MUTED + '">' + v + "</text>";
  });
  values.forEach(function (d, i) {
    var h = Math.max(2, (d.value / max) * ch);
    var x = padL + i * slot + (slot - bw) / 2;
    var y = padT + ch - h;
    var showLabel = values.length <= 30 || i % 2 === 0;
    svg += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) +
      '" fill="' + (d.color || RED) + '" rx="2"><title>' + esc(d.label) + ": " + d.value + "</title></rect>";
    if (showLabel) {
      svg += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (padT + ch + 16) + '" text-anchor="middle" font-size="10" fill="' + MUTED + '">' +
        esc(String(d.label).slice(2)) + "</text>";
    }
  });
  return svg + "</svg>";
}

/* Horizontal bar chart for ranked lists. values: [{label, value}] */
function hBarChart(values, ariaLabel) {
  var W = 960, rowH = 30, padL = 210, padR = 60, padT = 8;
  var H = padT + values.length * rowH + 8;
  var cw = W - padL - padR;
  var max = Math.max.apply(null, values.map(function (v) { return v.value; }).concat([1]));
  var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(ariaLabel) + '">';
  values.forEach(function (d, i) {
    var y = padT + i * rowH;
    var w = Math.max(3, (d.value / max) * cw);
    svg += '<text x="' + (padL - 10) + '" y="' + (y + 19) + '" text-anchor="end" font-size="13" fill="#1E1B16">' +
      esc(d.label) + "</text>";
    svg += '<rect x="' + padL + '" y="' + (y + 6) + '" width="' + w.toFixed(1) + '" height="16" fill="' + RED + '" rx="3">' +
      "<title>" + esc(d.label) + ": " + d.value + " figures</title></rect>";
    svg += '<text x="' + (padL + w + 8).toFixed(1) + '" y="' + (y + 19) + '" font-size="12" fill="' + MUTED + '">' + d.value + "</text>";
  });
  return svg + "</svg>";
}

/* Donut chart. parts: [{label, value, color}] */
function donut(parts, ariaLabel) {
  var size = 240, r = 90, cx = size / 2, cy = size / 2, sw = 34;
  var total = parts.reduce(function (n, p) { return n + p.value; }, 0);
  var circ = 2 * Math.PI * r;
  var off = 0;
  var svg = '<svg viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="' + esc(ariaLabel) +
    '" style="max-width:240px;width:100%;height:auto;display:block;margin-inline:auto;">';
  parts.forEach(function (p) {
    var frac = total ? p.value / total : 0;
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + p.color +
      '" stroke-width="' + sw + '" stroke-dasharray="' + (frac * circ).toFixed(1) + " " + circ.toFixed(1) +
      '" stroke-dashoffset="' + (-off * circ).toFixed(1) + '" transform="rotate(-90 ' + cx + " " + cy + ')">' +
      "<title>" + esc(p.label) + ": " + p.value.toLocaleString() + " (" + Math.round(frac * 100) + "%)</title></circle>";
    off += frac;
  });
  svg += '<text x="' + cx + '" y="' + (cy - 6) + '" text-anchor="middle" font-size="26" font-weight="800" fill="#1E1B16">' +
    total.toLocaleString() + "</text>";
  svg += '<text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" font-size="12" fill="' + MUTED + '">figures</text>';
  return svg + "</svg>";
}

function kpiCard(value, label) {
  return '<div class="stat"><div class="stat-value">' + value + '</div><div class="stat-label">' + esc(label) + "</div></div>";
}

function render() {
  var bafEl = document.getElementById("baf-chart");
  var charsEl = document.getElementById("chars-chart");
  var exclEl = document.getElementById("excl-chart");
  var sizeEl = document.getElementById("wavesize-kpis");
  if (!bafEl && !charsEl && !exclEl && !sizeEl) return;

  loadData().then(function (data) {
    var waves = data.waves, figures = data.figures;

    if (bafEl) {
      var years = {};
      waves.forEach(function (w) {
        years[w.year] = years[w.year] || { baf: 0, total: 0 };
        years[w.year].total += 1;
        if (w.baf) years[w.year].baf += 1;
      });
      var vals = Object.keys(years).map(Number).sort(function (a, b) { return a - b; })
        .map(function (y) {
          return { label: String(y), value: years[y].baf, color: years[y].baf ? GOLD : GRID };
        });
      bafEl.innerHTML = vBarChart(vals, "Bar chart of Build-A-Figure waves per year, 2002 to 2026");
    }

    if (charsEl) {
      var counts = {};
      figures.forEach(function (f) {
        var b = baseName(f.name);
        if (b) counts[b] = (counts[b] || 0) + 1;
      });
      var top = Object.keys(counts).map(function (k) { return { label: k, value: counts[k] }; })
        .sort(function (a, b) { return b.value - a.value; }).slice(0, 25);
      charsEl.innerHTML = hBarChart(top, "Top 25 characters by Marvel Legends figure count");
    }

    if (exclEl) {
      var excl = figures.filter(function (f) { return f.exclusive; }).length;
      exclEl.innerHTML = donut([
        { label: "Exclusives", value: excl, color: GOLD },
        { label: "Mainline releases", value: figures.length - excl, color: RED },
      ], "Share of exclusive versus mainline Marvel Legends figures") +
        '<div class="legend"><span><i style="background:' + GOLD + '"></i>Exclusives, ' + excl.toLocaleString() +
        '</span><span><i style="background:' + RED + '"></i>Mainline, ' + (figures.length - excl).toLocaleString() + "</span></div>";
    }

    if (sizeEl) {
      var tb = waves.filter(function (w) { return w.manufacturer === "Toy Biz"; });
      var hb = waves.filter(function (w) { return w.manufacturer !== "Toy Biz"; });
      var avg = function (ws) {
        return ws.length ? (ws.reduce(function (n, w) { return n + w.figures.length; }, 0) / ws.length) : 0;
      };
      sizeEl.innerHTML =
        kpiCard(avg(waves).toFixed(1), "Avg figures per wave") +
        kpiCard(avg(tb).toFixed(1), "Toy Biz avg (" + tb.length + " waves)") +
        kpiCard(avg(hb).toFixed(1), "Hasbro avg (" + hb.length + " waves)") +
        kpiCard(waves.filter(function (w) { return w.baf; }).length, "BAF waves");
    }
  }).catch(function (err) {
    console.error(err);
    var msg = '<div class="empty-state"><p>Could not load chart data. Check your connection and reload.</p></div>';
    if (bafEl) bafEl.innerHTML = msg;
    if (charsEl) charsEl.innerHTML = msg;
    if (exclEl) exclEl.innerHTML = msg;
    if (sizeEl) sizeEl.innerHTML = msg;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", render, { once: true });
} else {
  render();
}
