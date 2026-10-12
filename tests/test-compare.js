/* Wave 26: VS mode (Figure Compare) + encyclopedia deep-link overhaul tests.
   Logic tests run against pinned fixtures; data tests run against the REAL
   data/figures.json + api/v1/compare.json + built waves/*.html — every deep
   link must resolve, every cross-reference must point at a real figure, and no
   price may be invented (guidance may only repeat numbers from the fixtures). */
"use strict";

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import {
  MAX_SLOTS, parseCompareParams, buildCompareUrl, waveAnchors,
  reviewSearchUrl, upgradeNote, guidanceFor,
} from "../assets/js/compare-guide.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const figRaw = JSON.parse(readFileSync(join(ROOT, "data/figures.json"), "utf8"));
const compareRaw = JSON.parse(readFileSync(join(ROOT, "api/v1/compare.json"), "utf8"));
const profiles = compareRaw.profiles;

/* Real archive id set: <waveId>::<figureName>, same format as data.js. */
const realIds = new Set();
const wavesById = {};
for (const w of figRaw.waves) {
  wavesById[w.id] = w;
  for (const f of w.figures) realIds.add(`${w.id}::${f.name}`);
}
const profById = new Map();
for (const p of profiles) if (!profById.has(p.id)) profById.set(p.id, p);

function figLike(id) {
  const [waveId, name] = id.split("::");
  const w = wavesById[waveId];
  const f = w.figures.find((x) => x.name === name);
  return { id, name: f.name, variant: f.variant ?? null, exclusive: f.exclusive ?? null,
           waveSeries: w.series, year: w.year, manufacturer: w.manufacturer, waveBaf: w.baf ?? null };
}

suite("compare: URL params", () => {
  test("parses a+b share links", () => {
    assert.deepEqual(parseCompareParams("?a=x%3A%3Ay&b=z"), ["x::y", "z"]);
  });
  test("dedupes and caps at 4 slots", () => {
    // URLSearchParams.get returns the FIRST value per key: a=1, b=2 win over later dupes.
    assert.deepEqual(parseCompareParams("?a=1&b=2&c=2&d=3&a=1&b=4"), ["1", "2", "3"]);
    assert.equal(parseCompareParams("?a=1&b=2&c=3&d=4&e=5").length, 4);
  });
  test("empty/malformed query -> []", () => {
    assert.deepEqual(parseCompareParams(""), []);
    assert.deepEqual(parseCompareParams("?"), []);
    assert.deepEqual(parseCompareParams(null), []);
  });
  test("MAX_SLOTS is 4", () => assert.equal(MAX_SLOTS, 4));
});

suite("compare: share URLs", () => {
  test("buildCompareUrl round-trips through parseCompareParams", () => {
    const ids = ["hasbro-2013-epic-heroes::Doctor Doom", "toybiz-2003-series-5::Red Skull"];
    const url = buildCompareUrl(ids);
    assert(url.startsWith("compare.html?a="), url);
    assert.deepEqual(parseCompareParams("?" + url.split("?")[1]), ids);
  });
  test("empty selection -> bare page", () => {
    assert.equal(buildCompareUrl([]), "compare.html");
  });
});

