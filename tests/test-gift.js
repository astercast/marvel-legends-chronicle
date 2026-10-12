/* Wave 19 tests: Gift Finder 2.0 ranking logic against REAL archive ids.
   Scoring, teams, KO notes, price tiers, buy-this-not-that, pre-order flags,
   market-briefing notes, and URL prefills — all verified with real figure
   records from data/figures.json (no invented fixtures for the ranking core). */
import { suite, test, assert } from "./assert.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RECIPIENTS, TEAMS, teamKeysFor, baseName, bandAllows, priceTier,
  scoreGift, rankGifts, notThat, prefillFromParams, hofMap, marketNote,
  findPreorder,
} from "../assets/js/gift.js";
import { koNoteFor } from "../assets/js/ko-targets.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const archive = JSON.parse(readFileSync(join(root, "data", "figures.json"), "utf8"));
const figures = [];
for (const w of archive.waves) {
  for (const f of w.figures ?? []) {
    figures.push({
      id: `${w.id}::${f.name}`,
      waveId: w.id, waveSeries: w.series, year: w.year,
      manufacturer: w.manufacturer, source: w.source ?? null,
      ...f,
    });
  }
}
const enc = JSON.parse(readFileSync(join(root, "data", "encyclopedia.json"), "utf8"));
const preorders = JSON.parse(readFileSync(join(root, "data", "preorders.json"), "utf8")).items;

const byId = (id) => figures.find((f) => f.id === id);
const miles = byId("hasbro-2024-across-spider-verse-2::Spider-Man (Miles Morales)");
const pulseSpidey = byId("hasbro-2024-exclusives::Spider-Man");

suite("gift: team matching", () => {
  test("teamKeysFor resolves team names and keywords", () => {
    assert.deepEqual(teamKeysFor("X-Men"), TEAMS["X-Men"]);
    assert.deepEqual(teamKeysFor("mutant"), TEAMS["X-Men"]);
    assert.deepEqual(teamKeysFor("Deadpool"), TEAMS["Deadpool"]);
    assert.deepEqual(teamKeysFor(""), []);
    assert.deepEqual(teamKeysFor("Spider-Hamster"), [], "unknown team → no keys");
  });

  test("team search returns team matches from the real archive", () => {
    assert(miles, "Miles Morales Spider-Man fixture exists in the archive");
    const scored = rankGifts(figures, { band: "under50", charQ: "X-Men", recipient: "casual" });
    assert(scored.length > 10, `X-Men team pool is deep (${scored.length})`);
    for (const { fig } of scored.slice(0, 10)) {
      const hay = `${fig.name} ${fig.waveSeries}`.toLowerCase();
      assert(TEAMS["X-Men"].some((k) => hay.includes(k)), `team match: ${fig.name} / ${fig.waveSeries}`);
    }
  });
});

