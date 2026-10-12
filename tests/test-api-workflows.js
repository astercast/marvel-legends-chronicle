/* Wave 18: agent-workflow proofs.
   Runs the three AGENT.md end-to-end workflows against the REAL local
   api/v1 JSON files (no fixtures for the data itself — only for user input
   like "my owned figures" or "this eBay listing"). If these pass, an agent
   following AGENT.md gets correct answers from the archive. */
"use strict";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const j = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

/* ---------- Workflow 1: "what should I pre-order this month?" ----------
   preorders.json -> dates/status. "Today" is pinned to the dataset's
   observation date so the test is deterministic. */
export function preorderPlan(preorders, todayISO) {
  const today = new Date(todayISO + "T00:00:00Z");
  const daysUntil = (d) => d ? Math.round((new Date(d + "T00:00:00Z") - today) / 864e5) : null;
  const open = [], upcoming = [], watch = [], buyNow = [];
  for (const it of preorders.items) {
    if (it.status === "preorder") {
      const n = daysUntil(it.preorderDate);
      // Exact date known: past/today -> open, future -> upcoming.
      // Preorder with no exact date reported: honestly "open now, date unreported".
      (n === null || n <= 0 ? open : upcoming).push({ id: it.id, name: it.name, preorderDate: it.preorderDate,
                                       price: it.price, daysUntil: n, retailers: it.retailers });
    } else if (it.status === "revealed") {
      watch.push({ id: it.id, name: it.name, releaseWindow: it.releaseWindow, price: it.price });
    } else if (it.status === "available") {
      buyNow.push({ id: it.id, name: it.name, price: it.price });
    }
  }
  upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
  return { asOf: todayISO, observed: preorders.observed, open,
           upcoming30: upcoming.filter((u) => u.daysUntil <= 30), watch, buyNow };
}

/* ---------- Workflow 2: "is this eBay listing a KO risk?" ----------
   encyclopedia.json bootlegGuide -> KO-risk verdict. The checklists come
   from the archive's own research; the listing is the agent's input. */
export function koRisk(listing, ency) {
  const sections = Object.fromEntries(ency.bootlegGuide.sections.map((s) => [s.id, s]));
  const failed = [];
  // Known KO targets (from the archive's "targets" checklist)
  const targetPhrases = ["dragon man", "ronan", "juggernaut"];
  if (targetPhrases.some((p) => listing.figure.toLowerCase().includes(p)))
    failed.push("known-ko-target: figure is on the archive's known-KO-targets list");
  // Price logic: the archive's listing checklist flags China/HK sellers with
  // $10-40 pricing on a $25+ figure; the price-logic checklist says far-below
  // retail/secondary for a popular wave or variant means investigate.
  if (listing.sellerRegion === "China" || listing.sellerRegion === "Hong Kong") {
    if (listing.price >= 10 && listing.price <= 40 && (listing.retail || 0) >= 25)
      failed.push("price-logic: China/HK seller at $10-40 on a $25+ figure");
    else
      failed.push("listing-flag: seller located in China/Hong Kong");
  }
  if (listing.retail && listing.price < listing.retail * 0.6)
    failed.push("price-logic: asking far below retail for the wave");
  if (listing.photos === "stock")
    failed.push("listing-flag: stock photos only, no real photos");
  if (listing.box === "none" && /exclusive/i.test(listing.claimed || ""))
    failed.push("listing-flag: 'no box' offer on a supposedly mint exclusive");
  const verdict = failed.length >= 2 ? "HIGH" : failed.length === 1 ? "MEDIUM" : "LOW";
  return { verdict, failedChecks: failed, guideSections: Object.keys(sections) };
}

/* ---------- Workflow 3: "audit my X-Men shelf for gaps" ----------
   figures.json + waves.json (+ stats.json for consistency): wave completion,
   near-complete wins (>=50%), missing BAF pieces. */
