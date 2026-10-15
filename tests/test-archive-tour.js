/* The Archive Tour — the guided museum tour (rotation 11 flagship).
   Guards:
   - the four chapter breaks and the partition of the archive
   - chapter counts counted from the catalog (fixture AND the real
     catalog's published chapter totals)
   - the curator-pick selection rules: opener, closer, BAF completers,
     first variant, first exclusive — deterministic, de-duplicated,
     and honestly empty when a rule finds nothing (the modern era's
     variant slot)
   - the page wiring: mounts, module, registry, and NO prices anywhere
*/
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import { buildTourModel, CHAPTERS, PICK_RULES } from "../assets/js/archive-tour-model.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

/* Fixture: waves are deliberately NOT in year order in the array —
   the earliest/latest rules must resolve by year, then catalog order. */
const WAVES = [
  { id: "w-late", series: "Late Wave", year: 2004, manufacturer: "Toy Biz", baf: null },
  { id: "w-first", series: "First Wave", year: 2002, manufacturer: "Toy Biz", baf: null },
  { id: "w-baf", series: "BAF Wave", year: 2005, manufacturer: "Toy Biz", baf: "Big Guy" },
  { id: "w-modern", series: "Modern Wave", year: 2021, manufacturer: "Hasbro", baf: "New Guy" },
];
const FIGURES = [
  { id: "w-late::LateOne", name: "LateOne", waveId: "w-late", waveSeries: "Late Wave", year: 2004, manufacturer: "Toy Biz", bafPiece: null, exclusive: null, variant: null, notes: "", waveBaf: null },
  { id: "w-first::Opener", name: "Opener", waveId: "w-first", waveSeries: "First Wave", year: 2002, manufacturer: "Toy Biz", bafPiece: null, exclusive: null, variant: null, notes: "", waveBaf: null },
  { id: "w-first::VarFig", name: "VarFig", waveId: "w-first", waveSeries: "First Wave", year: 2002, manufacturer: "Toy Biz", bafPiece: null, exclusive: null, variant: "Chase paint", notes: "", waveBaf: null },
  { id: "w-baf::PieceOne", name: "PieceOne", waveId: "w-baf", waveSeries: "BAF Wave", year: 2005, manufacturer: "Toy Biz", bafPiece: "Arm", exclusive: null, variant: null, notes: "", waveBaf: "Big Guy" },
  { id: "w-baf::Completer", name: "Completer", waveId: "w-baf", waveSeries: "BAF Wave", year: 2005, manufacturer: "Toy Biz", bafPiece: "Head", exclusive: "Walmart", variant: null, notes: "", waveBaf: "Big Guy" },
  { id: "w-modern::ModernOpener", name: "ModernOpener", waveId: "w-modern", waveSeries: "Modern Wave", year: 2021, manufacturer: "Hasbro", bafPiece: "Torso", exclusive: null, variant: null, notes: "", waveBaf: "New Guy" },
];

suite("archive-tour — chapters", () => {
  test("the four chapter breaks are the published ones", () => {
    assert.deepEqual(CHAPTERS.map((c) => c.years), [[2002, 2006], [2007, 2012], [2013, 2019], [2020, 2026]]);
    assert.deepEqual(CHAPTERS.map((c) => c.title), ["Toy Biz Twilight", "Hasbro's Early Years", "The Rebuild", "The Modern Era"]);
  });

  test("chapters partition the fixture archive exactly", () => {
    const m = buildTourModel(FIGURES, WAVES);
    assert.equal(m.partitioned, true);
    assert.equal(m.totals.figures, 6);
    assert.equal(m.totals.waves, 4);
    const ch1 = m.chapters[0];
    assert.equal(ch1.counts.waves, 3);
    assert.equal(ch1.counts.figures, 5);
    assert.equal(ch1.counts.bafWaves, 1);
    assert.equal(ch1.counts.exclusives, 1);
    assert.equal(ch1.counts.variants, 1);
  });

  test("per-year rows cover every year of the chapter, zeroes included", () => {
    const m = buildTourModel(FIGURES, WAVES);
    assert.equal(m.chapters[0].yearRows.length, 5, "2002–2006 is five rows");
    const y2003 = m.chapters[0].yearRows.find((r) => r.year === 2003);
    assert.equal(y2003.figures, 0);
    assert.equal(y2003.waves, 0);
  });
});