suite("gift: recipient-weighted ranking (real ids)", () => {
  test("kid ranking leads with the retail standard, not the exclusive", () => {
    assert(pulseSpidey, "Hasbro Pulse Spider-Man exclusive fixture exists");
    const kid = rankGifts(figures, { band: "splurge", charQ: "spider-man", recipient: "kid" });
    const top = kid[0].fig;
    assert(!top.exclusive && !top.variant, `kid top pick is retail-class: ${top.name} (${top.exclusive ?? top.variant ?? "standard"})`);
    assert(top.year >= 2024, `kid top pick is recent: ${top.name} (${top.year})`);
    const milesScore = scoreGift(miles, { charQ: "", teamKeys: TEAMS["Spider-Man"], recipient: "kid" });
    assert(milesScore > scoreGift(pulseSpidey, { charQ: "", teamKeys: TEAMS["Spider-Man"], recipient: "kid" }),
      "the 2024 Miles Morales standard outscores the Pulse exclusive for a kid");
  });

  test("collector ranking leads with rarity signals over the standard", () => {
    const coll = rankGifts(figures, { band: "splurge", charQ: "spider-man", recipient: "collector" });
    const top = coll[0].fig;
    assert(top.exclusive || top.variant, `collector top pick is special: ${top.name} (${top.exclusive ?? top.variant})`);
  });

  test("scores differ by recipient on the same figure", () => {
    const kidScore = scoreGift(pulseSpidey, { charQ: "spider-man", recipient: "kid" });
    const collScore = scoreGift(pulseSpidey, { charQ: "spider-man", recipient: "collector" });
    assert(collScore > kidScore, `exclusive: collector ${collScore} > kid ${kidScore}`);
    const kidStd = scoreGift(miles, { charQ: "spider-man", recipient: "kid" });
    const collStd = scoreGift(miles, { charQ: "spider-man", recipient: "collector" });
    assert(kidStd > collStd, `standard: kid ${kidStd} > collector ${collStd}`);
  });

  test("character/team match beats everything", () => {
    /* "spider-man" is also a team keyword, so the pool is character + team. */
    const ranked = rankGifts(figures, { band: "splurge", charQ: "spider-man", recipient: "casual" });
    for (const { fig } of ranked.slice(0, 12)) {
      const hay = `${fig.name} ${fig.waveSeries}`.toLowerCase();
      assert(/spider-man/i.test(fig.name) || TEAMS["Spider-Man"].some((k) => hay.includes(k)),
        `character/team match: ${fig.name} / ${fig.waveSeries}`);
    }
  });

  test("pure character input filters by name", () => {
    const ranked = rankGifts(figures, { band: "splurge", charQ: "storm", recipient: "casual" });
    assert(ranked.length > 0, "storm pool is non-empty");
    for (const { fig } of ranked.slice(0, 12)) {
      assert(/storm/i.test(fig.name), `name match: ${fig.name}`);
    }
  });
});

suite("gift: price tiers", () => {
  test("tier labels are classes, never prices", () => {
    assert.equal(priceTier(miles).tier, 1, "Miles Morales standard → tier 1");
    assert.equal(priceTier(pulseSpidey).tier, 3, "Pulse exclusive → tier 3");
    assert(priceTier(pulseSpidey).label.includes("Hasbro Pulse"), "tier 3 names the exclusive");
    assert.equal(priceTier({ exclusive: "HasLab", waveSeries: "X" }).tier, 4, "HasLab → tier 4");
    assert.equal(priceTier({ exclusive: "Box set exclusive", waveSeries: "Box Set - X" }).tier, 2, "box set exclusive → tier 2");
    for (const t of [priceTier(miles), priceTier(pulseSpidey)]) {
      assert(!/\$\d/.test(t.label), `no dollar figures in tier label: ${t.label}`);
    }
  });
});

suite("gift: KO-risk notes", () => {
  test("documented KO targets flag, clean figures don't", () => {
    const dm = koNoteFor("Dragon Man");
    assert(dm && dm.note.includes("Known KO target"), `Dragon Man flags: ${dm?.note}`);
    assert.equal(dm.source, "Encyclopedia bootleg guide");
    const cyc = koNoteFor("Cyclops (X-Men '97)");
    assert(cyc && /Mustang Toyz/.test(cyc.note), `X-Men '97 Cyclops flags: ${cyc?.note}`);
    assert.equal(cyc.source, "2026 Holiday Guide");
    assert.equal(koNoteFor("Spider-Man (Miles Morales)"), null, "clean figure → no KO note");
    assert.equal(koNoteFor(""), null, "empty name → null");
  });

  test("KO targets score lower as gift picks", () => {
    const dragon = figures.find((f) => f.name === "Dragon Man");
    assert(dragon, "Dragon Man exists in the archive");
    const withKo = scoreGift(dragon, { recipient: "kid" });
    const clean = scoreGift({ ...dragon, name: "Dragon Person" }, { recipient: "kid" });
    assert(withKo < clean, `KO penalty applies: ${withKo} < ${clean}`);
  });
});

