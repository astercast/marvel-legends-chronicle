/* completionist-model.js, the pure set-completion math behind The
   Completionist (completionist.html). No DOM, no storage: given the
   catalog and the three tracker shelves (Owned / Wanted / Watching id
   sets), it works out exactly what the page renders, per-wave
   completion, the waves nearest completion with the exact figures
   still missing, and completion by era.

   Completion means Owned. Wanted and Watching counts ride along on
   every row as plans and signals, and never count toward a set being
   finished, the same ledger discipline as My Vault. Era chapters are
   the Archive Tour's (CHAPTERS in archive-tour-model.js): the tour
   counts the archive, this page counts your shelves against the same
   four chapters, so the two pages can never disagree about an era.

   Everything is derived from the reader's own marks and the archive's
   own totals. Nothing is estimated, and there are no prices anywhere:
   a completion ledger is a record of sets, not a shopping list. */

import { CHAPTERS } from "./archive-tour-model.js";

const pct = (got, total) => (total ? (got / total) * 100 : 0);

/* Nearest-first: fewest figures missing, then closest by share owned,
   then year, then series, so "one figure away" always leads. */
const nearestFirst = (a, b) =>
  a.missingCount - b.missingCount ||
  b.pct - a.pct ||
  (a.year ?? 0) - (b.year ?? 0) ||
  a.series.localeCompare(b.series);

/* figures: flat catalog (loadData shape). waves: wave summaries.
   marks: { owned:Set, wanted:Set, watching:Set } of figIds. */
export function buildCompletionistModel(figures, waves, marks) {
  const byId = new Map(figures.map((f) => [f.id, f]));
  const totalFigures = figures.length;

  /* Marks pointing at ids the archive no longer carries are counted
     honestly as unresolved, never dropped, never rendered. */
  let unresolved = 0;
  for (const kind of ["owned", "wanted", "watching"]) {
    for (const id of marks[kind] ?? []) if (!byId.has(id)) unresolved += 1;
  }
  const counts = {
    owned: figures.filter((f) => marks.owned?.has(f.id)).length,
    wanted: figures.filter((f) => marks.wanted?.has(f.id)).length,
    watching: figures.filter((f) => marks.watching?.has(f.id)).length,
    totalFigures,
    totalWaves: waves.length,
    unresolved,
  };
  counts.marked = counts.owned + counts.wanted + counts.watching;
  counts.ownedPct = pct(counts.owned, totalFigures);

  /* Per-wave completion, every wave in the archive gets a row.
     Totals are counted from the catalog itself; a wave summary's
     figureCount is only a fallback. Missing figures stay in catalog
     order: that is the order a collector works through the wave. */
  const figsByWave = new Map();
  for (const f of figures) {
    if (!figsByWave.has(f.waveId)) figsByWave.set(f.waveId, []);
    figsByWave.get(f.waveId).push(f);
  }
  const byWave = waves.map((w) => {
    const inWave = figsByWave.get(w.id) ?? [];
    const total = inWave.length || w.figureCount || 0;
    const ownedFigs = inWave.filter((f) => marks.owned?.has(f.id));
    const missing = inWave.filter((f) => !marks.owned?.has(f.id));
    const row = {
      id: w.id,
      series: w.series ?? w.id,
      year: w.year ?? null,
      manufacturer: w.manufacturer ?? "",
      baf: w.baf ?? null,
      total,
      owned: ownedFigs.length,
      wanted: inWave.filter((f) => marks.wanted?.has(f.id)).length,
      watching: inWave.filter((f) => marks.watching?.has(f.id)).length,
      missing,
      missingCount: total - ownedFigs.length,
    };
    row.pct = pct(row.owned, total);
    row.complete = total > 0 && row.missingCount === 0;
    row.touched = row.owned > 0 || row.wanted > 0 || row.watching > 0;
    row.started = row.owned > 0;
    return row;
  });

  /* The nearest ledgers. Only a wave the collector has started, at
     least one figure Owned, can be "away" from complete: a wave with
     nothing owned is unstarted, not two figures from done, however
     small it is. Complete waves are finished, not nearest. */
  const started = byWave.filter((r) => r.started && !r.complete);
  const oneAway = started.filter((r) => r.missingCount === 1).sort(nearestFirst);
  const twoAway = started.filter((r) => r.missingCount === 2).sort(nearestFirst);
  const nextUp = started.filter((r) => r.missingCount >= 3).sort(nearestFirst);
  const completeWaves = byWave
    .filter((r) => r.complete)
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.series.localeCompare(b.series));
  const touchedWaves = byWave.filter((r) => r.touched).sort(nearestFirst);

  /* Completion by era, the Archive Tour's four chapters. Every wave
     and figure lands in exactly one chapter (the tour's partition),
     so the era rows sum back to the archive totals. */
  const byEra = CHAPTERS.map((ch) => {
    const [lo, hi] = ch.years;
    const eraWaves = byWave.filter((r) => r.year !== null && r.year >= lo && r.year <= hi);
    const eraFigures = figures.filter((f) => f.year >= lo && f.year <= hi);
    const owned = eraFigures.filter((f) => marks.owned?.has(f.id)).length;
    return {
      id: ch.id,
      title: ch.title,
      kicker: ch.kicker,
      years: ch.years,
      waves: eraWaves.length,
      figures: eraFigures.length,
      owned,
      wanted: eraFigures.filter((f) => marks.wanted?.has(f.id)).length,
      watching: eraFigures.filter((f) => marks.watching?.has(f.id)).length,
      pct: pct(owned, eraFigures.length),
      wavesComplete: eraWaves.filter((r) => r.complete).length,
      wavesTouched: eraWaves.filter((r) => r.touched).length,
      oneAway: eraWaves.filter((r) => r.started && r.missingCount === 1).length,
      twoAway: eraWaves.filter((r) => r.started && r.missingCount === 2).length,
    };
  });

  /* Catalog preview for the empty state: what this page becomes,
     described from the archive's structure alone, era sizes and the
     shortest sets in the catalog. No collection is invented: with no
     marks there are no nearest waves, and the model says so. */
  const smallestWaves = [...byWave]
    .filter((r) => r.total > 0)
    .sort((a, b) => a.total - b.total || (a.year ?? 0) - (b.year ?? 0) || a.series.localeCompare(b.series))
    .slice(0, 6)
    .map((r) => ({ id: r.id, series: r.series, year: r.year, manufacturer: r.manufacturer, total: r.total }));
  const waveSizes = byWave.map((r) => r.total).filter((n) => n > 0);

  return {
    counts,
    byWave,
    oneAway,
    twoAway,
    nextUp,
    completeWaves,
    touchedWaves,
    byEra,
    erasPartition:
      byEra.reduce((n, e) => n + e.figures, 0) === totalFigures &&
      byEra.reduce((n, e) => n + e.waves, 0) === waves.length,
    preview: {
      smallestWaves,
      minWaveSize: waveSizes.length ? Math.min(...waveSizes) : 0,
      maxWaveSize: waveSizes.length ? Math.max(...waveSizes) : 0,
      eras: byEra.map((e) => ({ id: e.id, title: e.title, years: e.years, waves: e.waves, figures: e.figures })),
    },
    empty: counts.marked === 0,
  };
}
