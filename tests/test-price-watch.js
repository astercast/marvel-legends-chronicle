/* Wave 25: Price Watch pure-logic tests.
   Logic tests run against pinned fixtures; data tests run against the REAL
   data/price-signals.json + data/figures.json — every signal must resolve
   to a real figure and carry a real reported number, never an invented one. */
"use strict";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import {
  money, signalForFigure, watchVerdict, closenessToTarget,
  rankWatchHunts, verdictLine, shareWatchlistText,
} from "../assets/js/price-watch.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const sigRaw = JSON.parse(readFileSync(join(ROOT, "data/price-signals.json"), "utf8"));
const signals = sigRaw.signals;
const figRaw = JSON.parse(readFileSync(join(ROOT, "data/figures.json"), "utf8"));
const realIds = new Set();
for (const w of figRaw.waves) {
  for (const f of w.figures) realIds.add(`${w.id}::${f.name}`);
}

/* Pinned fixtures: one sold-band signal, one single-price listing. */
const BAND = { id: "band", figId: "w::A", label: "Figure A", kind: "sold-band", low: 115, high: 200, display: "$115–$200" };
const LISTING = { id: "listing", figId: "w::B", label: "Figure B", kind: "listing", low: 59.99, high: 59.99, display: "$59.99 listing" };
const FX = [BAND, LISTING];

suite("price watch: signal lookup", () => {
  test("signalForFigure returns only matching signals", () => {
    const got = signalForFigure("w::A", FX);
    assert.equal(got.length, 1);
    assert.equal(got[0].id, "band");
    assert.equal(signalForFigure("w::zzz", FX).length, 0);
    assert.equal(signalForFigure(null, FX).length, 0);
  });

  test("a figure can carry more than one signal (white vs green Doom)", () => {
    const doom = signalForFigure("hasbro-2013-epic-heroes::Doctor Doom", signals);
    assert.equal(doom.length, 2, "white-deco band + green average");
  });
});

suite("price watch: verdicts", () => {
  test("target under the band low -> above, with the dollar gap", () => {
    const v = watchVerdict(BAND, 100);
    assert.equal(v.status, "above");
    assert.equal(v.delta, 15);
    assert(verdictLine(v).includes("$15.00"), "verdict names the gap");
  });

  test("target inside the band -> in-range", () => {
    assert.equal(watchVerdict(BAND, 150).status, "in-range");
    assert.equal(watchVerdict(BAND, 115).status, "in-range", "low edge counts");
    assert.equal(watchVerdict(BAND, 200).status, "in-range", "high edge counts");
  });

  test("target above the band high -> below", () => {
    const v = watchVerdict(BAND, 250);
    assert.equal(v.status, "below");
    assert.equal(v.delta, 50);
  });

  test("single-price listing: at/under target is in-range", () => {
    assert.equal(watchVerdict(LISTING, 59.99).status, "in-range");
    assert.equal(watchVerdict(LISTING, 80).status, "below");
    const v = watchVerdict(LISTING, 50);
    assert.equal(v.status, "above");
    assert.equal(Math.round(v.delta * 100), 999, "delta is 9.99");
  });

  test("no target -> no-target; no signal -> no-data", () => {
    assert.equal(watchVerdict(BAND, null).status, "no-target");
    assert.equal(watchVerdict(null, 50).status, "no-data");
    assert.equal(watchVerdict({ low: null }, 50).status, "no-data");
  });

  test("money formats USD", () => {
    assert.equal(money(115), "$115.00");
  });
});

suite("price watch: closeness weighting", () => {
  test("closeness is target/low capped at 1", () => {
    assert(Math.abs(closenessToTarget(BAND, 100) - 100 / 115) < 1e-9);
    assert.equal(closenessToTarget(BAND, 200), 1, "target above low caps at 1");
    assert.equal(closenessToTarget(BAND, null), null);
    assert.equal(closenessToTarget(null, 100), null);
  });
});

suite("price watch: hunt ranking", () => {
  const entries = [
    { id: "1", figId: "w::A", name: "A", target: 100 },   // closeness 100/115
    { id: "2", figId: "w::B", name: "B", target: 59.99 }, // closeness 1
    { id: "3", figId: "w::C", name: "C", target: 10 },    // no signal -> last
  ];
  test("ranks closest-to-target first, no-data last", () => {
    const ranked = rankWatchHunts(entries, [], FX);
    assert.equal(ranked[0].entry.id, "2");
    assert.equal(ranked[1].entry.id, "1");
    assert.equal(ranked[2].entry.id, "3");
    assert.equal(ranked[2].verdict.status, "no-data");
  });

  test("owned figures are excluded from hunts", () => {
    const ranked = rankWatchHunts(entries, ["w::B"], FX);
    assert(!ranked.some((h) => h.entry.id === "2"), "owned figure excluded");
  });

  test("best signal is the closest one when a figure has two", () => {
    const two = [
      { id: "x", figId: "f::D", label: "lo", kind: "sold-band", low: 100, high: 120 },
      { id: "y", figId: "f::D", label: "hi", kind: "sold-band", low: 300, high: 400 },
    ];
    const ranked = rankWatchHunts([{ id: "1", figId: "f::D", name: "D", target: 110 }], [], two);
    assert.equal(ranked[0].best.signal.id, "x");
    assert.equal(ranked[0].verdict.status, "in-range");
  });
});

suite("price watch: share text", () => {
  test("share text carries names, targets, and bands", () => {
    const text = shareWatchlistText(
      [{ figId: "w::A", name: "Figure A", target: 100 }],
      FX,
    );
    assert(text.includes("Figure A"), "name present");
    assert(text.includes("$100.00"), "target present");
    assert(text.includes("115"), "reported band present");
    assert(text.includes("not live prices"), "honest framing present");
  });

  test("empty watchlist shares honestly", () => {
    assert(shareWatchlistText([], FX).includes("empty"));
  });
});

suite("price signals: real data integrity", () => {
  test("every signal id is unique and resolves to a real figure", () => {
    const ids = signals.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, "unique signal ids");
    for (const s of signals) {
      assert(realIds.has(s.figId), `signal ${s.id} resolves: ${s.figId}`);
    }
  });

  test("every signal carries a real reported number and a named source", () => {
    for (const s of signals) {
      assert(Number.isFinite(s.low) && s.low > 0, `${s.id} has a numeric low`);
      assert(Number.isFinite(s.high) && s.high >= s.low, `${s.id} has a numeric high`);
      assert(typeof s.source === "string" && s.source.length > 0, `${s.id} names its source`);
      assert(typeof s.display === "string" && s.display.length > 0, `${s.id} has a display`);
      assert(["sold-band", "sold-avg", "listing", "claimed"].includes(s.kind), `${s.id} kind is known`);
    }
  });

  test("pinned reality: the white Doom band and the Red Skull listing", () => {
    const white = signals.find((s) => s.id === "white-epic-heroes-doom");
    assert.equal(white.low, 115);
    assert.equal(white.high, 200);
    assert(white.sourceUrl.includes("actionfigure411"), "cited tracker URL");
    const skull = signals.find((s) => s.id === "series5-red-skull");
    assert.equal(skull.kind, "listing", "listing, never presented as a sale");
  });

  test("the Deadpool claim is flagged single-source", () => {
    const dp = signals.find((s) => s.id === "series6-deadpool");
    assert.equal(dp.singleSource, true);
    assert.equal(dp.kind, "claimed");
  });
});