export function shelfAudit(ownedIds, figures, waves) {
  const owned = new Set(ownedIds);
  const waveInfo = new Map(waves.map((w) => [w.id, w]));
  const byWave = new Map();
  for (const f of figures) {
    if (!byWave.has(f.waveId))
      byWave.set(f.waveId, { total: 0, have: 0, baf: f.waveBaf, missingPieces: [] });
    const w = byWave.get(f.waveId);
    w.total++;
    if (owned.has(f.id)) w.have++;
    else if (f.bafPiece) w.missingPieces.push({ figure: f.name, piece: f.bafPiece, id: f.id });
  }
  const rows = [...byWave.entries()].map(([waveId, w]) => {
    const info = waveInfo.get(waveId) || {};
    return { waveId, series: info.series || waveId, year: info.year || null,
             total: w.total, have: w.have, pct: w.total ? w.have / w.total : 0,
             baf: w.baf, missingPieces: w.missingPieces };
  });
  const nearComplete = rows.filter((r) => r.pct >= 0.5 && r.pct < 1)
                               .sort((a, b) => b.pct - a.pct);
  const bafGaps = rows.filter((r) => r.baf && r.missingPieces.length > 0)
                      .map((r) => ({ waveId: r.waveId, series: r.series, baf: r.baf,
                                     missing: r.missingPieces }));
  return { ownedCount: owned.size, wavesTouched: rows.filter((r) => r.have > 0).length,
           nearComplete, bafGaps };
}

