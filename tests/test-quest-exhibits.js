/* Wow wave 2 — Grail Quest 6.0: the exhibition commissions.
   Guards the Grail Ladder (rarity scoring from archive signals only), the
   year-shelf commissions, completed-commission math, the three new
   achievements, the rarest-affordable-grail engine (never an invented
   price), ceremony diffing, drawer quest hints, the exhibit wall, the
   quest-market data file + builder, the 17th manifest endpoint, and the
   page wiring. */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import {
  grailScore, grailTier, GRAIL_TIER_LABELS, rarestOwned,
  shelfCommissions, activeCommissions, completedCommissions,
  countCompletedCommissions, generateQuests, recommendNext,
  computeAchievements, costTier,
} from "../assets/js/quest-core.js";
import {
  commissionNo, detectNewCompletions, koTargetsIn, drawerQuestHint,
  exhibitWings,
} from "../assets/js/quest-exhibits.js";
import { PATHS, STORE_KEYS } from "../assets/js/config.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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
    ],
  },
  {
    id: "w3", series: "Avengers", year: 2020, manufacturer: "Hasbro", baf: "Thanos",
    figures: [
      { name: "Iron Man", bafPiece: "Torso", notes: "" },
      { name: "Captain America", bafPiece: "Head", notes: "" },
    ],
  },
  {
    id: "w4", series: "Series 4", year: 2002, manufacturer: "Toy Biz",
    figures: [
      { name: "Spider-Man", notes: "" },
      { name: "Wolverine", notes: "1:100 chase variant", variant: "Unmasked" },
      { name: "Doombot", notes: "" },
    ],
  },
  {
    id: "w5", series: "HasLab Sentinel", year: 2021, manufacturer: "Hasbro",
    figures: [
      { name: "Sentinel", exclusive: "HasLab", notes: "" },
    ],
  },
];
const figures = [];
for (const w of waves) {
  for (const f of w.figures) {
    figures.push({
      ...f, id: `${w.id}::${f.name}`, waveId: w.id, waveSeries: w.series,
      year: w.year, manufacturer: w.manufacturer, waveBaf: w.baf ?? null,
      variant: f.variant ?? null, exclusive: f.exclusive ?? null,
    });
  }
}
const byId = new Map(figures.map((f) => [f.id, f]));

suite("the Grail Ladder", () => {
  test("chase figures score mythic", () => {
    const s = grailScore(byId.get("w4::Wolverine"));
    assert(s >= 100, `chase score ${s}`);
    assert.equal(grailTier(s), "mythic");
  });

  test("HasLab and convention exclusives score mythic", () => {
    assert.equal(grailTier(grailScore(byId.get("w5::Sentinel"))), "mythic");
    const sdcc = { ...byId.get("w1::Storm"), exclusive: "San Diego Comic-Con" };
    assert.equal(grailTier(grailScore(sdcc)), "mythic");
  });

  test("plain figures score common, variants notable", () => {
    assert.equal(grailTier(grailScore(byId.get("w1::Storm"))), "common");
    assert.equal(grailTier(grailScore(byId.get("w1::Wolverine"))), "notable");
    assert.equal(grailTier(grailScore(byId.get("w1::Cyclops"))), "notable");
  });

  test("reported price signals boost the score (market recognition)", () => {
    const base = grailScore(byId.get("w1::Gambit"));
    const boosted = grailScore(byId.get("w1::Gambit"), [
      { figId: "w1::Gambit", low: 40, high: 150 },
    ]);
    assert(boosted > base, "a $150-high signal adds market-recognition points");
    assert.equal(grailTier(boosted), "notable");
  });

  test("tier labels exist for all four tiers", () => {
    for (const t of ["mythic", "rare", "notable", "common"]) {
      assert(GRAIL_TIER_LABELS[t], `label for ${t}`);
    }
  });

  test("rarestOwned picks the highest score, deterministically", () => {
    const best = rarestOwned(figures, ["w1::Storm", "w4::Wolverine", "w5::Sentinel"]);
    assert.equal(best.fig.id, "w4::Wolverine", "chase (110) beats HasLab (90)");
    assert.equal(best.tier, "mythic");
    const again = rarestOwned(figures, ["w1::Storm", "w4::Wolverine", "w5::Sentinel"]);
    assert.equal(again.fig.id, best.fig.id, "deterministic");
    assert.equal(rarestOwned(figures, []), null, "empty shelf -> null");
  });

  test("real data: the white Epic Heroes Doom scores rare via its reported band", () => {
    const raw = JSON.parse(readFileSync(join(root, "data", "figures.json"), "utf8"));
    const rFigs = [];
    for (const w of raw.waves) {
      for (const f of w.figures) {
        rFigs.push({ ...f, id: `${w.id}::${f.name}`, year: w.year, manufacturer: w.manufacturer });
      }
    }
    const signals = JSON.parse(readFileSync(join(root, "data", "price-signals.json"), "utf8")).signals;
    const doom = rFigs.find((f) => f.id === "hasbro-2013-epic-heroes::Doctor Doom" && f.variant);
    assert(doom, "white Doom (Future Foundation variant) resolves");
    const score = grailScore(doom, signals);
    assert(score >= 45, `white Doom score ${score} (variant + $115–$200 band)`);
    assert.equal(grailTier(score), "rare");
  });
});

