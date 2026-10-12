import { suite, test, assert } from "./assert.js";
import {
  buildBafs, pieceOwned, bafProgress,
  ownedUnion, journalPriceMap, carrierTier, cheapestPath, closestBafs,
} from "../assets/js/baf-planner.js";
import { STORE_KEYS } from "../assets/js/config.js";

const waves = [
  {
    id: "w1", series: "Avengers", year: 2020, baf: "Thanos",
    figures: [
      { name: "Iron Man", bafPiece: "Torso" },
      { name: "Cap", bafPiece: "Torso", variant: "Unmasked" }, // same piece, 2nd carrier
      { name: "Thor", bafPiece: "Left Arm" },
      { name: "Hulk" }, // no piece
    ],
  },
  { id: "w2", series: "X-Men", year: 2021, baf: null, figures: [{ name: "Wolverine" }] },
  { id: "w3", series: "FF", year: 2022, baf: "Galactus", figures: [{ name: "Thing" }] }, // baf, no pieces
];

function seedOwned(ids) {
  globalThis.__resetStorage();
  localStorage.setItem(STORE_KEYS.owned, JSON.stringify(ids));
}

suite("baf planner", () => {
  test("buildBafs maps pieces to carriers, dedupes variant repeats", () => {
    const bafs = buildBafs(waves);
    assert.equal(bafs.length, 1, "w3 has a baf but no pieces; w2 has no baf");
    const thanos = bafs[0];
    assert.equal(thanos.name, "Thanos");
    assert.equal(thanos.pieces.length, 2);
    const torso = thanos.pieces.find((p) => p.piece === "Torso");
    assert.equal(torso.carriers.length, 2, "both torso carriers listed");
    assert(torso.carriers.every((c) => c.id.startsWith("w1::")), "carrier ids are stable");
  });

  test("pieceOwned is true when any carrier is owned", () => {
    seedOwned(["w1::Cap"]);
    const bafs = buildBafs(waves);
    const torso = bafs[0].pieces.find((p) => p.piece === "Torso");
    const arm = bafs[0].pieces.find((p) => p.piece === "Left Arm");
    assert(pieceOwned(torso), "owned via variant carrier");
    assert(!pieceOwned(arm), "no carrier owned");
  });

  test("bafProgress counts secured pieces", () => {
    seedOwned(["w1::Iron Man"]);
    const bafs = buildBafs(waves);
    assert.deepEqual(bafProgress(bafs[0]), { total: 2, got: 1 });
  });

  test("bafProgress is zero with nothing owned", () => {
    seedOwned([]);
    const bafs = buildBafs(waves);
    assert.deepEqual(bafProgress(bafs[0]), { total: 2, got: 0 });
  });

  test("buildBafs ignores waves without a baf name", () => {
    const bafs = buildBafs([{ id: "x", series: "S", year: 2000, figures: [{ name: "A", bafPiece: "Head" }] }]);
    assert.equal(bafs.length, 0);
  });
});

function seedBuys(entries) {
  localStorage.setItem(STORE_KEYS.buys, JSON.stringify(entries));
}

function seedJournal(entries) {
  localStorage.setItem(STORE_KEYS.journal, JSON.stringify(entries));
}

suite("baf planner 2.0: purchase-backed ownership", () => {
  test("ownedUnion merges tracker marks with logged purchases", () => {
    globalThis.__resetStorage();
    localStorage.setItem(STORE_KEYS.owned, JSON.stringify(["w1::Iron Man"]));
    seedBuys([{ figId: "w1::Thor", price: 25 }]);
    const u = ownedUnion();
    assert(u.has("w1::Iron Man"), "tracker mark included");
    assert(u.has("w1::Thor"), "logged purchase included");
    assert(!u.has("w1::Cap"), "unowned excluded");
  });

  test("logged purchases secure BAF pieces", () => {
    globalThis.__resetStorage();
    seedBuys([{ figId: "w1::Thor", price: 25 }]);
    const bafs = buildBafs(waves);
    const arm = bafs[0].pieces.find((p) => p.piece === "Left Arm");
    assert(pieceOwned(arm), "ledger-logged Thor secures the Left Arm");
  });

  test("journal sales never count as owned", () => {
    globalThis.__resetStorage();
    seedJournal([{ figId: "w1::Thor", price: 25 }]);
    const bafs = buildBafs(waves);
    const arm = bafs[0].pieces.find((p) => p.piece === "Left Arm");
    assert(!pieceOwned(arm), "sold ≠ owned: journal sales don't secure pieces");
  });

  test("journalPriceMap takes the median of logged sold prices", () => {
    globalThis.__resetStorage();
    seedJournal([
      { figId: "w1::Iron Man", price: 20 },
      { figId: "w1::Iron Man", price: 40 },
      { figId: "w1::Iron Man", price: 30 },
      { figId: "w1::Thor", price: "junk" },
      { figId: null, price: 10 },
    ]);
    const m = journalPriceMap();
    assert.equal(m.get("w1::Iron Man"), 30, "median of 20/40/30");
    assert(!m.has("w1::Thor"), "junk prices skipped");
    assert.equal(m.size, 1, "null figIds skipped");
  });
});

