import { suite, test, assert } from "./assert.js";
import {
  searchFigures, figureById, computeStats, sourceLabel, sourceCoverage,
} from "../assets/js/data.js";

const figs = [
  { id: "w1::Spider-Man", name: "Spider-Man", variant: "Black suit", waveSeries: "Series 1", waveId: "w1", year: 2002, manufacturer: "Toy Biz", waveBaf: null, source: null },
  { id: "w1::Hulk", name: "Hulk", waveSeries: "Series 1", waveId: "w1", year: 2002, manufacturer: "Toy Biz", waveBaf: null, source: "mcu" },
  { id: "w2::Iron Man", name: "Iron Man", variant: null, exclusive: "Comic-Con", waveSeries: "Avengers", waveId: "w2", year: 2020, manufacturer: "Hasbro", waveBaf: "Thanos", source: "mcu" },
];
const waves = [
  { id: "w1", year: 2002, manufacturer: "Toy Biz", series: "Series 1", baf: null, figures: [{}, {}] },
  { id: "w2", year: 2020, manufacturer: "Hasbro", series: "Avengers", baf: "Thanos", figures: [{}] },
];

suite("data queries", () => {
  test("figureById finds by stable id", () => {
    assert.equal(figureById(figs, "w1::Hulk").name, "Hulk");
    assert.equal(figureById(figs, "nope"), null);
  });

  test("searchFigures matches name, variant, wave series", () => {
    assert.equal(searchFigures(figs, "spider").length, 1);
    assert.equal(searchFigures(figs, "black suit").length, 1);
    assert.equal(searchFigures(figs, "avengers").length, 1);
    assert.equal(searchFigures(figs, "x").length, 0, "single char must not search");
    assert.equal(searchFigures(figs, "  ").length, 0);
  });

  test("searchFigures is case-insensitive", () => {
    assert.equal(searchFigures(figs, "SPIDER-MAN").length, 1);
  });

  test("computeStats aggregates waves and figures", () => {
    const s = computeStats(waves, figs);
    assert.equal(s.waves, 2);
    assert.equal(s.figures, 3);
    assert.equal(s.yearMin, 2002);
    assert.equal(s.yearMax, 2020);
    assert.equal(s.bafWaves, 1);
    assert.equal(s.exclusiveFigures, 1);
    assert.equal(s.variantFigures, 1);
    assert.equal(s.byYear[2002], 2);
    assert.equal(s.byManufacturer["Hasbro"], 1);
  });

  test("sourceLabel maps known sources, defaults the rest", () => {
    assert.equal(sourceLabel("mcu"), "MCU (films & streaming)");
    assert.equal(sourceLabel("animated"), "Animated series & films");
    assert.equal(sourceLabel("whatever"), "Unclassified");
    assert.equal(sourceLabel(null), "Unclassified");
    assert.equal(sourceLabel(undefined), "Unclassified");
  });

  test("sourceCoverage counts classified figures", () => {
    const c = sourceCoverage(figs);
    assert.deepEqual(c, { classified: 2, total: 3 });
  });
});
