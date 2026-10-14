/* The Year Ledger, the years census.
   Every year of the line counted by what the catalog dates to it:
   the flood years that ship a hundred figures and more, and the
   lean years, 2011 shipped exactly one figure. Every count comes
   from the catalog itself. No prices, a ledger of years, not a
   market. Years render bare, never with a thousands separator. */
import { loadData } from "./data.js";
import { escapeHtml } from "./figure-dialog.js";
import { buildYearLedgerModel } from "./year-ledger-model.js";

const els = {
  kpis: document.getElementById("year-ledger-kpis"),
  ledger: document.getElementById("year-ledger-ledger"),
  bands: document.getElementById("year-ledger-bands"),
  swings: document.getElementById("year-ledger-swings"),
  error: document.getElementById("year-ledger-error"),
};

const fmt = (n) => n.toLocaleString("en-US");

function kpi(label, value, sub) {
  return `<div class="db-stat"><div class="db-stat-value">${value}</div><div class="db-stat-label">${label}</div>${sub ? `<div class="db-stat-sub">${sub}</div>` : ""}</div>`;
}

async function main() {
  try {
    const catalog = await loadData();
    const m = buildYearLedgerModel(catalog.figures);

    els.kpis.innerHTML = [
      kpi("Years in the ledger", fmt(m.yearCount),
        `${m.firstYear}–${m.lastYear}, no gap year, holding ${fmt(m.figureCount)} figures`),
      kpi("The busiest year", m.busiest ? `${m.busiest.year}` : "n/a",
        m.busiest ? `${fmt(m.busiest.figures)} figures across ${fmt(m.busiest.waves)} waves` : ""),
      kpi("The median year", m.median === null ? "n/a" : `${fmt(m.median)} figures`,
        "the middle year when all twenty-five are ordered by output"),
      kpi("The flood years", fmt(m.flood.years),
        `years of 100 figures or more, holding ${fmt(m.flood.figures)} figures between them`),
    ].join("");

    els.ledger.innerHTML = m.years.length
      ? `<ul class="db-rows">${m.years.map((y) => `
        <li class="db-row">
          <span class="db-year">${y.year}</span>
          <span class="db-name">${fmt(y.figures)} ${y.figures === 1 ? "figure" : "figures"}</span>
          <span class="db-fig">${fmt(y.waves)} ${y.waves === 1 ? "wave" : "waves"} · ${fmt(y.characters)} characters · ${fmt(y.debuts)} debuts</span>
          <span class="db-count">${fmt(y.exclusives)} exclusives · ${fmt(y.bafWaves)} build ${y.bafWaves === 1 ? "wave" : "waves"} · ${escapeHtml(y.manufacturer)}</span>
        </li>`).join("")}</ul>`
      : `<p class="db-none">The catalog files no year yet.</p>`;

    els.bands.innerHTML = m.bands.length
      ? `<ul class="db-rows">${m.bands.map((b) => `
        <li class="db-row">
          <span class="db-name">${escapeHtml(b.label)}</span>
          <span class="db-fig">${fmt(b.years)} ${b.years === 1 ? "year" : "years"}</span>
          <span class="db-count">${fmt(b.figures)} ${b.figures === 1 ? "figure" : "figures"} of the line</span>
        </li>`).join("")}</ul>`
      : `<p class="db-none">No bands to file.</p>`;

    const swingRows = [];
    if (m.flood.years) {
      swingRows.push(`<li class="db-row">
        <span class="db-name">The flood</span>
        <span class="db-fig">every year from ${m.flood.firstYear} to ${m.flood.lastYear} in the ledger's flood band shipped 100 figures or more, ${fmt(m.flood.years)} years holding ${fmt(m.flood.figures)} figures, the bulk of the line</span>
        <span class="db-count">filed as recorded</span>
      </li>`);
    }
    if (m.busiest) {
      swingRows.push(`<li class="db-row">
        <span class="db-year">${m.busiest.year}</span>
        <span class="db-name">The busiest year</span>
        <span class="db-fig">${fmt(m.busiest.figures)} figures, the most the line has ever shipped in a single year</span>
        <span class="db-count">${escapeHtml(m.busiest.manufacturer)}</span>
      </li>`);
    }
    if (m.quietest) {
      swingRows.push(`<li class="db-row">
        <span class="db-year">${m.quietest.year}</span>
        <span class="db-name">The quietest year</span>
        <span class="db-fig">${fmt(m.quietest.figures)} ${m.quietest.figures === 1 ? "figure" : "figures"}, the least the line has ever shipped in a single year, in ${fmt(m.quietest.waves)} ${m.quietest.waves === 1 ? "wave" : "waves"}</span>
        <span class="db-count">${escapeHtml(m.quietest.manufacturer)}</span>
      </li>`);
    }
    if (m.biggestRise) {
      swingRows.push(`<li class="db-row">
        <span class="db-year">${m.biggestRise.fromYear} → ${m.biggestRise.toYear}</span>
        <span class="db-name">The biggest rise</span>
        <span class="db-fig">+${fmt(m.biggestRise.delta)} figures year over year, the steepest climb in the ledger</span>
        <span class="db-count">between consecutive years</span>
      </li>`);
    }
    if (m.biggestFall) {
      swingRows.push(`<li class="db-row">
        <span class="db-year">${m.biggestFall.fromYear} → ${m.biggestFall.toYear}</span>
        <span class="db-name">The biggest fall</span>
        <span class="db-fig">${fmt(m.biggestFall.delta)} figures year over year, the steepest drop in the ledger</span>
        <span class="db-count">between consecutive years</span>
      </li>`);
    }
    els.swings.innerHTML = swingRows.length
      ? `<ul class="db-rows">${swingRows.join("")}</ul>`
      : `<p class="db-none">No swings to file.</p>`;
  } catch (err) {
    els.error.hidden = false;
    els.error.textContent = "The year ledger could not be counted from the catalog. The archive itself is unaffected, try reloading the page.";
  }
}

main();