suite("compare: deep-link anchors", () => {
  test("anchor algorithm matches every real deepLink (JS/Python parity)", () => {
    let checked = 0;
    for (const w of figRaw.waves) {
      const anchors = waveAnchors(w.figures.map((f) => ({ name: f.name, variant: f.variant })));
      assert.equal(new Set(anchors).size, anchors.length, `anchor collision in ${w.id}`);
      w.figures.forEach((f, i) => {
        const want = `waves/${w.id}.html#${anchors[i]}`;
        const got = profiles.filter((p) => p.waveId === w.id)[i].deepLink;
        assert.equal(got, want, `${w.id}::${f.name}`);
        checked++;
      });
    }
    assert(checked >= 1904, `checked ${checked}`);
  });
  test("pinned: Series 1 Hulk collision disambiguates", () => {
    const w = wavesById["toybiz-2002-series-1"];
    const anchors = waveAnchors(w.figures.map((f) => ({ name: f.name, variant: f.variant })));
    const hulks = w.figures.map((f, i) => [f.name, anchors[i]]).filter(([n]) => n === "Hulk");
    assert.equal(hulks.length, 2);
    assert(hulks[0][1] !== hulks[1][1], JSON.stringify(hulks));
    assert(hulks[1][1].includes("straight-fingers"), hulks[1][1]);
  });
  test("every deepLink anchor exists in the built wave page", () => {
    const byWave = {};
    for (const p of profiles) (byWave[p.waveId] ??= []).push(p);
    let checked = 0;
    for (const [wid, ps] of Object.entries(byWave)) {
      const html = readFileSync(join(ROOT, "waves", `${wid}.html`), "utf8");
      for (const p of ps) {
        const anchor = p.deepLink.split("#")[1];
        assert(html.includes(`id="${anchor}"`), `${wid}: missing #${anchor}`);
        checked++;
      }
    }
    assert(checked >= 1904, `checked ${checked}`);
  });
  test("every profile id resolves to a real archive figure", () => {
    for (const p of profiles) assert(realIds.has(p.id), `unresolved ${p.id}`);
  });
});

