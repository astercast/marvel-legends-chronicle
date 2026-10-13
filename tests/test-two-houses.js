/* The Two Houses — the makers' ledger (rotation 16 flagship).
   Guards:
   - a house is a distinct maker as the catalog records it (figures'
     manufacturer cross-checked against waves.json's on every wave)
   - the handover is clean: Toy Biz 2002–2006, Hasbro 2007–2026, no
     shared year, and the succession seam names the real closing and
     opening waves (Masterworks 2006 → the Annihilus Wave, 2007)
   - characters follow the debut ledger's rule (name minus
     parenthetical): 700 distinct, 117 debuting under Toy Biz and
     583 under Hasbro, 93 appearing under both houses
   - the houses partition the catalog: figures, waves, debuts and
     years all sum back to the archive's own totals
   - the page wiring: mounts, module, registry, and NO prices */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import { buildTwoHousesModel } from "../assets/js/two-houses-model.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const FIGS = [
  { id: "a1::Alpha", name: "Alpha", year: 2002, waveId: "a1", waveSeries: "Series 1", manufacturer: "Maker One", waveBaf: null, exclusive: null, variant: null },
  { id: "a1::Beta", name: "Beta (Classic)", year: 2002, waveId: "a1", waveSeries: "Series 1", manufacturer: "Maker One", waveBaf: null, exclusive: "Walmart", variant: null },
  { id: "a2::Beta", name: "Beta", year: 2003, waveId: "a2", waveSeries: "Series 2", manufacturer: "Maker One", waveBaf: "Giant", exclusive: null, variant: "Chase" },
  { id: "b1::Beta", name: "Beta", year: 2010, waveId: "b1", waveSeries: "Wave 1", manufacturer: "Maker Two", waveBaf: null, exclusive: null, variant: null },
  { id: "b1::Gamma", name: "Gamma", year: 2010, waveId: "b1", waveSeries: "Wave 1", manufacturer: "Maker Two", waveBaf: null, exclusive: "Target", variant: null },
];

suite("two-houses — the counting rules", () => {
  test("figures file under their maker; characters and debuts follow the debut rule", () => {
    const m = buildTwoHousesModel(FIGS);
    assert.equal(m.total, 2);
    assert.equal(m.figureCount, 5);
    assert.equal(m.waveCount, 3);
    assert.equal(m.characterCount, 3, "Alpha, Beta, Gamma — the parenthetical is not a second character");
    const one = m.houses.find((h) => h.name === "Maker One");
    const two = m.houses.find((h) => h.name === "Maker Two");
    assert.equal(one.figureCount, 3);
    assert.equal(one.characterCount, 2);
    assert.equal(one.debutCount, 2, "Alpha and Beta both first appear under Maker One");
    assert.equal(two.debutCount, 1, "Gamma debuts under Maker Two; Beta's return is not a debut");
    assert.equal(m.sharedCharacters, 1, "Beta appears under both houses");
    assert.equal(one.onlyCount, 1, "Alpha is Maker One's alone");
    assert.equal(two.onlyCount, 1, "Gamma is Maker Two's alone");
  });

  test("exclusives, variants, builds and the seam are counted from the record", () => {
    const m = buildTwoHousesModel(FIGS);
    const one = m.houses.find((h) => h.name === "Maker One");
    assert.equal(one.exclusiveCount, 1);
    assert.deepEqual(one.topChannels, [{ channel: "Walmart", count: 1 }]);
    assert.equal(one.variantCount, 1);
    assert.equal(one.builds, 1);
    assert.equal(one.bafWaveCount, 1);
    assert.equal(one.busiestYear.year, 2002);
    assert.equal(one.busiestYear.figures, 2);
    assert.equal(m.succession.length, 1);
    assert.equal(m.succession[0].closingWave.waveId, "a2");
    assert.equal(m.succession[0].openingWave.waveId, "b1");
    assert.deepEqual(m.span, [2002, 2010]);
  });
});

