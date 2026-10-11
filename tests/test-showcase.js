import { suite, test, assert } from "./assert.js";
import { moveId } from "../assets/js/showcase.js";

suite("showcase ordering", () => {
  test("moveId swaps with the neighbor", () => {
    assert.deepEqual(moveId(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
    assert.deepEqual(moveId(["a", "b", "c"], "b", 1), ["a", "c", "b"]);
  });

  test("moveId clamps at the edges", () => {
    assert.deepEqual(moveId(["a", "b"], "a", -1), ["a", "b"]);
    assert.deepEqual(moveId(["a", "b"], "b", 1), ["a", "b"]);
  });

  test("moveId ignores unknown ids", () => {
    assert.deepEqual(moveId(["a", "b"], "zzz", 1), ["a", "b"]);
  });

  test("moveId does not mutate the input", () => {
    const order = ["a", "b", "c"];
    moveId(order, "a", 1);
    assert.deepEqual(order, ["a", "b", "c"]);
  });

  test("moveId handles single-element lists", () => {
    assert.deepEqual(moveId(["a"], "a", 1), ["a"]);
    assert.deepEqual(moveId(["a"], "a", -1), ["a"]);
  });

  test("repeated moves walk an item to the top", () => {
    let order = ["a", "b", "c", "d"];
    order = moveId(order, "d", -1);
    order = moveId(order, "d", -1);
    order = moveId(order, "d", -1);
    assert.deepEqual(order, ["d", "a", "b", "c"]);
  });
});
