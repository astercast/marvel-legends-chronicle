/* The Wave Ledger — the waves census.
   Every wave in the catalog counted by the figures filed under
   it: the handful of giant annual buckets that hold nearly half
   the line, and the standard waves that run six or seven figures
   deep. Every count comes from the catalog itself — waves, sizes,
   bands, the median and the ceiling. No prices — a ledger of
   waves, not a market. */
import { loadData } from "./data.js";
import { escapeHtml } from "./figure-dialog.js";
import { buildWaveLedgerModel } from "./wave-ledger-model.js";

const els = {
  kpis: document.getElementById("wave-ledger-kpis"),
  largest: document.getElementById("wave-ledger-largest"),
  bands: document.getElementById("wave-ledger-bands"),
  buckets: document.getElementById("wave-ledger-buckets"),
  error: document.getElementById("wave-ledger-error"),
};

const fmt = (n) => n.toLocaleString("en-US");

function kpi(label, value, sub) {
  return `<div class="db-stat"><div class="db-stat-value">${value}</div><div class="db-stat-label">${label}</div>${sub ? `<div class="db-stat-sub">${sub}</div>` : ""}</div>`;
}

function waveRow(w) {
  return `<li class="db-row">
      <span class="db-year">${w.year}</span>
      <span class="db-name"><a href="waves/${escapeHtml(w.waveId)}.html">${escapeHtml(w.waveSeries)}</a></span>
      <span class="db-fig">${fmt(w.size)} ${w.size === 1 ? "figure" : "figures"}</span>
      <span class="db-count">${escapeHtml(w.manufacturer)}${w.hasBaf ? " · carries a build" : ""}</span>
    </li>`;
}

async function main() {
  try {
    const catalog = await loadData();
    const m = buildWaveLedgerModel(catalog.figures);

    els.kpis.innerHTML = [
      kpi("Waves in the ledger", fmt(m.waveCount), `holding ${fmt(m.figureCount)} figures in the catalog`),
      kpi("The typical wave", m.median === null ? "—" : `${fmt(m.median)} figures`,
        m.mode ? `the median wave — and the commonest size, ${fmt(m.mode.waves)} waves strong` : "the median wave"),
      kpi("The giant buckets", fmt(m.buckets.annualWaves),
        `annual exclusives buckets holding ${fmt(m.buckets.annualFigures)} figures between them`),
      kpi("The standard ceiling", m.standard.ceiling === null ? "—" : `${fmt(m.standard.ceiling)} figures`,
        "the largest wave that is not a bucket"),
    ].join("");

    els.largest.innerHTML = m.largest.length
      ? `<ul class="db-rows">${m.largest.map(waveRow).join("")}</ul>`
      : `<p class="db-none">The catalog files no wave yet.</p>`;

    els.bands.innerHTML = m.bands.length
      ? `<ul class="db-rows">${m.bands.map((b) => `
        <li class="db-row">
          <span class="db-name">${escapeHtml(b.label)}</span>
          <span class="db-fig">${fmt(b.waves)} ${b.waves === 1 ? "wave" : "waves"}</span>
          <span class="db-count">${fmt(b.figures)} ${b.figures === 1 ? "figure" : "figures"} of the line</span>
        </li>`).join("")}</ul>`
      : `<p class="db-none">No bands to file.</p>`;

    const bucketRows = [
      `<li class="db-row">
        <span class="db-name">The annual buckets</span>
        <span class="db-fig">${fmt(m.buckets.annualWaves)} waves named Store &amp; Convention Exclusives, one a year from 2014, hold ${fmt(m.buckets.annualFigures)} figures</span>
        <span class="db-count">filed as recorded</span>
      </li>`,
      `<li class="db-row">
        <span class="db-name">The bucket series whole</span>
        <span class="db-fig">${fmt(m.buckets.waves)} waves under that name, ${m.buckets.firstYear}–${m.buckets.lastYear}, hold ${fmt(m.buckets.figures)} figures — the 2008 shelf of six stands apart from the annual run</span>
        <span class="db-count">the rest of the line files under standard waves</span>
      </li>`,
      `<li class="db-row">
        <span class="db-name">The standard waves</span>
        <span class="db-fig">${fmt(m.standard.waves)} waves hold ${fmt(m.standard.figures)} figures, and none of them holds more than ${fmt(m.standard.ceiling)}</span>
        <span class="db-count">the ceiling is shared by ${fmt(m.standard.ceilingWaves.length)} waves</span>
      </li>`,
      ...m.standard.ceilingWaves.map((w) => `
      <li class="db-row">
        <span class="db-year">${w.year}</span>
        <span class="db-name"><a href="waves/${escapeHtml(w.waveId)}.html">${escapeHtml(w.waveSeries)}</a></span>
        <span class="db-fig">${fmt(w.size)} figures — at the standard ceiling</span>
        <span class="db-count">${escapeHtml(w.manufacturer)}</span>
      </li>`),
      ...m.standard.singleWaves.map((w) => `
      <li class="db-row">
        <span class="db-year">${w.year}</span>
        <span class="db-name"><a href="waves/${escapeHtml(w.waveId)}.html">${escapeHtml(w.waveSeries)}</a></span>
        <span class="db-fig">1 figure — the only single-figure wave in the ledger</span>
        <span class="db-count">${escapeHtml(w.manufacturer)}</span>
      </li>`),
    ];
    els.buckets.innerHTML = `<ul class="db-rows">${bucketRows.join("")}</ul>`;
  } catch (err) {
    els.error.hidden = false;
    els.error.textContent = "The wave ledger could not be counted from the catalog. The archive itself is unaffected — try reloading the page.";
  }
}

main();
