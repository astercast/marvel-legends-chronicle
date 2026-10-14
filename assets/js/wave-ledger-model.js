/* wave-ledger-model.js, the pure math behind The Wave Ledger
   (wave-ledger.html). No DOM, no storage: given the catalog's flat
   figure list, it files every figure under its wave and counts the
   waves themselves, how many there are, how big they run, and
   where the figures actually sit.

   WHAT COUNTS AS A WAVE: the catalog's own waveId, one entry per
   distinct waveId in the flat figure list, carrying that wave's
   series name, year and manufacturer from its figures (a test
   cross-checks every wave's size against waves.json's figureCount
   on all 167 waves, the two agree everywhere). A wave's size is
   the number of catalog figures filed under it.

   THE COUNTING RULES (deterministic, catalog data only, printed
   on the page): the ledger is ordered by size descending, ties by
   earliest year, then by catalog order of the wave's first figure
  , a fact of the record, never an editorial ranking. The bands
   are fixed ranges of the size (1 · 2–3 · 4–5 · 6–7 · 8–9 · 10–12
   · 13 and over), and every band's waves and figures sum back to
   the archive's own totals. A "bucket" is a wave whose series the
   catalog names exactly "Store & Convention Exclusives", the
   annual catch-all shelves; every other wave is a standard wave.
   The median is the middle wave's size when the waves are ordered
   by size; the mode is the commonest size.

   HONESTY: no prices anywhere (a ledger of waves is the record,
   not the market). The buckets are reported at their true size,
   nearly half the line files under them, never folded into the
   standard waves to flatter the typical wave. */
export const WAVE_BANDS = [
  { label: "1 figure", min: 1, max: 1 },
  { label: "2–3 figures", min: 2, max: 3 },
  { label: "4–5 figures", min: 4, max: 5 },
  { label: "6–7 figures", min: 6, max: 7 },
  { label: "8–9 figures", min: 8, max: 9 },
  { label: "10–12 figures", min: 10, max: 12 },
  { label: "13+ figures", min: 13, max: Infinity },
];

export const BUCKET_SERIES = "Store & Convention Exclusives";

/* figures: the catalog's flat figure list (data/v1/figures.json shape).
   Returns { figureCount, waveCount, waves, bands, largest, median,
             mode, buckets, standard }, `waves` is every wave in
   ledger order ({ waveId, waveSeries, year, manufacturer, size,
   hasBaf }); `largest` is the first 12 in ledger order; `buckets`
   separates the annual run (2014 onward) from the bucket series as
   a whole; `standard` covers every non-bucket wave, its ceiling,
   and the waves sitting at that ceiling. */
export function buildWaveLedgerModel(figures) {
  const list = figures || [];

  const byWave = new Map(); // waveId -> entries [{fig, idx}]
  list.forEach((fig, idx) => {
    if (!byWave.has(fig.waveId)) byWave.set(fig.waveId, []);
    byWave.get(fig.waveId).push({ fig, idx });
  });

  const waves = [...byWave.entries()].map(([waveId, entries]) => ({
    waveId,
    waveSeries: entries[0].fig.waveSeries,
    year: entries[0].fig.year,
    manufacturer: entries[0].fig.manufacturer,
    size: entries.length,
    hasBaf: entries.some((e) => e.fig.waveBaf),
    _firstIdx: Math.min(...entries.map((e) => e.idx)),
  })).sort((a, b) =>
    b.size - a.size || a.year - b.year || a._firstIdx - b._firstIdx);
  for (const w of waves) delete w._firstIdx;

  const bands = WAVE_BANDS.map((b) => {
    const inBand = waves.filter((w) => w.size >= b.min && w.size <= b.max);
    return {
      label: b.label,
      min: b.min,
      max: b.max === Infinity ? null : b.max,
      waves: inBand.length,
      figures: inBand.reduce((n, w) => n + w.size, 0),
    };
  });

  const sizesAsc = waves.map((w) => w.size).sort((a, b) => a - b);
  const median = sizesAsc.length
    ? sizesAsc[Math.floor((sizesAsc.length - 1) / 2)] : null;

  const sizeCounts = new Map();
  for (const w of waves) sizeCounts.set(w.size, (sizeCounts.get(w.size) || 0) + 1);
  let mode = null;
  for (const [size, count] of sizeCounts) {
    if (!mode || count > mode.waves || (count === mode.waves && size < mode.size)) {
      mode = { size, waves: count };
    }
  }

  const bucketWaves = waves.filter((w) => w.waveSeries === BUCKET_SERIES);
  const annualBuckets = bucketWaves.filter((w) => w.year >= 2014);
  const buckets = {
    waves: bucketWaves.length,
    figures: bucketWaves.reduce((n, w) => n + w.size, 0),
    annualWaves: annualBuckets.length,
    annualFigures: annualBuckets.reduce((n, w) => n + w.size, 0),
    firstYear: bucketWaves.length ? Math.min(...bucketWaves.map((w) => w.year)) : null,
    lastYear: bucketWaves.length ? Math.max(...bucketWaves.map((w) => w.year)) : null,
  };

  const standardWaves = waves.filter((w) => w.waveSeries !== BUCKET_SERIES);
  const ceiling = standardWaves.length
    ? Math.max(...standardWaves.map((w) => w.size)) : null;
  const standard = {
    waves: standardWaves.length,
    figures: standardWaves.reduce((n, w) => n + w.size, 0),
    ceiling,
    ceilingWaves: standardWaves.filter((w) => w.size === ceiling),
    singleWaves: standardWaves.filter((w) => w.size === 1),
  };

  return {
    figureCount: list.length,
    waveCount: waves.length,
    waves,
    bands,
    largest: waves.slice(0, 12),
    median,
    mode,
    buckets,
    standard,
  };
}
