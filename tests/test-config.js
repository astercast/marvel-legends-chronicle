import { suite, test, assert } from "./assert.js";
import { PATHS, STORE_KEYS } from "../assets/js/config.js";

suite("config", () => {
  test("PATHS points at the real data files", () => {
    assert.equal(PATHS.figures, "data/figures.json");
    assert.equal(PATHS.encyclopedia, "data/encyclopedia.json");
    assert.equal(PATHS.communitySeed, "data/community.json");
  });

  test("STORE_KEYS are unique", () => {
    const vals = Object.values(STORE_KEYS);
    assert.equal(new Set(vals).size, vals.length, "duplicate store keys");
  });

  test("STORE_KEYS use the mlc_ namespace", () => {
    for (const k of Object.values(STORE_KEYS)) {
      assert(k.startsWith("mlc_"), `key ${k} missing mlc_ prefix`);
    }
  });

  test("STORE_KEYS are versioned (v1 suffix)", () => {
    for (const k of Object.values(STORE_KEYS)) {
      assert(/_v\d+$/.test(k), `key ${k} missing version suffix`);
    }
  });
});
