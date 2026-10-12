/* Wave 30: The Launch Curve.
   - data/launch-curves.json integrity: unique ids; figId "<waveId>::<figureName>"
     resolves in data/figures.json; >=3 points; ISO dates ascending; numeric
     prices > 0; kinds in {sold, presale, asking}; well-formed source URLs;
     numeric msrp; well-formed events.
   - Pinned stats from real trackers: Gambit peak $79.99 on 2026-09-24, latest
     $25.99 on 2026-10-09; Cyclops peak $64.99 on 2026-09-25.
   - launchPrep() (Grail Quest 5.0, assets/js/preorders.js): fixture tests plus a
     pinned real-data run on 2026-10-12 (Doomsday W2 = 2d, X-Men '97 = 9d;
     Astonishing 16d excluded; YFNS sale-window Nov 1 = 20d excluded).
   - launch-curve.html: both curve sections present, SVG .curve-draw + pathLength,
     markers resolved, keyboard-focusable data points.
   - API manifest: 16 endpoints; launch-curves records == 2. */
"use strict";

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import { launchPrep, LAUNCH_PREP_STEPS } from "../assets/js/preorders.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const j = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const curvesDoc = j("data/launch-curves.json");
const curves = curvesDoc.curves;
const figRaw = j("data/figures.json");
const preorders = j("data/preorders.json").items;
const manifest = j("api/v1/index.json");
const page = readFileSync(join(ROOT, "launch-curve.html"), "utf8");

const waveById = new Map();
for (const w of figRaw.waves || []) waveById.set(w.id, w);

function resolves(figId) {
  const [waveId, name] = String(figId).split("::");
  const w = waveById.get(waveId);
  if (!w || !name) return false;
  return (w.figures || []).some((f) => f.name === name);
}

