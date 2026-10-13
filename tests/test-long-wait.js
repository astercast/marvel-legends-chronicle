/* The Long Wait — the returns ledger (rotation 14 flagship).
   Guards:
   - the character rule is the archive's own (shared with the debut
     ledger, imported — not re-implemented)
   - a wait is the gap between consecutive releases; the longest wait
     names the exact figures on both sides of the silence
   - a one-figure character is still waiting, counted through the
     catalog's latest year, and never filed as returned
   - returned + waiting partition the distinct characters (fixture
     AND the real catalog: 700 = 273 returned + 427 waiting; the
     longest ended wait is H.E.R.B.I.E., 22 years, 2004 → 2026)
   - the page wiring: mounts, module, registry, and NO prices
   - view transitions (rotation 14 adoption): the vault-door block
     lives in the shared base.css, root-only, and stillness wins
     under both the OS preference and the manual toggle */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import { buildLongWaitModel } from "../assets/js/long-wait-model.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const FIGS = [
  { id: "w1::Alpha", name: "Alpha", year: 2002, waveId: "w1", waveSeries: "Series 1", manufacturer: "Toy Biz" },
  { id: "w1::Beta (Classic)", name: "Beta (Classic)", year: 2002, waveId: "w1", waveSeries: "Series 1", manufacturer: "Toy Biz" },
  { id: "w2::Alpha", name: "Alpha", year: 2005, waveId: "w2", waveSeries: "Series 2", manufacturer: "Toy Biz" },
  { id: "w3::Beta", name: "Beta", year: 2010, waveId: "w3", waveSeries: "Series 3", manufacturer: "Hasbro" },
  { id: "w3::Gamma", name: "Gamma", year: 2010, waveId: "w3", waveSeries: "Series 3", manufacturer: "Hasbro" },
  { id: "w4::Alpha", name: "Alpha", year: 2024, waveId: "w4", waveSeries: "Series 4", manufacturer: "Hasbro" },
];

suite("long-wait — the wait rules", () => {
  test("the longest wait is the largest gap between consecutive releases, parentheticals file under the base name", () => {
    const m = buildLongWaitModel(FIGS, new Set());
    const alpha = m.returned.find((c) => c.name === "Alpha");
    assert.equal(alpha.releases, 3);
    assert.equal(alpha.longestGap.years, 19, "2005 → 2024 beats 2002 → 2005");
    assert.equal(alpha.longestGap.fromYear, 2005);
    assert.equal(alpha.longestGap.toYear, 2024);
    assert.equal(alpha.longestGap.beforeFigure, "Alpha");
    assert.equal(alpha.longestGap.afterWaveSeries, "Series 4");
    const beta = m.returned.find((c) => c.name === "Beta");
    assert.equal(beta.longestGap.years, 8, "the (Classic) debut files under Beta");
    assert.equal(beta.debutFigure, "Beta (Classic)");
  });

  test("a one-figure character is still waiting, counted through the latest catalog year", () => {
    const m = buildLongWaitModel(FIGS, new Set());
    assert.equal(m.total, 3);
    assert.equal(m.returnedCount, 2);
    assert.equal(m.waitingCount, 1);
    const gamma = m.waiting[0];
    assert.equal(gamma.name, "Gamma");
    assert.equal(gamma.waitingYears, 14, "2010 → 2024, the fixture's latest year");
    assert.equal(m.latestYear, 2024);
    assert.equal(m.longest.name, "Alpha", "returned sorts by longest wait first");
  });

  test("a character page is linked only when the archive publishes one", () => {
    const m = buildLongWaitModel(FIGS, new Set(["gamma"]));
    assert.equal(m.waiting[0].hasPage, true);
    assert.equal(m.returned[0].hasPage, false);
  });
});

suite("long-wait — the real catalog", () => {
  const figures = JSON.parse(read("data/v1/figures.json"));
  const chars = JSON.parse(read("data/v1/characters.json"));
  const m = buildLongWaitModel(figures, new Set(chars.characters.map((c) => c.slug)));

  test("returned + waiting partition the catalog's distinct characters", () => {
    assert.equal(m.total, 700);
    assert.equal(m.returnedCount, 273);
    assert.equal(m.waitingCount, 427);
    assert.equal(m.returnedCount + m.waitingCount, m.total);
    assert.equal(m.returned.reduce((n, c) => n + c.releases, 0) +
                 m.waiting.reduce((n, c) => n + c.releases, 0), figures.length,
      "every figure is counted as a release of exactly one character");
    assert.equal(m.latestYear, 2026);
  });

  test("the longest ended wait in the line is H.E.R.B.I.E., 22 years", () => {
    assert.equal(m.longest.name, "H.E.R.B.I.E.");
    assert.equal(m.longest.longestGap.years, 22);
    assert.equal(m.longest.longestGap.fromYear, 2004);
    assert.equal(m.longest.longestGap.toYear, 2026);
    const toad = m.returned.find((c) => c.name === "Toad");
    assert.equal(toad.longestGap.years, 20, "Toad waited 2002 → 2022");
  });
});

suite("long-wait — page wiring", () => {
  test("page mounts, module and registry", () => {
    const page = read("long-wait.html");
    for (const id of ["wait-kpis", "wait-front", "wait-returned", "wait-waiting", "wait-error"])
      assert(page.includes(`id="${id}"`), `mount #${id}`);
    assert(page.includes('src="assets/js/long-wait.js"'), "renderer module");
    assert(page.includes('href="long-wait.html"'), "footer registry carries the door");
    assert(page.includes("The Long Wait"), "directory carries the door");
    assert(read("scripts/nav_data.py").includes('"long-wait.html"'), "nav_data registry carries the door");
    assert.equal((page.match(/<h1/g) || []).length, 1, "exactly one <h1>");
  });

  test("no prices anywhere on the returns ledger: the record, not the market", () => {
    for (const f of ["assets/js/long-wait.js", "assets/js/long-wait-model.js"]) {
      const src = read(f);
      assert(!/price/i.test(src.replace(/no prices/gi, "")), `${f} stays price-free`);
      assert(!/\$\d/.test(src), `${f} renders no currency amounts`);
    }
    assert(!/\$\d/.test(read("long-wait.html")), "the page itself quotes no prices");
  });
});

suite("view transitions — the vault door (rotation 14 adoption)", () => {
  const css = read("assets/css/base.css");

  test("cross-document transitions are opted in, root-only, in the shared stylesheet", () => {
    assert(css.includes("@view-transition { navigation: auto; }"), "opt-in present");
    assert(css.includes("::view-transition-old(root)"), "old root styled");
    assert(css.includes("::view-transition-new(root)"), "new root styled");
    assert(!/view-transition-name/.test(css), "no named elements — root-only by design");
  });

  test("stillness wins under the OS preference and the manual toggle", () => {
    assert(/@media \(prefers-reduced-motion: reduce\) \{\s*::view-transition-old\(root\), ::view-transition-new\(root\) \{ animation: none !important; \}/.test(css),
      "OS reduced-motion removes the transition animations");
    assert(css.includes('html[data-motion="reduce"] ::view-transition-old(root)'),
      "manual vault toggle removes the transition animations");
  });

  test("every page loads the shared stylesheet that carries the block", () => {
    assert(read("long-wait.html").includes('href="assets/css/base.css"'), "flagship loads base.css");
    assert(read("index.html").includes('href="assets/css/base.css"'), "homepage loads base.css");
  });
});