suite("year-shelf commissions", () => {
  test("shelves cover every stub year, sorted, with got/total math", () => {
    const shelves = shelfCommissions(figures, ["w1::Gambit", "w4::Spider-Man"]);
    assert.deepEqual(shelves.map((s) => s.year), [2002, 2020, 2021, 2023, 2024]);
    const s2023 = shelves.find((s) => s.year === 2023);
    assert.equal(s2023.total, 6);
    assert.equal(s2023.got, 1);
    assert.equal(s2023.missingCount, 5);
    assert.equal(s2023.kind, "shelf");
    assert.equal(s2023.id, "shelf:2023");
  });

  test("activeCommissions folds started shelves in with quests", () => {
    const active = activeCommissions(figures, waves, ["w1::Gambit"]);
    const kinds = new Set(active.map((q) => q.kind));
    assert(kinds.has("shelf"), "started 2023 shelf is a commission");
    assert(kinds.has("baf"), "started Adversary BAF is a commission");
    for (const q of active) {
      assert(q.got > 0 && q.missingCount > 0, "active commissions are started and unfinished");
    }
  });

  test("real data: 25 contiguous shelves, every figure on exactly one", () => {
    const raw = JSON.parse(readFileSync(join(root, "data", "figures.json"), "utf8"));
    const rFigs = [];
    for (const w of raw.waves) {
      for (const f of w.figures) {
        rFigs.push({ ...f, id: `${w.id}::${f.name}`, year: w.year });
      }
    }
    const shelves = shelfCommissions(rFigs, []);
    assert.equal(shelves.length, 25, "2002–2026");
    assert.equal(shelves[0].year, 2002);
    assert.equal(shelves[24].year, 2026);
    const total = shelves.reduce((n, s) => n + s.total, 0);
    assert.equal(total, 1949, "every figure on exactly one shelf");
  });
});

suite("completed commissions + new achievements", () => {
  test("completing a BAF yields a stable completed commission", () => {
    const owned = ["w3::Iron Man", "w3::Captain America"];
    const done = completedCommissions(figures, waves, owned);
    const baf = done.find((c) => c.kind === "baf");
    assert(baf, "Thanos BAF completed");
    assert.equal(baf.id, "baf:Thanos:2020", "stable id across renders");
    assert.equal(countCompletedCommissions(figures, waves, owned), done.length);
  });

  test("twenty achievements: crown-jewel, decade-walker, wing-curator", () => {
    const a = computeAchievements(figures, waves, []);
    assert.equal(a.length, 20, "17 + 3 new");
    assert(a.some((x) => x.id === "crown-jewel"), "crown-jewel exists");
    assert(a.some((x) => x.id === "decade-walker"), "decade-walker exists");
    assert(a.some((x) => x.id === "wing-curator"), "wing-curator exists");
  });

  test("crown-jewel unlocks on a mythic-tier owned figure", () => {
    const a = computeAchievements(figures, waves, ["w5::Sentinel"]);
    assert(a.find((x) => x.id === "crown-jewel").unlocked, "HasLab Sentinel is mythic");
    const b = computeAchievements(figures, waves, ["w1::Storm"]);
    assert(!b.find((x) => x.id === "crown-jewel").unlocked, "common figure stays locked");
  });

  test("decade-walker counts distinct archive years", () => {
    const a = computeAchievements(figures, waves, ["w1::Storm", "w2::Beast", "w3::Iron Man", "w4::Spider-Man", "w5::Sentinel"]);
    const dw = a.find((x) => x.id === "decade-walker");
    assert.equal(dw.got, 5, "5 distinct years");
    assert(!dw.unlocked, "needs 10");
  });

  test("wing-curator unlocks on any completed commission", () => {
    const a = computeAchievements(figures, waves, ["w3::Iron Man", "w3::Captain America"]);
    assert(a.find((x) => x.id === "wing-curator").unlocked, "completed Thanos BAF");
    const b = computeAchievements(figures, waves, ["w1::Gambit"]);
    assert(!b.find((x) => x.id === "wing-curator").unlocked, "nothing completed");
  });
});

