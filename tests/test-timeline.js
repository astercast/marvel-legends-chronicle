/* Wave 22: Legends Timeline tests.
   Guards the timeline data, its cross-references into the archive, the
   generated page markup, and the page-logic pure functions. */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import { eraOfYear, visibleYears, railStep, YEARS } from "../assets/js/timeline-page.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tl = JSON.parse(readFileSync(join(root, "data", "timeline.json"), "utf8"));
const raw = JSON.parse(readFileSync(join(root, "data", "figures.json"), "utf8"));
const waves = new Map(raw.waves.map((w) => [w.id, w]));
const figIds = new Set();
for (const w of raw.waves) for (const f of w.figures) figIds.add(`${w.id}::${f.name}`);
const page = readFileSync(join(root, "timeline.html"), "utf8");

suite("timeline data (data/timeline.json)", () => {
  test("covers 2002-2026 contiguously (25 years)", () => {
    assert.equal(tl.count, 25);
    assert.deepEqual(tl.years.map((y) => y.year), Array.from({ length: 25 }, (_, i) => 2002 + i));
    assert.equal(tl.yearMin, 2002);
    assert.equal(tl.yearMax, 2026);
  });

  test("year records have required fields and sane values", () => {
    for (const y of tl.years) {
      assert(typeof y.headline === "string" && y.headline.length > 0, `no headline ${y.year}`);
      assert(typeof y.summary === "string" && y.summary.length > 20, `short summary ${y.year}`);
      assert(y.era === "Toy Biz" || y.era === "Hasbro", `bad era ${y.year}`);
      assert(y.packaging === null || typeof y.packaging === "string", `bad packaging ${y.year}`);
      assert(Array.isArray(y.waves) && y.waves.length > 0, `no waves ${y.year}`);
      assert(Array.isArray(y.milestones), `no milestones array ${y.year}`);
      assert(Array.isArray(y.spotlight), `no spotlight array ${y.year}`);
    }
  });

  test("every year waves id resolves to the archive and the year matches", () => {
    for (const y of tl.years) {
      for (const w of y.waves) {
        const arch = waves.get(w.id);
        assert(arch, `unknown wave id ${w.id} (year ${y.year})`);
        assert.equal(arch.year, y.year, `year mismatch ${w.id}`);
        assert.equal(w.figureCount, arch.figures.length, `figureCount drift ${w.id}`);
        assert.equal(w.page, `waves/${w.id}.html`);
      }
    }
  });

  test("all 158 archive waves appear exactly once across the years", () => {
    const listed = tl.years.flatMap((y) => y.waves.map((w) => w.id));
    assert.equal(listed.length, raw.waves.length);
    assert.equal(new Set(listed).size, listed.length);
    for (const w of raw.waves) assert(listed.includes(w.id), `missing wave ${w.id}`);
  });

  test("every spotlight figure id resolves to a real archive figure", () => {
    for (const y of tl.years) {
      for (const s of y.spotlight) {
        assert(figIds.has(s.id), `unknown figure id ${s.id} (year ${y.year})`);
        assert.equal(s.page, `waves/${s.waveId}.html`);
        assert(typeof s.why === "string" && s.why.length > 0, `no why ${s.id}`);
      }
    }
  });

  test("every milestone has at least one labeled, well-formed source", () => {
    for (const y of tl.years) {
      for (const m of y.milestones) {
        assert(Array.isArray(m.sources) && m.sources.length > 0, `sourceless milestone ${y.year}: ${m.text.slice(0, 40)}`);
        for (const s of m.sources) {
          assert(typeof s.label === "string" && s.label.length > 0, `bad source label ${y.year}`);
          assert(/^https?:\/\//.test(s.url) || /^[a-z0-9_-]+\.html(#.*)?$/.test(s.url), `bad source url ${y.year}: ${s.url}`);
        }
      }
    }
  });

  test("packaging eras cover the five documented transitions", () => {
    assert.equal(tl.packagingEras.length, 5);
    const names = tl.packagingEras.map((e) => e.name);
    assert.deepEqual(names, ["Clamshell + comic", "Blister card", "Window box", "Plastic-free window box", "Retro blister + mini comic"]);
    for (const e of tl.packagingEras) {
      assert(e.sources.length > 0, `era without sources: ${e.name}`);
    }
  });
});

suite("timeline page (timeline.html)", () => {
  test("all 25 year sections exist with anchors", () => {
    for (let y = 2002; y <= 2026; y++) {
      assert(page.includes(`id="year-${y}"`), `missing section year-${y}`);
      assert(page.includes(`aria-labelledby="year-${y}-h"`), `missing labelledby year-${y}`);
    }
  });

  test("every wave link in the page resolves to a real file", () => {
    const refs = [...page.matchAll(/href="(waves\/[a-z0-9-]+\.html)"/g)].map((m) => m[1]);
    assert(refs.length > 150, `too few wave links: ${refs.length}`);
    for (const r of new Set(refs)) {
      assert(existsSync(join(root, r)), `broken wave link ${r}`);
    }
  });

  test("year rail has 25 year links and the era filter exists", () => {
    const rail = page.match(/<ul class="tl-rail" id="tl-rail">([\s\S]*?)<\/ul>/);
    assert(rail, "no year rail");
    const links = [...rail[1].matchAll(/href="#year-(\d{4})"/g)].map((m) => m[1]);
    assert.deepEqual(links, Array.from({ length: 25 }, (_, i) => String(2002 + i)));
    assert(page.includes('name="tl-era"'), "no era filter radios");
  });

  test("page is keyboard/accessibility-safe", () => {
    assert(page.includes('aria-current="page"'), "nav missing aria-current");
    assert(page.includes('class="skip-link"'), "no skip link");
    assert(page.includes("prefers-reduced-motion"), "no reduced-motion rule");
    assert(page.includes('aria-label="Jump to year"'), "rail missing label");
  });

  test("year content is static (works without JS)", () => {
    const unesc = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
    const text = unesc(page);
    for (const y of tl.years) {
      assert(text.includes(y.headline), `headline not in static HTML: ${y.headline}`);
      assert(text.includes(y.summary.slice(0, 60)), `summary not in static HTML: ${y.year}`);
    }
  });

  test("methodology + API cross-link present", () => {
    assert(page.includes('href="api/v1/timeline.json"'), "no api/v1/timeline.json link");
    assert(page.includes("encyclopedia.html#history") || page.includes("encyclopedia.html#retro-blisters-2026"), "no encyclopedia back-link");
  });
});

suite("timeline page logic (assets/js/timeline-page.js)", () => {
  test("YEARS is 2002-2026", () => {
    assert.deepEqual(YEARS, Array.from({ length: 25 }, (_, i) => 2002 + i));
  });

  test("eraOfYear splits at 2006/2007", () => {
    assert.equal(eraOfYear(2002), "toybiz");
    assert.equal(eraOfYear(2006), "toybiz");
    assert.equal(eraOfYear(2007), "hasbro");
    assert.equal(eraOfYear(2026), "hasbro");
  });

  test("visibleYears filters eras", () => {
    assert.equal(visibleYears("all").length, 25);
    assert.deepEqual(visibleYears("toybiz"), [2002, 2003, 2004, 2005, 2006]);
    assert.equal(visibleYears("hasbro").length, 20);
    assert.equal(visibleYears("bogus").length, 25);
  });

  test("railStep moves focus with arrows/Home/End and wraps", () => {
    const vis = [0, 1, 2, 3];
    assert.equal(railStep(1, "ArrowRight", vis), 2);
    assert.equal(railStep(1, "ArrowLeft", vis), 0);
    assert.equal(railStep(0, "ArrowLeft", vis), 3);
    assert.equal(railStep(3, "ArrowRight", vis), 0);
    assert.equal(railStep(2, "Home", vis), 0);
    assert.equal(railStep(2, "End", vis), 3);
    assert.equal(railStep(2, "Enter", vis), null);
    assert.equal(railStep(99, "ArrowRight", vis), null);
  });
});
