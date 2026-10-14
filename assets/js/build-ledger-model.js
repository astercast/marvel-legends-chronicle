/* build-ledger-model.js, the pure math behind The Build Ledger
   (build-ledger.html). No DOM, no storage: given the catalog's flat
   figure list, it files every Build-A-Figure the line ever offered
  , one build per distinct BAF name the catalog records, with the
   waves that carried it and the figures that carried its pieces.

   WHAT COUNTS AS A BUILD: a distinct value of the catalog's own
   waveBaf field (the same field the wave pages and figures carry,
   cross-checked in the test suite against waves.json's baf field,
   the two agree on every wave). Builds are keyed by that name and
   nothing else is normalized: "Fin Fang Foom" was split across two
   2008 waves, so it is one build carried by two waves, and the
   ledger says so rather than filing it twice.

   THE COUNTING RULES (deterministic, catalog data only, printed on
   the page): a figure "carries a piece" when the catalog records a
   bafPiece for it. The ledger counts piece-carrying figures and,
   separately, the distinct piece labels recorded, the two are not
   the same number (two figures can carry the same labelled piece,
   as variant carriers do), and the ledger never merges them.
   A build's era chapter is the Archive Tour chapter of its first
   year, the model imports the tour's CHAPTERS via the debut
   ledger's chapter rule, so the pages cannot disagree.

   HONESTY: no prices anywhere (a build ledger is the record, not
   the market). Where the catalog records no piece assignments at
   all, the Bonebreaker build, and Fin Fang Foom's second wave,
   the ledger files the gap as a gap: counted, named, and never
   filled in by hand. */
import { CHAPTERS } from "./archive-tour-model.js";
import { chapterForYear } from "./debuts-model.js";

/* figures: the catalog's flat figure list (data/v1/figures.json shape).
   Returns { total, waveCount, figureCount, carrierCount, span,
             builds, largest, byChapter, unrecordedBuilds,
             unrecordedWaves }, `builds` sorted by (first year,
   catalog order); `largest` sorted by piece-carrying figures desc
   (ties: earlier first year, then name); `byChapter` partitions
   the builds by the era chapter of each build's first year. */
export function buildBuildLedgerModel(figures) {
  const byName = new Map(); // BAF name -> { entries: [{fig, idx}] }
  (figures || []).forEach((fig, idx) => {
    if (!fig.waveBaf) return;
    if (!byName.has(fig.waveBaf)) byName.set(fig.waveBaf, []);
    byName.get(fig.waveBaf).push({ fig, idx });
  });

  const builds = [];
  const unrecordedWaves = [];
  let waveCount = 0;
  let figureCount = 0;
  let carrierCount = 0;

  for (const [name, entries] of byName) {
    const byWave = new Map(); // waveId -> entries
    for (const e of entries) {
      if (!byWave.has(e.fig.waveId)) byWave.set(e.fig.waveId, []);
      byWave.get(e.fig.waveId).push(e);
    }
    const waves = [...byWave.entries()].map(([waveId, es]) => {
      const carriers = es.filter((e) => e.fig.bafPiece);
      const w = {
        waveId,
        waveSeries: es[0].fig.waveSeries,
        year: es[0].fig.year,
        manufacturer: es[0].fig.manufacturer,
        figures: es.length,
        carriers: carriers.length,
        _idx: Math.min(...es.map((e) => e.idx)),
      };
      if (carriers.length === 0) {
        unrecordedWaves.push({
          waveId, waveSeries: w.waveSeries, year: w.year, baf: name,
        });
      }
      return w;
    }).sort((a, b) => a.year - b.year || a._idx - b._idx)
      .map(({ _idx, ...w }) => w);

    const carriers = entries.filter((e) => e.fig.bafPiece);
    const pieces = [];
    for (const e of carriers) {
      if (!pieces.includes(e.fig.bafPiece)) pieces.push(e.fig.bafPiece);
    }
    const years = entries.map((e) => e.fig.year);
    builds.push({
      name,
      firstYear: Math.min(...years),
      lastYear: Math.max(...years),
      manufacturer: entries[0].fig.manufacturer,
      waves,
      waveCount: waves.length,
      figureCount: entries.length,
      carrierCount: carriers.length,
      pieces,
      pieceCount: pieces.length,
      chapterId: (chapterForYear(Math.min(...years)) || {}).id || null,
      _idx: Math.min(...entries.map((e) => e.idx)),
    });
    waveCount += waves.length;
    figureCount += entries.length;
    carrierCount += carriers.length;
  }

  builds.sort((a, b) => a.firstYear - b.firstYear || a._idx - b._idx);
  const clean = builds.map(({ _idx, ...b }) => b);

  const largest = clean.slice().sort((a, b) =>
    b.carrierCount - a.carrierCount ||
    a.firstYear - b.firstYear ||
    a.name.localeCompare(b.name));

  const byChapter = CHAPTERS.map((c) => ({
    ...c,
    builds: clean.filter((b) => b.chapterId === c.id),
  }));

  const years = clean.map((b) => b.firstYear);
  return {
    total: clean.length,
    waveCount,
    figureCount,
    carrierCount,
    span: years.length ? [Math.min(...years), Math.max(...clean.map((b) => b.lastYear))] : [null, null],
    builds: clean,
    largest,
    byChapter,
    unrecordedBuilds: clean.filter((b) => b.carrierCount === 0),
    unrecordedWaves: unrecordedWaves.sort((a, b) => a.year - b.year || a.baf.localeCompare(b.baf)),
  };
}
