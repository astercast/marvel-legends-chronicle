/* The Two Houses, the makers' ledger.
   The whole line filed under the two houses that made it: Toy Biz,
   which opened the line in 2002, and Hasbro, which has carried it
   since 2007. Every count comes from the catalog itself, figures,
   waves, builds, characters, debuts, exclusives, variants, and the
   seam between the houses is reported exactly where the catalog
   puts it. No prices, a ledger of makers, not a market. */
import { loadData } from "./data.js";
import { escapeHtml } from "./figure-dialog.js";
import { buildTwoHousesModel } from "./two-houses-model.js";

const els = {
  kpis: document.getElementById("houses-kpis"),
  front: document.getElementById("houses-front"),
  years: document.getElementById("houses-years"),
  seam: document.getElementById("houses-seam"),
  error: document.getElementById("houses-error"),
};

const fmt = (n) => n.toLocaleString("en-US");

function kpi(label, value, sub) {
  return `<div class="db-stat"><div class="db-stat-value">${value}</div><div class="db-stat-label">${label}</div>${sub ? `<div class="db-stat-sub">${sub}</div>` : ""}</div>`;
}

function waveLink(w) {
  return w ? `<a href="waves/${escapeHtml(w.waveId)}.html">${escapeHtml(w.waveSeries)}</a>` : "Not recorded";
}

function housePlate(h) {
  const channels = h.topChannels.length
    ? h.topChannels.map((c) => `${escapeHtml(c.channel)} ${c.count}`).join(" · ")
    : "none recorded";
  return `<li class="db-row">
      <span class="db-year">${h.firstYear}–${h.lastYear}</span>
      <span class="db-name">${escapeHtml(h.name)}</span>
      <span class="db-fig">${fmt(h.figureCount)} figures in ${fmt(h.waveCount)} waves · ${fmt(h.builds)} builds · ${fmt(h.characterCount)} characters, ${fmt(h.debutCount)} of them debuting here</span>
      <span class="db-wave">${fmt(h.exclusiveCount)} exclusives (${channels}) · ${fmt(h.variantCount)} catalogued variants</span>
      <span class="db-count">busiest year ${h.busiestYear ? `${h.busiestYear.year} · ${fmt(h.busiestYear.figures)} figures` : "n/a"}</span>
    </li>`;
}

async function main() {
  try {
    const catalog = await loadData();
    const m = buildTwoHousesModel(catalog.figures);
    const seam = m.succession.length ? m.succession[0] : null;

    els.kpis.innerHTML = [
      kpi("Houses of the line", fmt(m.total), "every distinct maker the catalog records"),
      kpi("Figures filed", fmt(m.figureCount), `across ${fmt(m.waveCount)} waves, ${m.span[0]}–${m.span[1]}`),
      kpi("The handover", seam ? `${seam.closingWave.year} → ${seam.openingWave.year}` : "n/a",
        seam ? `${seam.from} closes; ${seam.to} opens, no year is shared` : "one house only"),
      kpi("Characters in both houses", fmt(m.sharedCharacters),
        `of ${fmt(m.characterCount)} distinct characters in the archive`),
    ].join("");

    els.front.innerHTML = m.houses.length
      ? `<ul class="db-rows">${m.houses.map(housePlate).join("")}</ul>`
      : `<p class="db-none">The catalog records no maker yet.</p>`;

    els.years.innerHTML = m.houses.map((h) => `
      <div class="db-chapter">
        <div class="db-chapter-head"><h3>${escapeHtml(h.name)}, year by year</h3><span class="db-chapter-count">${fmt(h.figureCount)} figures</span></div>
        <ul class="db-rows">${h.years.map((y) => `
          <li class="db-row">
            <span class="db-year">${y.year}</span>
            <span class="db-fig">${y.figures === 1 ? "1 figure" : `${fmt(y.figures)} figures`}</span>
            <span class="db-count">${y.waves === 1 ? "1 wave" : `${fmt(y.waves)} waves`}</span>
          </li>`).join("")}</ul>
      </div>`).join("");

    const seamRows = m.succession.map((s) => `
      <li class="db-row">
        <span class="db-year">${s.closingWave.year}</span>
        <span class="db-name">${escapeHtml(s.from)} closes</span>
        <span class="db-fig">its last catalogued wave is ${waveLink(s.closingWave)} (${s.closingWave.year})</span>
        <span class="db-count">filed as recorded</span>
      </li>
      <li class="db-row">
        <span class="db-year">${s.openingWave.year}</span>
        <span class="db-name">${escapeHtml(s.to)} opens</span>
        <span class="db-fig">its first catalogued wave is ${waveLink(s.openingWave)} (${s.openingWave.year})</span>
        <span class="db-count">filed as recorded</span>
      </li>`);
    const onlyRows = m.houses.map((h) => `
      <li class="db-row">
        <span class="db-name">${escapeHtml(h.name)} alone</span>
        <span class="db-fig">${fmt(h.onlyCount)} characters appear under this house and no other</span>
        <span class="db-count">${fmt(m.sharedCharacters)} carried across</span>
      </li>`);
    els.seam.innerHTML = (seamRows.length || onlyRows.length)
      ? `<ul class="db-rows">${[...seamRows, ...onlyRows].join("")}</ul>`
      : `<p class="db-none">The catalog records a single house, there is no seam to file.</p>`;
  } catch (err) {
    els.error.hidden = false;
    els.error.textContent = "The makers' ledger could not be read from the catalog. The archive itself is unaffected, try reloading the page.";
  }
}

main();
