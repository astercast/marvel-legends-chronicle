/* Wave 23: Rarity & variants guide tests.
   Guards the editorial source (data/rarity-guide.json), the generated page
   (rarity.html), the API payload (data/v1/rarity.json), and the wave-23 quest
   achievements. Every example id must resolve to a REAL archive figure. */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import { computeAchievements } from "../assets/js/quest-core.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const guide = JSON.parse(readFileSync(join(root, "data", "rarity-guide.json"), "utf8"));
const raw = JSON.parse(readFileSync(join(root, "data", "figures.json"), "utf8"));
const waves = new Map(raw.waves.map((w) => [w.id, w]));
const figIds = new Set();
for (const w of raw.waves) for (const f of w.figures) figIds.add(`${w.id}::${f.name}`);
const page = readFileSync(join(root, "rarity.html"), "utf8");
const api = JSON.parse(readFileSync(join(root, "data", "v1", "rarity.json"), "utf8"));

const URL_OK = /^(https?:\/\/[^\s'"<>]+|[a-z0-9_.-]+\.html(\?[^\s'"<>]*)?)$/;

suite("rarity editorial source (data/rarity-guide.json)", () => {
  test("9 tiers, unique ids, required fields", () => {
    assert.equal(guide.tiers.length, 9, "9 rarity tiers");
    const ids = guide.tiers.map((t) => t.id);
    assert.equal(new Set(ids).size, 9, "tier ids unique");
    for (const t of guide.tiers) {
      for (const k of ["id", "name", "icon", "tagline", "body", "howToSpot", "valueNote", "examples", "sources"])
        assert(t[k] !== undefined && t[k] !== null, `tier ${t.id} missing ${k}`);
      assert(t.body.length >= 1 && t.valueNote.length >= 1, `tier ${t.id} needs prose`);
    }
  });

  test("every example id resolves to a real archive figure", () => {
    const seen = [];
    for (const t of guide.tiers) {
      assert(t.examples.length >= 1, `tier ${t.id} needs an example`);
      for (const e of t.examples) {
        assert(figIds.has(e.id), `example id ${e.id} is not a real figure`);
        assert(e.note && e.note.length > 5, `example ${e.id} needs a note`);
        seen.push(e.id);
      }
    }
    // the guide's flagship examples must be present
    for (const must of ["toybiz-2003-series-5::Red Skull", "hasbro-2021-exclusives::Sentinel",
                        "hasbro-2022-exclusives::Galactus"]) {
      assert(seen.includes(must), `guide missing flagship example ${must}`);
    }
  });

  test("every source is labeled, noted, and URL-well-formed", () => {
    for (const t of guide.tiers) {
      for (const s of t.sources) {
        assert(s.label && s.note, `source in ${t.id} missing label/note`);
        assert(URL_OK.test(s.url), `bad source URL in ${t.id}: ${s.url}`);
      }
    }
    for (const c of guide.crossCutting) for (const l of c.links)
      assert(URL_OK.test(l.url), `bad cross link URL: ${l.url}`);
  });

  test("cross-cutting sections: 4, unique ids", () => {
    assert.equal(guide.crossCutting.length, 4);
    assert.equal(new Set(guide.crossCutting.map((c) => c.id)).size, 4);
  });
});

suite("rarity page (rarity.html)", () => {
  test("all 9 tier anchors + 4 cross-cutting anchors render", () => {
    for (const t of guide.tiers)
      assert(page.includes(`id="tier-${t.id}"`), `missing anchor tier-${t.id}`);
    for (const c of guide.crossCutting)
      assert(page.includes(`id="cc-${c.id}"`), `missing anchor cc-${c.id}`);
  });

  test("TOC links every tier and cross section", () => {
    for (const t of guide.tiers)
      assert(page.includes(`href="#tier-${t.id}"`), `TOC missing tier-${t.id}`);
    for (const c of guide.crossCutting)
      assert(page.includes(`href="#cc-${c.id}"`), `TOC missing cc-${c.id}`);
  });

  test("example links point at real wave pages", () => {
    for (const t of guide.tiers) for (const e of t.examples) {
      const wid = e.id.split("::")[0];
      assert(page.includes(`href="waves/${wid}.html"`), `no wave-page link for ${e.id}`);
      assert(existsSync(join(root, "waves", `${wid}.html`)), `wave page missing: ${wid}.html`);
    }
  });

  test("nav carries the Rarity Guide link; cross-links present", () => {
    assert(page.includes('href="rarity.html"'), "nav missing Rarity Guide");
    assert(page.includes('href="auth-wizard.html"'), "KO-spotter cross-link missing");
    assert(page.includes('href="market-briefing.html"'), "market briefing cross-link missing");
    assert(page.includes('href="gift.html?for=collector"'), "rarest-gift-picks link missing");
    assert(page.includes('href="data/v1/rarity.json"'), "API link missing");
  });

  test("a11y + perf basics", () => {
    assert(page.includes('aria-label="Rarity guide contents"'), "TOC needs an aria-label");
    assert(page.includes("prefers-reduced-motion"), "reduced-motion block required");
    assert(page.includes('lang="en"'), "lang required");
  });
});

suite("rarity API (data/v1/rarity.json)", () => {
  test("tiers is the first list (manifest-driven validator picks it)", () => {
    const firstList = Object.entries(api).find(([, v]) => Array.isArray(v))[0];
    assert.equal(firstList, "tiers", "tiers must be the first list in the envelope");
    assert.equal(api.tiers.length, 9);
  });

  test("tier records carry real figure refs with wave context", () => {
    for (const t of api.tiers) {
      assert(t.questAchievement === null || typeof t.questAchievement === "string", `questAchievement shape ${t.id}`);
      for (const e of t.examples) {
        assert(figIds.has(e.id), `API example id ${e.id} not real`);
        assert(e.waveId && e.wavePage === `waves/${e.waveId}.html`, `API wave context ${e.id}`);
        assert(Number.isInteger(e.year), `API year ${e.id}`);
      }
    }
  });

  test("archive counts match the real data", () => {
    const count = (fn) => raw.waves.reduce((n, w) => n + w.figures.filter(fn).length, 0);
    assert.equal(api.archiveCounts.chaseFlagged, count((f) => /chase/i.test(`${f.notes ?? ""} ${f.variant ?? ""}`)));
    assert.equal(api.archiveCounts.haslab, count((f) => f.exclusive === "HasLab"));
    assert.equal(api.archiveCounts.madeToOrder, count((f) => f.exclusive === "Made-to-order"));
    assert.equal(api.archiveCounts.sdcc, count((f) => f.exclusive === "San Diego Comic-Con"));
    assert.equal(api.archiveCounts.exclusiveFigures, count((f) => f.exclusive));
  });

  test("quest mapping covers the new achievements", () => {
    const m = Object.fromEntries(api.tiers.map((t) => [t.id, t.questAchievement]));
    assert.equal(m.chase, "chase-hunter");
    assert.equal(m.haslab, "haslab-backer");
    assert.equal(m["made-to-order"], "made-to-order");
    assert.equal(m.convention, "convention-floor");
  });
});

suite("wave-23 quest achievements", () => {
  const figs = raw.waves.flatMap((w) => w.figures.map((f) => ({
    id: `${w.id}::${f.name}`, waveId: w.id, waveSeries: w.series, year: w.year,
    manufacturer: w.manufacturer, ...f,
  })));
  const wvs = raw.waves;

  test("haslab-backer unlocks on a real HasLab figure", () => {
    const a = computeAchievements(figs, wvs, ["hasbro-2021-exclusives::Sentinel"]);
    const h = a.find((x) => x.id === "haslab-backer");
    assert(h, "haslab-backer exists");
    assert(h.unlocked, "owning the HasLab Sentinel unlocks it");
    const none = computeAchievements(figs, wvs, ["hasbro-2021-exclusives::Bastion"]);
    assert(none.find((x) => x.id === "haslab-backer").unlocked, "stretch-goal HasLab figures count too");
  });

  test("made-to-order unlocks on a real made-to-order figure", () => {
    const a = computeAchievements(figs, wvs, ["hasbro-2025-exclusives::Dragon Man"]);
    const m = a.find((x) => x.id === "made-to-order");
    assert(m && m.unlocked, "owning made-to-order Dragon Man unlocks it");
  });

  test("rarity-trifecta needs one of each tier", () => {
    const one = computeAchievements(figs, wvs, ["toybiz-2003-series-5::Red Skull"]);
    const t1 = one.find((x) => x.id === "rarity-trifecta");
    assert.equal(t1.got, 1, "chase alone = 1 tier");
    assert(!t1.unlocked, "locked at 1/3");
    const two = computeAchievements(figs, wvs,
      ["toybiz-2003-series-5::Red Skull", "hasbro-2007-sdcc::Stan Lee"]);
    assert.equal(two.find((x) => x.id === "rarity-trifecta").got, 2, "chase + con = 2 tiers");
    const all = computeAchievements(figs, wvs,
      ["toybiz-2003-series-5::Red Skull", "hasbro-2007-sdcc::Stan Lee", "hasbro-2022-exclusives::Galactus"]);
    const t3 = all.find((x) => x.id === "rarity-trifecta");
    assert(t3.unlocked && t3.got === 3, "chase + con + HasLab unlocks the trifecta");
  });
});
