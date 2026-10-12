/* Wave 25: Budget Tracker pure-math tests. Pinned fixtures only — the math
   is a mirror of user-logged purchases, never advice. */
"use strict";

import { suite, test, assert } from "./assert.js";
import {
  monthKey, buysInMonth, buysInYear, totalFor,
  budgetStatus, budgetStats, todayKeys,
} from "../assets/js/budget-core.js";

const BUYS = [
  { id: "1", name: "A", price: 27.99, date: "2026-10-02", where: "Pulse" },
  { id: "2", name: "B", price: 60.00, date: "2026-10-20", where: "eBay" },
  { id: "3", name: "C", price: 34.99, date: "2026-09-15", where: "Target" },
  { id: "4", name: "D", price: 200.00, date: "2025-12-25", where: "BBTS" },
];

suite("budget: month keys", () => {
  test("parses YYYY-MM-DD strings and Dates", () => {
    assert.equal(monthKey("2026-10-11"), "2026-10");
    assert.equal(monthKey(new Date(2026, 9, 1)), "2026-10");
    assert.equal(monthKey("garbage"), null);
    assert.equal(monthKey("2026-13-01"), null);
    assert.equal(monthKey(null), null);
  });

  test("todayKeys is injectable", () => {
    assert.equal(todayKeys(new Date(2026, 10, 5)).month, "2026-11");
    assert.equal(todayKeys(new Date(2026, 10, 5)).year, "2026");
  });
});

suite("budget: period totals", () => {
  test("month and year filters", () => {
    const oct = buysInMonth(BUYS, "2026-10");
    assert.equal(oct.length, 2);
    assert(Math.abs(totalFor(oct) - 87.99) < 1e-9);
    const y2026 = buysInYear(BUYS, "2026");
    assert.equal(y2026.length, 3);
    assert(Math.abs(totalFor(y2026) - 122.98) < 1e-9);
    assert.equal(buysInMonth(BUYS, null).length, 0);
  });

  test("totalFor ignores bad prices", () => {
    assert.equal(totalFor([{ price: "nope" }, { price: -5 }, {}]), 0);
  });
});

suite("budget: status vs a limit", () => {
  test("under, at, and over budget", () => {
    const under = budgetStatus(80, 100);
    assert(under.set && !under.over);
    assert.equal(Math.round(under.pct), 80);
    assert.equal(Math.round(under.remaining * 100), 2000);
    const over = budgetStatus(120, 100);
    assert(over.over && over.set);
    assert.equal(Math.round(over.remaining), 0);
  });

  test("no limit set -> { set: false }, never a verdict", () => {
    const s = budgetStatus(50, null);
    assert(!s.set && !s.over);
  });
});

suite("budget: all-time stats", () => {
  test("count, total, average, most expensive", () => {
    const st = budgetStats(BUYS);
    assert.equal(st.count, 4);
    assert(Math.abs(st.total - 322.98) < 1e-9);
    assert(Math.abs(st.avg - 322.98 / 4) < 1e-9);
    assert.equal(st.max, 200);
    assert.equal(st.maxBuy.name, "D");
  });

  test("empty ledger -> zeros, no crash", () => {
    const st = budgetStats([]);
    assert.equal(st.count, 0);
    assert.equal(st.total, 0);
    assert.equal(st.avg, 0);
    assert.equal(st.maxBuy, null);
  });
});
