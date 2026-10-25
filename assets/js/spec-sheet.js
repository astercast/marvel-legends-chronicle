/* The Spec Sheet, the per-figure structured spec record
   (ticket T-MARVEL-1). Pick any figure in the catalog and read
   its museum-vault spec sheet: every field the catalog actually
   records, verbatim, and the fields it does not record named as
   recorded-absent, never invented. The capture slot on each
   record stays empty until the Drop Week capture files real
   asking prices, limits and ship dates from the day itself. */
import { loadData } from "./data.js";
import { escapeHtml } from "./figure-dialog.js";
import { buildSpecSheetModel, SPEC_ABSENT_FIELDS } from "./spec-sheet-model.js";
import { loadFigureImages, plateFigureHtml, buyLinksHtml } from "./figure-images.js";

let images = new Map();

const els = {
  kpis: document.getElementById("spec-sheet-kpis"),
  picker: document.getElementById("spec-sheet-picker"),
  sheet: document.getElementById("spec-sheet-sheet"),
  coverage: document.getElementById("spec-sheet-coverage"),
  error: document.getElementById("spec-sheet-error"),
};

const fmt = (n) => n.toLocaleString("en-US");

function kpi(value, label) {
  return `<p class="census-line"><span class="census-value">${value}</span><span class="census-label">${label}</span></p>`;
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

const SITE_ORIGIN = "https://marvel-legends-chronicle-live.vercel.app";

/* The persistent URL is built on the object: the record page plus the
   catalog number itself as the fragment. The picker honours that
   fragment on load and rewrites it on change, so the URL printed on
   every record resolves to that record. */
function persistentUrl(id) {
  return `${SITE_ORIGIN}/spec-sheet#${encodeURIComponent(id)}`;
}

function catNo(id) {
  return `<span class="cat-no">${escapeHtml(id)}</span>`;
}

function recordSection(title, inner) {
  return `<section><h3>${escapeHtml(title)}</h3>${inner}</section>`;
}

/* The per-figure record, rebuilt in the museum order (R21):
   the object dominant in the viewport; directly with it, a
   TOMBSTONE LABEL (name and years; line; catalog number; year;
   variant note) BEFORE any prose; everything beyond those lines
   in a margin column as ONE fixed-order list (Identification,
   Creation, Material and technique, Subject, Acquisition and
   rights, Documentation, Persistent URL); provenance as one
   running prose chain inside the Catalogue Note, the headed
   essay room between the tombstone and the fact list; the
   catalog number printed three times in the identical .cat-no
   setting (tombstone, foot, citation / persistent URL line),
   and the house seal stamped at the foot beside the third
   printing, in red ink, present on arrival. */
function renderSheet(r) {
  const entry = images.get(r.id);
  const waveLine = `${r.wave.series}, ${r.manufacturer}`;
  const tombstone = `<div class="tombstone">
      <p class="tombstone-name">${escapeHtml(r.name)}</p>
      <p class="tombstone-line">${escapeHtml(waveLine)}</p>
      ${catNo(r.id)}
      <p class="tombstone-year">${r.year}</p>
      ${r.variant ? `<p class="tombstone-variant">Variant: ${escapeHtml(r.variant)}</p>` : ""}
    </div>`;
  const objectHtml = entry
    ? `${plateFigureHtml(entry, r.name, { maker: r.manufacturer, year: r.year, id: r.id, mark: "PLATE 1" })}${tombstone}`
    : `<div class="figure-typographic">${tombstone}<p class="record-provenance">No verified picture yet: this figure renders typographically, the archive's standard treatment, and is filed in the Visual Database's fill-in queue.</p></div>`;

  const buildValue = r.build.build
    ? (r.build.role === "piece-carrier"
      ? `${escapeHtml(r.build.build)}, and this figure carries: ${escapeHtml(r.build.piece)}`
      : `${escapeHtml(r.build.build)}, with no piece recorded for this figure`)
    : "No build: this figure's wave carries no Build-A-Figure";

  /* Provenance, where the catalog carries it, as one running chain
     of prose: source, exclusive channel, photograph, capture. */
  const chain = [];
  if (r.source) chain.push(`filed from ${escapeHtml(r.source)}`);
  if (r.exclusive) chain.push(`offered through ${escapeHtml(r.exclusive)}`);
  if (entry) chain.push(`Photo at ${escapeHtml(entry.imageSource)}, never copied into this archive`);
  if (r.capture) chain.push(`with a Drop Week capture on file`);
  const provenance = chain.length
    ? `<p class="record-provenance">Provenance: this record was ${chain.join("; ")}.</p>`
    : `<p class="record-provenance">Provenance: the catalog names no source for this figure, and this sheet invents none.</p>`;

  /* The Catalogue Note: a headed short prose essay in the Lot
     Essay position (Christie's anatomy), carrying the figure's
     story and the archive's position in the archive's voice.
     It is composed from the record's own matter: the provenance
     chain as prose, then the catalog's note where one stands. */
  const noteParas = [provenance
    .replace(/^<p class="record-provenance">Provenance: this record was /, "<p>This record was ")
    .replace(/^<p class="record-provenance">Provenance: the catalog names /, "<p>The catalog names ")];
  if (r.notes) noteParas.push(`<p>${escapeHtml(r.notes)}</p>`);
  const catalogueNote = `<div class="catalogue-note"><h2>Catalogue Note</h2>${noteParas.join("")}</div>`;

  const record = `<div class="record-list" role="list" aria-label="The record for ${escapeHtml(r.name)}">
    ${recordSection("Identification", `<p>${escapeHtml(r.name)}</p><p>Catalog number ${catNo(r.id)}</p>`)}
    ${recordSection("Creation", `<p>${escapeHtml(r.manufacturer)}, ${r.year}</p><p>Wave: <a href="waves/${escapeHtml(r.wave.id)}.html">${escapeHtml(r.wave.series)}</a></p><p>Build-A-Figure: ${buildValue}</p>`)}
    ${recordSection("Material and technique", `<p>Not recorded: the catalog holds no material or technique field for any figure, and this sheet names that absence rather than inventing one.</p>`)}
    ${recordSection("Subject", `<p>${escapeHtml(r.character)}</p>`)}
    ${recordSection("Acquisition and rights", `<p>${r.exclusive ? `Exclusive: ${escapeHtml(r.exclusive)}` : "No exclusive channel recorded for this figure."}</p>${entry ? buyLinksHtml(entry) : ""}<p>${entry ? `Photo at ${escapeHtml(entry.imageSource)}: the manufacturer's own photography stays at the retailer, linked from this sheet, never copied into this archive.` : "No photo yet for this figure."}</p>`)}
    ${recordSection("Documentation", `<p>${r.source ? `Source: ${escapeHtml(r.source)}` : "The catalog names no source for this figure."}</p><p>${r.capture ? `Capture: ${escapeHtml(JSON.stringify(r.capture))}` : "Capture: awaiting capture, no asking price, limit or ship date has been captured for this figure yet."}</p>${SPEC_ABSENT_FIELDS.map((f) => `<p>${escapeHtml(f.label)}: not recorded, ${escapeHtml(f.note)}</p>`).join("")}`)}
    ${recordSection("Persistent URL", `<p><a href="${escapeHtml(persistentUrl(r.id))}">${escapeHtml(persistentUrl(r.id))}</a></p>`)}
  </div>`;

  els.sheet.innerHTML = `<article class="figure-record">
      <div class="figure-object">${objectHtml}${catalogueNote}</div>
      <div class="figure-margin">${record}</div>
    </article>
    <footer class="record-foot">${catNo(r.id)}<p class="record-cite">Cite as: Marvel Legends Chronicle, catalog number ${escapeHtml(r.id)}, ${escapeHtml(r.name)}, ${escapeHtml(waveLine)}, ${r.year}.</p><span class="seal-stamp" aria-hidden="true"><span>R</span></span></footer>`;
  if ("replaceState" in history) history.replaceState(null, "", `#${encodeURIComponent(r.id)}`);
}

async function main() {
  try {
    const catalog = await loadData();
    try { images = await loadFigureImages(); } catch { images = new Map(); }
    const m = buildSpecSheetModel(catalog.figures);
    const byId = new Map(m.records.map((r) => [r.id, r]));

    els.kpis.innerHTML = [
      kpi(fmt(m.total), "spec records, one structured record per figure in the catalog"),
      kpi(fmt(m.carriers), `piece carriers, of ${fmt(m.buildWaveFigures)} figures in build waves`),
      kpi(fmt(m.exclusives), "exclusives recorded, figures whose record names an exclusive channel"),
      kpi(fmt(m.absentFields.length), "recorded-absent fields, UPC / SKU, MSRP and accessories, named on every sheet, never invented"),
    ].join("");

    els.picker.innerHTML = m.records.map((r) =>
      `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}, ${escapeHtml(r.wave.series)} (${r.year})</option>`).join("");
    els.picker.addEventListener("change", () => {
      const r = byId.get(els.picker.value);
      if (r) renderSheet(r);
    });
    if (m.records.length) {
      const fromHash = location.hash ? byId.get(decodeURIComponent(location.hash.slice(1))) : null;
      const first = fromHash || m.records[0];
      els.picker.value = first.id;
      renderSheet(first);
    }

    els.coverage.innerHTML = `<ul class="db-rows">
      ${row("Records built from the catalog", `${fmt(m.total)} figures, every field above is a committed catalog field, copied verbatim`)}
      ${row("Variants recorded", `${fmt(m.variants)} figures carry a variant note in the catalog`)}
      ${row("Notes recorded", `${fmt(m.noted)} figures carry a catalog note`)}
      ${row("Sources named", `${fmt(m.sourced)} figures name a source in the catalog`)}
      ${row("The capture slot", "empty on every record today. The Drop Week capture attaches the first real asking prices, limits and ship dates there, without restructuring the record")}
    </ul>`;
  } catch (err) {
    els.error.hidden = false;
    els.error.textContent = "The spec sheets could not be built from the catalog. The archive itself is unaffected; try reloading the page.";
  }
}

main();
