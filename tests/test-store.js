import { suite, test, assert } from "./assert.js";
import { load, save, makeIdSet } from "../assets/js/store.js";

suite("store", () => {
  test("load returns fallback when key is missing", () => {
    globalThis.__resetStorage();
    const fb = { a: 1 };
    const out = load("mlc_missing", fb);
    assert.deepEqual(out, fb);
    assert(out !== fb, "fallback must be cloned, not shared");
  });

  test("save then load round-trips", () => {
    globalThis.__resetStorage();
    assert(save("mlc_x", { order: [1, 2], notes: { a: "b" } }));
    assert.deepEqual(load("mlc_x", null), { order: [1, 2], notes: { a: "b" } });
  });

  test("corrupt JSON resets to fallback and clears the key", () => {
    globalThis.__resetStorage();
    localStorage.setItem("mlc_bad", "{not json");
    const out = load("mlc_bad", [1]);
    assert.deepEqual(out, [1]);
    assert.equal(localStorage.getItem("mlc_bad"), null, "corrupt key should be removed");
  });

  test("makeIdSet toggle is symmetric", () => {
    globalThis.__resetStorage();
    const s = makeIdSet("mlc_ids");
    assert.equal(s.has("a"), false);
    assert.equal(s.toggle("a"), true);
    assert.equal(s.has("a"), true);
    assert.equal(s.toggle("a"), false);
    assert.equal(s.count(), 0);
  });

  test("makeIdSet persists across instances", () => {
    globalThis.__resetStorage();
    makeIdSet("mlc_ids").toggle("x");
    assert(makeIdSet("mlc_ids").has("x"), "second instance should see the id");
    assert.deepEqual(makeIdSet("mlc_ids").all(), ["x"]);
  });
});
