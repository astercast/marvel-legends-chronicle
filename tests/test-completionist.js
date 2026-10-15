/* The Completionist — set-completion intelligence (rotation 12 flagship).
   Guards:
   - per-wave completion counted from the catalog (owned x of y), with
     the exact missing figures in catalog order
   - the nearest ledgers: one-away / two-away hold STARTED waves only —
     an unstarted small wave is not "two away", and a complete wave is
     finished, not nearest
   - completion by era in the Archive Tour's four chapters, partitioning
     the archive (fixture AND the real catalog's totals)
   - Wanted/Watching never complete a set; unresolved marks are counted
   - the honest empty state: no marks -> no nearest waves, and the
     preview describes the catalog's structure alone
   - the page wiring: mounts, module, registry, and NO prices anywhere
*/
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import { buildCompletionistModel } from "../assets/js/completionist-model.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

/* Fixture: three waves — 3 figures (2002), 2 figures (2007), 4 (2015). */
const FIGURES = [
  { id: "w-a::Alpha", name: "Alpha", waveId: "w-a", waveSeries: "Series A", year: 2002, manufacturer: "Toy Biz", bafPiece: null, exclusive: null, variant: null, notes: null, waveBaf: "Big Guy" },
  { id: "w-a::Beta", name: "Beta", waveId: "w-a", waveSeries: "Series A", year: 2002, manufacturer: "Toy Biz", bafPiece: "Arm", exclusive: null, variant: null, notes: null, waveBaf: "Big Guy" },
  { id: "w-a::Gamma", name: "Gamma", waveId: "w-a", waveSeries: "Series A", year: 2002, manufacturer: "Toy Biz", bafPiece: "Leg", exclusive: null, variant: null, notes: null, waveBaf: "Big Guy" },
  { id: "w-b::Delta", name: "Delta", waveId: "w-b", waveSeries: "Series B", year: 2007, manufacturer: "Hasbro", bafPiece: null, exclusive: null, variant: null, notes: null, waveBaf: null },
  { id: "w-b::Epsilon", name: "Epsilon", waveId: "w-b", waveSeries: "Series B", year: 2007, manufacturer: "Hasbro", bafPiece: null, exclusive: null, variant: null, notes: null, waveBaf: null },
  { id: "w-c::Zeta", name: "Zeta", waveId: "w-c", waveSeries: "Series C", year: 2015, manufacturer: "Hasbro", bafPiece: null, exclusive: null, variant: null, notes: null, waveBaf: null },
  { id: "w-c::Eta", name: "Eta", waveId: "w-c", waveSeries: "Series C", year: 2015, manufacturer: "Hasbro", bafPiece: null, exclusive: null, variant: null, notes: null, waveBaf: null },
  { id: "w-c::Theta", name: "Theta", waveId: "w-c", waveSeries: "Series C", year: 2015, manufacturer: "Hasbro", bafPiece: null, exclusive: null, variant: null, notes: null, waveBaf: null },
  { id: "w-c::Iota", name: "Iota", waveId: "w-c", waveSeries: "Series C", year: 2015, manufacturer: "Hasbro", bafPiece: null, exclusive: null, variant: null, notes: null, waveBaf: null },
];
const WAVES = [
  { id: "w-a", series: "Series A", year: 2002, manufacturer: "Toy Biz", figureCount: 3, baf: "Big Guy" },
  { id: "w-b", series: "Series B", year: 2007, manufacturer: "Hasbro", figureCount: 2, baf: null },
  { id: "w-c", series: "Series C", year: 2015, manufacturer: "Hasbro", figureCount: 4, baf: null },
];
const marks = (o = [], w = [], t = []) => ({ owned: new Set(o), wanted: new Set(w), watching: new Set(t) });

suite("completionist — per-wave completion", () => {
  test("rows count owned against the catalog, missing in catalog order", () => {
    const m = buildCompletionistModel(FIGURES, WAVES, marks(["w-a::Alpha", "w-a::Beta"], ["w-a::Gamma"], []));
    const a = m.byWave.find((r) => r.id === "w-a");
    assert.equal(a.owned, 2); assert.equal(a.total, 3); assert.equal(a.missingCount, 1);
    assert.deepEqual(a.missing.map((f) => f.name), ["Gamma"]);
    assert.equal(a.complete, false);
    assert(Math.abs(a.pct - 200 / 3) < 0.01, "pct is owned over total");
  });

  test("a wave is complete only when every figure is owned", () => {
    const m = buildCompletionistModel(FIGURES, WAVES, marks(["w-b::Delta", "w-b::Epsilon"], [], []));
    assert.deepEqual(m.completeWaves.map((r) => r.id), ["w-b"]);
    assert.equal(m.byWave.find((r) => r.id === "w-b").missingCount, 0);
  });

  test("wanted and watching never complete a set", () => {
    const m = buildCompletionistModel(FIGURES, WAVES, marks([], ["w-b::Delta"], ["w-b::Epsilon"]));
    const b = m.byWave.find((r) => r.id === "w-b");
    assert.equal(b.owned, 0); assert.equal(b.complete, false); assert.equal(b.touched, true);
    assert.equal(m.completeWaves.length, 0);
  });
});

