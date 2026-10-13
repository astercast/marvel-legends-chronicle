/* First Appearances — the debut ledger (rotation 13 flagship).
   Guards:
   - a character is the archive's own rule: name minus parenthetical
     (the same rule scripts/build_characters.py builds pages with)
   - the debut is the earliest figure, ties by catalog order, and it
     names the exact figure, wave and maker from the catalog
   - the four era chapters partition the debuts (fixture AND the real
     catalog: 700 distinct characters, span 2002-2026)
   - a character page is linked only when the archive publishes one
   - the page wiring: mounts, module, registry, and NO prices anywhere
*/
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import { buildDebutsModel, baseName, slugify } from "../assets/js/debuts-model.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const FIGS = [
  { id: "w1::Alpha", name: "Alpha", year: 2002, waveId: "w1", waveSeries: "Series 1", manufacturer: "Toy Biz" },
  { id: "w1::Beta (Classic)", name: "Beta (Classic)", year: 2002, waveId: "w1", waveSeries: "Series 1", manufacturer: "Toy Biz" },
  { id: "w2::Alpha", name: "Alpha", year: 2005, waveId: "w2", waveSeries: "Series 2", manufacturer: "Toy Biz" },
  { id: "w3::Beta", name: "Beta", year: 2010, waveId: "w3", waveSeries: "Series 3", manufacturer: "Hasbro" },
  { id: "w3::Gamma", name: "Gamma", year: 2010, waveId: "w3", waveSeries: "Series 3", manufacturer: "Hasbro" },
  { id: "w4::Delta", name: "Delta", year: 2024, waveId: "w4", waveSeries: "Series 4", manufacturer: "Hasbro" },
];

suite("debuts — the character rule", () => {
  test("baseName strips the parenthetical, nothing else", () => {
    assert.equal(baseName("Beta (Classic)"), "Beta");
    assert.equal(baseName("The Punisher"), "The Punisher");
    assert.equal(slugify("Captain America"), "captain-america");
  });

  test("the debut is the earliest figure, parenthetical variants file under the base name", () => {
    const m = buildDebutsModel(FIGS, new Set());
    const beta = m.debuts.find((d) => d.name === "Beta");
    assert.equal(beta.year, 2002);
    assert.equal(beta.figure, "Beta (Classic)", "the exact debut figure, as catalogued");
    assert.equal(beta.waveSeries, "Series 1");
    assert.equal(beta.manufacturer, "Toy Biz");
    assert.equal(beta.releases, 2, "both Beta releases counted");
    const alpha = m.debuts.find((d) => d.name === "Alpha");
    assert.equal(alpha.year, 2002);
    assert.equal(alpha.figureId, "w1::Alpha", "catalog order breaks the year tie");
  });

  test("debuts sort chronologically and the chapters partition them", () => {
    const m = buildDebutsModel(FIGS, new Set());
    assert.equal(m.total, 4);
    assert.deepEqual(m.debuts.map((d) => d.name), ["Alpha", "Beta", "Gamma", "Delta"]);
    const inChapters = m.byChapter.reduce((n, c) => n + c.debuts.length, 0);
    assert.equal(inChapters, m.total, "every debut in exactly one chapter");
    assert.equal(m.byChapter[0].debuts.length, 2, "Toy Biz Twilight holds the 2002 debuts");
    assert.equal(m.byChapter[3].debuts.length, 1, "the modern chapter holds Delta");
    assert.equal(m.latestYear, 2024);
    assert.deepEqual(m.latest.map((d) => d.name), ["Delta"]);
    assert.deepEqual(m.byYear, [
      { year: 2002, count: 2 }, { year: 2010, count: 1 }, { year: 2024, count: 1 },
    ]);
  });

  test("a character page is linked only when the archive publishes one", () => {
    const m = buildDebutsModel(FIGS, new Set(["alpha"]));
    assert.equal(m.debuts.find((d) => d.name === "Alpha").hasPage, true);
    assert.equal(m.debuts.find((d) => d.name === "Beta").hasPage, false);
  });
});

suite("debuts — the real catalog", () => {
  const figures = JSON.parse(read("data/v1/figures.json"));
  const chars = JSON.parse(read("data/v1/characters.json"));
  const m = buildDebutsModel(figures, new Set(chars.characters.map((c) => c.slug)));

  test("the model counts the catalog's distinct characters, no more, no fewer", () => {
    const distinct = new Set(figures.map((f) => baseName(f.name)));
    assert.equal(m.total, distinct.size);
    assert.equal(m.total, 700, "the catalog's 700 distinct characters");
    assert.deepEqual(m.span, [2002, 2026]);
    assert.equal(m.byChapter.reduce((n, c) => n + c.debuts.length, 0), 700);
    assert.equal(m.debuts.reduce((n, d) => n + d.releases, 0), figures.length,
      "every figure is counted as a release of exactly one character");
  });

  test("the first debut in the line is Series 1, 2002", () => {
    const cap = m.debuts.find((d) => d.name === "Captain America");
    assert.equal(cap.year, 2002);
    assert.equal(cap.figure, "Captain America");
    assert.equal(cap.waveSeries, "Series 1");
    assert.equal(cap.manufacturer, "Toy Biz");
    assert.equal(cap.hasPage, true, "Captain America has a character page");
    assert.equal(m.latestYear, 2026);
  });
});

suite("debuts — page wiring", () => {
  test("page mounts, module and registry", () => {
    const page = read("debuts.html");
    for (const id of ["debut-kpis", "debut-latest", "debut-chapters", "debut-years", "debut-error"])
      assert(page.includes(`id="${id}"`), `mount #${id}`);
    assert(page.includes('src="assets/js/debuts.js"'), "renderer module");
    assert(page.includes('href="debuts.html"'), "footer registry carries the door");
    assert(page.includes("First Appearances"), "directory carries the door");
    const nav = JSON.parse(JSON.stringify(read("scripts/nav_data.py")));
    assert(nav.includes('"debuts.html"'), "nav_data registry carries the door");
  });

  test("no prices anywhere on the debut ledger: the record, not the market", () => {
    for (const f of ["assets/js/debuts.js", "assets/js/debuts-model.js"]) {
      const src = read(f);
      assert(!/price/i.test(src.replace(/no prices/gi, "")), `${f} stays price-free`);
      assert(!/\$\d/.test(src), `${f} renders no currency amounts`);
    }
    assert(!/\$\d/.test(read("debuts.html")), "the page itself quotes no prices");
  });
});
