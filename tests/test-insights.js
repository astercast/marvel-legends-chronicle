/* Pinned-fixture tests for the Collection Insights dashboard (Grail Quest 4.0):
   completion math, duplicate detection, shelf-value ranges, milestone
   triggers, growth series, the markdown report, and the two new quest
   achievements — plus a pinned real-data run against data/figures.json +
   data/price-signals.json (every signal resolves; the multi-signal Doom
   band rule is pinned). */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import {
  completionByWave, completionByYear, characterCompletions, oneFigureAway,
  findDuplicateIds, shelfValueRange, growthSeries, growthByMonth,
  computeMilestones, buildCollectionReport,
} from "../assets/js/insights.js";
import {
  characterRuns, countCompletedBafs, computeAchievements,
} from "../assets/js/quest-core.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* Stub archive: w1 complete (3/3), w2 half (1/2), w3 (3/5), w4 (4/5).
   Spider-Man base name groups 5 archive releases, one missing. */
const waves = [
  {
    id: "w1", series: "X-Men '97 Wave 1", year: 2023, manufacturer: "Hasbro", baf: "The Adversary",
    figures: [
      { name: "Gambit", bafPiece: "Torso", notes: "" },
      { name: "Rogue", bafPiece: "Left Arm", notes: "" },
      { name: "Wolverine", bafPiece: "Right Arm", notes: "" },
    ],
  },
  {
    id: "w2", series: "X-Men '97 Wave 2", year: 2024, manufacturer: "Hasbro", baf: "The Adversary",
    figures: [
      { name: "Nightcrawler", bafPiece: "Torso", notes: "" },
      { name: "Jean Grey", bafPiece: "Left Leg", notes: "" },
    ],
  },
  {
    id: "w3", series: "Avengers", year: 2020, manufacturer: "Hasbro",
    figures: [
      { name: "Iron Man", notes: "" },
      { name: "Captain America", notes: "" },
      { name: "Thor", notes: "" },
      { name: "Hulk", notes: "" },
      { name: "Spider-Man", notes: "" },
    ],
  },
  {
    id: "w5", series: "Archive Filler", year: 2022, manufacturer: "Hasbro",
    figures: Array.from({ length: 60 }, (_, i) => ({ name: `Filler Figure ${i + 1}`, notes: "" })),
  },
  {
    id: "w4", series: "Spider-Verse", year: 2021, manufacturer: "Hasbro",
    figures: [
      { name: "Spider-Man (Miles Morales)", notes: "" },
      { name: "Spider-Man (Ben Reilly)", notes: "" },
      { name: "Spider-Man (Classic)", notes: "" },
      { name: "Spider-Man (2099)", notes: "" },
      { name: "Spider-Ham", notes: "" },
    ],
  },
];

function flatFigures(ws) {
  const out = [];
  for (const w of ws) {
    for (const f of w.figures) {
      out.push({
        id: `${w.id}::${f.name}`,
        waveId: w.id, waveSeries: w.series, year: w.year,
        manufacturer: w.manufacturer, waveBaf: w.baf ?? null,
        ...f,
      });
    }
  }
  return out;
}
const figures = flatFigures(waves);

const owned = [
  "w1::Gambit", "w1::Rogue", "w1::Wolverine",
  "w2::Nightcrawler",
  "w3::Iron Man", "w3::Captain America", "w3::Thor",
  "w4::Spider-Man (Miles Morales)", "w4::Spider-Man (Ben Reilly)",
  "w4::Spider-Man (Classic)", "w4::Spider-Man (2099)",
];

const signals = [
  { figId: "w1::Gambit", low: 10, high: 20, label: "sold-band", display: "$10–$20" },
  { figId: "w1::Gambit", low: 15, high: 30, label: "sold-band", display: "$15–$30" },
  { figId: "w3::Thor", low: 25, high: 40, label: "sold-band", display: "$25–$40" },
];