suite("baf planner 2.0: cheapest-path math", () => {
  test("journal-logged carriers win over unlogged ones", () => {
    globalThis.__resetStorage();
    seedJournal([{ figId: "w1::Cap", price: 18 }]);
    const bafs = buildBafs(waves);
    const plan = cheapestPath(bafs[0], journalPriceMap());
    assert.equal(plan.legs.length, 2, "both pieces missing");
    const torso = plan.legs.find((l) => l.piece === "Torso");
    assert.equal(torso.carrier.name, "Cap", "logged Cap beats unlogged Iron Man");
    assert.equal(torso.journalPrice, 18);
    assert.equal(plan.unknownCount, 1, "Left Arm has no journal price");
    assert.equal(plan.totalKnown, 18, "only known legs summed");
  });

  test("cheapest journal price wins among logged carriers", () => {
    globalThis.__resetStorage();
    seedJournal([
      { figId: "w1::Iron Man", price: 30 },
      { figId: "w1::Cap", price: 18 },
    ]);
    const bafs = buildBafs(waves);
    const plan = cheapestPath(bafs[0], journalPriceMap());
    const torso = plan.legs.find((l) => l.piece === "Torso");
    assert.equal(torso.carrier.name, "Cap", "$18 Cap beats $30 Iron Man");
  });

  test("tier proxy breaks ties when no journal prices exist", () => {
    globalThis.__resetStorage();
    seedJournal([]);
    const bafs = buildBafs(waves);
    const plan = cheapestPath(bafs[0], journalPriceMap());
    assert(plan.legs.every((l) => l.journalPrice === null), "all unknown");
    assert.equal(plan.unknownCount, 2);
    assert.equal(plan.totalKnown, 0, "no invented dollars — zero known");
  });

  test("owned pieces are excluded from the path", () => {
    globalThis.__resetStorage();
    localStorage.setItem(STORE_KEYS.owned, JSON.stringify(["w1::Thor"]));
    seedJournal([]);
    const bafs = buildBafs(waves);
    const plan = cheapestPath(bafs[0], journalPriceMap());
    assert.equal(plan.legs.length, 1, "only the Torso remains");
    assert.equal(plan.legs[0].piece, "Torso");
  });

  test("carrierTier mirrors the figure-type cost proxy", () => {
    assert.equal(carrierTier({ waveSeries: "X-Men" }), 1, "standard single");
    assert.equal(carrierTier({ exclusive: "Target", waveSeries: "X" }), 3, "retailer exclusive");
    assert.equal(carrierTier({ exclusive: "HasLab" }), 4, "HasLab");
    assert.equal(carrierTier({ exclusive: "Box set exclusive", waveSeries: "Box Set - X" }), 2, "box set");
  });
});

suite("baf planner 2.0: closest BAF to complete", () => {
  const two = [
    {
      id: "a", series: "A", year: 2020, baf: "Big",
      figures: [
        { name: "A1", bafPiece: "Head" },
        { name: "A2", bafPiece: "Torso" },
        { name: "A3", bafPiece: "Arm" },
      ],
    },
    {
      id: "b", series: "B", year: 2021, baf: "Small",
      figures: [
        { name: "B1", bafPiece: "Head" },
        { name: "B2", bafPiece: "Torso" },
      ],
    },
  ];

  test("started BAFs sort by fewest missing pieces first", () => {
    const bafs = buildBafs(two);
    const rows = closestBafs(bafs, ["a::A1", "b::B1"]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].baf.name, "Small", "1 missing beats 2 missing");
    assert.equal(rows[0].missing, 1);
    assert.equal(rows[1].baf.name, "Big");
    assert.equal(rows[1].missing, 2);
    assert.equal(rows[1].got, 1);
  });

  test("unstarted and complete BAFs are excluded", () => {
    const bafs = buildBafs(two);
    const rows = closestBafs(bafs, ["b::B1", "b::B2"]);
    assert(rows.every((r) => r.baf.name !== "Small"), "completed BAF excluded");
    assert(rows.every((r) => r.baf.name !== "Big"), "unstarted BAF excluded");
    assert.equal(rows.length, 0);
  });
});
