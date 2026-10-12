/* Wave 2 (wow) — The Drawer Index tests.
   Full-text search across every vault drawer: pure ranking function,
   combobox keyboard/ARIA wiring, reduced-motion/mobile/no-JS posture. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import "./stubs.js";
import { searchDrawers } from "../assets/js/vault-room.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const page = read("vault-room.html");
const js = read("assets/js/vault-room.js");
const figures = JSON.parse(read("data/v1/figures.json"));

const stubFigs = [
  { id: "w1::Doctor Doom", name: "Doctor Doom", variant: null, exclusive: null, bafPiece: null, notes: "classic", waveId: "w1", waveSeries: "Epic Heroes", year: 2013, manufacturer: "Hasbro" },
  { id: "w2::Green Goblin", name: "Green Goblin", variant: "Ultimate", exclusive: "Target", bafPiece: "Sandman torso", notes: "mentions Doctor Doom nowhere", waveId: "w2", waveSeries: "Spider-Man Wave", year: 2017, manufacturer: "Hasbro" },
  { id: "w3::Nightcrawler", name: "Nightcrawler", variant: null, exclusive: null, bafPiece: null, notes: "blue fuzzy elf", waveId: "w3", waveSeries: "X-Men Wave", year: 2019, manufacturer: "Hasbro" },
];

suite("drawer search — pure ranking", () => {
  test("blank query returns nothing", () => {
    assert.deepEqual(searchDrawers(stubFigs, ""), []);
    assert.deepEqual(searchDrawers(stubFigs, "   "), []);
  });

  test("case-insensitive name match", () => {
    const r = searchDrawers(stubFigs, "NIGHTCRAWLER");
    assert.equal(r.length, 1);
    assert.equal(r[0].id, "w3::Nightcrawler");
  });

  test("AND semantics: every token must hit", () => {
    assert.equal(searchDrawers(stubFigs, "nightcrawler x-men").length, 1);
    assert.equal(searchDrawers(stubFigs, "nightcrawler target").length, 0);
  });

  test("name hits outrank notes hits", () => {
    const r = searchDrawers(stubFigs, "doom");
    assert.equal(r.length, 2);
    assert.equal(r[0].id, "w1::Doctor Doom"); // name hit (4) beats notes hit (1)
  });

  test("variant, exclusive, wave, BAF piece, year all searchable", () => {
    assert.equal(searchDrawers(stubFigs, "ultimate")[0].id, "w2::Green Goblin");
    assert.equal(searchDrawers(stubFigs, "target")[0].id, "w2::Green Goblin");
    assert.equal(searchDrawers(stubFigs, "spider-man wave")[0].id, "w2::Green Goblin");
    assert.equal(searchDrawers(stubFigs, "sandman torso")[0].id, "w2::Green Goblin");
    assert.equal(searchDrawers(stubFigs, "2019")[0].id, "w3::Nightcrawler");
  });

  test("limit is respected", () => {
    const r = searchDrawers(stubFigs, "a", 1);
    assert.equal(r.length, 1);
  });

  test("real data: 'nightcrawler' finds real drawers, ids resolve", () => {
    const r = searchDrawers(figures, "nightcrawler");
    assert(r.length >= 1, "at least one nightcrawler");
    const ids = new Set(figures.map((f) => f.id));
    for (const f of r) assert(ids.has(f.id), `unresolved id ${f.id}`);
    assert(r[0].name.toLowerCase().includes("nightcrawler"), "name hit first");
  });

  test("real data: 'galactus' BAF carriers surface", () => {
    const r = searchDrawers(figures, "galactus");
    assert(
      r.some((f) => (f.waveBaf || "").toLowerCase().includes("galactus")),
      "wave-BAF carriers found"
    );
  });

  test("real data: 'target' finds exclusives", () => {
    const r = searchDrawers(figures, "target");
    assert(r.length >= 1, "target exclusives found");
    assert(r.every((f) => JSON.stringify(f).toLowerCase().includes("target")), "all results mention target");
  });

  test("real data: full-archive search stays fast (<250ms)", () => {
    const t0 = Date.now();
    searchDrawers(figures, "spider man");
    assert(Date.now() - t0 < 250, "search too slow");
  });
});

suite("drawer search — page structure", () => {
  test("search section with combobox wiring", () => {
    assert(page.includes('id="drawer-search-form"'), "search form");
    assert(page.includes('role="search"'), "search landmark");
    assert(page.includes('id="drawer-search-input"'), "search input");
    assert(page.includes('role="combobox"'), "combobox role");
    assert(page.includes('aria-controls="drawer-search-results"'), "controls wiring");
    assert(page.includes('id="drawer-search-results"'), "results host");
    assert(page.includes('role="listbox"'), "listbox role");
    assert(page.includes('id="drawer-search-status"'), "status line");
    assert(page.includes('role="status"'), "status live region");
  });

  test("search section sits between hero and journey", () => {
    const hero = page.indexOf("vault-room-hero");
    const search = page.indexOf('class="drawer-index"');
    const journey = page.indexOf('id="journey"');
    assert(hero !== -1 && search !== -1 && journey !== -1, "all three present");
    assert(hero < search && search < journey, "hero → index → journey order");
  });

  test("no-JS fallback for the index", () => {
    const idx = page.indexOf('class="drawer-index"');
    const noscript = page.indexOf("<noscript>", idx);
    assert(noscript !== -1 && noscript < page.indexOf('id="journey"'), "noscript inside index section");
  });

  test("reduced-motion and mobile posture", () => {
    // The index is instant by design: no transitions/animations to gate.
    assert(!/drawer-search[^{]*\{[^}]*transition/.test(page), "no transitions on search chrome");
    assert(page.includes("#drawer-search-results[hidden]"), "hidden state styled");
  });
});

suite("drawer search — wiring", () => {
  test("combobox keyboard contract in the engine", () => {
    assert(js.includes("aria-activedescendant"), "active descendant tracking");
    assert(js.includes('aria-expanded", "true"') || js.includes("aria-expanded"), "expanded state");
    assert(js.includes("setTimeout(runSearch, 120)"), "debounced input");
    assert(js.includes('"Enter"') && js.includes("openResult"), "Enter opens a result");
    assert(js.includes('"Escape"'), "Escape clears");
    assert(js.includes('"mousedown"'), "click lands before blur hides");
  });

  test("results open the real drawer dialog", () => {
    assert(js.includes("initDrawerSearch(figures, yearByNum)"), "wired into init");
    assert(js.includes("openDrawer(fig, yearCtx, why)"), "reuses the archive-drawer dialog");
    assert(js.includes("spotlight"), "spotlight why carried into the dialog");
  });

  test("results capped for 60fps", () => {
    assert(js.includes("searchDrawers(figures, q, 51)"), "truncation probe");
    assert(js.includes("slice(0, 50)"), "50-row render cap");
  });
});
