/* The Visual Database — the picture census (rotation 20 flagship,
   door 56). Guards:
   - a figure is pictured only when the manifest holds a verified
     entry for its catalog id; orphans are counted apart
   - the census lands true against the real catalog + manifest:
     pictured + unpictured = 1,939, every entry's figure exists,
     every URL is https, every pictured figure has a buy link
   - the fallback law is in the renderer: the plate's img removes
     its own plate on error; unpictured figures get no plate
   - the page wiring: mounts, module, registry — and no checkout,
     cart or on-site transaction anywhere on the desk */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import { buildVisualDatabaseModel } from "../assets/js/visual-database-model.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const j = (p) => JSON.parse(read(p));

const FIGS = [
  { id: "a::Alpha", name: "Alpha", year: 2024, waveId: "a", waveSeries: "Wave A", manufacturer: "Hasbro", waveBaf: null, exclusive: null },
  { id: "a::Beta", name: "Beta", year: 2024, waveId: "a", waveSeries: "Wave A", manufacturer: "Hasbro", waveBaf: null, exclusive: null },
  { id: "b::Gamma", name: "Gamma", year: 2025, waveId: "b", waveSeries: "Wave B", manufacturer: "Hasbro", waveBaf: null, exclusive: null },
];
const ENTRIES = [
  { figureId: "a::Alpha", imageUrl: "https://images.example.com/a.jpg", imageSource: "Example Store", buy: [{ retailer: "Example Store", url: "https://example.com/a", priceUSD: 27.99, priceSeen: "2026-10-13" }] },
  { figureId: "zz::Ghost", imageUrl: "https://images.example.com/x.jpg", imageSource: "Example Store", buy: [] },
];

suite("visual-database — the counting rules", () => {
  test("pictured follows the manifest; orphans counted apart", () => {
    const m = buildVisualDatabaseModel(FIGS, ENTRIES);
    assert.equal(m.total, 3);
    assert.equal(m.picturedCount, 1);
    assert.equal(m.unpicturedCount, 2);
    assert.equal(m.orphans, 1, "the ghost entry names no catalog figure");
    assert.equal(m.coveredWaves, 1, "only wave A holds a picture");
    assert.equal(m.completeWaves, 0, "wave A still misses Beta; wave B misses Gamma");
    assert.equal(m.priced, 1, "only Alpha's buy link carries a price");
  });

  test("the queue runs nearest-complete first, then most recent", () => {
    const m = buildVisualDatabaseModel(FIGS, ENTRIES);
    assert.deepEqual(m.queue.map((w) => w.waveId), ["b", "a"],
      "both waves miss exactly one figure, so the more recent year files first");
  });

  test("an empty manifest pictures nothing and queues everything", () => {
    const m = buildVisualDatabaseModel(FIGS, []);
    assert.equal(m.picturedCount, 0);
    assert.equal(m.queue.length, 2);
  });
});

suite("visual-database — the real manifest against the real catalog", () => {
  const figures = j("data/v1/figures.json");
  const doc = j("data/v1/figure-images.json");
  const m = buildVisualDatabaseModel(figures, doc.entries);

  test("the census sums back to the catalog", () => {
    assert.equal(m.total, 1939);
    assert.equal(m.picturedCount + m.unpicturedCount, 1939);
    assert.equal(m.picturedCount, doc.entries.length, "every filed entry pictures a real figure");
    assert.equal(m.orphans, 0, "no orphan entries in the filed manifest");
    assert(m.picturedCount >= 25, `pictured core holds ${m.picturedCount}`);
  });

  test("every entry is a verified embed with provenance and an outbound buy", () => {
    for (const e of doc.entries) {
      assert(e.imageUrl.startsWith("https://"), `${e.figureId} image is https`);
      assert(e.sourceUrl.startsWith("https://"), `${e.figureId} source is https`);
      assert(e.imageSource && e.rightsHolder, `${e.figureId} names its source and rights holder`);
      assert.equal(e.fallback, "typographic", `${e.figureId} falls back to type`);
      assert(Array.isArray(e.buy) && e.buy.length >= 1, `${e.figureId} has a place to buy`);
      for (const b of e.buy) {
        assert(b.url.startsWith("https://"), `${e.figureId} buy link is https`);
        if (typeof b.priceUSD === "number") assert(b.priceSeen, `${e.figureId} price is dated`);
      }
    }
  });
});

suite("visual-database — the fallback law and the wiring", () => {
  const kit = read("assets/js/figure-images.js");
  const page = read("visual-database.html");
  const script = read("assets/js/visual-database.js");

  test("a dead embed removes its own plate — no broken-image state exists", () => {
    assert(kit.includes("onerror=\"this.closest('.fig-plate').remove()\""),
      "the plate carries the self-removal handler");
    assert(kit.includes('loading="lazy"'), "pictures lazy-load");
    assert(!/placehold.co|via.placeholder|dummyimage/.test(kit), "no placeholder graphic service is ever substituted");
  });

  test("the desk is a database only — no cart, no checkout, no transaction", () => {
    for (const src of [page, script, kit]) {
      assert(!/add[- ]to[- ]cart|checkout|buy now/i.test(src), "no transaction language");
    }
    assert(page.includes("nothing is sold here"), "the page says so in plain words");
  });

  test("the page mounts the census blocks and its module", () => {
    for (const id of ["visual-database-kpis", "visual-database-core",
                      "visual-database-shelf", "visual-database-queue", "visual-database-error"]) {
      assert(page.includes(`id="${id}"`), `mount #${id}`);
    }
    assert(page.includes("assets/js/visual-database.js"), "module wired");
    assert(script.includes("buildVisualDatabaseModel"), "the page counts through the pure model");
    assert(script.includes("loadFigureImages"), "the page reads the manifest, not a hard-coded list");
  });
});