const URL_RE = /^https:\/\/[^\s"'<>]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KIND_OK = new Set(["sold", "presale", "asking"]);

suite("launch-curves: data integrity", () => {
  test("curve ids unique, >=3 points each", () => {
    const ids = curves.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate curve ids");
    for (const c of curves) assert((c.points || []).length >= 3, `${c.id}: fewer than 3 points`);
  });
  test("figIds resolve in figures.json", () => {
    for (const c of curves) assert(resolves(c.figId), `${c.id}: figId ${c.figId} does not resolve`);
  });
  test("points: ISO dates ascending, numeric prices > 0, known kinds", () => {
    for (const c of curves) {
      let prev = "";
      for (const p of c.points) {
        assert(DATE_RE.test(p.date), `${c.id}: bad date ${p.date}`);
        assert(p.date >= prev, `${c.id}: dates not ascending at ${p.date}`);
        prev = p.date;
        assert(typeof p.price === "number" && p.price > 0, `${c.id}: bad price ${p.price}`);
        assert(KIND_OK.has(p.kind), `${c.id}: bad kind ${p.kind}`);
      }
    }
  });
  test("msrp numeric, events well-formed with source URLs", () => {
    for (const c of curves) {
      assert(typeof c.msrp === "number" && c.msrp > 0, `${c.id}: bad msrp`);
      for (const e of c.events || []) {
        assert(DATE_RE.test(e.date) && typeof e.label === "string" && e.label.length > 0, `${c.id}: bad event`);
        assert(URL_RE.test(e.source.url), `${c.id}: bad event source URL ${e.source.url}`);
      }
    }
  });
  test("page: marker-based source URLs well-formed", () => {
    assert(page.includes("<!--LAUNCH-CURVES:START-->"), "start marker missing");
    assert(page.includes("<!--LAUNCH-CURVES:END-->"), "end marker missing");
    const between = page.split("<!--LAUNCH-CURVES:START-->")[1].split("<!--LAUNCH-CURVES:END-->")[0];
    assert(between.trim().length > 0, "empty markers");
    for (const u of between.match(/https:\/\/[^\s"'<>]+/g) || []) {
      assert(URL_RE.test(u), `bad URL in rendered section: ${u}`);
    }
  });
});

suite("launch-curves: pinned real-tracker stats", () => {
  const gambit = curves.find((c) => c.id === "doomsday-wave1-gambit");
  const cyclops = curves.find((c) => c.id === "doomsday-wave1-cyclops");
  test("Gambit: peak $79.99 on 2026-09-24, latest $25.99 on 2026-10-09", () => {
    assert(gambit, "gambit curve present");
    const sold = gambit.points.filter((p) => p.kind === "sold");
    const peak = sold.reduce((a, b) => (a.price >= b.price ? a : b));
    assert.equal(peak.price, 79.99);
    assert.equal(peak.date, "2026-09-24");
    const last = gambit.points[gambit.points.length - 1];
    assert.equal(last.price, 25.99);
    assert.equal(last.date, "2026-10-09");
  });
  test("Cyclops: peak $64.99 on 2026-09-25", () => {
    assert(cyclops, "cyclops curve present");
    const peak = cyclops.points.reduce((a, b) => (a.price >= b.price ? a : b));
    assert.equal(peak.price, 64.99);
    assert.equal(peak.date, "2026-09-25");
  });
});

suite("launchPrep: fixtures", () => {
  const item = (over = {}) => ({
    id: "x", name: "X", status: "preorder", preorderDate: null,
    releaseWindow: null, price: 27.99, query: "x", venue: null,
    details: null, retailers: [], sources: [], ...over,
  });
  test("includes windows within daysAhead, sorted by date", () => {
    const items = [
      item({ id: "a", name: "A", preorderDate: "2026-10-21" }),
      item({ id: "b", name: "B", preorderDate: "2026-10-14" }),
      item({ id: "c", name: "C", preorderDate: "2026-10-28" }), // 16d out
    ];
    const got = launchPrep(items, "2026-10-12");
    assert.deepEqual(got.map((q) => q.id), ["b", "a"], "sorted by date, 16d excluded");
    assert.deepEqual(got[0].steps, LAUNCH_PREP_STEPS);
    assert.equal(LAUNCH_PREP_STEPS.length, 5);
  });
  test("past windows excluded", () => {
    const items = [item({ id: "p", preorderDate: "2026-10-06" })];
    assert.equal(launchPrep(items, "2026-10-12").length, 0);
  });
  test("sale-window items included when in range", () => {
    const items = [
      { id: "yfns-spidey-rhino-2pack", name: "YFNS", status: "revealed", preorderDate: null,
        price: null, venue: "Pulse", retailers: [], sources: [] },
    ];
    const got = launchPrep(items, "2026-10-12", 30);
    assert.equal(got.length, 1);
    assert.equal(got[0].kind, "sale-window");
    assert.equal(got[0].days, 20, "Nov 1 is 20d out of default 14d window");
  });
});

suite("launchPrep: pinned real-data run on 2026-10-12", () => {
  test("Doomsday W2 = 2d, X-Men '97 = 9d; Astonishing 16d and YFNS 20d excluded", () => {
    const got = launchPrep(preorders, "2026-10-12");
    assert.deepEqual(got.map((q) => q.id), ["doomsday-wave-2", "xmen97-retro-wave"]);
    assert.equal(got[0].days, 2);
    assert.equal(got[1].days, 9);
    assert.equal(got[0].msrp, 27.99);
    assert(got[0].venue && got[0].venue.length > 0, "venue carried through");
    assert.deepEqual(got[0].steps, LAUNCH_PREP_STEPS);
  });
});

suite("launch-curve.html: rendered page", () => {
  test("both curve sections present", () => {
    for (const c of curves) {
      assert(page.includes(`aria-labelledby="curve-${c.id}"`), `${c.id}: section missing`);
      assert(page.includes(`id="curve-${c.id}"`), `${c.id}: heading missing`);
    }
  });
  test("SVG .curve-draw + pathLength present", () => {
    assert(page.includes('class="curve-draw"'), "curve-draw class missing");
    assert(page.includes('pathLength="1"'), "pathLength normalization missing");
  });
  test("data points keyboard-focusable with accessible labels", () => {
    assert(page.includes('tabindex="0"'), "no focusable points");
    const n = (page.match(/<circle[^>]*tabindex="0"[^>]*>/g) || []).length;
    const total = curves.reduce((s, c) => s + c.points.length, 0);
    assert.equal(n, total, `expected ${total} focusable points, got ${n}`);
  });
  test("page exists and nav link resolves", () => {
    assert(existsSync(join(ROOT, "launch-curve.html")), "launch-curve.html missing");
    const nav = readFileSync(join(ROOT, "index.html"), "utf8");
    assert(nav.includes("launch-curve.html"), "index nav missing launch-curve link");
  });
});

suite("api: launch-curves endpoint", () => {
  test("manifest registers 16 endpoints with launch-curves records == 2", () => {
    const names = Object.keys(manifest.endpoints);
    assert.equal(names.length, 16, `${names.length} endpoints`);
    assert.equal(manifest.endpoints["launch-curves"].records, 2);
  });
  test("api/v1/launch-curves.json has 2 curve records", () => {
    const api = j("api/v1/launch-curves.json");
    assert.equal(api.count, 2);
    assert.equal(api.curves.length, 2);
  });
});
