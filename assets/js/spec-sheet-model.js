/* spec-sheet-model.js, the pure math behind The Spec Sheet
   (spec-sheet.html), closing ticket T-MARVEL-1: the catalog's
   per-figure structured spec record. No DOM, no storage: given the
   catalog's flat figure list, it builds one spec record per figure
   from ONLY the fields the committed catalog actually holds.

   THE RECORD (v1, per figure):
     id, name           , the catalog's own figure identity
     character          , the debut ledger's rule (name minus
                           parenthetical, imported from
                           debuts-model.js, so the pages agree)
     wave { id, series }, the wave the figure files under
     year, manufacturer, the catalog's dating and maker
     build { build, piece, role }, the wave's Build-A-Figure name
                           and the piece this figure carries, both
                           verbatim from the catalog; role is
                           "piece-carrier" when a piece is recorded,
                           "build-wave" when the wave carries a build
                           but no piece is recorded for this figure,
                           "no-build" when the wave carries none
     exclusive, variant, notes, source, verbatim catalog fields,
                           null when the catalog records none

   RECORDED-ABSENT FIELDS: the catalog holds no UPC/SKU, no MSRP
   and no accessory list for any figure (verified against the
   committed figures.json key union, research cycles 133–134).
   Those fields are NEVER invented: every record names them in
   `absent` and carries no value for them.

   THE CAPTURE SLOT: every record carries `capture: null`. The
   Drop Week capture (first asking prices, per-door limits, ship
   dates, real captures only, supplied post-window) attaches
   there as { askingPrice, limit, shipDate, capturedAt, door }
   without restructuring the record; until a real capture exists
   the slot stays null and the sheet says so. */
import { baseName } from "./debuts-model.js";

export const SPEC_ABSENT_FIELDS = [
  { key: "upc", label: "UPC / SKU", note: "not recorded in the catalog" },
  { key: "msrp", label: "MSRP", note: "not recorded in the catalog; the Drop Week capture lane will file the first asking prices here, from real captures only" },
  { key: "accessories", label: "Accessories", note: "not recorded in the catalog" },
];

export function buildSpecRecord(fig) {
  const build = fig.waveBaf || null;
  const piece = fig.bafPiece || null;
  return {
    id: fig.id,
    name: fig.name,
    character: baseName(fig.name),
    wave: { id: fig.waveId, series: fig.waveSeries },
    year: fig.year,
    manufacturer: fig.manufacturer,
    build: {
      build,
      piece,
      role: piece ? "piece-carrier" : build ? "build-wave" : "no-build",
    },
    exclusive: fig.exclusive || null,
    variant: fig.variant || null,
    notes: fig.notes || null,
    source: fig.source || null,
    absent: SPEC_ABSENT_FIELDS.map((f) => f.key),
    capture: null,
  };
}

/* figures: the catalog's flat figure list. Returns { total,
   records, carriers, buildWaveFigures, exclusives, variants,
   noted, sourced, absentFields }, one record per figure, in
   catalog order, plus the coverage counts the desk reports. */
export function buildSpecSheetModel(figures) {
  const records = (figures || []).map(buildSpecRecord);
  return {
    total: records.length,
    records,
    carriers: records.filter((r) => r.build.role === "piece-carrier").length,
    buildWaveFigures: records.filter((r) => r.build.build).length,
    exclusives: records.filter((r) => r.exclusive).length,
    variants: records.filter((r) => r.variant).length,
    noted: records.filter((r) => r.notes).length,
    sourced: records.filter((r) => r.source).length,
    absentFields: SPEC_ABSENT_FIELDS,
  };
}
