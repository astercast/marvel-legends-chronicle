/* The Spec Sheet — the per-figure structured spec record
   (ticket T-MARVEL-1). Pick any figure in the catalog and read
   its museum-vault spec sheet: every field the catalog actually
   records, verbatim, and the fields it does not record named as
   recorded-absent — never invented. The capture slot on each
   record stays empty until the Drop Week capture files real
   asking prices, limits and ship dates from the day itself. */
import { loadData } from "./data.js";
import { escapeHtml } from "./figure-dialog.js";
import { buildSpecSheetModel, SPEC_ABSENT_FIELDS } from "./spec-sheet-model.js";
import { loadFigureImages, plateHtml, buyLinksHtml } from "./figure-images.js";

let images = new Map();

const els = {
  kpis: document.getElementById("spec-sheet-kpis"),
  picker: document.getElementById("spec-sheet-picker"),
  sheet: document.getElementById("spec-sheet-sheet"),
  coverage: document.getElementById("spec-sheet-coverage"),
  error: document.getElementById("spec-sheet-error"),
};

const fmt = (n) => n.toLocaleString("en-US");

function kpi(label, value, sub) {
  return `<div class="db-stat"><div class="db-stat-value">${value}</div><div class="db-stat-label">${label}</div>${sub ? `<div class="db-stat-sub">${sub}</div>` : ""}</div>`;
}

function row(label, valueHtml) {
  return `<li class="db-row">
      <span class="db-name">${escapeHtml(label)}</span>
      <span class="db-fig">${valueHtml}</span>
    </li>`;
}

function absentRow(label, note) {
  return `<li class="db-row">
      <span class="db-name">${escapeHtml(label)}</span>
      <span class="db-fig">Not recorded</span>
      <span class="db-count">${escapeHtml(note)}</span>
    </li>`;
}

function renderSheet(r) {
  const buildValue = r.build.build
    ? (r.build.role === "piece-carrier"
      ? `${escapeHtml(r.build.build)} — this figure carries: ${escapeHtml(r.build.piece)}`
      : `${escapeHtml(r.build.build)} — no piece recorded for this figure`)
    : "No build — this figure's wave carries no Build-A-Figure";
  const entry = images.get(r.id);
  const rows = [
    ...(entry ? [
      row("Picture", plateHtml(entry, r.name)),
      row("Places to buy", buyLinksHtml(entry) || "Not recorded"),
    ] : [
      row("Picture", "No verified picture yet — this figure renders typographically, and is filed in the Visual Database's fill-in queue"),
    ]),
    row("Figure", escapeHtml(r.name)),
    row("Character", escapeHtml(r.character)),
    row("Wave", `<a href="waves/${escapeHtml(r.wave.id)}.html">${escapeHtml(r.wave.series)}</a>`),
    row("Year", `${r.year}`),
    row("Manufacturer", escapeHtml(r.manufacturer)),
    row("Build-A-Figure", buildValue),
    row("Exclusive", r.exclusive ? escapeHtml(r.exclusive) : "Not recorded — the catalog marks no exclusive channel for this figure"),
    row("Variant", r.variant ? escapeHtml(r.variant) : "Not recorded — the catalog records no variant for this figure"),
    row("Notes", r.notes ? escapeHtml(r.notes) : "Not recorded — the catalog carries no note for this figure"),
    row("Source", r.source ? escapeHtml(r.source) : "Not recorded — the catalog names no source for this figure"),
    row("Capture", r.capture
      ? escapeHtml(JSON.stringify(r.capture))
      : "Awaiting capture — no asking price, limit or ship date has been captured for this figure yet"),
    ...SPEC_ABSENT_FIELDS.map((f) => absentRow(f.label, f.note)),
  ];
  els.sheet.innerHTML = `<ul class="db-rows">${rows.join("")}</ul>`;
}

async function main() {
  try {
    const catalog = await loadData();
    try { images = await loadFigureImages(); } catch { images = new Map(); }
    const m = buildSpecSheetModel(catalog.figures);
    const byId = new Map(m.records.map((r) => [r.id, r]));

    els.kpis.innerHTML = [
      kpi("Spec records", fmt(m.total), "one structured record per figure in the catalog"),
      kpi("Piece carriers", fmt(m.carriers), `of ${fmt(m.buildWaveFigures)} figures in build waves, the catalog records a piece for these`),
      kpi("Exclusives recorded", fmt(m.exclusives), "figures whose record names an exclusive channel"),
      kpi("Recorded-absent fields", fmt(m.absentFields.length), "UPC / SKU, MSRP and accessories — named on every sheet, never invented"),
    ].join("");

    els.picker.innerHTML = m.records.map((r) =>
      `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)} — ${escapeHtml(r.wave.series)} (${r.year})</option>`).join("");
    els.picker.addEventListener("change", () => {
      const r = byId.get(els.picker.value);
      if (r) renderSheet(r);
    });
    if (m.records.length) {
      els.picker.value = m.records[0].id;
      renderSheet(m.records[0]);
    }

    els.coverage.innerHTML = `<ul class="db-rows">
      ${row("Records built from the catalog", `${fmt(m.total)} figures — every field above is a committed catalog field, copied verbatim`)}
      ${row("Variants recorded", `${fmt(m.variants)} figures carry a variant note in the catalog`)}
      ${row("Notes recorded", `${fmt(m.noted)} figures carry a catalog note`)}
      ${row("Sources named", `${fmt(m.sourced)} figures name a source in the catalog`)}
      ${row("The capture slot", "empty on every record today — the Drop Week capture attaches the first real asking prices, limits and ship dates there, without restructuring the record")}
    </ul>`;
  } catch (err) {
    els.error.hidden = false;
    els.error.textContent = "The spec sheets could not be built from the catalog. The archive itself is unaffected — try reloading the page.";
  }
}

main();
