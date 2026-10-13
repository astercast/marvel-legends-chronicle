/* The Build Ledger — every Build-A-Figure in the line.
   Every distinct build the catalog records, the waves that carried
   it, and the figures that carried its pieces: counted from the
   catalog itself, filed by the Archive Tour's era chapters. Piece-
   carrying figures and distinct piece labels are counted apart and
   never merged. Where the catalog records no piece assignments,
   the page files the gap as a gap. No prices — a ledger of builds,
   not a market. */
import { loadData } from "./data.js";
import { escapeHtml } from "./figure-dialog.js";
import { buildBuildLedgerModel } from "./build-ledger-model.js";

const els = {
  kpis: document.getElementById("build-kpis"),
  front: document.getElementById("build-front"),
  chapters: document.getElementById("build-chapters"),
  gaps: document.getElementById("build-gaps"),
  error: document.getElementById("build-error"),
};

const fmt = (n) => n.toLocaleString("en-US");

function kpi(label, value, sub) {
  return `<div class="db-stat"><div class="db-stat-value">${value}</div><div class="db-stat-label">${label}</div>${sub ? `<div class="db-stat-sub">${sub}</div>` : ""}</div>`;
}

function waveLinks(b) {
  return b.waves.map((w) =>
    `<a href="waves/${escapeHtml(w.waveId)}.html">${escapeHtml(w.waveSeries)}</a>`).join(" · ");
}

function buildRow(b) {
  return `<li class="db-row">
      <span class="db-year">${b.firstYear}</span>
      <span class="db-name">${escapeHtml(b.name)}</span>
      <span class="db-fig">${b.carrierCount} of ${b.figureCount} figures carry a piece · ${b.pieceCount} distinct pieces recorded</span>
      <span class="db-wave">${waveLinks(b)} · ${escapeHtml(b.manufacturer)}</span>
      <span class="db-count">${b.waveCount === 1 ? "1 wave" : `${b.waveCount} waves`}</span>
    </li>`;
}

async function main() {
  try {
    const catalog = await loadData();
    const m = buildBuildLedgerModel(catalog.figures);
    const first = m.builds.length ? m.builds[0] : null;

    els.kpis.innerHTML = [
      kpi("Builds catalogued", fmt(m.total), "one per distinct Build-A-Figure the catalog names"),
      kpi("Waves carrying a build", fmt(m.waveCount), `of ${fmt(catalog.waves.length)} waves in the archive`),
      kpi("Figures carrying a piece", fmt(m.carrierCount), `of ${fmt(m.figureCount)} figures in build waves`),
      kpi("The first build", first ? `${first.firstYear}` : "—",
        first ? `${first.name} — the Build-A-Figure arrives in ${first.firstYear}` : "no builds recorded"),
    ].join("");

    els.front.innerHTML = m.largest.length
      ? `<ul class="db-rows">${m.largest.slice(0, 12).map(buildRow).join("")}</ul>`
      : `<p class="db-none">The catalog records no Build-A-Figure yet.</p>`;

    els.chapters.innerHTML = m.byChapter.map((c) => `
      <div class="db-chapter">
        <div class="db-chapter-head"><h3>${escapeHtml(c.kicker)} — ${escapeHtml(c.title)}</h3><span class="db-chapter-count">${c.builds.length} builds</span></div>
        ${c.builds.length
          ? `<ul class="db-rows">${c.builds.map(buildRow).join("")}</ul>`
          : `<p class="db-none">No build in the catalog begins in this chapter.</p>`}
      </div>`).join("");

    const gapRows = [
      ...m.unrecordedBuilds.map((b) => `<li class="db-row">
          <span class="db-year">${b.firstYear}</span>
          <span class="db-name">${escapeHtml(b.name)}</span>
          <span class="db-fig">the catalog records no piece assignments for this build</span>
          <span class="db-wave">${waveLinks(b)} · ${escapeHtml(b.manufacturer)}</span>
          <span class="db-count">filed as recorded</span>
        </li>`),
      ...m.unrecordedWaves.filter((w) => !m.unrecordedBuilds.some((b) => b.name === w.baf))
        .map((w) => `<li class="db-row">
          <span class="db-year">${w.year}</span>
          <span class="db-name">${escapeHtml(w.baf)}</span>
          <span class="db-fig">this wave's figures record no pieces — the build's pieces are recorded under its other wave</span>
          <span class="db-wave"><a href="waves/${escapeHtml(w.waveId)}.html">${escapeHtml(w.waveSeries)}</a></span>
          <span class="db-count">filed as recorded</span>
        </li>`),
    ];
    els.gaps.innerHTML = gapRows.length
      ? `<ul class="db-rows">${gapRows.join("")}</ul>`
      : `<p class="db-none">Every build in the catalog carries at least one recorded piece assignment.</p>`;
  } catch (err) {
    els.error.hidden = false;
    els.error.textContent = "The build ledger could not be read from the catalog. The archive itself is unaffected — try reloading the page.";
  }
}

main();
