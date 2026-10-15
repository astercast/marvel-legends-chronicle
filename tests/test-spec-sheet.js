/* The Spec Sheet — the per-figure structured spec record
   (rotation 19, closing ticket T-MARVEL-1).
   Guards:
   - one record per figure (1,949), every field copied verbatim
     from the committed catalog — nothing derived by invention
   - the recorded-absent fields (UPC/SKU, MSRP, accessories) carry
     NO value on any record; they are named in `absent` only
   - the capture slot is null on every record (the Drop Week
     capture attaches there post-window, without restructuring)
   - coverage counts land true: 663 piece carriers of 741 build-
     wave figures, 589 exclusives, 94 variants, 1,683 notes,
     215 sources
   - the page wiring: mounts, picker, module, registry */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import { buildSpecSheetModel, buildSpecRecord, SPEC_ABSENT_FIELDS } from "../assets/js/spec-sheet-model.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

suite("spec-sheet — the record shape", () => {
  test("a record carries only catalog fields, verbatim, plus absent + capture slots", () => {
    const fig = { id: "w::F (Suit)", name: "F (Suit)", year: 2010, waveId: "w", waveSeries: "Wave 1",
      manufacturer: "Hasbro", waveBaf: "Build", bafPiece: "Arm", exclusive: "Target", variant: null, notes: "n", source: null };
    const r = buildSpecRecord(fig);
    assert.equal(r.character, "F", "character follows the debut ledger's rule");
    assert.deepEqual([r.build.build, r.build.piece, r.build.role], ["Build", "Arm", "piece-carrier"]);
    assert.equal(r.exclusive, "Target");
    assert.equal(r.variant, null, "unrecorded fields stay null, never invented");
    assert.deepEqual(r.absent, ["upc", "msrp", "accessories"]);
    assert.equal(r.capture, null, "the capture slot starts empty");
    assert(!("upc" in r) && !("msrp" in r) && !("accessories" in r) && !("price" in r),
      "no invented field carries a key, let alone a value");
  });

  test("roles separate carriers, build-wave figures and no-build figures", () => {
    const base = { name: "X", year: 2010, waveId: "w", waveSeries: "W", manufacturer: "Hasbro", exclusive: null, variant: null, notes: null, source: null };
    assert.equal(buildSpecRecord({ ...base, id: "1", waveBaf: "B", bafPiece: null }).build.role, "build-wave",
      "a build wave with no piece recorded says exactly that");
    assert.equal(buildSpecRecord({ ...base, id: "2", waveBaf: null, bafPiece: null }).build.role, "no-build");
  });
});

suite("spec-sheet — the real catalog (T-MARVEL-1 closure)", () => {
  const figures = JSON.parse(read("data/v1/figures.json"));
  const m = buildSpecSheetModel(figures);

  test("coverage: one spec record per figure — 0 → 1,949", () => {
    assert.equal(m.total, 1949);
    assert.equal(m.records.length, figures.length);
    assert.deepEqual(m.records.map((r) => r.id), figures.map((f) => f.id),
      "records cover every figure, in catalog order");
  });

  test("every record is verbatim: fields match the catalog figure exactly", () => {
    for (let i = 0; i < figures.length; i++) {
      const f = figures[i], r = m.records[i];
      assert.equal(r.name, f.name, `${f.id}: name`);
      assert.equal(r.wave.id, f.waveId, `${f.id}: wave id`);
      assert.equal(r.wave.series, f.waveSeries, `${f.id}: wave series`);
      assert.equal(r.year, f.year, `${f.id}: year`);
      assert.equal(r.manufacturer, f.manufacturer, `${f.id}: manufacturer`);
      assert.equal(r.build.build, f.waveBaf || null, `${f.id}: build`);
      assert.equal(r.build.piece, f.bafPiece || null, `${f.id}: piece`);
      assert.equal(r.exclusive, f.exclusive || null, `${f.id}: exclusive`);
      assert.equal(r.variant, f.variant || null, `${f.id}: variant`);
      assert.equal(r.notes, f.notes || null, `${f.id}: notes`);
      assert.equal(r.source, f.source || null, `${f.id}: source`);
    }
  });

  test("the filed gap stays a gap: absent fields valueless, capture slots empty", () => {
    assert.deepEqual(SPEC_ABSENT_FIELDS.map((f) => f.key), ["upc", "msrp", "accessories"],
      "the catalog holds no UPC/SKU, no MSRP, no accessory list (cycles 133–134)");
    const keyUnion = new Set();
    for (const f of figures) for (const k of Object.keys(f)) keyUnion.add(k);
    for (const k of ["upc", "sku", "msrp", "price", "accessories", "region"])
      assert(!keyUnion.has(k), `figures.json carries no ${k} key — the gap is real`);
    for (const r of m.records) {
      assert.equal(r.capture, null, `${r.id}: capture awaits the Drop Week capture`);
      assert.deepEqual(r.absent, ["upc", "msrp", "accessories"], `${r.id}: absent named`);
    }
  });

  test("coverage counts land true", () => {
    assert.deepEqual([m.carriers, m.buildWaveFigures, m.exclusives, m.variants, m.noted, m.sourced],
      [663, 741, 589, 94, 1683, 215], "carriers / build-wave / exclusives / variants / notes / sources");
  });
});

suite("spec-sheet — page wiring", () => {
  test("page mounts, picker, module and registry", () => {
    const page = read("spec-sheet.html");
    for (const id of ["spec-sheet-kpis", "spec-sheet-picker", "spec-sheet-sheet", "spec-sheet-coverage", "spec-sheet-error"])
      assert(page.includes(`id="${id}"`), `mount #${id}`);
    assert(page.includes('src="assets/js/spec-sheet.js"'), "renderer module");
    assert(page.includes('href="spec-sheet.html"'), "footer registry carries the door");
    assert(page.includes("The Spec Sheet"), "directory carries the door");
    assert(read("scripts/nav_data.py").includes('"spec-sheet.html"'), "nav_data registry carries the door");
    assert.equal((page.match(/<h1/g) || []).length, 1, "exactly one <h1>");
  });

  test("the renderer invents nothing: absent fields render as not recorded", () => {
    const src = read("assets/js/spec-sheet.js");
    assert(src.includes("Not recorded"), "absent fields are labelled, not filled");
    assert(!/\$\d/.test(src.replace(/\$27\.99/g, "")), "the renderer quotes no prices of its own");
    assert(!/\$\d/.test(read("spec-sheet.html")), "the page itself quotes no prices");
  });
});