suite("agent workflows (AGENT.md, real api/v1 data)", () => {
  const preorders = j("api/v1/preorders.json");
  const ency = j("api/v1/encyclopedia.json");
  const figures = j("api/v1/figures.json");
  const waves = j("api/v1/waves.json");
  const stats = j("api/v1/stats.json");

  test("W1: pre-order plan from preorders.json", () => {
    const plan = preorderPlan(preorders, "2026-10-11");
    assert.equal(plan.asOf, "2026-10-11");
    assert.equal(preorders.count, 21, "dataset has 21 researched items (15 wave-12 + 5 NYCC 2026 + 1 wave-24 reveal)");
    const xmen97 = plan.upcoming30.find((u) => u.id === "xmen97-retro-wave");
    assert(xmen97, "X-Men '97 retro wave is upcoming");
    assert.equal(xmen97.daysUntil, 10, "2026-10-21 is 10 days after 2026-10-11");
    assert.equal(xmen97.price, 27.99);
    const dw2 = plan.upcoming30.find((u) => u.id === "doomsday-wave-2");
    assert(dw2, "Doomsday Wave 2 (pre-order 2026-10-14) is upcoming");
    assert.equal(dw2.daysUntil, 3);
    const aston = plan.upcoming30.find((u) => u.id === "astonishing-cyclops-wolverine-2pack");
    assert(aston, "Astonishing Cyclops & Wolverine 2-pack (pre-order 2026-10-28) is upcoming");
    assert.equal(aston.daysUntil, 17);
    const mini = plan.open.find((o) => o.id === "mini-comics-wave-3");
    assert(mini, "Mini Comics Wave 3 (pre-order 2026-10-06) is open now");
    assert(mini.daysUntil <= 0);
    const tas = plan.open.find((o) => o.id === "tas-retro-wave");
    assert(tas, "TAS retro wave (pre-order 2026-09-29) is open now");
    const trask = plan.open.find((o) => o.id === "bastion-trask-2pack");
    assert(trask, "Trask & Bastion made-to-order (pre-order 2026-10-07) is open now");
    assert.equal(trask.daysUntil, -4);
    const venom = plan.open.find((o) => o.id === "retro-venom-reissue");
    assert(venom, "Retro Venom (preorder, no exact date) is open with null daysUntil — honest, not dropped");
    assert.equal(venom.daysUntil, null);
    const doom = plan.open.find((o) => o.id === "doomsday-wave");
    assert(doom, "Doomsday wave (preorder, no exact date) is open, not silently dropped");
    const yfns = plan.watch.find((w) => w.id === "yfns-spidey-rhino-2pack");
    assert(yfns, "YFNS Spider-Man vs Rhino 2-pack (revealed) is watchlist material");
    assert(plan.buyNow.some((b) => b.id === "doomsday-ff-thing"),
           "Walmart Doomsday Thing (available) listed as buy-now");
    assert(plan.buyNow.length > 0, "available items listed as buy-now");
    for (const u of plan.upcoming30) assert(u.daysUntil <= 30 && u.daysUntil > 0);
  });

  test("W1: exact-date vs null-date honesty", () => {
    for (const it of preorders.items) {
      if (it.preorderDate !== null)
        assert(/^\d{4}-\d{2}-\d{2}$/.test(it.preorderDate),
               `${it.id}: preorderDate must be YYYY-MM-DD or null`);
    }
    const revealedNoDate = preorders.items.filter(
      (i) => i.status === "revealed" && i.preorderDate === null);
    assert(revealedNoDate.length > 0, "revealed items with null dates exist (watch, not dates)");
  });

  test("W2: KO-risk verdict from the archive's bootleg guide", () => {
    const ids = ency.bootlegGuide.sections.map((s) => s.id);
    for (const need of ["packaging", "paint", "joints", "targets", "listings", "price-logic"])
      assert(ids.includes(need), `bootlegGuide has '${need}' checklist`);
    const shady = koRisk({ figure: "Dragon Man", price: 32, retail: 60, photos: "stock",
                           sellerRegion: "China", box: "none", claimed: "mint exclusive" }, ency);
    assert.equal(shady.verdict, "HIGH");
    assert(shady.failedChecks.length >= 3, "shady listing fails multiple checks");
    assert(shady.failedChecks.some((c) => c.startsWith("known-ko-target")),
           "Dragon Man is a documented KO target");
    const clean = koRisk({ figure: "Spider-Man", price: 28, retail: 27.99, photos: "real",
                           sellerRegion: "US", box: "mint", claimed: "" }, ency);
    assert.equal(clean.verdict, "LOW");
    assert.equal(clean.failedChecks.length, 0);
    const borderline = koRisk({ figure: "Cyclops", price: 30, retail: 27.99, photos: "stock",
                                sellerRegion: "US", box: "mint", claimed: "" }, ency);
    assert.equal(borderline.verdict, "MEDIUM", "one red flag = MEDIUM, not HIGH");
  });

  test("W3: shelf audit from figures.json + waves.json", () => {
    // Real fixture: 4 of the 7 figures in The Void Wave (BAF: The Void).
    const owned = [
      "hasbro-2024-the-void::Black Panther",
      "hasbro-2024-the-void::Namor",
      "hasbro-2024-the-void::Power Princess",
      "hasbro-2024-the-void::Vision",
    ];
    for (const id of owned)
      assert(figures.some((f) => f.id === id), `fixture id exists in archive: ${id}`);
    const audit = shelfAudit(owned, figures, waves);
    assert.equal(audit.ownedCount, 4);
    assert.equal(audit.wavesTouched, 1);
    const win = audit.nearComplete.find((r) => r.waveId === "hasbro-2024-the-void");
    assert(win, "The Void Wave detected as near-complete");
    assert(Math.abs(win.pct - 4 / 7) < 1e-9, "4 of 7 figures = 57%");
    const gap = audit.bafGaps.find((g) => g.waveId === "hasbro-2024-the-void");
    assert(gap, "BAF gap detected for The Void");
    assert.equal(gap.baf, "The Void");
    assert.equal(gap.missing.length, 3, "3 unowned piece-carriers remain");
    assert(gap.missing.some((m) => m.figure === "Namorita" && m.piece === "Torso"));
    // Archive-level consistency
    assert.equal(stats.figures, figures.length, "stats.json matches figures.json");
    assert.equal(stats.waves, waves.length, "stats.json matches waves.json");
  });

  test("W3: empty shelf is a valid audit (no crashes, no invented data)", () => {
    const audit = shelfAudit([], figures, waves);
    assert.equal(audit.ownedCount, 0);
    assert.equal(audit.nearComplete.length, 0);
    assert(audit.bafGaps.length > 0, "full-archive BAF gaps still listed honestly");
  });
});
