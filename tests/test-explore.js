import { suite, test, assert } from "./assert.js";
import { mulberry32 } from "../assets/js/explore.js";

suite("explore seeded shuffle", () => {
  test("mulberry32 is deterministic per seed", () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 20; i++) assert.equal(a(), b(), `draw ${i} differs`);
  });

  test("different seeds diverge", () => {
    const a = mulberry32(1), b = mulberry32(2);
    const same = Array.from({ length: 10 }, () => a() === b()).every(Boolean);
    assert(!same, "seeds 1 and 2 produced identical streams");
  });

  test("output stays in [0, 1)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      assert(v >= 0 && v < 1, `out of range: ${v}`);
    }
  });

  test("seed 0 still advances (no stuck generator)", () => {
    const rng = mulberry32(0);
    const vals = new Set(Array.from({ length: 10 }, () => rng()));
    assert(vals.size > 1, "generator stuck on seed 0");
  });
});
