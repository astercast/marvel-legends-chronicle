import { suite, test, assert } from "./assert.js";
import {
  runKey, baseName, isChase, isRetro, isToyBiz, isConventionExclusive,
  costTier, COST_TIER_LABELS, difficultyFor,
  generateQuests, recommendNext, computeAchievements,
  xpBreakdown, computeLevel, shareCardText, LEVELS,
} from "../assets/js/quest.js";

/* Stub archive — mimics data.js loadData() flattening (id = waveId::name). */
const waves = [
  {
    id: "w1", series: "X-Men '97 Wave 1", year: 2023, manufacturer: "Hasbro",
    baf: "The Adversary",
    figures: [
      { name: "Gambit", bafPiece: "Torso", notes: "" },
      { name: "Rogue", bafPiece: "Left Arm", notes: "" },
      { name: "Wolverine", bafPiece: "Right Arm", variant: "Brown costume", notes: "" },
      { name: "Magneto", notes: "Retro card" },
      { name: "Storm", notes: "" },
      { name: "Cyclops", exclusive: "Target", notes: "" },
    ],
  },
  {
    id: "w2", series: "X-Men '97 Wave 2", year: 2024, manufacturer: "Hasbro",
    baf: "The Adversary",
    figures: [
      { name: "Nightcrawler", bafPiece: "Torso", notes: "" },
      { name: "Jean Grey", bafPiece: "Left Leg", notes: "" },
      { name: "Beast", bafPiece: "Right Leg", notes: "" },
      { name: "Jubilee", notes: "" },
      { name: "Bishop", notes: "" },
      { name: "Morph", notes: "" },
    ],
  },
  {
    id: "w3", series: "Avengers", year: 2020, manufacturer: "Hasbro", baf: "Thanos",
    figures: [
      { name: "Iron Man", bafPiece: "Torso", notes: "" },
      { name: "Captain America", bafPiece: "Head", notes: "" },
      { name: "Thor", notes: "" },
      { name: "Hulk", notes: "" },
    ],
  },
  {
    id: "w4", series: "Series 2", year: 2002, manufacturer: "Toy Biz",
    figures: [
      { name: "Doombot", variant: "Chase-style variant", notes: "" },
      { name: "Red Skull", notes: "Chase-style; not pictured on packaging" },
      { name: "Spider-Man", notes: "Retro card" },
      { name: "Spider-Man", variant: "Symbiote", notes: "" },
      { name: "Spider-Man (Miles Morales)", notes: "" },
      { name: "Spider-Man (Ben Reilly)", notes: "" },
      { name: "Spider-Man (Classic)", notes: "" },
      { name: "Spider-Man 2099", notes: "" },
      { name: "Wolverine", exclusive: "San Diego Comic-Con", notes: "" },
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

suite("quest grouping helpers", () => {
  test("runKey collapses numbered wave suffixes", () => {
    assert.equal(runKey("X-Men '97 Wave 1"), "X-Men '97");
    assert.equal(runKey("X-Men '97 Wave 2"), "X-Men '97");
    assert.equal(runKey("Avengers"), "Avengers");
  });

  test("baseName strips parenthetical qualifiers like the character pages", () => {
    assert.equal(baseName("Spider-Man (Miles Morales)"), "Spider-Man");
    assert.equal(baseName("Wolverine"), "Wolverine");
  });

  test("isChase matches the archive's chase flag wording", () => {
    const doombot = figures.find((f) => f.id === "w4::Doombot");
    const gambit = figures.find((f) => f.id === "w1::Gambit");
    assert(isChase(doombot), "Doombot is chase-flagged");
    assert(!isChase(gambit), "Gambit is not chase-flagged");
  });

  test("isRetro follows the archive-notes gate", () => {
    assert(isRetro(figures.find((f) => f.id === "w1::Magneto")));
    assert(!isRetro(figures.find((f) => f.id === "w1::Storm")));
  });

  test("isToyBiz reads the manufacturer field", () => {
    assert(isToyBiz(figures.find((f) => f.id === "w4::Doombot")));
    assert(!isToyBiz(figures.find((f) => f.id === "w1::Gambit")));
  });

  test("isConventionExclusive matches con events only", () => {
    assert(isConventionExclusive(figures.find((f) => f.id === "w4::Wolverine")), "SDCC counts");
    assert(!isConventionExclusive(figures.find((f) => f.id === "w1::Cyclops")), "Target is retail, not a con");
  });

  test("costTier orders standard < box set < exclusive < made-to-order", () => {
    const std = figures.find((f) => f.id === "w1::Gambit");
    const retail = figures.find((f) => f.id === "w1::Cyclops");
    const mto = { ...std, exclusive: "Made-to-order" };
    assert(costTier(std) < costTier(retail), "standard cheaper than exclusive");
    assert(costTier(retail) < costTier(mto), "exclusive cheaper than made-to-order");
    assert.equal(COST_TIER_LABELS[costTier(std)], "Standard single");
  });

  test("difficultyFor tiers by missing count", () => {
    assert.equal(difficultyFor(1), "Quick win");
    assert.equal(difficultyFor(3), "Medium");
    assert.equal(difficultyFor(7), "Long haul");
  });
});

suite("quest generation", () => {
  test("no owned figures -> no quests", () => {
    assert.equal(generateQuests(figures, waves, []).length, 0);
  });

  test("BAF quest appears when started, sorted nearest-first", () => {
    // Adversary (w1): 3 pieces; own Torso + Left Arm (2 of 3, missing 1)
    // Thanos: 2 pieces; own Torso (1 of 2, missing 1) — tie on missing, smaller total first
    const owned = ["w1::Gambit", "w1::Rogue", "w3::Iron Man"];
    const bafs = generateQuests(figures, waves, owned).filter((q) => q.kind === "baf");
    assert.equal(bafs.length, 2);
    assert.equal(bafs[0].title, "Finish BAF: Thanos", "fewest missing sorts first");
    assert.equal(bafs[0].missingCount, 1);
    assert.equal(bafs[1].title, "Finish BAF: The Adversary (2023)", "repeat BAF names disambiguated by year");
    assert.equal(bafs[1].missingCount, 1);
    assert.equal(bafs[0].difficulty, "Quick win");
  });

  test("unstarted and completed BAFs are excluded", () => {
    const owned = []; // nothing started
    assert(generateQuests(figures, waves, owned).every((q) => q.kind !== "baf"));
    // complete Thanos: own both piece carriers
    const done = ["w3::Iron Man", "w3::Captain America"];
    const qs = generateQuests(figures, waves, done);
    assert(qs.every((q) => q.title !== "Finish BAF: Thanos"), "completed BAF is not a quest");
    assert(qs.some((q) => q.title === "Complete the Avengers run"), "but the wave run can still be open");
  });

  test("series runs group numbered waves", () => {
    const owned = ["w1::Gambit", "w2::Nightcrawler"];
    const qs = generateQuests(figures, waves, owned);
    const run = qs.find((q) => q.kind === "run");
    assert(run, "an X-Men '97 run quest exists");
    assert.equal(run.title, "Complete the X-Men '97 run");
    assert.equal(run.total, 12, "both waves grouped");
    assert.equal(run.got, 2);
    assert.equal(run.missingCount, 10);
  });

  test("character runs use the character-page base-name grouping, min 5 releases", () => {
    const owned = ["w4::Spider-Man", "w1::Wolverine", "w4::Wolverine"];
    const qs = generateQuests(figures, waves, owned);
    const spidey = qs.find((q) => q.kind === "character" && q.title.includes("Spider-Man"));
    assert(spidey, "Spider-Man run exists (5 releases incl. Miles/Ben/2099 variants)");
    assert.equal(spidey.total, 5, "variant rows count as separate releases, matching the archive");
    assert.equal(spidey.got, 2, "duplicate-id variant rows share one owned id");
    // Wolverine has 2 releases (< 5) -> no character quest
    assert(!qs.some((q) => q.kind === "character" && q.title.includes("Wolverine run")));
  });
});

suite("next-quest recommendations", () => {
  test("closest BAF is the one with fewest missing pieces", () => {
    const owned = ["w1::Gambit", "w1::Rogue", "w1::Wolverine", "w3::Iron Man"];
    const rec = recommendNext(figures, waves, owned, []);
    assert(rec.baf, "a BAF recommendation exists");
    assert.equal(rec.baf.title, "Finish BAF: Thanos");
    assert.equal(rec.baf.missingCount, 1);
  });

  test("cheapest missing piece uses the figure-type proxy", () => {
    const owned = ["w1::Gambit", "w1::Rogue", "w1::Wolverine", "w1::Magneto", "w1::Storm"];
    const rec = recommendNext(figures, waves, owned, []);
    assert(rec.cheapPiece, "a cheap-piece recommendation exists");
    assert(rec.cheapPiece.tier <= 2, `cheapest tier is ${rec.cheapPiece.tier}, expected standard/box`);
    assert(COST_TIER_LABELS[rec.cheapPiece.tier], "tier has an honest label");
  });

  test("watchlist grail picks the lowest reported sighting and flags it", () => {
    const watchlist = [
      { id: "a", figId: "w1::Cyclops", name: "Cyclops", sightings: [{ price: 40 }, { price: 25 }] },
      { id: "b", figId: "w4::Doombot", name: "Doombot", sightings: [{ price: 300 }] },
    ];
    const rec = recommendNext(figures, waves, ["w1::Gambit"], watchlist);
    assert(rec.grail, "a grail recommendation exists");
    assert.equal(rec.grail.entry.name, "Cyclops");
    assert.equal(rec.grail.price, 25);
    assert(rec.grail.reported, "sighting price is flagged as reported");
  });

  test("empty watchlist -> no grail recommendation", () => {
    const rec = recommendNext(figures, waves, ["w1::Gambit"], []);
    assert.equal(rec.grail, null);
  });
});

suite("achievements", () => {
  test("First Steps unlocks at 5 owned", () => {
    const a = computeAchievements(figures, waves, ["w1::Gambit", "w1::Rogue", "w1::Wolverine", "w1::Magneto", "w1::Storm"]);
    const fs = a.find((x) => x.id === "first-steps");
    assert(fs.unlocked, "5 owned unlocks First Steps");
    const locked = computeAchievements(figures, waves, ["w1::Gambit"]);
    assert(!locked.find((x) => x.id === "first-steps").unlocked, "1 owned stays locked");
    assert.equal(locked.find((x) => x.id === "first-steps").got, 1, "progress reported");
  });

  test("Chase Hunter needs the archive's chase-flagged figures", () => {
    const owned = ["w4::Doombot", "w4::Red Skull"];
    const a = computeAchievements(figures, waves, owned);
    const ch = a.find((x) => x.id === "chase-hunter");
    assert.equal(ch.need, 2, "archive flags 2 chase figures");
    assert(ch.unlocked, "both owned unlocks");
    const half = computeAchievements(figures, waves, ["w4::Doombot"]);
    assert(!half.find((x) => x.id === "chase-hunter").unlocked);
  });

  test("Build-A-Master unlocks on a completed BAF", () => {
    const owned = ["w3::Iron Man", "w3::Captain America"];
    const a = computeAchievements(figures, waves, owned);
    assert(a.find((x) => x.id === "build-a-master").unlocked);
    const partial = computeAchievements(figures, waves, ["w3::Iron Man"]);
    assert(!partial.find((x) => x.id === "build-a-master").unlocked);
  });

  test("Completionist unlocks on a fully-owned wave", () => {
    const w3ids = waves[2].figures.map((f) => `w3::${f.name}`);
    const a = computeAchievements(figures, waves, w3ids);
    assert(a.find((x) => x.id === "completionist").unlocked, "all 4 Avengers owned");
    const partial = computeAchievements(figures, waves, w3ids.slice(0, 3));
    assert(!partial.find((x) => x.id === "completionist").unlocked);
  });

  test("era/variant/retro/convention achievements count archive signals", () => {
    const owned = [
      "w4::Doombot", "w4::Red Skull", "w4::Spider-Man", "w4::Spider-Man (Miles Morales)",
      "w4::Spider-Man (Ben Reilly)", "w4::Spider-Man 2099", "w4::Wolverine",
      "w1::Wolverine", "w1::Magneto", "w1::Cyclops",
    ];
    const a = computeAchievements(figures, waves, owned);
    const tb = a.find((x) => x.id === "toy-biz-pioneer");
    assert.equal(tb.got, 8, "8 Toy Biz rows owned (variant rows count separately)");
    assert(!tb.unlocked, "needs 10");
    assert(a.find((x) => x.id === "variant-vault").got >= 2, "variant count uses the variant field");
    assert.equal(a.find((x) => x.id === "convention-floor").got, 1, "SDCC Wolverine counts");
    assert(!a.find((x) => x.id === "century-shelf").unlocked, "10 owned is not a century");
  });
});

suite("collector levels", () => {
  test("XP math is owned + 25/BAF + 10/achievement", () => {
    const bd = xpBreakdown(142, 3, 5);
    assert.equal(bd.total, 142 + 75 + 50);
    assert.equal(bd.fromOwned, 142);
    assert.equal(bd.fromBafs, 75);
    assert.equal(bd.fromAchievements, 50);
  });

  test("level titles step at 0/25/100/250/500", () => {
    assert.equal(computeLevel(0, 0, 0).title, "Rookie");
    assert.equal(computeLevel(24, 0, 0).title, "Rookie");
    assert.equal(computeLevel(25, 0, 0).title, "Collector");
    assert.equal(computeLevel(90, 0, 1).title, "Archivist", "90 + 10 achievement XP = 100");
    assert.equal(computeLevel(200, 2, 0).title, "Curator", "200 + 50 BAF XP = 250");
    assert.equal(computeLevel(400, 4, 0).title, "Living Legend", "400 + 100 = 500");
    assert.equal(LEVELS.length, 5);
  });

  test("next-level progress is reported honestly", () => {
    const l = computeLevel(10, 0, 0);
    assert.equal(l.nextTitle, "Collector");
    assert.equal(l.nextXp, 25);
    assert.equal(l.xpIntoLevel, 10);
    const max = computeLevel(900, 10, 9);
    assert.equal(max.nextTitle, null, "Living Legend is max");
  });
});

suite("share card", () => {
  test("share text carries level, quests, and achievement", () => {
    const ownedIds = ["w3::Iron Man", "w3::Captain America", "w3::Thor", "w3::Hulk", "w1::Gambit"];
    const level = computeLevel(ownedIds.length, 0, 1);
    const quests = generateQuests(figures, waves, ownedIds);
    const achievements = computeAchievements(figures, waves, ownedIds);
    const latest = achievements.find((a) => a.unlocked);
    assert(latest, "First Steps is unlocked with 5 owned");
    const text = shareCardText({
      level, ownedCount: ownedIds.length, completedBafs: 0,
      achievements, quests, latestAchievement: latest,
    });
    assert(text.includes(level.title), "level title present");
    assert(text.includes("5 figures owned"), "owned count present");
    assert(text.includes("Finish BAF: The Adversary (2023)"), "top quest present");
    assert(text.includes(latest.name), "latest achievement present");
  });
});
