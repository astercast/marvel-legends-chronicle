/* The Roll Call, the returns census.
   Every distinct character in the catalog, called by how many
   figures the line gives them: the handful who anchor the line,
   and the hundreds who appear exactly once. Every count comes
   from the catalog itself, figures per character, the bands
   they fall in, the waves they span. No prices, a census of
   the roll, not a market. */
import { loadData } from "./data.js";
import { escapeHtml } from "./figure-dialog.js";
import { buildRollCallModel } from "./roll-call-model.js";

const els = {
  kpis: document.getElementById("roll-kpis"),
  head: document.getElementById("roll-head"),
  bands: document.getElementById("roll-bands"),
  tail: document.getElementById("roll-tail"),
  error: document.getElementById("roll-error"),
};

const fmt = (n) => n.toLocaleString("en-US");

function kpi(label, value, sub) {
  return `<div class="db-stat"><div class="db-stat-value">${value}</div><div class="db-stat-label">${label}</div>${sub ? `<div class="db-stat-sub">${sub}</div>` : ""}</div>`;
}

function rollRow(r) {
  const span = r.firstYear === r.lastYear ? `${r.firstYear}` : `${r.firstYear}–${r.lastYear}`;
  return `<li class="db-row">
      <span class="db-year">${span}</span>
      <span class="db-name">${escapeHtml(r.name)}</span>
      <span class="db-fig">${fmt(r.count)} ${r.count === 1 ? "figure" : "figures"}</span>
      <span class="db-count">across ${fmt(r.waveCount)} ${r.waveCount === 1 ? "wave" : "waves"}</span>
    </li>`;
}

async function main() {
  try {
    const catalog = await loadData();
    const m = buildRollCallModel(catalog.figures);
    const head = m.roll[0] || null;

    els.kpis.innerHTML = [
      kpi("Characters on the roll", fmt(m.characterCount), `across ${fmt(m.figureCount)} figures in the catalog`),
      kpi("Called exactly once", fmt(m.singletons.characters), "characters with a single figure to their name"),
      kpi("The returners", fmt(m.returners.characters), `characters holding ${fmt(m.returners.figures)} figures between them`),
      kpi("Head of the roll", head ? escapeHtml(head.name) : "n/a",
        head ? `${fmt(head.count)} figures across ${fmt(head.waveCount)} waves` : "the roll is empty"),
    ].join("");

    els.head.innerHTML = m.top.length
      ? `<ul class="db-rows">${m.top.map(rollRow).join("")}</ul>`
      : `<p class="db-none">The catalog calls no character yet.</p>`;

    els.bands.innerHTML = m.bands.length
      ? `<ul class="db-rows">${m.bands.map((b) => `
        <li class="db-row">
          <span class="db-name">${escapeHtml(b.label)}</span>
          <span class="db-fig">${fmt(b.characters)} ${b.characters === 1 ? "character" : "characters"}</span>
          <span class="db-count">${fmt(b.figures)} ${b.figures === 1 ? "figure" : "figures"} of the line</span>
        </li>`).join("")}</ul>`
      : `<p class="db-none">No bands to file.</p>`;

    const tailRows = [
      `<li class="db-row">
        <span class="db-name">The long tail</span>
        <span class="db-fig">${fmt(m.singletons.characters)} characters appear exactly once, ${fmt(m.singletons.figures)} figures, one apiece</span>
        <span class="db-count">filed as recorded</span>
      </li>`,
      `<li class="db-row">
        <span class="db-name">Two figures or fewer</span>
        <span class="db-fig">${fmt(m.bands[0].characters + m.bands[1].characters)} characters share ${fmt(m.bands[0].figures + m.bands[1].figures)} figures between them</span>
        <span class="db-count">the head of the roll holds ${fmt(m.topTenFigures)} in its top ten alone</span>
      </li>`,
    ];
    els.tail.innerHTML = `<ul class="db-rows">${tailRows.join("")}</ul>`;
  } catch (err) {
    els.error.hidden = false;
    els.error.textContent = "The roll could not be called from the catalog. The archive itself is unaffected, try reloading the page.";
  }
}

main();
