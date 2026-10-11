import { suite, test, assert } from "./assert.js";
import { buildBafs, pieceOwned, bafProgress } from "../assets/js/baf-planner.js";
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
