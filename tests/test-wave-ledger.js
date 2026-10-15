/* The Wave Ledger — the waves census (rotation 18 flagship).
   Guards:
   - a wave is the catalog's own waveId: 170 distinct across
     1,949 figures, each size cross-checked against waves.json
   - the ledger's shape: the median and commonest wave is 7
     figures, the seven fixed bands summing back to both totals
   - the buckets land true (13 annual exclusives buckets holding
     890 figures; the bucket series whole 14 waves / 896) and the
     standard waves cap at 12, shared by exactly four waves
   - the page wiring: mounts, module, registry, and NO prices */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import { buildWaveLedgerModel } from "../assets/js/wave-ledger-model.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const FIGS = [
  { id: "a1::Alpha", name: "Alpha", year: 2002, waveId: "a1", waveSeries: "Series 1", manufacturer: "Toy Biz", waveBaf: null },
  { id: "a1::Beta", name: "Beta", year: 2002, waveId: "a1", waveSeries: "Series 1", manufacturer: "Toy Biz", waveBaf: null },
  { id: "a2::Gamma", name: "Gamma", year: 2003, waveId: "a2", waveSeries: "Series 2", manufacturer: "Toy Biz", waveBaf: "Build" },
  { id: "b1::Delta", name: "Delta", year: 2008, waveId: "b1", waveSeries: "Store & Convention Exclusives", manufacturer: "Hasbro", waveBaf: null },
  { id: "b1::Epsilon", name: "Epsilon", year: 2008, waveId: "b1", waveSeries: "Store & Convention Exclusives", manufacturer: "Hasbro", waveBaf: null },
  { id: "b1::Zeta", name: "Zeta", year: 2008, waveId: "b1", waveSeries: "Store & Convention Exclusives", manufacturer: "Hasbro", waveBaf: null },
];

suite("wave-ledger — the counting rules", () => {
  test("figures file under their wave; size is the figure count under its waveId", () => {
    const m = buildWaveLedgerModel(FIGS);
    assert.equal(m.figureCount, 6);
    assert.equal(m.waveCount, 3, "Series 1, Series 2, the bucket");
    assert.deepEqual(m.waves.map((w) => [w.waveId, w.size]), [["b1", 3], ["a1", 2], ["a2", 1]],
      "size desc, then earliest year, then catalog order");
    assert.equal(m.waves[2].hasBaf, true, "a wave carrying a build is marked");
    assert.equal(m.waves[0].hasBaf, false);
    assert.equal(m.median, 2, "the middle wave of 1, 2, 3");
    assert.equal(m.buckets.waves, 1, "the bucket is its exact series name");
    assert.equal(m.buckets.figures, 3);
    assert.equal(m.buckets.annualWaves, 0, "a 2008 bucket predates the annual run");
    assert.equal(m.standard.waves, 2);
    assert.equal(m.standard.ceiling, 2);
    assert.equal(m.standard.singleWaves.length, 1);
  });

  test("the bands partition the waves and sum back to both totals", () => {
    const m = buildWaveLedgerModel(FIGS);
    assert.equal(m.bands.length, 7, "the seven fixed bands");
    assert.equal(m.bands.reduce((n, b) => n + b.waves, 0), m.waveCount);
    assert.equal(m.bands.reduce((n, b) => n + b.figures, 0), m.figureCount);
    assert.equal(m.bands[0].waves, 1, "one single-figure wave in the fixture");
    assert.equal(m.bands[6].waves, 0, "empty bands are filed, not dropped");
  });
});