suite("completion by wave", () => {
  test("pct math and most-complete-first sorting", () => {
    const rows = completionByWave(figures, waves, owned);
    assert.equal(rows.length, 5);
    assert.equal(rows[4].waveId, "w5");
    assert.equal(rows[4].pct, 0);
    assert.equal(rows[0].waveId, "w1");
    assert.equal(rows[0].pct, 100);
    assert.equal(rows[1].waveId, "w4");
    assert.equal(rows[1].pct, 80);
    assert.equal(rows[2].waveId, "w3");
    assert.equal(rows[2].pct, 60);
    assert.equal(rows[3].waveId, "w2");
    assert.equal(rows[3].pct, 50);
  });

  test("got/total/missing fields", () => {
    const w4 = completionByWave(figures, waves, owned).find((r) => r.waveId === "w4");
    assert.equal(w4.got, 4);
    assert.equal(w4.total, 5);
    assert.equal(w4.missing, 1);
  });

  test("empty owned state -> every wave 0%", () => {
    for (const r of completionByWave(figures, waves, [])) {
      assert.equal(r.got, 0);
      assert.equal(r.pct, 0);
    }
  });
});

suite("completion by year", () => {
  test("per-year pct, ascending year order", () => {
    const rows = completionByYear(figures, owned);
    assert.deepEqual(rows.map((r) => r.year), [2020, 2021, 2022, 2023, 2024]);
    const y2020 = rows.find((r) => r.year === 2020);
    assert.equal(y2020.got, 3);
    assert.equal(y2020.total, 5);
    assert.equal(y2020.pct, 60);
    const y2023 = rows.find((r) => r.year === 2023);
    assert.equal(y2023.pct, 100);
  });
});

suite("character completions", () => {
  test("base-name grouping with the 5-release bar", () => {
    const rows = characterCompletions(figures, owned, 5);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, "Spider-Man");
    assert.equal(rows[0].got, 4);
    assert.equal(rows[0].total, 5);
    assert.equal(rows[0].pct, 80);
    assert.equal(rows[0].missingCount, 1);
  });

  test("missing lists the exact figure", () => {
    const rows = characterCompletions(figures, owned, 5);
    assert.equal(rows[0].missing.length, 1);
    assert.equal(rows[0].missing[0].name, "Spider-Man");
  });

  test("characterRuns helper agrees with the quest grouping", () => {
    const runs = characterRuns(figures, owned, 5);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].name, "Spider-Man");
    assert.equal(runs[0].got, 4);
  });
});

suite("gap analysis (one figure away)", () => {
  test("flags runs exactly one figure from complete", () => {
    const gaps = oneFigureAway(figures, owned, 5);
    assert.equal(gaps.length, 1);
    assert.equal(gaps[0].name, "Spider-Man");
    assert.equal(gaps[0].missing[0].name, "Spider-Man");
    assert.equal(gaps[0].missing[0].id, "w3::Spider-Man");
  });

  test("complete runs are not gaps", () => {
    const allSpidey = [...owned, "w3::Spider-Man"];
    assert.equal(oneFigureAway(figures, allSpidey, 5).length, 0);
  });
});

suite("duplicate detection", () => {
  test("finds ids logged twice or more, count-descending", () => {
    const dupes = findDuplicateIds([
      "w1::Gambit", "w1::Gambit", "w2::Nightcrawler",
      "w2::Nightcrawler", "w2::Nightcrawler", "w3::Thor",
    ]);
    assert.equal(dupes.length, 2);
    assert.equal(dupes[0].id, "w2::Nightcrawler");
    assert.equal(dupes[0].count, 3);
    assert.equal(dupes[1].id, "w1::Gambit");
    assert.equal(dupes[1].count, 2);
  });

  test("clean arrays and junk input -> empty", () => {
    assert.deepEqual(findDuplicateIds(["a", "b", "c"]), []);
    assert.deepEqual(findDuplicateIds(null), []);
    assert.deepEqual(findDuplicateIds([null, "", 42]), []);
  });
});