suite("completionist — nearest ledgers", () => {
  test("one-away and two-away hold started waves, nearest first", () => {
    const m = buildCompletionistModel(FIGURES, WAVES, marks(
      ["w-a::Alpha", "w-a::Beta", "w-c::Zeta", "w-c::Eta"], [], []));
    assert.deepEqual(m.oneAway.map((r) => r.id), ["w-a"], "2 of 3 owned is one away");
    assert.deepEqual(m.twoAway.map((r) => r.id), ["w-c"], "2 of 4 owned is two away");
    assert.deepEqual(m.oneAway[0].missing.map((f) => f.name), ["Gamma"], "the exact missing figure");
  });

  test("an unstarted wave is never 'away', however small it is", () => {
    // w-b has only 2 figures: with nothing owned it is unstarted, not two away.
    // The one started wave (w-c, 1 of 4 owned) is three away — next-up, not nearest.
    const m = buildCompletionistModel(FIGURES, WAVES, marks(["w-c::Zeta"], [], []));
    assert.equal(m.oneAway.length + m.twoAway.length, 0);
    assert.deepEqual(m.nextUp.map((r) => r.id), ["w-c"], "the started wave waits in next-up");
    assert(!m.touchedWaves.some((r) => r.id === "w-b"), "untouched waves stay out of the ledger");
  });

  test("complete waves are finished, not nearest", () => {
    const m = buildCompletionistModel(FIGURES, WAVES, marks(
      ["w-a::Alpha", "w-a::Beta", "w-b::Delta", "w-b::Epsilon"], [], []));
    assert.deepEqual(m.oneAway.map((r) => r.id), ["w-a"]);
    assert(!m.oneAway.some((r) => r.id === "w-b") && !m.twoAway.some((r) => r.id === "w-b"));
  });
});

suite("completionist — completion by era", () => {
  test("eras are the Archive Tour chapters and partition the fixture archive", () => {
    const m = buildCompletionistModel(FIGURES, WAVES, marks(["w-a::Alpha", "w-a::Beta"], ["w-a::Gamma", "w-c::Zeta"], []));
    assert.equal(m.erasPartition, true);
    assert.deepEqual(m.byEra.map((e) => e.figures), [3, 2, 4, 0]);
    assert.deepEqual(m.byEra.map((e) => e.waves), [1, 1, 1, 0]);
    assert.equal(m.byEra[0].title, "Toy Biz Twilight");
    assert.equal(m.byEra[0].owned, 2);
    assert.equal(m.byEra[0].oneAway, 1, "the one-away wave lands in its era");
    assert.equal(m.byEra[2].wanted, 1);
    assert.equal(m.byEra[2].wavesTouched, 1);
  });

  test("the real catalog partitions: era figures and waves sum to the archive", () => {
    const raw = JSON.parse(read("data/figures.json"));
    const waves = raw.waves;
    const figures = [];
    for (const w of waves) for (const f of w.figures ?? []) {
      figures.push({ id: `${w.id}::${f.name}`, waveId: w.id, waveSeries: w.series, year: w.year, manufacturer: w.manufacturer, waveBaf: w.baf ?? null, ...f });
    }
    const m = buildCompletionistModel(figures, waves, marks());
    assert.equal(m.erasPartition, true);
    assert.deepEqual(m.byEra.map((e) => e.figures), [229, 174, 581, 965]);
    assert.deepEqual(m.byEra.map((e) => e.waves), [31, 25, 54, 57]);
    assert.equal(m.counts.totalFigures, 1949);
    assert.equal(m.counts.totalWaves, 170);
  });
});

suite("completionist — honesty", () => {
  test("empty marks: no nearest waves, preview from catalog structure alone", () => {
    const m = buildCompletionistModel(FIGURES, WAVES, marks());
    assert.equal(m.empty, true);
    assert.equal(m.oneAway.length, 0); assert.equal(m.twoAway.length, 0);
    assert.equal(m.touchedWaves.length, 0);
    assert.equal(m.preview.minWaveSize, 2); assert.equal(m.preview.maxWaveSize, 4);
    assert.deepEqual(m.preview.smallestWaves.map((w) => w.id), ["w-b", "w-a", "w-c"], "shortest sets first");
    assert.equal(m.preview.eras.length, 4);
  });

  test("marks for figures the archive no longer carries count as unresolved", () => {
    const m = buildCompletionistModel(FIGURES, WAVES, marks(["w-a::Alpha", "gone::Ghost"], [], []));
    assert.equal(m.counts.owned, 1);
    assert.equal(m.counts.unresolved, 1);
    assert.equal(m.empty, false);
  });
});

suite("completionist — page wiring", () => {
  test("the page exists with its mounts and module", () => {
    const page = read("completionist.html");
    for (const id of ["comp-empty", "comp-preview", "comp-dash", "comp-kpis", "comp-nearest", "comp-eras", "comp-ledger", "comp-error"]) {
      assert(page.includes(`id="${id}"`), `mount #${id}`);
    }
    assert(page.includes('src="assets/js/completionist.js"'), "page module loaded");
    assert(page.includes("Completionist"), "page names itself");
  });

  test("the registry carries the new door in NAV and in the Your Shelf hall", () => {
    const nav = read("scripts/nav_data.py");
    assert(nav.includes('("completionist.html", "The Completionist")'), "NAV entry");
    assert(nav.includes('("completionist.html", "The Completionist",'), "hall entry with blurb");
  });

  test("no prices anywhere on the completion desk: a ledger of sets, not a shopping list", () => {
    for (const f of ["assets/js/completionist.js", "assets/js/completionist-model.js"]) {
      const src = read(f);
      assert(!/price/i.test(src.replace(/no prices|prices anywhere/g, "")), `${f} stays price-free`);
      assert(!/\$\d/.test(src), `${f} renders no currency amounts`);
    }
    const page = read("completionist.html");
    assert(!/\$\d/.test(page), "the page itself quotes no prices");
  });
});