suite("gift: buy this, not that", () => {
  test("standard pick warns off the pricier same-character variant", () => {
    const pool = [miles, pulseSpidey];
    const nt = notThat(miles, pool);
    assert(nt, "alternate found");
    assert.equal(nt.fig.id, pulseSpidey.id, "the Pulse exclusive is the 'that'");
    assert(/premium/.test(nt.reason), `reason is honest: ${nt.reason}`);
  });

  test("no alternate when the pool has no same-character special", () => {
    assert.equal(notThat(miles, [miles]), null, "solo pool → null");
    const other = { id: "x::Y", name: "Y" };
    assert.equal(notThat(miles, [miles, other]), null, "different characters → null");
  });

  test("KO-target alternate warns with the KO reason", () => {
    const fig = { id: "a::Dragon Man", name: "Dragon Man" };
    const koVariant = { id: "b::Dragon Man (Battle Damage)", name: "Dragon Man (Battle Damage)", variant: "Battle Damage" };
    const nt = notThat(fig, [fig, koVariant]);
    assert(nt && /KO target/.test(nt.reason), `KO reason: ${nt?.reason}`);
  });
});

suite("gift: market-briefing notes", () => {
  test("hall-of-fame premiums annotate matched picks", () => {
    const map = hofMap(enc.hallOfFame);
    const toad = figures.find((f) => baseName(f.name) === "toad");
    assert(toad, "Toad exists in the archive");
    const resilient = marketNote(toad, map);
    assert(resilient && /true-rarity/.test(resilient), `Toad (resilient premium): ${resilient}`);
    const deadpool = figures.find((f) => baseName(f.name) === "deadpool");
    assert(deadpool, "Deadpool exists in the archive");
    const vulnerable = marketNote(deadpool, map);
    assert(vulnerable && /vulnerable/.test(vulnerable), `Deadpool (vulnerable premium): ${vulnerable}`);
    const bss = figures.find((f) => baseName(f.name) === "black suit spider-man");
    if (bss) {
      assert(/vulnerable/.test(marketNote(bss, map)), "Black Suit Spider-Man flags vulnerable");
    }
    assert.equal(marketNote(miles, map), null, "unmatched figure → no note, never invented");
  });
});

suite("gift: pre-order flags", () => {
  test("figures named in live pre-order details get flagged", () => {
    const elektra = { name: "Elektra (Classic)" };
    const hit = findPreorder(elektra, preorders);
    assert(hit && hit.id === "mini-comics-wave-3", `Elektra → Mini Comics Wave 3: ${hit?.id}`);
  });

  test("revealed-only items are never flagged", () => {
    const revealed = preorders.filter((i) => i.status === "revealed");
    assert(revealed.length > 0, "revealed items exist");
    const fig = { name: revealed[0].name };
    assert.equal(findPreorder(fig, revealed), null, "revealed items are not pre-orderable");
  });
});

suite("gift: URL prefills", () => {
  test("valid params pass through, junk falls back to defaults", () => {
    assert.deepEqual(
      prefillFromParams("?budget=under25&for=kid&character=Spider-Man"),
      { budget: "under25", recipient: "kid", character: "Spider-Man" });
    assert.deepEqual(
      prefillFromParams("?budget=rich&for=toddler&character="),
      { budget: "under50", recipient: "casual", character: "" });
    assert.deepEqual(prefillFromParams(""), { budget: "under50", recipient: "casual", character: "" });
  });
});

suite("gift: budget bands (unchanged behavior)", () => {
  test("under25 allows standard singles only", () => {
    assert(bandAllows("under25", miles), "standard allowed");
    assert(!bandAllows("under25", pulseSpidey), "exclusive excluded");
    assert(bandAllows("splurge", pulseSpidey), "splurge allows all");
  });
});