suite("shelf value (reported ranges only)", () => {
  test("sums bands; multi-signal figures span lowest-low to highest-high", () => {
    const shelf = shelfValueRange(figures, ["w1::Gambit", "w3::Thor", "w3::Hulk"], signals);
    assert.equal(shelf.covered, 2);
    assert.equal(shelf.uncovered, 1);
    assert.equal(shelf.low, 10 + 25); // Gambit min low 10, Thor 25
    assert.equal(shelf.high, 30 + 40); // Gambit max high 30, Thor 40
  });

  test("figures without signals are counted, never guessed", () => {
    const shelf = shelfValueRange(figures, ["w3::Hulk"], signals);
    assert.equal(shelf.covered, 0);
    assert.equal(shelf.uncovered, 1);
    assert.equal(shelf.low, 0);
    assert.equal(shelf.high, 0);
  });

  test("stale ids not in the archive are ignored", () => {
    const shelf = shelfValueRange(figures, ["nope::Ghost"], signals);
    assert.equal(shelf.covered, 0);
    assert.equal(shelf.uncovered, 0);
  });
});

suite("growth view", () => {
  const buys = [
    { date: "2026-03-05", price: 25 },
    { date: "2026-03-20", price: 30 },
    { date: "2026-04-02", price: 20 },
    { date: "nope", price: 5 },
    { date: "", price: 0 },
  ];

  test("cumulative points in date order, unparseable dates skipped+counted", () => {
    const g = growthSeries(buys);
    assert.equal(g.points.length, 3);
    assert.equal(g.skipped, 2);
    assert.deepEqual(g.points.map((p) => p.date), ["2026-03-05", "2026-03-20", "2026-04-02"]);
    assert.equal(g.points[2].totalCount, 3);
    assert.equal(g.points[2].totalSpend, 75);
    assert.equal(g.points[1].totalSpend, 55);
  });

  test("monthly buckets accumulate", () => {
    const m = growthByMonth(buys);
    assert.equal(m.length, 2);
    assert.equal(m[0].month, "2026-03");
    assert.equal(m[0].added, 2);
    assert.equal(m[0].spend, 55);
    assert.equal(m[1].month, "2026-04");
    assert.equal(m[1].totalCount, 3);
    assert.equal(m[1].totalSpend, 75);
  });

  test("empty ledger -> empty series", () => {
    const g = growthSeries([]);
    assert.deepEqual(g.points, []);
    assert.equal(g.skipped, 0);
  });
});

suite("milestones", () => {
  test("triggers fire on the right counts", () => {
    const ms = computeMilestones({ ownedCount: 10, completedBafs: 1, buys: [{}, {}, {}] });
    const byId = Object.fromEntries(ms.map((m) => [m.id, m]));
    assert(byId["first-figure"].unlocked, "first figure");
    assert(byId["shelf-10"].unlocked, "10th figure");
    assert(!byId["shelf-25"].unlocked, "25th not yet");
    assert.equal(byId["shelf-25"].detail, "10 of 25");
    assert(byId["first-baf"].unlocked, "first BAF");
    assert(byId["first-purchase"].unlocked, "first purchase");
    assert(!byId["ledger-10"].unlocked, "10 purchases not yet");
  });

  test("zero state -> nothing unlocked", () => {
    const ms = computeMilestones({ ownedCount: 0, completedBafs: 0, buys: [] });
    assert(ms.every((m) => !m.unlocked), "all locked at zero");
  });
});

suite("collection report", () => {
  test("report carries the honesty disclaimer and real numbers", () => {
    const ach = computeAchievements(figures, waves, owned, {});
    const ms = computeMilestones({ ownedCount: owned.length, completedBafs: 1, buys: [] });
    const report = buildCollectionReport({
      generatedAt: "2026-10-11", figures, waves, ownedIds: owned,
      signals, buys: [], achievements: ach, milestones: ms,
    });
    assert(report.includes("not a valuation"), "disclaimer present");
    assert(report.includes(`Figures owned: ${owned.length} of ${figures.length}`), "snapshot");
    assert(report.includes("Full waves completed: 1"), "completed wave count");
    assert(report.includes("$35.00–$70.00"), "shelf band");
    assert(report.includes("Spider-Man"), "gap analysis");
    assert(report.includes("w3::Spider-Man") || report.includes("Spider-Man"), "missing figure named");
    assert(report.includes("## Duplicates"), "duplicates section");
    assert(report.includes("## Milestones"), "milestones section");
    assert(report.includes("## Growth (since you started logging)"), "growth framing");
  });

  test("no owned figures -> honest empty sections, no invented numbers", () => {
    const report = buildCollectionReport({
      generatedAt: "2026-10-11", figures, waves, ownedIds: [],
      signals, buys: [], achievements: [], milestones: [],
    });
    assert(report.includes("Figures owned: 0 of"), "zero snapshot");
    assert(report.includes("No reported market data"), "no band invented");
  });
});

