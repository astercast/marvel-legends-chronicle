import { suite, test, assert } from "./assert.js";
import {
  windowCheck, windowScorecard, recentlyOpened, WINDOW_RESULTS,
} from "../assets/js/preorders.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const preordersData = JSON.parse(readFileSync(join(ROOT, "data", "preorders.json"), "utf-8")).items;

const item = (over = {}) => ({
  id: "x", name: "Test Item", status: "preorder", preorderDate: null,
  releaseWindow: "Fall 2026", price: null, query: "test", venue: null,
  details: null, retailers: [], sources: [], windowResult: null,
  ...over,
});

suite("window check: kinds", () => {
  test("past date is a past-window, future is upcoming", () => {
    const items = [
      item({ id: "p", preorderDate: "2026-10-06", windowResult: "as-announced" }),
      item({ id: "f", preorderDate: "2026-10-21" }),
    ];
    const checks = windowCheck(items, "2026-10-11");
    assert.equal(checks.length, 2);
    const past = checks.find((c) => c.id === "p");
    assert.equal(past.kind, "past-window");
    assert.equal(past.daysUntil, -5);
    assert.equal(past.result, "as-announced");
    const fut = checks.find((c) => c.id === "f");
    assert.equal(fut.kind, "upcoming-window");
    assert.equal(fut.daysUntil, 10);
    assert.equal(fut.result, "on-schedule");
  });

  test("unknown windowResult on a past window is unscored, never a pass", () => {
    const checks = windowCheck([item({ id: "u", preorderDate: "2026-10-01", windowResult: "bogus" })], "2026-10-11");
    assert.equal(checks[0].kind, "past-window");
    assert.equal(checks[0].result, "unscored");
  });

  test("undated and out-of-range items are excluded", () => {
    const items = [
      item({ id: "nodate", preorderDate: null, status: "revealed" }),
      item({ id: "far-past", preorderDate: "2026-01-01", windowResult: "as-announced" }),
      item({ id: "far-future", preorderDate: "2027-06-01" }),
    ];
    assert.equal(windowCheck(items, "2026-10-11").length, 0);
  });

  test("Pulse-exclusive sale day is a sale-window", () => {
    const items = [item({ id: "yfns-spidey-rhino-2pack", name: "YFNS 2-pack", status: "revealed", preorderDate: null })];
    const checks = windowCheck(items, "2026-10-11");
    assert.equal(checks.length, 1);
    assert.equal(checks[0].kind, "sale-window");
    assert.equal(checks[0].date, "2026-11-01");
    assert.equal(checks[0].daysUntil, 21);
  });

  test("sorted by date ascending", () => {
    const items = [
      item({ id: "b", preorderDate: "2026-10-28" }),
      item({ id: "a", preorderDate: "2026-10-14" }),
    ];
    const ids = windowCheck(items, "2026-10-11").map((c) => c.id);
    assert.deepEqual(ids, ["a", "b"]);
  });

  test("null and empty inputs are safe", () => {
    assert.deepEqual(windowCheck(null, "2026-10-11"), []);
    assert.deepEqual(windowCheck([], "2026-10-11"), []);
  });
});

suite("window check: scorecard", () => {
  test("scorecard math across all result kinds", () => {
    const checks = [
      { id: "a", kind: "past-window", result: "as-announced" },
      { id: "b", kind: "past-window", result: "as-announced" },
      { id: "c", kind: "past-window", result: "retailers-partial" },
      { id: "d", kind: "past-window", result: "delayed" },
      { id: "e", kind: "past-window", result: "missed" },
      { id: "f", kind: "past-window", result: "unscored" },
      { id: "g", kind: "upcoming-window", result: "on-schedule" },
      { id: "h", kind: "sale-window", result: "on-schedule" },
    ];
    const s = windowScorecard(checks);
    assert.deepEqual(s, { scored: 5, correct: 2, partial: 1, delayed: 1, missed: 1, unscored: 1, upcoming: 2 });
  });

  test("empty scorecard is zeros", () => {
    assert.deepEqual(windowScorecard([]), { scored: 0, correct: 0, partial: 0, delayed: 0, missed: 0, unscored: 0, upcoming: 0 });
  });
});

suite("window check: recentlyOpened", () => {
  test("returns preorder items opened within daysBack, freshest first", () => {
    const items = [
      item({ id: "a", preorderDate: "2026-09-23" }), // 18 days: too old
      item({ id: "b", preorderDate: "2026-10-07" }), // 4
      item({ id: "c", preorderDate: "2026-10-06" }), // 5
      item({ id: "d", preorderDate: "2026-10-21" }), // future: excluded
      item({ id: "e", preorderDate: "2026-10-08", status: "available" }), // wrong status
      item({ id: "f", preorderDate: null }),
    ];
    const fresh = recentlyOpened(items, "2026-10-11", 14);
    assert.deepEqual(fresh.map((x) => x.item.id), ["b", "c"]);
    assert.deepEqual(fresh.map((x) => x.daysOpen), [4, 5]);
  });
});

suite("window check: pinned against real data/preorders.json", () => {
  test("the Oct 11, 2026 window check against the real tracker", () => {
    const checks = windowCheck(preordersData, "2026-10-11");
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
    // past windows
    assert.equal(byId["holiday-spidey-2026"].result, "as-announced");
    assert.equal(byId["tas-retro-wave"].result, "as-announced");
    assert.equal(byId["mini-comics-wave-3"].result, "retailers-partial", "Oct 6: retailers correct, Pulse listing lagged");
    assert.equal(byId["bastion-trask-2pack"].result, "as-announced");
    // upcoming windows
    assert.equal(byId["doomsday-wave-2"].daysUntil, 3);
    assert.equal(byId["xmen97-retro-wave"].daysUntil, 10);
    assert.equal(byId["astonishing-cyclops-wolverine-2pack"].daysUntil, 17);
    // Nov 1 Pulse-exclusive sale
    assert.equal(byId["yfns-spidey-rhino-2pack"].kind, "sale-window");
    assert.equal(byId["yfns-spidey-rhino-2pack"].daysUntil, 21);
    const s = windowScorecard(checks);
    assert.equal(s.scored, 4, "four scored past windows");
    assert.equal(s.correct, 3);
    assert.equal(s.partial, 1);
    assert.equal(s.unscored, 0, "no unscored past windows — every past window has a researched outcome");
    assert.equal(s.upcoming, 4, "Oct 14 + Oct 21 + Oct 28 + Nov 1 sale");
  });

  test("every windowResult in the data is a valid enum value", () => {
    for (const it of preordersData) {
      if (it.windowResult !== null && it.windowResult !== undefined) {
        assert(WINDOW_RESULTS.includes(it.windowResult),
          `${it.id}: windowResult ${it.windowResult} not in ${WINDOW_RESULTS.join(",")}`);
      }
    }
  });

  test("fresh windows on 2026-10-11", () => {
    const fresh = recentlyOpened(preordersData, "2026-10-11", 14);
    assert.deepEqual(fresh.map((x) => x.item.id), ["bastion-trask-2pack", "mini-comics-wave-3", "tas-retro-wave"]);
    assert.deepEqual(fresh.map((x) => x.daysOpen), [4, 5, 12]);
  });
});
