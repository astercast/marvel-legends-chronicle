/* The Roll Call — the returns census (rotation 17 flagship).
   Guards:
   - a character is the debut ledger's rule (name minus
     parenthetical): 700 distinct across 1,939 figures
   - the roll's shape: 427 characters called exactly once, 273
     returners holding 1,512 figures, the seven fixed bands
     summing back to both totals
   - the head of the roll lands true (Spider-Man 88 in 38 waves,
     Iron Man 77, Wolverine 56, Captain America 54; top ten 419)
   - every figure's waveId exists in waves.json, and waves.json's
     figureCounts sum to the figure total (the cross-check)
   - the page wiring: mounts, module, registry, and NO prices */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import { buildRollCallModel } from "../assets/js/roll-call-model.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const FIGS = [
  { id: "a1::Alpha", name: "Alpha", year: 2002, waveId: "a1", waveSeries: "Series 1" },
  { id: "a1::Beta", name: "Beta (Classic)", year: 2002, waveId: "a1", waveSeries: "Series 1" },
  { id: "a2::Beta", name: "Beta", year: 2003, waveId: "a2", waveSeries: "Series 2" },
  { id: "b1::Beta", name: "Beta", year: 2010, waveId: "b1", waveSeries: "Wave 1" },
  { id: "b1::Gamma", name: "Gamma", year: 2010, waveId: "b1", waveSeries: "Wave 1" },
];

suite("roll-call — the counting rules", () => {
  test("figures file under their character; the parenthetical is not a second character", () => {
    const m = buildRollCallModel(FIGS);
    assert.equal(m.figureCount, 5);
    assert.equal(m.characterCount, 3, "Alpha, Beta, Gamma");
    assert.deepEqual(m.roll.map((r) => r.name), ["Beta", "Alpha", "Gamma"],
      "count desc, then earliest year, then catalog order");
    const beta = m.roll[0];
    assert.equal(beta.count, 3);
    assert.equal(beta.firstYear, 2002);
    assert.equal(beta.lastYear, 2010);
    assert.equal(beta.waveCount, 3);
    assert.equal(m.singletons.characters, 2);
    assert.equal(m.returners.characters, 1);
    assert.equal(m.returners.figures, 3);
    assert.equal(m.topTenFigures, 5);
  });

  test("the bands partition the roll and sum back to both totals", () => {
    const m = buildRollCallModel(FIGS);
    assert.equal(m.bands.length, 7, "the seven fixed bands");
    assert.equal(m.bands.reduce((n, b) => n + b.characters, 0), m.characterCount);
    assert.equal(m.bands.reduce((n, b) => n + b.figures, 0), m.figureCount);
    assert.equal(m.bands[0].characters, 2, "two singletons in the fixture");
    assert.equal(m.bands[1].characters, 0, "empty bands are filed, not dropped");
  });
});

suite("roll-call — the real catalog", () => {
  const figures = JSON.parse(read("data/v1/figures.json"));
  const waves = JSON.parse(read("data/v1/waves.json"));
  const m = buildRollCallModel(figures);

  test("the waves cross-check: every figure's wave exists, counts sum to the catalog", () => {
    const byId = new Map(waves.map((w) => [w.id, w]));
    assert.equal(waves.length, 167);
    for (const f of figures) assert(byId.has(f.waveId), `${f.id}: wave ${f.waveId} in waves.json`);
    assert.equal(waves.reduce((n, w) => n + w.figureCount, 0), figures.length,
      "waves.json figureCounts sum to the flat list");
    for (const w of waves) {
      assert.equal(figures.filter((f) => f.waveId === w.id).length, w.figureCount,
        `${w.id}: figureCount matches the flat list`);
    }
  });

  test("the census: 700 characters across 1,939 figures, the tail at its true size", () => {
    assert.equal(m.figureCount, 1939);
    assert.equal(m.characterCount, 700);
    assert.equal(m.singletons.characters, 427, "427 characters called exactly once");
    assert.equal(m.singletons.figures, 427);
    assert.equal(m.returners.characters, 273);
    assert.equal(m.returners.figures, 1512);
    assert.equal(m.singletons.characters + m.returners.characters, 700);
    assert.equal(m.singletons.figures + m.returners.figures, 1939);
  });

  test("the bands land true, band by band", () => {
    const got = m.bands.map((b) => [b.characters, b.figures]);
    assert.deepEqual(got, [[427, 427], [115, 230], [76, 258], [51, 339], [21, 266], [6, 144], [4, 275]],
      `bands: ${JSON.stringify(got)}`);
  });

  test("the head of the roll lands true", () => {
    assert.deepEqual(m.top.slice(0, 4).map((r) => [r.name, r.count]),
      [["Spider-Man", 88], ["Iron Man", 77], ["Wolverine", 56], ["Captain America", 54]]);
    assert.equal(m.roll[0].waveCount, 38, "Spider-Man's 88 figures span 38 waves");
    assert.equal(m.roll[1].waveCount, 44, "Iron Man's 77 figures span 44 waves");
    assert.equal(m.topTenFigures, 419, "the top ten hold 419 figures");
    assert.equal(m.top.length, 25, "the head of the roll is 25 deep");
  });
});

suite("roll-call — page wiring", () => {
  test("page mounts, module and registry", () => {
    const page = read("roll-call.html");
    for (const id of ["roll-kpis", "roll-head", "roll-bands", "roll-tail", "roll-error"])
      assert(page.includes(`id="${id}"`), `mount #${id}`);
    assert(page.includes('src="assets/js/roll-call.js"'), "renderer module");
    assert(page.includes('href="roll-call.html"'), "footer registry carries the door");
    assert(page.includes("The Roll Call"), "directory carries the door");
    assert(read("scripts/nav_data.py").includes('"roll-call.html"'), "nav_data registry carries the door");
    assert.equal((page.match(/<h1/g) || []).length, 1, "exactly one <h1>");
  });

  test("no prices anywhere on the census: the record, not the market", () => {
    for (const f of ["assets/js/roll-call.js", "assets/js/roll-call-model.js"]) {
      const src = read(f);
      assert(!/price/i.test(src.replace(/no prices/gi, "")), `${f} stays price-free`);
      assert(!/\$\d/.test(src), `${f} renders no currency amounts`);
    }
    assert(!/\$\d/.test(read("roll-call.html")), "the page itself quotes no prices");
  });
});
