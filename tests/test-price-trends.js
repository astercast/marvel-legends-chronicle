import { suite, test, assert } from "./assert.js";
import {
  entriesForFigure, trendStats, sparklineSVG, directionBadge,
} from "../assets/js/price-trends.js";

const E = (price, date, extra = {}) =>
  ({ id: "e" + Math.random().toString(36).slice(2), price, date, name: "Spider-Man", ...extra });

suite("price trends", () => {
  test("entriesForFigure matches by figId, falls back to name", () => {
    const entries = [
      { id: "1", figId: "w1::Spider-Man", name: "wrong name", price: 10, date: "2024-01-01" },
      { id: "2", figId: null, name: "spider-man", price: 20, date: "2024-02-01" },
      { id: "3", figId: null, name: "Hulk", price: 30, date: "2024-03-01" },
    ];
    const got = entriesForFigure(entries, "w1::Spider-Man", "Spider-Man");
    assert.equal(got.length, 2);
  });

  test("trendStats detects an upward trend", () => {
    const s = trendStats([E(10, "2024-01-01"), E(11, "2024-02-01"), E(20, "2024-03-01"), E(22, "2024-04-01")]);
    assert(s !== null);
    assert.equal(s.direction, "up");
    assert.equal(s.n, 4);
  });

  test("trendStats detects a downward trend", () => {
    const s = trendStats([E(50, "2024-01-01"), E(48, "2024-02-01"), E(20, "2024-03-01")]);
    assert(s !== null);
    assert.equal(s.direction, "down");
  });

  test("trendStats calls <10% change stable", () => {
    const s = trendStats([E(100, "2024-01-01"), E(102, "2024-02-01"), E(104, "2024-03-01")]);
    assert(s !== null);
    assert.equal(s.direction, "stable");
  });

  test("trendStats needs 3+ valid dated entries", () => {
    assert.equal(trendStats([E(10, "2024-01-01"), E(20, "2024-02-01")]), null);
    assert.equal(trendStats([]), null);
  });

  test("trendStats ignores invalid prices and undated entries", () => {
    const s = trendStats([
      E(0, "2024-01-01"), E(-5, "2024-01-02"), E("junk", "2024-01-03"),
      E(10, null), E(10, "2024-02-01"), E(10, "2024-03-01"), E(10, "2024-04-01"),
    ]);
    assert(s !== null, "3 valid entries remain");
    assert.equal(s.direction, "stable");
  });

  test("trendStats sorts by date, not insertion order", () => {
    const s = trendStats([E(30, "2024-03-01"), E(10, "2024-01-01"), E(20, "2024-02-01")]);
    assert(s !== null);
    assert.equal(s.from, "2024-01-01");
    assert.equal(s.to, "2024-03-01");
    assert.equal(s.direction, "up");
  });

  test("sparklineSVG renders accessible SVG for 2+ points", () => {
    const svg = sparklineSVG([E(10, "2024-01-01"), E(20, "2024-02-01")]);
    assert(svg.includes("<svg"), "should contain svg");
    assert(svg.includes('role="img"'), "should be role=img");
    assert(svg.includes("<title>"), "should have accessible title");
    assert.equal(sparklineSVG([E(10, "2024-01-01")]), "", "single point -> empty");
    assert.equal(sparklineSVG([]), "", "no points -> empty");
  });

  test("sparklineSVG handles flat prices (zero span)", () => {
    const svg = sparklineSVG([E(15, "2024-01-01"), E(15, "2024-02-01")]);
    assert(svg.includes("<svg"), "flat prices must still render");
    assert(!svg.includes("NaN"), "no NaN coordinates");
  });

  test("directionBadge labels all directions", () => {
    assert(directionBadge("up").includes("Trending up"));
    assert(directionBadge("down").includes("Trending down"));
    assert(directionBadge("stable").includes("Stable"));
  });
});