suite("archive-tour — curator pick rules", () => {
  test("opener and closer resolve by year, not array position", () => {
    const m = buildTourModel(FIGURES, WAVES);
    const picks = Object.fromEntries(m.chapters[0].picks.map((p) => [p.kind, p.figure.name]));
    assert.equal(picks.opener, "Opener", "earliest wave is 2002 First Wave, not the array-first 2004 wave");
    assert.equal(picks.closer, "PieceOne", "latest wave is the 2005 BAF Wave; its first figure opens the pick");
  });

  test("BAF completer is the last piece-carrier; a shared figure keeps one plate", () => {
    const m = buildTourModel(FIGURES, WAVES);
    const ch1 = m.chapters[0];
    const baf = ch1.picks.find((p) => p.kind === "baf-first");
    assert.equal(baf.figure.name, "Completer");
    assert.equal(baf.figure.bafPiece, "Head");
    /* Completer is also the chapter's first exclusive — de-duplicated:
       it hangs once, under the earlier BAF rule, and the exclusive rule
       is NOT reported empty (it found its figure; it shares the plate). */
    assert.equal(ch1.picks.filter((p) => p.figure.id === "w-baf::Completer").length, 1);
    assert(!ch1.emptyRules.some((r) => r.kind === "exclusive"), "exclusive rule found its figure");
    const variant = ch1.picks.find((p) => p.kind === "variant");
    assert.equal(variant.figure.name, "VarFig");
  });

  test("a rule that finds nothing is honestly empty — modern variant slot", () => {
    const m = buildTourModel(FIGURES, WAVES);
    const modern = m.chapters[3];
    assert(modern.emptyRules.some((r) => r.kind === "variant"), "no variants in the modern fixture chapter");
    assert(!modern.picks.some((p) => p.kind === "variant"), "and no variant pick is invented");
    assert.equal(PICK_RULES.length, 6, "six published rules");
  });

  test("the real catalog's chapter totals are the published ones", () => {
    const raw = JSON.parse(read("data/figures.json"));
    const waves = raw.waves;
    const figures = [];
    for (const w of waves) for (const f of w.figures ?? []) {
      figures.push({ id: `${w.id}::${f.name}`, waveId: w.id, waveSeries: w.series, year: w.year, manufacturer: w.manufacturer, waveBaf: w.baf ?? null, ...f });
    }
    const m = buildTourModel(figures, waves);
    assert.equal(m.partitioned, true);
    assert.deepEqual(m.chapters.map((c) => c.counts.figures), [229, 174, 581, 965]);
    assert.deepEqual(m.chapters.map((c) => c.counts.waves), [31, 25, 54, 57]);
    assert.deepEqual(m.chapters.map((c) => c.counts.bafWaves), [7, 12, 46, 38]);
    assert.deepEqual(m.chapters.map((c) => c.counts.exclusives), [30, 65, 178, 316]);
    assert.deepEqual(m.chapters.map((c) => c.counts.variants), [63, 27, 4, 0]);
    const modern = m.chapters[3];
    assert(modern.emptyRules.some((r) => r.kind === "variant"), "the real modern era records no variants");
    assert.equal(m.chapters[0].picks.find((p) => p.kind === "opener").figure.name, "Captain America");
  });
});

suite("archive-tour — page wiring", () => {
  test("the page exists with its mounts, module and method section", () => {
    const page = read("archive-tour.html");
    for (const id of ["tour-kpis", "tour-route", "tour-chapters", "tour-error", "how-picks-work"]) {
      assert(page.includes(`id="${id}"`), `mount #${id}`);
    }
    assert(page.includes('src="assets/js/archive-tour.js"'), "page module loaded");
    assert(page.includes("The Archive"), "page names itself");
  });

  test("the registry carries the new door in NAV and in The Archive hall", () => {
    const nav = read("scripts/nav_data.py");
    assert(nav.includes('("archive-tour.html", "Archive Tour")'), "NAV entry");
    assert(nav.includes('("archive-tour.html", "Archive Tour",'), "hall entry with blurb");
  });

  test("no prices anywhere on the tour: the record, not the market", () => {
    for (const f of ["assets/js/archive-tour.js", "assets/js/archive-tour-model.js"]) {
      const src = read(f);
      assert(!/\$\d/.test(src), `${f} renders no currency amounts`);
    }
    const page = read("archive-tour.html");
    assert(!/\$\d/.test(page), "the page itself quotes no prices");
  });
});
