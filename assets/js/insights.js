/* insights.js, pure Collection Insights logic (Grail Quest 4.0).
   No DOM, no storage, no fetch: callers supply the archive figures/waves,
   the user's owned ids, ledger purchase rows, and the Chronicle's reported
   price signals. Completion math is arithmetic over the archive + the user's
   own state. Every dollar is either a reported band from
   data/price-signals.json (labeled "reported ranges, not live prices") or
   the user's own logged purchase price, never an appraisal, never a
   Chronicle price index. Safe to import from any page or test. */
import { characterRuns } from "./quest-core.js";
import { signalForFigure, money } from "./price-watch.js";
import { monthKey } from "./budget-core.js";

export { money };

function ownedSetOf(ownedIds) {
  return new Set(Array.isArray(ownedIds) ? ownedIds : []);
}

/* ------------------------------------------------------------------ */
/* Completion math, by wave, by year, by character. */

/* Per-wave completion, sorted most-complete first (ties: more owned, then
   series name, deterministic for tests and share text). */
export function completionByWave(figures, waves, ownedIds) {
  const owned = ownedSetOf(ownedIds);
  const byWave = new Map();
  for (const f of figures ?? []) {
    if (!f || !f.waveId) continue;
    if (!byWave.has(f.waveId)) {
      byWave.set(f.waveId, {
        waveId: f.waveId,
        series: f.waveSeries ?? f.waveId,
        year: f.year ?? null,
        total: 0,
        got: 0,
      });
    }
    const w = byWave.get(f.waveId);
    w.total++;
    if (owned.has(f.id)) w.got++;
  }
  const out = [...byWave.values()].map((w) => ({
    ...w,
    missing: w.total - w.got,
    pct: w.total ? Math.round((w.got / w.total) * 100) : 0,
  }));
  out.sort((a, b) => b.pct - a.pct || b.got - a.got || String(a.series).localeCompare(String(b.series)));
  return out;
}

/* Per-year completion, ascending by year. */
export function completionByYear(figures, ownedIds) {
  const owned = ownedSetOf(ownedIds);
  const byYear = new Map();
  for (const f of figures ?? []) {
    const y = Number(f?.year);
    if (!Number.isFinite(y)) continue;
    if (!byYear.has(y)) byYear.set(y, { year: y, total: 0, got: 0 });
    const r = byYear.get(y);
    r.total++;
    if (owned.has(f.id)) r.got++;
  }
  const out = [...byYear.values()].map((r) => ({
    ...r,
    missing: r.total - r.got,
    pct: r.total ? Math.round((r.got / r.total) * 100) : 0,
  }));
  out.sort((a, b) => a.year - b.year);
  return out;
}

/* Per-character completion for characters with >= minReleases archive
   releases (default 5, the same bar the quest generator uses). Sorted by
   fewest missing first, then most owned. `missing` lists the figures to
   close the run. */
export function characterCompletions(figures, ownedIds, minReleases = 5) {
  const runs = characterRuns(figures, ownedIds, minReleases);
  const out = runs.map((r) => ({
    name: r.name,
    total: r.total,
    got: r.got,
    missing: r.missing,
    missingCount: r.total - r.got,
    pct: r.total ? Math.round((r.got / r.total) * 100) : 0,
  }));
  out.sort((a, b) => a.missingCount - b.missingCount || b.got - a.got || a.name.localeCompare(b.name));
  return out;
}

/* Most-wanted gap analysis: character runs exactly ONE figure away from
   complete. Sorted by run size (biggest run first, the meatiest finish). */
