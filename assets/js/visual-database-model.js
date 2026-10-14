/* visual-database-model.js, the pure math behind The Visual
   Database (visual-database.html), the archive's picture census.
   No DOM, no storage: given the catalog's flat figure list and the
   figure-images manifest entries, it counts the pictured core and
   files the rest as the fill-in queue.

   THE RULES (deterministic, printed on the page): a figure is
   PICTURED when the manifest holds an entry for its catalog id,
   an entry exists only for an embed verified live (HTTP 200,
   image content type) with its provenance recorded. Everything
   else is UNPICTURED and renders typographically; unpictured is a
   filing state, not a defect, and the queue names it by wave and
   year so the fill-in order is a fact of the record: the waves
   nearest complete first, then the most recent years first.
   Entries naming figures the catalog does not hold are orphans
   and are counted apart, never pictured.

   THE HOUSE RULE FOR THIS DESK: pictures are embeds of the
   manufacturer's/retailer's own product photography, referenced,
   never copied, never AI-generated, and buying happens only
   outbound, at the linked retailer. This archive sells nothing. */
export function buildVisualDatabaseModel(figures, entries) {
  const list = figures || [];
  const byId = new Map(list.map((f) => [f.id, f]));
  const pictured = new Map(); // figureId -> entry
  let orphans = 0;
  for (const e of entries || []) {
    if (e && e.figureId && e.imageUrl && byId.has(e.figureId)) pictured.set(e.figureId, e);
    else orphans += 1;
  }

  const waves = new Map(); // waveId -> accumulator
  for (const fig of list) {
    if (!waves.has(fig.waveId)) {
      waves.set(fig.waveId, {
        waveId: fig.waveId, series: fig.waveSeries, year: fig.year,
        total: 0, pictured: [], missing: [],
      });
    }
    const w = waves.get(fig.waveId);
    w.total += 1;
    if (pictured.has(fig.id)) w.pictured.push(fig.id);
    else w.missing.push(fig.name);
  }

  const waveRows = [...waves.values()].sort((a, b) =>
    a.year - b.year || a.series.localeCompare(b.series));
  const coveredWaves = waveRows.filter((w) => w.pictured.length > 0);
  const completeWaves = waveRows.filter((w) => w.missing.length === 0);

  // The fill-in queue: waves with anything missing, nearest
  // complete first (fewest missing), ties by most recent year.
  const queue = waveRows
    .filter((w) => w.missing.length > 0)
    .sort((a, b) => a.missing.length - b.missing.length || b.year - a.year
      || a.series.localeCompare(b.series));

  const sources = new Map();
  for (const e of pictured.values()) {
    sources.set(e.imageSource, (sources.get(e.imageSource) || 0) + 1);
  }
  const priced = [...pictured.values()].filter((e) =>
    Array.isArray(e.buy) && e.buy.some((b) => typeof b.priceUSD === "number")).length;

  return {
    total: list.length,
    picturedCount: pictured.size,
    unpicturedCount: list.length - pictured.size,
    orphans,
    pictured,
    waveRows,
    coveredWaves: coveredWaves.length,
    completeWaves: completeWaves.length,
    queue,
    sources: [...sources.entries()].map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    priced,
  };
}