suite("two-houses — the real catalog", () => {
  const figures = JSON.parse(read("data/v1/figures.json"));
  const waves = JSON.parse(read("data/v1/waves.json"));
  const m = buildTwoHousesModel(figures);

  test("the figures' maker field and the waves' maker field agree on every wave", () => {
    for (const w of waves) {
      const makers = new Set(figures.filter((f) => f.waveId === w.id).map((f) => f.manufacturer));
      assert.equal(makers.size, 1, `${w.id}: one maker per wave in the figure record`);
      assert(makers.has(w.manufacturer), `${w.id}: figure record names the wave record's maker`);
    }
  });

  test("the census: two houses partition the line, 229 + 1,710 figures", () => {
    assert.equal(m.total, 2);
    assert.deepEqual(m.houses.map((h) => h.name), ["Toy Biz", "Hasbro"]);
    assert.equal(m.figureCount, 1939);
    assert.equal(m.waveCount, 167);
    assert.equal(m.characterCount, 700);
    const tb = m.houses[0];
    const hb = m.houses[1];
    assert.equal(tb.figureCount + hb.figureCount, 1939);
    assert.equal(tb.waveCount + hb.waveCount, 167);
    assert.equal(tb.debutCount + hb.debutCount, 700, "every character debuts under exactly one house");
    assert.equal(tb.figureCount, 229);
    assert.equal(hb.figureCount, 1710);
    assert.equal(tb.waveCount, 31);
    assert.equal(hb.waveCount, 136);
  });

  test("the handover is clean, and the seam names the real waves", () => {
    const tb = m.houses[0];
    const hb = m.houses[1];
    assert.deepEqual([tb.firstYear, tb.lastYear], [2002, 2006]);
    assert.deepEqual([hb.firstYear, hb.lastYear], [2007, 2026]);
    assert(tb.lastYear < hb.firstYear, "no year is shared between the houses");
    assert.equal(m.succession.length, 1);
    assert.equal(m.succession[0].closingWave.waveId, "toybiz-2006-masterworks");
    assert.equal(m.succession[0].openingWave.waveId, "hasbro-2007-annihilus");
    assert.deepEqual(m.span, [2002, 2026]);
  });

  test("each house's character, debut, exclusive and variant counts land true", () => {
    const tb = m.houses[0];
    const hb = m.houses[1];
    assert.equal(tb.characterCount, 117);
    assert.equal(hb.characterCount, 676);
    assert.equal(tb.debutCount, 117, "every Toy Biz character debuts under Toy Biz — it opened the line");
    assert.equal(hb.debutCount, 583);
    assert.equal(m.sharedCharacters, 93);
    assert.equal(tb.onlyCount, 24);
    assert.equal(hb.onlyCount, 583);
    assert.equal(tb.exclusiveCount, 30);
    assert.equal(hb.exclusiveCount, 559);
    assert.equal(tb.variantCount, 63);
    assert.equal(hb.variantCount, 31);
    assert.equal(tb.builds, 7);
    assert.equal(hb.builds, 95);
    assert.equal(tb.busiestYear.year, 2006);
    assert.equal(tb.busiestYear.figures, 95);
    assert.equal(hb.busiestYear.year, 2023);
    assert.equal(hb.busiestYear.figures, 181);
    assert.equal(tb.years.reduce((n, y) => n + y.figures, 0), 229, "the year table sums to the house");
    assert.equal(hb.years.reduce((n, y) => n + y.figures, 0), 1710);
  });
});

suite("two-houses — page wiring", () => {
  test("page mounts, module and registry", () => {
    const page = read("two-houses.html");
    for (const id of ["houses-kpis", "houses-front", "houses-years", "houses-seam", "houses-error"])
      assert(page.includes(`id="${id}"`), `mount #${id}`);
    assert(page.includes('src="assets/js/two-houses.js"'), "renderer module");
    assert(page.includes('href="two-houses.html"'), "footer registry carries the door");
    assert(page.includes("The Two Houses"), "directory carries the door");
    assert(read("scripts/nav_data.py").includes('"two-houses.html"'), "nav_data registry carries the door");
    assert.equal((page.match(/<h1/g) || []).length, 1, "exactly one <h1>");
  });

  test("no prices anywhere on the makers' ledger: the record, not the market", () => {
    for (const f of ["assets/js/two-houses.js", "assets/js/two-houses-model.js"]) {
      const src = read(f);
      assert(!/price/i.test(src.replace(/no prices/gi, "")), `${f} stays price-free`);
      assert(!/\$\d/.test(src), `${f} renders no currency amounts`);
    }
    assert(!/\$\d/.test(read("two-houses.html")), "the page itself quotes no prices");
  });
});
