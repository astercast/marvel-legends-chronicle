/* My Vault — the personal collection tracker (rotation 10 flagship).
   Guards:
   - the Watching shelf is a registered storage key (mlc_watching_v1)
   - the tracker state machine: Owned ⊥ Wanted, Owned clears Watching,
     Wanted leaves Watching alone, toggles persist to the right keys
   - the vault model's ledger math (halls, counts, by-year, by-wave,
     complete waves, unresolved marks counted honestly)
   - the page wiring: mounts, script, nav registry, and NO prices anywhere
*/
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import { STORE_KEYS } from "../assets/js/config.js";
import { applyTrackToggle, trackState } from "../assets/js/tracker.js";
import { buildVaultModel } from "../assets/js/vault-model.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

function clearTracker() {
  localStorage.removeItem(STORE_KEYS.owned);
  localStorage.removeItem(STORE_KEYS.wanted);
  localStorage.removeItem(STORE_KEYS.watching);
}

suite("my-vault — watching shelf registration", () => {
  test("watching is a registered, namespaced, versioned key", () => {
    assert.equal(STORE_KEYS.watching, "mlc_watching_v1");
  });
});

suite("my-vault — tracker state machine", () => {
  test("owned and wanted are mutually exclusive, both ways", () => {
    clearTracker();
    applyTrackToggle("wanted", "w1::A");
    assert.deepEqual(trackState("w1::A"), { owned: false, wanted: true, watching: false });
    applyTrackToggle("owned", "w1::A");
    assert.deepEqual(trackState("w1::A"), { owned: true, wanted: false, watching: false });
    applyTrackToggle("wanted", "w1::A");
    assert.deepEqual(trackState("w1::A"), { owned: false, wanted: true, watching: false });
  });

  test("marking owned ends the watch; wanted leaves the watch alone", () => {
    clearTracker();
    applyTrackToggle("watching", "w1::B");
    applyTrackToggle("wanted", "w1::B");
    assert.deepEqual(trackState("w1::B"), { owned: false, wanted: true, watching: true });
    applyTrackToggle("owned", "w1::B");
    assert.deepEqual(trackState("w1::B"), { owned: true, wanted: false, watching: false });
  });

  test("toggles persist to their own keys and toggle back off", () => {
    clearTracker();
    applyTrackToggle("watching", "w1::C");
    assert.deepEqual(JSON.parse(localStorage.getItem(STORE_KEYS.watching)), ["w1::C"]);
    applyTrackToggle("watching", "w1::C");
    assert.deepEqual(trackState("w1::C"), { owned: false, wanted: false, watching: false });
    assert.deepEqual(JSON.parse(localStorage.getItem(STORE_KEYS.watching)), []);
  });

  test("unknown kinds are rejected, not silently stored", () => {
    clearTracker();
    assert.throws(() => applyTrackToggle("sold", "w1::D"), /unknown track kind/);
  });
});

/* Fixture catalog: two waves, five figures, 2002 + 2007. */
const FIGURES = [
  { id: "w-a::Alpha", name: "Alpha", waveId: "w-a", waveSeries: "Series A", year: 2002, manufacturer: "Toy Biz", bafPiece: null, exclusive: null, variant: null, notes: null, waveBaf: "Big Guy" },
  { id: "w-a::Beta", name: "Beta", waveId: "w-a", waveSeries: "Series A", year: 2002, manufacturer: "Toy Biz", bafPiece: "Arm", exclusive: null, variant: null, notes: null, waveBaf: "Big Guy" },
  { id: "w-a::Gamma", name: "Gamma", waveId: "w-a", waveSeries: "Series A", year: 2002, manufacturer: "Toy Biz", bafPiece: "Leg", exclusive: null, variant: null, notes: null, waveBaf: "Big Guy" },
  { id: "w-b::Delta", name: "Delta", waveId: "w-b", waveSeries: "Series B", year: 2007, manufacturer: "Hasbro", bafPiece: null, exclusive: null, variant: null, notes: null, waveBaf: null },
  { id: "w-b::Epsilon", name: "Epsilon", waveId: "w-b", waveSeries: "Series B", year: 2007, manufacturer: "Hasbro", bafPiece: null, exclusive: null, variant: null, notes: null, waveBaf: null },
];
const WAVES = [
  { id: "w-a", series: "Series A", year: 2002, manufacturer: "Toy Biz", figureCount: 3 },
  { id: "w-b", series: "Series B", year: 2007, manufacturer: "Hasbro", figureCount: 2 },
];
const marks = (o = [], w = [], t = []) => ({ owned: new Set(o), wanted: new Set(w), watching: new Set(t) });