suite("quest-core: completed-BAF helper + new achievements", () => {
  test("countCompletedBafs counts the finished wave-1 Adversary only", () => {
    // w1 Adversary: Torso/Left Arm/Right Arm all owned -> complete.
    // w2 Adversary: Torso owned, Left Leg missing -> incomplete.
    assert.equal(countCompletedBafs(figures, waves, owned), 1);
  });

  test("character-loyalist unlocks on a full character run", () => {
    const allSpidey = [...owned, "w3::Spider-Man"];
    const ach = computeAchievements(figures, waves, allSpidey, {});
    const loyal = ach.find((a) => a.id === "character-loyalist");
    assert(loyal, "achievement exists");
    assert(loyal.unlocked, "unlocked with the full Spider-Man run");
  });

  test("character-loyalist locked one figure short", () => {
    const ach = computeAchievements(figures, waves, owned, {});
    const loyal = ach.find((a) => a.id === "character-loyalist");
    assert(loyal && !loyal.unlocked, "locked at 4/5");
  });

  test("archivist unlocks at 50 figures", () => {
    const big = Array.from({ length: 50 }, (_, i) => `w5::Filler Figure ${i + 1}`);
    const ach = computeAchievements(figures, waves, big, {});
    const arc = ach.find((a) => a.id === "archivist");
    assert(arc && arc.unlocked, "unlocked at 50");
    const small = computeAchievements(figures, waves, big.slice(0, 49), {});
    const arc2 = small.find((a) => a.id === "archivist");
    assert(arc2 && !arc2.unlocked, "locked at 49");
    assert.equal(arc2.got, 49);
  });

  test("completionist + build-a-master still exist (wave-29 spec mapping)", () => {
    const ach = computeAchievements(figures, waves, owned, {});
    const comp = ach.find((a) => a.id === "completionist");
    assert(comp && comp.unlocked, "completionist = 100% of a wave, unlocked via w1");
    const bam = ach.find((a) => a.id === "build-a-master");
    assert(bam && bam.unlocked, "build-a-master = first BAF, unlocked via w1 Adversary");
  });
});

suite("pinned real-data run (2026-10-11)", () => {
  const raw = JSON.parse(readFileSync(join(root, "data", "figures.json"), "utf8"));
  const rWaves = raw.waves;
  const rFigures = [];
  for (const w of rWaves) {
    for (const f of (w.figures ?? [])) {
      rFigures.push({ ...f, id: `${w.id}::${f.name}`, waveId: w.id, waveSeries: w.series, year: w.year, manufacturer: w.manufacturer });
    }
  }
  const rSignals = JSON.parse(readFileSync(join(root, "data", "price-signals.json"), "utf8")).signals;

  test("every reported signal resolves to a real archive figure", () => {
    const ids = new Set(rFigures.map((f) => f.id));
    for (const s of rSignals) {
      assert(ids.has(s.figId), `signal figId does not resolve: ${s.figId}`);
    }
  });

  test("Doom multi-signal band rule pinned: $40–$200 across both decos", () => {
    const doomId = "hasbro-2013-epic-heroes::Doctor Doom";
    const shelf = shelfValueRange(rFigures, [doomId], rSignals);
    assert.equal(shelf.covered, 1);
    assert.equal(shelf.low, 40); // green deco low
    assert.equal(shelf.high, 200); // white deco high
  });

  test("archive-scale sanity: 1904 figures, insights run in reasonable time", () => {
    const t0 = Date.now();
    const waveRows = completionByWave(rFigures, rWaves, []);
    const yearRows = completionByYear(rFigures, []);
    const charRows = characterCompletions(rFigures, [], 5);
    const gaps = oneFigureAway(rFigures, [], 5);
    assert.equal(waveRows.length, 158);
    assert(yearRows.length > 0, "year rows present");
    assert(charRows.length > 0, "character runs present");
    assert.deepEqual(gaps, [], "no gaps with an empty shelf");
    assert(Date.now() - t0 < 2000, "insights complete in under 2s on the full archive");
  });
});