suite("rarest affordable grail", () => {
  test("picks the highest rarity-per-cost, excluding HasLab and owned", () => {
    const rec = recommendNext(figures, waves, ["w4::Spider-Man"], []);
    const g = rec.affordableGrail;
    assert(g, "an affordable grail exists");
    assert.equal(g.fig.id, "w4::Wolverine", "the chase is mythic and a standard single");
    assert(g.rarity === "mythic" || g.rarity === "rare");
    assert(g.fig.id !== "w5::Sentinel", "HasLab is never affordable");
  });

  test("cost note never invents a price without a reported signal", () => {
    const rec = recommendNext(figures, waves, [], []);
    assert(!/\$\d/.test(rec.affordableGrail.costNote), "no dollar sign without reported data");
  });

  test("a reported low prices the grail honestly", () => {
    const signals = [{ figId: "w1::Cyclops", low: 55, high: 60, kind: "sold-band" }];
    const rec = recommendNext(figures, waves, ["w4::Wolverine"], [], { signals });
    const g = rec.affordableGrail;
    assert(g, "Cyclops is rare (exclusive + band) and affordable at $55");
    assert(g.costNote.includes("$55"), "reported low shown as reported");
    assert(g.costNote.includes("reported"), "flagged as reported, not a live price");
  });

  test("reported low above $60 is not affordable", () => {
    const signals = [{ figId: "w1::Cyclops", low: 61, high: 90, kind: "sold-band" }];
    const rec = recommendNext(figures, waves, ["w4::Wolverine"], [], { signals });
    assert(!rec.affordableGrail || rec.affordableGrail.fig.id !== "w1::Cyclops",
      "$61 reported low prices Cyclops out");
  });
});

suite("ceremonies + commission numbers", () => {
  test("commissionNo formats stable accession numbers", () => {
    assert.equal(commissionNo("baf", 0), "CQ-BAF-01");
    assert.equal(commissionNo("shelf", 9), "CQ-SHF-10");
    assert.equal(commissionNo("character", 2), "CQ-CHR-03");
    assert.equal(commissionNo("run", 4), "CQ-RUN-05");
  });

  test("detectNewCompletions diffs against the celebrated map", () => {
    assert.deepEqual(detectNewCompletions({ a: "2026-10-12" }, ["a", "b"]), ["b"]);
    assert.deepEqual(detectNewCompletions({}, ["a"]), ["a"]);
    assert.deepEqual(detectNewCompletions({ a: "2026-10-12" }, ["a"]), []);
    assert.deepEqual(detectNewCompletions(null, ["a"]), ["a"], "missing map degrades");
  });
});

suite("drawer quest hints (the Vault Room feed)", () => {
  test("a missing piece of a started BAF gets a progress hint", () => {
    const hint = drawerQuestHint(byId.get("w3::Captain America"), figures, ["w3::Iron Man"]);
    assert(hint, "hint for the last Thanos piece");
    assert(hint.completes, "it completes the commission");
    assert(hint.text.includes("complete"), "says so plainly");
  });

  test("a non-completing piece reports the running count", () => {
    const hint = drawerQuestHint(byId.get("w1::Rogue"), figures, ["w1::Gambit"]);
    assert(hint && !hint.completes, "Rogue is one of several missing");
    assert(hint.text.includes("1/3"), "running count shown");
  });

  test("owned figures get the accessioned line, strangers get nothing", () => {
    const ownedHint = drawerQuestHint(byId.get("w1::Gambit"), figures, ["w1::Gambit"]);
    assert(ownedHint && ownedHint.text.includes("Already accessioned"), "owned drawer");
    const stranger = drawerQuestHint(byId.get("w5::Sentinel"), figures, []);
    assert.equal(stranger, null, "Sentinel starts no commission");
  });

  test("koTargetsIn matches the archive's documented KO targets", () => {
    const hits = koTargetsIn([{ name: "Dragon Man" }, { name: "Storm" }]);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].match, "dragon man");
  });
});

suite("the growing exhibit", () => {
  test("exhibitWings hangs owned pieces per wing, unfinished only", () => {
    const wings = exhibitWings(figures, waves, ["w3::Iron Man", "w1::Gambit"]);
    const thanos = wings.find((w) => w.id === "baf:Thanos:2020");
    assert(thanos, "Thanos wing under construction");
    assert.equal(thanos.hung.length, 1);
    assert.equal(thanos.hung[0].piece, "Torso");
    assert.equal(thanos.total, 2);
    const done = exhibitWings(figures, waves, ["w3::Iron Man", "w3::Captain America"]);
    assert(!done.some((w) => w.id === "baf:Thanos:2020"), "completed wings leave the wall for the gallery");
  });
});