suite("compare: cross-reference integrity (real data)", () => {
  test("rarity cross-refs resolve + pinned Red Skull chase", () => {
    const r = profById.get("toybiz-2003-series-5::Red Skull");
    assert(r.rarity, "Red Skull should carry a rarity cross-ref");
    assert.equal(r.rarity.tier, "chase");
    assert.equal(r.rarity.questAchievement, "chase-hunter");
    for (const p of profiles) {
      if (p.rarity) assert(realIds.has(p.id), p.id);
    }
  });
  test("price signals: all 7 attached, none invented", () => {
    const attached = profiles.flatMap((p) => p.priceSignals);
    assert.equal(attached.length, 7);
    const doom = profById.get("hasbro-2013-epic-heroes::Doctor Doom");
    const ids = doom.priceSignals.map((s) => s.id).sort();
    assert.deepEqual(ids, ["green-epic-heroes-doom", "white-epic-heroes-doom"]);
    const white = doom.priceSignals.find((s) => s.id === "white-epic-heroes-doom");
    assert.equal(white.low, 115);
    assert.equal(white.high, 200);
    assert.equal(white.kind, "sold-band");
  });
  test("KO watch: pinned Dragon Man + Carnage tell", () => {
    const dm = profiles.find((p) => p.name === "Dragon Man");
    assert(dm && dm.koWatch, "Dragon Man should be a KO target");
    assert(dm.koWatch.note.includes("Auth Wizard"));
    const carnage = profiles.find((p) => p.name === "Carnage" && p.koWatch);
    assert(carnage && carnage.koWatch.note.includes("silver eyes"));
  });
  test("upgrade paths: ids resolve, pinned Doom variant present", () => {
    const doom = profById.get("hasbro-2013-epic-heroes::Doctor Doom");
    assert(doom.upgradePaths.length > 0);
    for (const u of doom.upgradePaths) assert(realIds.has(u.id), `bad upgrade id ${u.id}`);
    assert(doom.upgradePaths.every((u) => u.id !== doom.id), "no self-links");
    assert(doom.upgradePaths.length <= 8, "capped at 8");
    for (const p of profiles) {
      assert(p.upgradePaths.length <= 8, p.id);
      for (const u of p.upgradePaths) assert(realIds.has(u.id), `bad upgrade id ${u.id}`);
    }
  });
  test("KO_TARGETS parity: Python compare_lib matches JS ko-targets.js", () => {
    const py = readFileSync(join(ROOT, "scripts/compare_lib.py"), "utf8");
    const js = readFileSync(join(ROOT, "assets/js/ko-targets.js"), "utf8");
    const pyMatches = [...py.matchAll(/"match":\s*"([^"]+)"/g)].map((m) => m[1]).sort();
    const jsMatches = [...js.matchAll(/match:\s*"([^"]+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(pyMatches, jsMatches);
  });
});

suite("compare: upgrade notes", () => {
  test("variant note names the budget path", () => {
    const n = upgradeNote({ relation: "variant", variant: "Future Foundation", exclusive: null });
    assert(n.includes("Future Foundation") && n.includes("budget path"), n);
  });
  test("reissue note cites the rarity/provenance rule", () => {
    const n = upgradeNote({ relation: "reissue", variant: null, exclusive: null });
    assert(n.includes("reissue") && n.includes("rarity or provenance"), n);
  });
  test("all relations produce honest notes", () => {
    for (const rel of ["variant", "base-release", "reissue", "exclusive", "same-character"]) {
      const n = upgradeNote({ relation: rel, variant: null, exclusive: null });
      assert(n.length > 20, rel);
      assert(!/best|winner|must buy/i.test(n), `hype in ${rel}: ${n}`);
    }
  });
});

suite("compare: guidance (which to buy)", () => {
  const doomWhite = figLike("hasbro-2013-epic-heroes::Doctor Doom");
  const skull = figLike("toybiz-2003-series-5::Red Skull");
  const dragonMan = figLike(profiles.find((p) => p.name === "Dragon Man").id);

  test("price bullet compares reported lows with sources, never invents", () => {
    const g = guidanceFor([doomWhite, skull], profById);
    const price = g.find((x) => x.kind === "price");
    assert(price, "price bullet present");
    const text = price.html.replace(/<[^>]+>/g, "");
    // Reported inputs only: white Doom low $115, Red Skull low $59.99.
    assert(text.includes("$115") && text.includes("$59.99"), text);
    // The verdict may state the derived gap (115 - 59.99 = 55.01): arithmetic on
    // reported numbers, not an invented price.
    assert(text.includes("$55.01"), `expected the derived gap in: ${text}`);
    assert(text.includes("Reported ranges, not live prices"), text);
  });
  test("kind mismatch is called out, not hidden", () => {
    // Red Skull signal is kind=listing; white Doom is sold-band.
    const g = guidanceFor([doomWhite, skull], profById);
    const price = g.find((x) => x.kind === "price");
    assert(price.html.includes("not directly comparable") || price.html.includes("listing"), price.html);
  });
  test("rarity + quest + KO bullets cite their evidence", () => {
    const g = guidanceFor([skull, dragonMan], profById);
    const rar = g.find((x) => x.kind === "rarity");
    assert(rar && rar.html.includes("rarity.html#tier-chase") && rar.html.includes("chase-hunter"), rar?.html);
    const ko = g.find((x) => x.kind === "ko");
    assert(ko && ko.html.includes("Auth Wizard"), ko?.html);
  });
  test("close bullet always last, never declares a winner", () => {
    const g = guidanceFor([doomWhite, skull], profById);
    assert.equal(g[g.length - 1].kind, "close");
    for (const b of g) assert(!/you should buy|clear winner|best pick/i.test(b.html), b.html);
  });
  test("no-signal pair gets the honest fallback", () => {
    const a = figLike("toybiz-2002-series-1::Hulk");
    const b = figLike("toybiz-2002-series-1::Toad");
    const g = guidanceFor([a, b], profById);
    const price = g.find((x) => x.kind === "price");
    assert(price.html.includes("No reported price signals"), price.html);
  });
});

suite("compare: review search URL", () => {
  test("points at YouTube review search, never a fabricated review", () => {
    const u = reviewSearchUrl("Doctor Doom", "Future Foundation");
    assert(u.startsWith("https://www.youtube.com/results?search_query="), u);
    assert(u.includes("review"), u);
  });
});
