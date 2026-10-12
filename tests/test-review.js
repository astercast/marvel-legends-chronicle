/* Wave 27: "2026: The State of Legends" year-in-review tests.
   - Pinned-fixture tests for the review computations: top-10 distinction
     scoring + ordering (score desc, alphabetical tie-break) and price-movement
     math (first->last delta, %). The test recomputes both from the source
     data files and requires data/v1/year-review.json to match.
   - Real-data integrity: every ref resolves, every source URL well-formed,
     every sold sits inside its signal's reported band.
   - Page + API structure: markers resolved, month sections, scrubber links,
     deep links point at real anchors in built wave pages, nav present. */
"use strict";

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import { waveAnchors } from "../assets/js/compare-guide.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const review = JSON.parse(readFileSync(join(ROOT, "data/year-review.json"), "utf8"));
const figRaw = JSON.parse(readFileSync(join(ROOT, "data/figures.json"), "utf8"));
const preRaw = JSON.parse(readFileSync(join(ROOT, "data/preorders.json"), "utf8"));
const sigRaw = JSON.parse(readFileSync(join(ROOT, "data/price-signals.json"), "utf8"));
const api = JSON.parse(readFileSync(join(ROOT, "data/v1/year-review.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(ROOT, "data/v1/index.json"), "utf8"));
const page = readFileSync(join(ROOT, "2026-review.html"), "utf8");

const wavesById = new Map(figRaw.waves.map((w) => [w.id, w]));
const realFigIds = new Set();
for (const w of figRaw.waves) for (const f of w.figures) realFigIds.add(`${w.id}::${f.name}`);
const preIds = new Set(preRaw.items.map((i) => i.id));
const preById = new Map(preRaw.items.map((i) => [i.id, i]));
const sigById = new Map(sigRaw.signals.map((s) => [s.id, s]));
const URL_OK = /^(https?:\/\/[^\s'"<>]+|[a-z0-9_./-]+\.html(\?[^\s'"<>]*)?)$/;

/* --- pure recomputation of the builder's math (pinned fixtures below) --- */
function scoreEntry(entry, scoring) {
  return entry.distinctions.reduce((s, d) => {
    if (!(d.kind in scoring)) throw new Error(`unknown distinction kind: ${d.kind}`);
    return s + scoring[d.kind];
  }, 0);
}
function rankTop10(entries, scoring) {
  return [...entries].sort((a, b) =>
    scoreEntry(b, scoring) - scoreEntry(a, scoring) ||
    a.display.toLowerCase().localeCompare(b.display.toLowerCase()));
}
function movementMath(solds) {
  const first = solds[0][1], last = solds[solds.length - 1][1];
  const delta = last - first;
  return { first, last, delta: Math.round(delta * 100) / 100,
           pct: Math.round((delta / first) * 1000) / 10, n: solds.length };
}

suite("review computations: top-10 scoring (pinned fixtures)", () => {
  test("scoring table is the published one", () => {
    assert.deepEqual(review.scoring,
      { "first-ever": 2, "first-since": 1, "pack-in": 1, "format": 1, "archive-first": 1, "market-story": 1 },
      "scoring table must match the documented weights");
  });

  test("fixture scores: 4 / 3 / 2 for the top three entries", () => {
    const byId = new Map(review.top10.map((e) => [e.id, e]));
    assert.equal(scoreEntry(byId.get("tas-retro-wave"), review.scoring), 4, "tas-retro-wave = 2+1+1");
    assert.equal(scoreEntry(byId.get("bastion-trask-2pack"), review.scoring), 3, "bastion-trask-2pack = 2+1");
    assert.equal(scoreEntry(byId.get("cypher-target"), review.scoring), 2, "cypher-target = 2");
  });

  test("unknown distinction kinds can never score", () => {
    assert.throws(() => scoreEntry({ distinctions: [{ kind: "vibes", claim: "x", source: "y" }] }, review.scoring),
      "unknown kind must throw, not score 0 silently");
  });

  test("computed ranking matches the pinned top-10 order", () => {
    const ranked = rankTop10(review.top10, review.scoring).map((e) => e.id);
    assert.deepEqual(ranked, [
      "tas-retro-wave", "bastion-trask-2pack", "cypher-target", "mtg-wave-2",
      "mini-comics-wave-3", "retro-venom-reissue", "xmen97-retro-wave",
      "astonishing-cyclops-wolverine-2pack", "doomsday-wave", "doomsday-wave-2",
    ], "pinned top-10 order");
  });

  test("tie-break is alphabetical by display name", () => {
    const ranked = rankTop10(review.top10, review.scoring);
    const twos = ranked.filter((e) => scoreEntry(e, review.scoring) === 2).map((e) => e.display);
    const sorted = [...twos].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    assert.deepEqual(twos, sorted, "score-2 ties break alphabetically");
  });

  test("API payload order + scores match the recomputation", () => {
    const ranked = rankTop10(review.top10, review.scoring);
    assert.equal(api.top10.length, 10, "API top10 has 10 entries");
    ranked.forEach((e, i) => {
      assert.equal(api.top10[i].id, e.id, `API order[${i}]`);
      assert.equal(api.top10[i].score, scoreEntry(e, review.scoring), `API score for ${e.id}`);
      assert.deepEqual(api.top10[i].distinctions, e.distinctions, `API distinctions for ${e.id}`);
    });
  });
});

suite("review computations: price-movement math (pinned fixtures)", () => {
  const doom = review.priceMovements.find((p) => p.signalId === "white-epic-heroes-doom");

  test("white Doom: pinned sold sequence", () => {
    assert.deepEqual(doom.solds,
      [["2026-03-12", 150], ["2026-05-03", 149], ["2026-08-10", 200]],
      "pinned white-Doom sold sequence");
  });

  test("white Doom: +$50 (+33.3%) Mar -> Aug 2026", () => {
    const m = movementMath(doom.solds);
    assert.equal(m.first, 150, "first sold");
    assert.equal(m.last, 200, "last sold");
    assert.equal(m.delta, 50, "delta");
    assert.equal(m.pct, 33.3, "percent change");
  });

  test("movement math edge: flat sequence is 0/0%", () => {
    const m = movementMath([["2026-01-01", 100], ["2026-02-01", 100]]);
    assert.equal(m.delta, 0, "flat delta");
    assert.equal(m.pct, 0, "flat pct");
  });

  test("API movement math matches recomputation", () => {
    for (const pm of api.priceMovements) {
      const src = review.priceMovements.find((p) => p.signalId === pm.signalId);
      assert.deepEqual(pm.math, movementMath(src.solds), `math for ${pm.signalId}`);
    }
  });

  test("every sold sits inside its signal's reported band", () => {
    for (const pm of review.priceMovements) {
      const s = sigById.get(pm.signalId);
      assert(s, `signal ${pm.signalId} exists`);
      for (const [date, price] of pm.solds) {
        assert(/^\d{4}-\d{2}-\d{2}$/.test(date), `bad sold date ${date}`);
        assert(price >= s.low && price <= s.high,
          `sold $${price} outside reported band $${s.low}-$${s.high}`);
      }
    }
  });
});

suite("review data integrity (real records only)", () => {
  test("exactly 10 top-10 entries, unique ids, all refs resolve", () => {
    assert.equal(review.top10.length, 10, "10 entries");
    const ids = review.top10.map((e) => e.id);
    assert.equal(new Set(ids).size, 10, "unique ids");
    for (const e of review.top10) {
      assert(preIds.has(e.ref.id), `top10 ref ${e.ref.id} is not a real preorder item`);
      assert(e.blurb && e.blurb.length > 20, `${e.id} needs a blurb`);
      assert(e.distinctions.length >= 1, `${e.id} needs distinctions`);
      for (const d of e.distinctions) {
        assert(d.kind in review.scoring, `unknown kind ${d.kind} in ${e.id}`);
        assert(d.claim && d.source, `distinction in ${e.id} needs claim + source`);
      }
      if (e.figureRef) assert(realFigIds.has(e.figureRef), `figureRef ${e.figureRef} not real`);
      if (e.waveRef) assert(wavesById.has(e.waveRef), `waveRef ${e.waveRef} not real`);
    }
  });

  test("every month is 2026-MM; events have status + labeled source", () => {
    assert.equal(review.months.length, 12, "12 months");
    const seen = new Set();
    for (const m of review.months) {
      assert(/^2026-(0[1-9]|1[0-2])$/.test(m.month), `bad month ${m.month}`);
      assert(!seen.has(m.month), `duplicate month ${m.month}`);
      seen.add(m.month);
      for (const ev of m.events) {
        assert(ev.text, `event in ${m.month} needs text`);
        assert(["documented", "scheduled"].includes(ev.status), `event in ${m.month} needs documented|scheduled`);
        assert(ev.source && ev.source.label && URL_OK.test(ev.source.url), `bad event source in ${m.month}`);
      }
    }
  });

  test("best-value packs resolve and have numeric prices", () => {
    for (const p of review.bestValue.packs) {
      const it = preById.get(p.itemId);
      assert(it, `pack ${p.itemId} not a real item`);
      assert(typeof it.price === "number" && it.price > 0, `pack ${p.itemId} needs a numeric price`);
      assert(Number.isInteger(p.figures) && p.figures > 1, `pack ${p.itemId} needs figure count > 1`);
    }
    // pinned: cheapest per-figure pack is Reed + HERBIE
    const perFig = review.bestValue.packs
      .map((p) => [p.itemId, preById.get(p.itemId).price / p.figures])
      .sort((a, b) => a[1] - b[1]);
    assert.equal(perFig[0][0], "doomsday-ff-reed-herbie", "cheapest per-figure pack");
    assert(perFig[0][1] < 20, "under $20 per packed figure");
  });

  test("methodology, gaps, surprises, KO, rarity, narrative all present + sourced", () => {
    assert(review.methodology.length >= 3, "methodology paragraphs");
    assert(review.gaps.length >= 3, "honest gaps");
    assert(review.surprises.length >= 5, "surprises");
    assert(review.rarityHighlights.length >= 3, "rarity highlights");
    assert(review.narrative.length >= 3, "narrative sections");
    assert(review.koWatch.headline && review.koWatch.items.length >= 3, "KO watch");
    for (const x of [...review.surprises, ...review.rarityHighlights]) {
      assert(URL_OK.test(x.source.url), `bad source URL: ${x.source.url}`);
    }
    for (const n of review.narrative) for (const s of n.sources) assert(URL_OK.test(s.url), `bad narrative URL`);
    for (const k of review.koWatch.items) assert(URL_OK.test(k.source.url), `bad KO URL`);
  });

  test("gaps admit the price-data and 2026-coverage limits", () => {
    const gaps = review.gaps.join(" ");
    assert(gaps.includes("7 figures"), "gap: price data covers 7 figures");
    assert(/aftermarket/i.test(gaps) && /2026/.test(gaps), "gap: 2026 aftermarket limits");
    assert(/no production numbers/i.test(gaps), "gap: no production numbers");
  });
});

suite("review page (2026-review.html)", () => {
  test("all builder markers resolved with content", () => {
    const pairs = [...page.matchAll(/<!-- REVIEW:([A-Z]+)-BEGIN -->([\s\S]*?)<!-- REVIEW:\1-END -->/g)];
    assert(pairs.length >= 10, `expected 10+ marker pairs, got ${pairs.length}`);
    for (const [, name, body] of pairs) {
      assert(body.trim().length > 50, `marker ${name} rendered empty`);
    }
  });

  test("12 month sections with scrubber links", () => {
    for (let m = 1; m <= 12; m++) {
      const mm = `2026-${String(m).padStart(2, "0")}`;
      assert(page.includes(`id="month-${mm}"`), `month section ${mm}`);
      assert(page.includes(`href="#month-${mm}"`), `scrubber link ${mm}`);
    }
    assert(page.includes('id="yr-scrubber"'), "scrubber nav present");
  });

  test("top-10 anchors + criteria shown on the page", () => {
    for (const e of review.top10) assert(page.includes(`id="yr-top-${e.id}"`), `top10 anchor ${e.id}`);
    assert(page.includes("Criteria"), "criteria label shown");
    assert(page.includes("first-ever = 2 pts"), "scoring weights shown");
    assert(page.includes("Ties break alphabetically"), "tie-break shown");
  });

  test("honest framing copy present", () => {
    const lower = page.toLowerCase();
    assert(lower.includes("as documented in the chronicle"), "honest framing");
    assert(lower.includes("no price index"), "no-index honesty");
    assert(lower.includes("reported ranges, not live prices"), "reported-ranges honesty");
  });

  test("figure deep links resolve to real anchors in built wave pages", () => {
    for (const e of review.top10) {
      if (!e.figureRef) continue;
      const [wid, name] = e.figureRef.split("::");
      const w = wavesById.get(wid);
      const anchors = waveAnchors(w.figures.map((f) => ({ name: f.name, variant: f.variant })));
      const idx = w.figures.findIndex((f) => f.name === name);
      const anchor = anchors[idx];
      const html = readFileSync(join(ROOT, "waves", `${wid}.html`), "utf8");
      assert(html.includes(`id="${anchor}"`), `${e.figureRef}: anchor #${anchor} in wave page`);
      assert(page.includes(`waves/${wid}.html#${anchor}`), `${e.figureRef}: deep link on review page`);
    }
  });

  test("review.js element ids exist on the page", () => {
    assert(page.includes('id="yr-scrubber"'), "#yr-scrubber present for review.js");
    assert(page.includes('src="assets/js/review.js"'), "review.js included");
  });

  test("cross-links to timeline, briefing, rarity, radar, encyclopedia, VS mode", () => {
    for (const href of ["timeline.html", "market-briefing.html", "rarity.html", "radar.html",
                        "preorders.html", "encyclopedia.html", "compare.html", "quest.html",
                        "data/v1/year-review.json"]) {
      assert(page.includes(`href="${href}"`), `cross-link ${href}`);
    }
  });

  test("a11y: skip link, labelled sections, reduced-motion", () => {
    assert(page.includes('class="skip-link"'), "skip link");
    assert(page.includes('aria-label="2026 month scrubber"'), "scrubber labelled");
    assert(page.includes("prefers-reduced-motion"), "reduced-motion CSS");
    assert(page.includes('aria-current="page"'), "nav current page");
  });
});

suite("review API endpoint (data/v1/year-review.json)", () => {
  test("manifest registers year-review as the 17th endpoint", () => {
    const names = Object.keys(manifest.endpoints);
    assert.equal(names.length, 17, "17 endpoints");
    const e = manifest.endpoints["year-review"];
    assert(e, "year-review in manifest");
    assert.equal(e.path, "data/v1/year-review.json", "path");
    assert.equal(e.schema, "data/v1/schema/year-review.json", "schema");
    assert.equal(e.itemSchema, "data/v1/schema/year-review-item.json", "itemSchema");
    assert.equal(e.records, 10, "records = 10 top-10 entries");
    assert(existsSync(join(ROOT, e.schema)), "envelope schema file exists");
    assert(existsSync(join(ROOT, e.itemSchema)), "item schema file exists");
  });

  test("top10 is the first list in the envelope (validator picks it)", () => {
    let firstList = null;
    for (const v of Object.values(api)) if (Array.isArray(v)) { firstList = v; break; }
    assert(firstList === api.top10, "top10 is the first array in the envelope");
  });

  test("archive stats match the real data", () => {
    const w26 = figRaw.waves.filter((w) => w.year === 2026);
    assert.equal(api.archiveStats.waves2026.length, w26.length, "2026 wave count");
    const figs = w26.reduce((n, w) => n + w.figures.length, 0);
    assert.equal(api.archiveStats.figures2026, figs, "2026 figure count");
    assert.equal(api.archiveStats.priceSignals, sigRaw.signals.length, "price signal count");
    assert(api.archiveStats.tracked2026 > 0 && api.archiveStats.tracked2026 <= preRaw.items.length,
      "tracked2026 sane");
  });

  test("API links resolve", () => {
    for (const t of api.top10) {
      assert(t.links.preorders === "preorders.html", "preorders link");
      if (t.links.deepLink) {
        const [path, frag] = t.links.deepLink.split("#");
        assert(existsSync(join(ROOT, path)), `deep link page ${path}`);
        const html = readFileSync(join(ROOT, path), "utf8");
        assert(html.includes(`id="${frag}"`), `deep link anchor ${frag}`);
      }
      if (t.links.wavePage) assert(existsSync(join(ROOT, t.links.wavePage)), `wave page ${t.links.wavePage}`);
      if (t.links.compareUrl) assert(t.links.compareUrl.startsWith("compare.html?a="), "compare URL shape");
    }
  });

  test("no invented prices: every sold traces to its signal's published note", () => {
    // the movement's sold sequence must already be published in the signal's
    // note text (same source record) — never introduced by the review.
    for (const pm of api.priceMovements) {
      const sig = sigById.get(pm.signalId);
      assert(sig, `signal ${pm.signalId} exists`);
      for (const s of pm.solds) {
        const needle = `$${Number(s.price).toFixed(s.price % 1 ? 2 : 0)}`;
        const plain = String(s.price);
        assert(sig.note.includes(needle) || sig.note.includes(plain),
          `sold ${s.price} is published in the ${pm.signalId} signal note`);
      }
      // and every sold sits inside the signal's reported band
      for (const s of pm.solds) {
        assert(s.price >= sig.low && s.price <= sig.high,
          `sold ${s.price} inside reported band ${sig.low}-${sig.high}`);
      }
    }
  });
});