suite("wave-ledger — the real catalog", () => {
  const figures = JSON.parse(read("data/v1/figures.json"));
  const wavesJson = JSON.parse(read("data/v1/waves.json"));
  const m = buildWaveLedgerModel(figures);

  test("the waves cross-check: every wave's size matches waves.json, counts sum to the catalog", () => {
    assert.equal(wavesJson.length, 170);
    assert.equal(m.waveCount, 170);
    const byId = new Map(m.waves.map((w) => [w.waveId, w]));
    for (const w of wavesJson) {
      assert(byId.has(w.id), `${w.id}: wave in the flat list`);
      assert.equal(byId.get(w.id).size, w.figureCount, `${w.id}: figureCount matches the flat list`);
      assert.equal(byId.get(w.id).year, w.year, `${w.id}: year agrees`);
      assert.equal(byId.get(w.id).manufacturer, w.manufacturer, `${w.id}: manufacturer agrees`);
    }
    assert.equal(wavesJson.reduce((n, w) => n + w.figureCount, 0), figures.length,
      "waves.json figureCounts sum to the flat list");
  });

  test("the census: 170 waves across 1,949 figures, the typical wave at its true size", () => {
    assert.equal(m.figureCount, 1949);
    assert.equal(m.median, 7, "the median wave holds 7 figures");
    assert.deepEqual([m.mode.size, m.mode.waves], [7, 59], "7 is also the commonest size, 59 waves strong");
    assert.equal(m.buckets.figures + m.standard.figures, 1949);
    assert.equal(m.buckets.waves + m.standard.waves, 170);
  });

  test("the bands land true, band by band", () => {
    const got = m.bands.map((b) => [b.waves, b.figures]);
    assert.deepEqual(got, [[1, 1], [8, 20], [14, 61], [97, 641], [20, 173], [14, 153], [13, 890]],
      `bands: ${JSON.stringify(got)}`);
  });

  test("the buckets and the standard ceiling land true", () => {
    assert.deepEqual(
      [m.buckets.waves, m.buckets.figures, m.buckets.annualWaves, m.buckets.annualFigures,
       m.buckets.firstYear, m.buckets.lastYear],
      [14, 896, 13, 890, 2008, 2026],
      "the bucket series whole, and the annual run inside it");
    assert.deepEqual([m.standard.waves, m.standard.figures, m.standard.ceiling],
      [153, 1043, 12], "no standard wave holds more than 12 figures");
    assert.deepEqual(m.standard.ceilingWaves.map((w) => w.waveSeries),
      ["Giant-Man (Walmart Exclusive)", "Series 15 - MODOK", "Face-Off Series 1", "2-Packs Series 2"],
      "exactly four waves sit at the standard ceiling");
    assert.deepEqual(m.standard.singleWaves.map((w) => w.waveId),
      ["hasbro-2011-sdcc-thor"], "the only single-figure wave in the ledger");
    assert.equal(m.largest.length, 12, "the largest desk is 12 deep");
    assert(m.largest.every((w) => w.waveSeries === "Store & Convention Exclusives"),
      "every one of the twelve largest waves is an annual bucket");
    assert.deepEqual(m.largest.slice(0, 3).map((w) => [w.year, w.size]),
      [[2023, 113], [2025, 100], [2018, 97]], "the head of the ledger lands true");
  });
});

suite("wave-ledger — page wiring", () => {
  test("page mounts, module and registry", () => {
    const page = read("wave-ledger.html");
    for (const id of ["wave-ledger-kpis", "wave-ledger-largest", "wave-ledger-bands", "wave-ledger-buckets", "wave-ledger-error"])
      assert(page.includes(`id="${id}"`), `mount #${id}`);
    assert(page.includes('src="assets/js/wave-ledger.js"'), "renderer module");
    assert(page.includes('href="wave-ledger.html"'), "footer registry carries the door");
    assert(page.includes("The Wave Ledger"), "directory carries the door");
    assert(read("scripts/nav_data.py").includes('"wave-ledger.html"'), "nav_data registry carries the door");
    assert.equal((page.match(/<h1/g) || []).length, 1, "exactly one <h1>");
  });

  test("no prices anywhere on the ledger: the record, not the market", () => {
    for (const f of ["assets/js/wave-ledger.js", "assets/js/wave-ledger-model.js"]) {
      const src = read(f);
      assert(!/price/i.test(src.replace(/no prices/gi, "")), `${f} stays price-free`);
      assert(!/\$\d/.test(src), `${f} renders no currency amounts`);
    }
    assert(!/\$\d/.test(read("wave-ledger.html")), "the page itself quotes no prices");
  });
});