suite("my-vault — model ledgers", () => {
  test("empty marks produce the honest empty model", () => {
    const m = buildVaultModel(FIGURES, WAVES, marks());
    assert.equal(m.empty, true);
    assert.equal(m.counts.marked, 0);
    assert.equal(m.counts.total, 5);
    assert.equal(m.byWave.length, 0);
    assert.equal(m.byYear.length, 2, "every archive year still ledgers");
  });

  test("halls come back in catalog order with true counts", () => {
    const m = buildVaultModel(FIGURES, WAVES, marks(["w-a::Gamma", "w-a::Alpha"], ["w-b::Delta"], ["w-a::Beta"]));
    assert.deepEqual(m.halls.owned.map((f) => f.name), ["Alpha", "Gamma"]);
    assert.equal(m.counts.owned, 2);
    assert.equal(m.counts.wanted, 1);
    assert.equal(m.counts.watching, 1);
    assert.equal(m.counts.ownedPct, 40);
    assert.equal(m.empty, false);
  });

  test("by-year and by-wave math, complete-wave detection", () => {
    const m = buildVaultModel(FIGURES, WAVES, marks(["w-a::Alpha", "w-a::Beta", "w-a::Gamma", "w-b::Delta"], [], ["w-b::Epsilon"]));
    const y2002 = m.byYear.find((r) => r.year === 2002);
    assert.equal(y2002.owned, 3); assert.equal(y2002.total, 3); assert.equal(y2002.pct, 100);
    const y2007 = m.byYear.find((r) => r.year === 2007);
    assert.equal(y2007.owned, 1); assert.equal(y2007.watching, 1); assert.equal(y2007.pct, 50);
    assert.equal(m.completeWaves.length, 1);
    assert.equal(m.completeWaves[0].id, "w-a");
    assert.equal(m.wavesTouched, 2);
    assert.equal(m.byWave[0].id, "w-a", "closest to complete sorts first");
  });

  test("marks for figures the archive no longer carries count as unresolved", () => {
    const m = buildVaultModel(FIGURES, WAVES, marks(["w-a::Alpha", "gone::Ghost"], [], []));
    assert.equal(m.counts.owned, 1, "the ghost is not rendered as a plate");
    assert.equal(m.counts.unresolved, 1, "and it is not silently dropped either");
  });
});

suite("my-vault — page wiring", () => {
  test("the page exists with its mounts and module", () => {
    const page = read("my-vault.html");
    for (const id of ["vault-empty", "vault-dash", "vault-kpis", "vault-filter", "vault-halls", "vault-years", "vault-waves"]) {
      assert(page.includes(`id="${id}"`), `mount #${id}`);
    }
    assert(page.includes('src="assets/js/my-vault.js"'), "page module loaded");
    assert(page.includes("My Vault"), "page names itself");
  });

  test("the registry carries the new door in NAV and in the Your Shelf hall", () => {
    const nav = read("scripts/nav_data.py");
    assert(nav.includes('("my-vault.html", "My Vault")'), "NAV entry");
    assert(nav.includes('("my-vault.html", "My Vault",'), "hall entry with blurb");
  });

  test("no prices anywhere in the vault: a record of holdings, not a valuation", () => {
    for (const f of ["assets/js/my-vault.js", "assets/js/vault-model.js"]) {
      const src = read(f);
      assert(!/price/i.test(src.replace(/no prices|prices anywhere|no values/g, "")), `${f} stays price-free`);
      assert(!/\$\d/.test(src), `${f} renders no currency amounts`);
    }
  });

  test("figure surfaces offer all three shelves", () => {
    const tracker = read("assets/js/tracker.js");
    for (const kind of ["owned", "wanted", "watching"]) {
      assert(tracker.includes(`data-track="${kind}"`), `tracker button: ${kind}`);
    }
    const dialog = read("assets/js/figure-dialog.js");
    assert(dialog.includes("on your watch list"), "dialog names the watch state");
  });
});
