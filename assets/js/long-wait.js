/* The Long Wait, the returns ledger.
   Every distinct character in the catalog, filed by the longest
   silence between one of their figures and the next: the waits that
   ended when a second figure finally arrived, and the waits still
   running for the characters the line has visited exactly once.
   Counted from the catalog itself, using the archive's own
   character rule. A character links to its character page only when
   the archive publishes one. No prices, a ledger of returns, not
   a market. */
import { loadData } from "./data.js";
import { escapeHtml } from "./figure-dialog.js";
import { buildLongWaitModel } from "./long-wait-model.js";

const els = {
  kpis: document.getElementById("wait-kpis"),
  front: document.getElementById("wait-front"),
  returned: document.getElementById("wait-returned"),
  waiting: document.getElementById("wait-waiting"),
  error: document.getElementById("wait-error"),
};

const fmt = (n) => n.toLocaleString("en-US");

function kpi(label, value, sub) {
  return `<div class="db-stat"><div class="db-stat-value">${value}</div><div class="db-stat-label">${label}</div>${sub ? `<div class="db-stat-sub">${sub}</div>` : ""}</div>`;
}

function nameHtml(c) {
  return c.hasPage
    ? `<a href="characters/${escapeHtml(c.slug)}.html">${escapeHtml(c.name)}</a>`
    : escapeHtml(c.name);
}

function returnedRow(c) {
  const g = c.longestGap;
  return `<li class="db-row">
      <span class="db-year">${g.years} yrs</span>
      <span class="db-name">${nameHtml(c)}</span>
      <span class="db-fig">${escapeHtml(g.beforeFigure)} (${g.fromYear}) → ${escapeHtml(g.afterFigure)} (${g.toYear})</span>
      <span class="db-wave">returned in <a href="waves/${escapeHtml(g.afterWaveId)}.html">${escapeHtml(g.afterWaveSeries)}</a> · ${escapeHtml(g.afterManufacturer)}</span>
      <span class="db-count">${c.releases} releases in all</span>
    </li>`;
}

function waitingRow(c) {
  return `<li class="db-row">
      <span class="db-year">${c.waitingYears} yrs</span>
      <span class="db-name">${nameHtml(c)}</span>
      <span class="db-fig">only figure: ${escapeHtml(c.onlyFigure)} (${c.debutYear})</span>
      <span class="db-wave"><a href="waves/${escapeHtml(c.onlyWaveId)}.html">${escapeHtml(c.onlyWaveSeries)}</a> · ${escapeHtml(c.onlyManufacturer)}</span>
      <span class="db-count">still waiting</span>
    </li>`;
}

async function main() {
  try {
    const catalog = await loadData();
    let slugs = new Set();
    try {
      const res = await fetch("data/v1/characters.json");
      if (res.ok) {
        const payload = await res.json();
        slugs = new Set((payload.characters || []).map((c) => c.slug));
      }
    } catch { /* character pages are a link affordance, not a dependency */ }
    const m = buildLongWaitModel(catalog.figures, slugs);

    els.kpis.innerHTML = [
      kpi("Characters catalogued", fmt(m.total), "the archive's own character rule"),
      kpi("Waits that ended", fmt(m.returnedCount), "characters with a second figure or more"),
      kpi("Still waiting", fmt(m.waitingCount), `one figure each, through ${m.latestYear}`),
      kpi("Longest wait, ended", m.longest ? `${m.longest.longestGap.years} years` : "n/a",
        m.longest ? `${m.longest.name}: ${m.longest.longestGap.fromYear} → ${m.longest.longestGap.toYear}` : "no returns yet"),
    ].join("");

    els.front.innerHTML = m.returned.length
      ? `<ul class="db-rows">${m.returned.slice(0, 12).map(returnedRow).join("")}</ul>`
      : `<p class="db-none">No character in the catalog has a second figure yet.</p>`;

    els.returned.innerHTML = m.returned.length
      ? `<ul class="db-rows">${m.returned.map(returnedRow).join("")}</ul>`
      : `<p class="db-none">The catalog records no returns yet.</p>`;

    els.waiting.innerHTML = m.waiting.length
      ? `<ul class="db-rows">${m.waiting.map(waitingRow).join("")}</ul>`
      : `<p class="db-none">Every character in the catalog has returned at least once.</p>`;
  } catch (err) {
    els.error.hidden = false;
    els.error.textContent = "The returns ledger could not be read from the catalog. The archive itself is unaffected, try reloading the page.";
  }
}

main();
