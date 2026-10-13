/* The Build Ledger — the Build-A-Figure census (rotation 15 flagship).
   Guards:
   - a build is a distinct Build-A-Figure name as the catalog records
     it (figures' waveBaf cross-checked against waves.json's baf)
   - piece-carrying figures and distinct piece labels are counted
     apart and never merged (variant carriers share a label)
   - a build split across two waves is one build (Fin Fang Foom)
   - the catalog's gaps are filed as gaps: Bonebreaker records no
     piece assignments; Fin Fang Foom's second wave records none
   - the era chapters partition the builds (fixture AND the real
     catalog: 102 builds, 103 BAF waves, 663 piece-carrying figures
     of 741 figures in build waves, span 2005–2026)
   - the page wiring: mounts, module, registry, and NO prices */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import { buildBuildLedgerModel } from "../assets/js/build-ledger-model.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const FIGS = [
  { id: "w1::Alpha", name: "Alpha", year: 2005, waveId: "w1", waveSeries: "Series 1", manufacturer: "Toy Biz", waveBaf: "Giant", bafPiece: "Head" },
  { id: "w1::Beta", name: "Beta", year: 2005, waveId: "w1", waveSeries: "Series 1", manufacturer: "Toy Biz", waveBaf: "Giant", bafPiece: "Left arm" },
  { id: "w1::Beta (Variant)", name: "Beta (Variant)", year: 2005, waveId: "w1", waveSeries: "Series 1", manufacturer: "Toy Biz", waveBaf: "Giant", bafPiece: "Left arm" },
  { id: "w1::Gamma", name: "Gamma", year: 2005, waveId: "w1", waveSeries: "Series 1", manufacturer: "Toy Biz", waveBaf: "Giant", bafPiece: null },
  { id: "w2::Delta", name: "Delta", year: 2005, waveId: "w2", waveSeries: "Series 2", manufacturer: "Toy Biz", waveBaf: null, bafPiece: null },
  { id: "w3::Epsilon", name: "Epsilon", year: 2020, waveId: "w3", waveSeries: "Series 3", manufacturer: "Hasbro", waveBaf: "Split", bafPiece: "Torso" },
  { id: "w4::Zeta", name: "Zeta", year: 2020, waveId: "w4", waveSeries: "Series 4", manufacturer: "Hasbro", waveBaf: "Split", bafPiece: null },
  { id: "w5::Eta", name: "Eta", year: 2022, waveId: "w5", waveSeries: "Series 5", manufacturer: "Hasbro", waveBaf: "Silent", bafPiece: null },
];

suite("build-ledger — the counting rules", () => {
  test("piece-carrying figures and distinct piece labels are counted apart", () => {
    const m = buildBuildLedgerModel(FIGS);
    const giant = m.builds.find((b) => b.name === "Giant");
    assert.equal(giant.figureCount, 4);
    assert.equal(giant.carrierCount, 3, "three figures carry a piece, one carries none");
    assert.equal(giant.pieceCount, 2, "two carriers share the 'Left arm' label — labels are not merged into the carrier count");
    assert.deepEqual(giant.pieces, ["Head", "Left arm"]);
  });

  test("a build split across two waves is one build, and its pieceless wave is a filed gap", () => {
    const m = buildBuildLedgerModel(FIGS);
    assert.equal(m.total, 3);
    assert.equal(m.waveCount, 4, "Giant 1 + Split 2 + Silent 1");
    const split = m.builds.find((b) => b.name === "Split");
    assert.equal(split.waveCount, 2);
    assert.equal(split.carrierCount, 1);
    assert.deepEqual(m.unrecordedWaves.map((w) => w.waveId), ["w4", "w5"]);
    assert.deepEqual(m.unrecordedBuilds.map((b) => b.name), ["Silent"],
      "the wave-level gap for Split is not also filed as a build-level gap");
    assert.equal(m.byChapter.reduce((n, c) => n + c.builds.length, 0), m.total,
      "chapters partition the builds");
  });
});

suite("build-ledger — the real catalog", () => {
  const figures = JSON.parse(read("data/v1/figures.json"));
  const waves = JSON.parse(read("data/v1/waves.json"));
  const m = buildBuildLedgerModel(figures);

  test("the figures' BAF field and the waves' BAF field agree on every wave", () => {
    for (const w of waves) {
      const fromFigs = new Set(figures.filter((f) => f.waveId === w.id).map((f) => f.waveBaf));
      if (w.baf) assert(fromFigs.has(w.baf), `${w.id}: figures name its build`);
      else assert([...fromFigs].every((v) => v === null), `${w.id}: no build in either record`);
    }
  });

  test("the census: 102 builds across 103 BAF waves, 663 piece-carrying figures", () => {
    assert.equal(m.total, 102);
    assert.equal(m.waveCount, 103);
    assert.equal(waves.filter((w) => w.baf).length, 103, "the wave record agrees");
    assert.equal(m.figureCount, 741);
    assert.equal(m.carrierCount, 663);
    assert.deepEqual(m.span, [2005, 2026]);
    assert.equal(m.builds.reduce((n, b) => n + b.figureCount, 0), 741);
    assert.equal(m.byChapter.map((c) => c.builds.length).join(","), "7,11,46,38",
      "builds per era chapter, by first year");
  });

  test("the largest builds and the first build land true", () => {
    assert.equal(m.builds[0].name, "Galactus", "catalog order opens the ledger in 2005");
    assert.equal(m.largest[0].carrierCount, 12);
    assert.deepEqual(m.largest.slice(0, 2).map((b) => b.name).sort(), ["Giant-Man", "MODOK"],
      "Giant-Man and MODOK tie at twelve piece-carrying figures");
    const fff = m.builds.find((b) => b.name === "Fin Fang Foom");
    assert.equal(fff.waveCount, 2, "Fin Fang Foom was split across two 2008 waves");
    assert.equal(fff.figureCount, 18);
    assert.equal(fff.carrierCount, 9);
  });

  test("the gaps are filed as gaps, exactly as the catalog records them", () => {
    assert.deepEqual(m.unrecordedBuilds.map((b) => b.name), ["Bonebreaker"]);
    assert.deepEqual(m.unrecordedWaves.map((w) => w.waveId).sort(),
      ["hasbro-2008-sdcc-fff", "hasbro-2022-bonebreaker"]);
  });
});

suite("build-ledger — page wiring", () => {
  test("page mounts, module and registry", () => {
    const page = read("build-ledger.html");
    for (const id of ["build-kpis", "build-front", "build-chapters", "build-gaps", "build-error"])
      assert(page.includes(`id="${id}"`), `mount #${id}`);
    assert(page.includes('src="assets/js/build-ledger.js"'), "renderer module");
    assert(page.includes('href="build-ledger.html"'), "footer registry carries the door");
    assert(page.includes("The Build Ledger"), "directory carries the door");
    assert(read("scripts/nav_data.py").includes('"build-ledger.html"'), "nav_data registry carries the door");
    assert.equal((page.match(/<h1/g) || []).length, 1, "exactly one <h1>");
  });

  test("no prices anywhere on the build ledger: the record, not the market", () => {
    for (const f of ["assets/js/build-ledger.js", "assets/js/build-ledger-model.js"]) {
      const src = read(f);
      assert(!/price/i.test(src.replace(/no prices/gi, "")), `${f} stays price-free`);
      assert(!/\$\d/.test(src), `${f} renders no currency amounts`);
    }
    assert(!/\$\d/.test(read("build-ledger.html")), "the page itself quotes no prices");
  });
});
