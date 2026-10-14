/* vault-model.js, the pure ledger math behind My Vault (my-vault.html).
   No DOM, no storage: given the catalog and the three tracker shelves
   (Owned / Wanted / Watching id sets), it works out exactly what the page
   renders, the halls, the counts, and completion by year and by wave.
   Everything here is derived from the reader's own marks and the archive's
   own totals. Nothing is estimated, and there are no prices anywhere:
   a vault is a record of what you hold, not a valuation. */

export const HALLS = [
  { kind: "owned", title: "Owned", note: "On your shelf, in hand." },
  { kind: "wanted", title: "Wanted", note: "The active hunt." },
  { kind: "watching", title: "Watching", note: "An eye kept on them, no chase, no commitment." },
];

const pct = (got, total) => (total ? (got / total) * 100 : 0);

/* figures: flat catalog (loadData shape). waves: wave summaries with
   figureCount. marks: { owned:Set, wanted:Set, watching:Set } of figIds. */
export function buildVaultModel(figures, waves, marks) {
  const byId = new Map(figures.map((f) => [f.id, f]));
  const order = new Map(figures.map((f, i) => [f.id, i]));
  const total = figures.length;

  /* The halls, in catalog order. Marks pointing at ids the archive no
     longer carries are counted honestly as unresolved, never dropped
     silently and never rendered as plates. */
  const halls = {};
  let unresolved = 0;
  for (const { kind } of HALLS) {
    const figs = [];
    for (const id of marks[kind] ?? []) {
      const fig = byId.get(id);
      if (fig) figs.push(fig);
      else unresolved += 1;
    }
    figs.sort((a, b) => order.get(a.id) - order.get(b.id));
    halls[kind] = figs;
  }

  const counts = {
    owned: halls.owned.length,
    wanted: halls.wanted.length,
    watching: halls.watching.length,
    total,
    unresolved,
  };
  counts.marked = counts.owned + counts.wanted + counts.watching;
  counts.ownedPct = pct(counts.owned, total);

  /* Completion by year, every archive year, marked or not. */
  const yearMap = new Map();
  for (const f of figures) {
    if (!yearMap.has(f.year)) yearMap.set(f.year, { year: f.year, total: 0, owned: 0, wanted: 0, watching: 0 });
    yearMap.get(f.year).total += 1;
  }
  for (const { kind } of HALLS) {
    for (const f of halls[kind]) yearMap.get(f.year)[kind] += 1;
  }
  const byYear = [...yearMap.values()]
    .sort((a, b) => a.year - b.year)
    .map((r) => ({ ...r, pct: pct(r.owned, r.total) }));

  /* Completion by wave, only waves the reader has touched get a ledger
     line; a wave is complete when every one of its figures is Owned.
     Totals come from the catalog itself (the figures array is the same
     source the by-year ledger uses); a wave summary's figureCount is
     only a fallback for catalogs loaded without their figures. */
  const catalogTotals = new Map();
  for (const f of figures) catalogTotals.set(f.waveId, (catalogTotals.get(f.waveId) ?? 0) + 1);
  const waveById = new Map(waves.map((w) => [w.id, w]));
  const waveMap = new Map();
  const rowFor = (waveId) => {
    if (!waveMap.has(waveId)) {
      const w = waveById.get(waveId);
      waveMap.set(waveId, {
        id: waveId,
        series: w?.series ?? waveId,
        year: w?.year ?? null,
        manufacturer: w?.manufacturer ?? "",
        total: catalogTotals.get(waveId) || w?.figureCount || 0,
        owned: 0, wanted: 0, watching: 0,
      });
    }
    return waveMap.get(waveId);
  };
  for (const { kind } of HALLS) {
    for (const f of halls[kind]) rowFor(f.waveId)[kind] += 1;
  }
  const byWave = [...waveMap.values()]
    .map((r) => ({ ...r, pct: pct(r.owned, r.total), complete: r.total > 0 && r.owned === r.total }))
    .sort((a, b) => b.pct - a.pct || (a.year ?? 0) - (b.year ?? 0) || a.series.localeCompare(b.series));
  const completeWaves = byWave.filter((r) => r.complete);

  return {
    counts,
    halls,
    byYear,
    byWave,
    completeWaves,
    wavesTouched: byWave.length,
    empty: counts.marked === 0,
  };
}