export function oneFigureAway(figures, ownedIds, minReleases = 5) {
  return characterCompletions(figures, ownedIds, minReleases)
    .filter((c) => c.missingCount === 1)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ */
/* Duplicate detection, the raw owned array as stored (pre-dedupe), so a
   figure id logged twice surfaces honestly. Returns [{ id, count }],
   count-descending. The page turns this into a "did you mean to log this
   twice?" nudge; it never auto-deletes anything. */
export function findDuplicateIds(rawOwned) {
  const counts = new Map();
  for (const id of Array.isArray(rawOwned) ? rawOwned : []) {
    if (typeof id !== "string" || !id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

/* ------------------------------------------------------------------ */
/* Shelf value, summed ONLY from the Chronicle's reported price bands.
   Labeled "reported ranges, not an appraisal" wherever shown. Figures
   without a reported signal are counted, never guessed: they contribute
   nothing to the band and are reported as `uncovered`. When one figure
   carries several reported signals (e.g. two decos tracked separately),
   the band for that figure spans the lowest reported low to the highest
   reported high, the widest honest reading of what the Chronicle has
   actually published. */
export function shelfValueRange(figures, ownedIds, signals) {
  const owned = ownedSetOf(ownedIds);
  const list = Array.isArray(signals) ? signals : [];
  /* Dedupe by figure id: a wave can list the same name twice (two decos
     under one id), but one owned id is one shelf figure, its band spans
     every reported signal for that id. */
  const byId = new Map();
  for (const f of figures ?? []) {
    if (!f || !owned.has(f.id) || byId.has(f.id)) continue;
    byId.set(f.id, f);
  }
  let low = 0, high = 0, covered = 0, uncovered = 0;
  const perFigure = [];
  for (const f of byId.values()) {
    const sigs = signalForFigure(f.id, list);
    const lows = sigs.map((s) => Number(s?.low)).filter((n) => Number.isFinite(n) && n > 0);
    const highs = sigs.map((s) => Number(s?.high)).filter((n) => Number.isFinite(n) && n > 0);
    if (!lows.length) {
      uncovered++;
      continue;
    }
    const fLow = Math.min(...lows);
    const fHigh = Math.max(...highs, fLow);
    low += fLow;
    high += fHigh;
    covered++;
    perFigure.push({ figId: f.id, name: f.name, low: fLow, high: fHigh, signals: sigs.length });
  }
  return { low, high, covered, uncovered, perFigure };
}

/* ------------------------------------------------------------------ */
/* Growth view, cumulative figures added over time from the Ledger's
   purchase dates. Honest framing: "since you started logging", rows
   without a parseable date are excluded and counted, never guessed.
   Returns ascending-date points: { date, added, spend, totalCount,
   totalSpend }. */
export function growthSeries(buys) {
  const byDate = new Map();
  let skipped = 0;
  for (const b of Array.isArray(buys) ? buys : []) {
    const k = monthKey(b?.date);
    if (!k) { skipped++; continue; }
    const full = /^\d{4}-\d{2}-\d{2}/.test(String(b.date).trim()) ? String(b.date).trim() : `${k}-01`;
    if (!byDate.has(full)) byDate.set(full, { added: 0, spend: 0 });
    const row = byDate.get(full);
    row.added++;
    const p = Number(b?.price);
    if (Number.isFinite(p) && p > 0) row.spend += p;
  }
  const dates = [...byDate.keys()].sort();
  let totalCount = 0, totalSpend = 0;
  const points = dates.map((date) => {
    const row = byDate.get(date);
    totalCount += row.added;
    totalSpend += row.spend;
    return {
      date, added: row.added, spend: Math.round(row.spend * 100) / 100,
      totalCount, totalSpend: Math.round(totalSpend * 100) / 100,
    };
  });
  return { points, skipped, months: dates.length ? dates[dates.length - 1].slice(0, 7) : null };
}

/* Monthly buckets of the same series for the page table. */
export function growthByMonth(buys) {
  const buckets = new Map();
  for (const b of Array.isArray(buys) ? buys : []) {
    const k = monthKey(b?.date);
    if (!k) continue;
    if (!buckets.has(k)) buckets.set(k, { month: k, added: 0, spend: 0 });
    const row = buckets.get(k);
    row.added++;
    const p = Number(b?.price);
    if (Number.isFinite(p) && p > 0) row.spend += p;
  }
  const out = [...buckets.values()].map((r) => ({ ...r, spend: Math.round(r.spend * 100) / 100 }));
  out.sort((a, b) => a.month.localeCompare(b.month));
  let totalCount = 0, totalSpend = 0;
  for (const r of out) {
    totalCount += r.added;
    totalSpend += r.spend;
    r.totalCount = totalCount;
    r.totalSpend = Math.round(totalSpend * 100) / 100;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Milestones, unlock state from the user's own counts. Each carries an
   honest `detail` ("23 of 50") so a locked milestone reads as progress,
   not failure. Dates are never invented: milestone cards show when a
   count was reached only where the data supports it. */
export function computeMilestones({ ownedCount = 0, completedBafs = 0, buys = [] } = {}) {
  const own = Number(ownedCount) || 0;
  const bafs = Number(completedBafs) || 0;
  const buyCount = Array.isArray(buys) ? buys.length : 0;
  const catalog = [
    {
      id: "first-figure", name: "First Figure", icon: "🌱",
      blurb: "Log your very first figure in the tracker.",
      got: Math.min(own, 1), need: 1,
    },
    {
      id: "shelf-10", name: "Shelf Starter", icon: "📚",
      blurb: "10 figures on the shelf.",
      got: Math.min(own, 10), need: 10,
    },
    {
      id: "shelf-25", name: "Quarter Shelf", icon: "🗂️",
      blurb: "25 figures on the shelf.",
      got: Math.min(own, 25), need: 25,
    },
    {
      id: "shelf-50", name: "Half Century", icon: "🏛️",
      blurb: "50 figures on the shelf.",
      got: Math.min(own, 50), need: 50,
    },
    {
      id: "first-baf", name: "First BAF", icon: "🧩",
      blurb: "Complete your first Build-A-Figure.",
      got: Math.min(bafs, 1), need: 1,
    },
    {
      id: "first-purchase", name: "First Purchase", icon: "🧾",
      blurb: "Log your first purchase in the Ledger.",
      got: Math.min(buyCount, 1), need: 1,
    },
    {
      id: "ledger-10", name: "Ledger Regular", icon: "📒",
      blurb: "10 purchases logged with dates, the growth chart needs them.",
      got: Math.min(buyCount, 10), need: 10,
    },
  ];
  return catalog.map((m) => ({
    ...m,
    unlocked: m.got >= m.need,
    detail: m.unlocked ? "Unlocked ✓" : `${m.got} of ${m.need}`,
  }));
}

/* ------------------------------------------------------------------ */
/* Collection report, plain-text/markdown export for insurance and
   records. Honest throughout: completion math from the archive + the
   user's own state; shelf bands from reported ranges only; the
   disclaimer up front and repeated at the shelf-value section. */

export function buildCollectionReport({
  generatedAt = new Date().toISOString().slice(0, 10),
  figures = [], waves = [], ownedIds = [], signals = [],
  buys = [], achievements = [], milestones = [],
} = {}) {
  const owned = ownedSetOf(ownedIds);
  const arch = figures.length;
  const waveRows = completionByWave(figures, waves, ownedIds);
  const yearRows = completionByYear(figures, ownedIds);
  const charRows = characterCompletions(figures, ownedIds);
  const gaps = oneFigureAway(figures, ownedIds);
  const dupes = findDuplicateIds(ownedIds);
  const shelf = shelfValueRange(figures, ownedIds, signals);
  const growth = growthSeries(buys);
  const pct = arch ? Math.round((owned.size / arch) * 100) : 0;
  const unlocked = achievements.filter((a) => a.unlocked);

  const L = [];
  L.push("# Marvel Legends Chronicle, Collection Report");
  L.push(`Generated ${generatedAt} · from your browser-local tracker data.`);
  L.push("");
  L.push("> Your records, not a valuation. Completion math comes from the archive and your own logged state. Shelf-value bands are summed from the Chronicle's reported price ranges only, reported ranges, not an appraisal, never a price index.");
  L.push("");
  L.push("## Snapshot");
  L.push(`- Figures owned: ${owned.size} of ${arch} in the archive (${pct}%)`);
  L.push(`- Waves in the archive: ${waveRows.length}`);
  L.push(`- Full waves completed: ${waveRows.filter((w) => w.pct === 100).length}`);
  L.push(`- Full character runs completed: ${charRows.filter((c) => c.missingCount === 0).length}`);
  L.push(`- Achievements unlocked: ${unlocked.length} of ${achievements.length}`);
  L.push(`- Purchases logged: ${buys.length}`);
  L.push("");
  L.push("## Shelf value (reported ranges, not an appraisal)");
  if (shelf.covered) {
    L.push(`- Reported band across your collection: ${money(shelf.low)}–${money(shelf.high)}`);
    L.push(`- Based on ${shelf.covered} figure${shelf.covered === 1 ? "" : "s"} with reported market data`);
  } else {
    L.push("- No reported market data for the figures you own yet, nothing to band.");
  }
  if (shelf.uncovered) {
    L.push(`- ${shelf.uncovered} owned figure${shelf.uncovered === 1 ? "" : "s"} ha${shelf.uncovered === 1 ? "s" : "ve"} no reported signal, excluded from the band, never guessed.`);
  }
  L.push("- Source: the Chronicle's reported price signals (reported solds/listings the site has already published), summed per figure. This is your records plus public research, not an appraisal, not insurance-grade.");
  L.push("");
  L.push("## Completion by year");
  L.push("| Year | Owned | Archive | % |");
  L.push("| --- | --- | --- | --- |");
  for (const r of yearRows) L.push(`| ${r.year} | ${r.got} | ${r.total} | ${r.pct}% |`);
  L.push("");
  L.push("## Closest wave completions");
  const near = waveRows.filter((w) => w.got > 0 && w.pct < 100).slice(0, 10);
  if (!near.length) L.push("- No started-but-unfinished waves, every wave you touch is either untouched or complete.");
  for (const w of near) L.push(`- ${w.series} (${w.year ?? "?"}): ${w.got}/${w.total} (${w.pct}%)`);
  L.push("");
  L.push("## One figure away (gap analysis)");
  if (!gaps.length) L.push("- No character run is exactly one figure from complete.");
  for (const g of gaps) {
    const miss = g.missing[0];
    L.push(`- ${g.name}: ${g.got}/${g.total}, missing ${miss?.name ?? "unknown"} (${miss?.waveSeries ?? "?"}, ${miss?.year ?? "?"})`);
  }
  L.push("");
  L.push("## Duplicates");
  if (!dupes.length) L.push("- No figure id logged twice.");
  for (const d of dupes) L.push(`- ${d.id} logged ${d.count}×, did you mean to log it twice?`);
  L.push("");
  L.push("## Milestones");
  for (const m of milestones) L.push(`- ${m.unlocked ? "✓" : "○"} ${m.name}, ${m.detail}`);
  L.push("");
  L.push("## Growth (since you started logging)");
  if (!growth.points.length) {
    L.push("- No dated purchases logged yet, log purchase dates in the Ledger and this section fills in.");
  } else {
    L.push(`- ${growth.points.length} dated purchase${growth.points.length === 1 ? "" : "s"} logged; collection reached ${growth.points[growth.points.length - 1].totalCount} logged purchases by ${growth.points[growth.points.length - 1].date}.`);
    if (growth.skipped) L.push(`- ${growth.skipped} purchase${growth.skipped === 1 ? "" : "s"} without a parseable date excluded.`);
  }
  L.push("");
  L.push("---");
  L.push("Marvel Legends Chronicle, a fan-made archive. Figures, dates, and prices are researched and reported; the collection math above is your own data. Keep a copy of this file with your insurance records.");
  return L.join("\n");
}