suite("quest-market data (the 2026 briefing, machine-readable)", () => {
  const doc = JSON.parse(readFileSync(join(root, "data", "quest-market.json"), "utf8"));
  const v1 = JSON.parse(readFileSync(join(root, "data", "v1", "quest-market.json"), "utf8"));

  test("pinned MSRP values match the published 2026 baseline", () => {
    assert.equal(doc.priceTiers.standard.usd, 27.99);
    assert.equal(doc.priceTiers.deluxe.low, 34.99);
    assert.equal(doc.priceTiers.deluxe.high, 46.99);
    assert.equal(doc.priceTiers.milesMask.usd, 139.99);
    assert.equal(doc.priceTiers.madeToOrder.usd, 74.99);
  });

  test("white-Doom band matches the Price Watch's own signal", () => {
    assert.deepEqual(doc.chaseEra.whiteDoom.band, [115, 200]);
    const signals = JSON.parse(readFileSync(join(root, "data", "price-signals.json"), "utf8")).signals;
    const doom = signals.find((s) => s.figId === doc.chaseEra.whiteDoom.figId && s.kind === "sold-band");
    assert(doom && doom.low === 115 && doom.high === 200, "same numbers, same source");
  });

  test("launch-curve peaks match the curve point data", () => {
    const curves = Object.fromEntries(
      JSON.parse(readFileSync(join(root, "data", "launch-curves.json"), "utf8")).curves.map((c) => [c.figId, c])
    );
    for (const key of ["gambit", "cyclops"]) {
      const note = doc.launchCurveNote[key];
      const curve = curves[note.figId];
      assert(curve, `curve for ${note.figId}`);
      assert.equal(Math.max(...curve.points.map((p) => p.price)), note.peak);
    }
  });

  test("every referenced figId resolves in the archive", () => {
    const raw = JSON.parse(readFileSync(join(root, "data", "figures.json"), "utf8"));
    const ids = new Set();
    for (const w of raw.waves) for (const f of w.figures) ids.add(`${w.id}::${f.name}`);
    for (const id of [doc.chaseEra.whiteDoom.figId, doc.launchCurveNote.gambit.figId, doc.launchCurveNote.cyclops.figId]) {
      assert(ids.has(id), `resolves: ${id}`);
    }
  });

  test("v1 envelope: tiers first-list, 6 tier records", () => {
    assert(Array.isArray(v1.tiers) && v1.tiers.length === 6, "6 MSRP tiers");
    assert.equal(v1.count, 6);
    assert(v1.chaseEra && v1.reissueProgram && v1.koWatch && v1.launchCurveNote, "intel sections present");
  });

  test("schemas exist for the endpoint and its tier records", () => {
    assert(existsSync(join(root, "data", "v1", "schema", "quest-market.json")), "envelope schema");
    assert(existsSync(join(root, "data", "v1", "schema", "quest-market-tier.json")), "tier schema");
  });
});

suite("quest-market API registration", () => {
  const manifest = JSON.parse(readFileSync(join(root, "data", "v1", "index.json"), "utf8"));

  test("quest-market is the 17th manifest endpoint", () => {
    const names = Object.keys(manifest.endpoints);
    assert.equal(names.length, 17, "17 endpoints");
    const e = manifest.endpoints["quest-market"];
    assert(e, "quest-market in manifest");
    assert.equal(e.path, "data/v1/quest-market.json");
    assert.equal(e.records, 6);
  });
});

suite("page wiring", () => {
  const page = readFileSync(join(root, "quest.html"), "utf8");
  const vault = readFileSync(join(root, "vault-room.html"), "utf8");

  test("quest page carries the 6.0 sections", () => {
    for (const id of ["market-placard", "exhibit-wall", "done-list", "rec-affordable",
                      "ceremony", "ceremony-title", "ceremony-body", "ceremony-acc", "jewel-line"]) {
      assert(page.includes(`id="${id}"`), `quest.html has #${id}`);
    }
    assert(page.includes("Active commissions"), "commissions framing");
    assert(page.includes("Accessioned honors"), "honors framing");
    assert(page.includes("The growing exhibit"), "exhibit section");
    assert(page.includes("The permanent gallery"), "gallery section");
    assert(page.includes("The registrar's next commissions"), "rec framing");
  });

  test("vault-room drawer carries the quest-strip styles", () => {
    assert(vault.includes("drawer-quest-strip"), "strip CSS present");
  });

  test("config registers the new storage key and data path", () => {
    assert.equal(STORE_KEYS.questDone, "mlc_quest_done_v1");
    assert.equal(PATHS.questMarket, "data/quest-market.json");
  });

  test("quest.html still carries the full vault wiring", () => {
    assert(page.includes("assets/css/vault.css"), "vault.css linked");
    assert(page.includes('id="directory-button"'), "directory button present");
    assert(page.includes('aria-current="page">Grail Quest'), "nav marks the current page");
  });
});
