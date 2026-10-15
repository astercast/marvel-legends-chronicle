/* The Year Ledger — the years census (rotation 19 flagship, door 54).
   Guards:
   - a year is the catalog's own year on each figure: 25 years,
     2002–2026 with no gap, cross-checked against waves.json
   - the census lands true: busiest 2023 (181), quietest 2011 (1),
     median year 71 figures, the six bands summing to both totals
   - the flood (9 years, 1,224 figures), the biggest rise
     (2017→2018, +71) and fall (2023→2024, −63)
   - the page wiring: mounts, module, registry, and NO prices */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import { buildYearLedgerModel } from "../assets/js/year-ledger-model.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const FIGS = [
  { id: "a::Alpha", name: "Alpha", year: 2002, waveId: "a", waveSeries: "Series 1", manufacturer: "Toy Biz", waveBaf: null, exclusive: null },
  { id: "a::Beta", name: "Beta (Suit)", year: 2002, waveId: "a", waveSeries: "Series 1", manufacturer: "Toy Biz", waveBaf: null, exclusive: "Walmart" },
  { id: "b::Alpha2", name: "Alpha", year: 2004, waveId: "b", waveSeries: "Series 2", manufacturer: "Toy Biz", waveBaf: "Build", exclusive: null },
  { id: "c::Gamma", name: "Gamma", year: 2004, waveId: "c", waveSeries: "Series 3", manufacturer: "Toy Biz", waveBaf: null, exclusive: null },
];

suite("year-ledger — the counting rules", () => {
  test("figures file under their year; waves, characters and debuts counted per year", () => {
    const m = buildYearLedgerModel(FIGS);
    assert.equal(m.figureCount, 4);
    assert.equal(m.yearCount, 2);
    assert.deepEqual(m.years.map((y) => [y.year, y.figures, y.waves, y.characters, y.debuts]),
      [[2002, 2, 1, 2, 2], [2004, 2, 2, 2, 1]],
      "Beta (Suit) files under Beta; Alpha's return is no debut");
    assert.equal(m.years[0].exclusives, 1);
    assert.equal(m.years[1].bafWaves, 1);
    assert.equal(m.median, 2);
    assert.equal(m.busiest.year, 2002, "ties hold the earliest year");
    assert.equal(m.biggestRise, null, "no rise in a flat fixture");
  });

  test("the bands partition the years and sum back to both totals", () => {
    const m = buildYearLedgerModel(FIGS);
    assert.equal(m.bands.length, 6, "the six fixed bands");
    assert.equal(m.bands.reduce((n, b) => n + b.years, 0), m.yearCount);
    assert.equal(m.bands.reduce((n, b) => n + b.figures, 0), m.figureCount);
  });
});

suite("year-ledger — the real catalog", () => {
  const figures = JSON.parse(read("data/v1/figures.json"));
  const wavesJson = JSON.parse(read("data/v1/waves.json"));
  const m = buildYearLedgerModel(figures);

  test("the years cross-check: waves.json agrees year by year, counts sum to the catalog", () => {
    assert.equal(m.figureCount, 1949);
    assert.equal(m.waveCount, 170);
    assert.equal(wavesJson.length, 170);
    for (const y of m.years) {
      const ws = wavesJson.filter((w) => w.year === y.year);
      assert.equal(y.waves, ws.length, `${y.year}: wave count matches waves.json`);
      assert.equal(y.figures, ws.reduce((n, w) => n + w.figureCount, 0),
        `${y.year}: figure count matches waves.json figureCounts`);
    }
  });

  test("the census: 25 years, 2002–2026, no gap year", () => {
    assert.equal(m.yearCount, 25);
    assert.equal(m.firstYear, 2002);
    assert.equal(m.lastYear, 2026);
    assert.deepEqual(m.years.map((y) => y.year),
      Array.from({ length: 25 }, (_, i) => 2002 + i), "every year of the span is present");
    assert.equal(m.years.reduce((n, y) => n + y.debuts, 0), 700,
      "the debuts across all years sum to the archive's 700 characters");
  });

  test("the shape lands true: median, bands, busiest and quietest", () => {
    assert.equal(m.median, 71, "the median year ships 71 figures");
    assert.deepEqual(m.bands.map((b) => [b.years, b.figures]),
      [[6, 99], [4, 170], [3, 190], [3, 264], [6, 731], [3, 495]],
      "band by band");
    assert.deepEqual([m.busiest.year, m.busiest.figures], [2023, 181], "the busiest year");
    assert.deepEqual([m.quietest.year, m.quietest.figures, m.quietest.waves], [2011, 1, 1],
      "2011 shipped a single figure in a single wave");
    const y2021 = m.years.find((y) => y.year === 2021);
    assert.equal(y2021.debuts, 76, "2021 is the biggest debut year");
    const y2002 = m.years.find((y) => y.year === 2002);
    assert.deepEqual([y2002.figures, y2002.waves, y2002.characters, y2002.debuts],
      [22, 4, 14, 14], "the opening year lands true");
  });

  test("the flood and the swings land true", () => {
    assert.deepEqual([m.flood.years, m.flood.figures, m.flood.firstYear, m.flood.lastYear],
      [9, 1226, 2018, 2026], "every year from 2018 on ships 100 figures or more");
    assert.deepEqual([m.biggestRise.fromYear, m.biggestRise.toYear, m.biggestRise.delta],
      [2017, 2018, 68], "the biggest rise");
    assert.deepEqual([m.biggestFall.fromYear, m.biggestFall.toYear, m.biggestFall.delta],
      [2023, 2024, -63], "the biggest fall");
  });
});

suite("year-ledger — page wiring", () => {
  test("page mounts, module and registry", () => {
    const page = read("year-ledger.html");
    for (const id of ["year-ledger-kpis", "year-ledger-ledger", "year-ledger-bands", "year-ledger-swings", "year-ledger-error"])
      assert(page.includes(`id="${id}"`), `mount #${id}`);
    assert(page.includes('src="assets/js/year-ledger.js"'), "renderer module");
    assert(page.includes('href="year-ledger.html"'), "footer registry carries the door");
    assert(page.includes("The Year Ledger"), "directory carries the door");
    assert(read("scripts/nav_data.py").includes('"year-ledger.html"'), "nav_data registry carries the door");
    assert.equal((page.match(/<h1/g) || []).length, 1, "exactly one <h1>");
  });

  test("no prices anywhere on the ledger: the record, not the market", () => {
    for (const f of ["assets/js/year-ledger.js", "assets/js/year-ledger-model.js"]) {
      const src = read(f);
      assert(!/price/i.test(src.replace(/no prices/gi, "")), `${f} stays price-free`);
      assert(!/\$\d/.test(src), `${f} renders no currency amounts`);
    }
    assert(!/\$\d/.test(read("year-ledger.html")), "the page itself quotes no prices");
    const src = read("assets/js/year-ledger.js");
    assert(!/toLocaleString\("en-US"\)\.format\(.*year/.test(src), "years are not thousands-formatted");
  });
});
