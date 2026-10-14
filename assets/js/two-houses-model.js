/* two-houses-model.js, the pure math behind The Two Houses
   (two-houses.html). No DOM, no storage: given the catalog's flat
   figure list, it files the whole line under the houses that made
   it, one house per distinct manufacturer the catalog records.

   WHAT COUNTS AS A HOUSE: a distinct value of the catalog's own
   manufacturer field, the same field the wave pages carry (a test
   cross-checks it against waves.json's manufacturer field on all
   167 waves, the two agree everywhere). Nothing else is
   normalized: the catalog's handover is clean, Toy Biz closing in
   2006 and Hasbro opening in 2007, and the ledger reports the
   seam exactly where the catalog puts it rather than smoothing it.

   THE COUNTING RULES (deterministic, catalog data only, printed on
   the page): a character is the debut ledger's own rule, the name
   with any parenthetical removed, imported from debuts-model.js
   so the pages cannot disagree. A character "debuts under" the
   house that made its first figure (earliest year, ties by catalog
   order, the debut ledger's rule again). An exclusive is a figure
   whose catalog record names an exclusive channel; a variant is a
   figure whose record names a variant. A house's first and last
   waves are ordered by year, ties by catalog order.

   HONESTY: no prices anywhere (a makers' ledger is the record, not
   the market). Counts are the catalog's own fields, counted, a
   figure the catalog leaves unmarked as exclusive or variant is
   counted as unmarked, never reclassified by hand. */
import { baseName } from "./debuts-model.js";

/* figures: the catalog's flat figure list (data/v1/figures.json shape).
   Returns { total, figureCount, waveCount, span, houses, succession,
             sharedCharacters, houseCount }, `houses` in the order
   the catalog first meets them; each house carries its own counts,
   its year-by-year table, its first/last waves, its top exclusive
   channels, and how many characters are its alone. `succession`
   holds one seam per adjacent pair of houses: the closing wave of
   the earlier house and the opening wave of the later one. */
export function buildTwoHousesModel(figures) {
  const list = figures || [];

  /* character debuts, by the debut ledger's rule: earliest year,
     ties by catalog order; the debut belongs to the house that made
     that first figure. */
  const firstByChar = new Map(); // base name -> { fig, idx }
  list.forEach((fig, idx) => {
    const key = baseName(fig.name);
    const cur = firstByChar.get(key);
    if (!cur || fig.year < cur.fig.year ||
        (fig.year === cur.fig.year && idx < cur.idx)) {
      firstByChar.set(key, { fig, idx });
    }
  });

  const byMaker = new Map(); // manufacturer -> entries [{fig, idx}]
  list.forEach((fig, idx) => {
    if (!fig.manufacturer) return;
    if (!byMaker.has(fig.manufacturer)) byMaker.set(fig.manufacturer, []);
    byMaker.get(fig.manufacturer).push({ fig, idx });
  });

  const houses = [];
  for (const [name, entries] of byMaker) {
    const byWave = new Map(); // waveId -> entries
    for (const e of entries) {
      if (!byWave.has(e.fig.waveId)) byWave.set(e.fig.waveId, []);
      byWave.get(e.fig.waveId).push(e);
    }
    const waveRows = [...byWave.entries()].map(([waveId, es]) => ({
      waveId,
      waveSeries: es[0].fig.waveSeries,
      year: es[0].fig.year,
      figures: es.length,
      _idx: Math.min(...es.map((e) => e.idx)),
    })).sort((a, b) => a.year - b.year || a._idx - b._idx);

    const byYear = new Map(); // year -> { figures, waves:Set }
    for (const e of entries) {
      if (!byYear.has(e.fig.year)) byYear.set(e.fig.year, { figures: 0, waves: new Set() });
      const y = byYear.get(e.fig.year);
      y.figures += 1;
      y.waves.add(e.fig.waveId);
    }
    const years = [...byYear.entries()]
      .map(([year, y]) => ({ year, figures: y.figures, waves: y.waves.size }))
      .sort((a, b) => a.year - b.year);
    const busiestYear = years.slice().sort((a, b) =>
      b.figures - a.figures || a.year - b.year)[0] || null;

    const channels = new Map(); // exclusive channel -> count
    let exclusiveCount = 0;
    for (const e of entries) {
      if (!e.fig.exclusive) continue;
      exclusiveCount += 1;
      channels.set(e.fig.exclusive, (channels.get(e.fig.exclusive) || 0) + 1);
    }
    const topChannels = [...channels.entries()]
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count || a.channel.localeCompare(b.channel))
      .slice(0, 4);

    const characters = new Set(entries.map((e) => baseName(e.fig.name)));
    const debuts = [...firstByChar.values()]
      .filter((d) => d.fig.manufacturer === name).length;

    houses.push({
      name,
      figureCount: entries.length,
      waveCount: waveRows.length,
      firstYear: years.length ? years[0].year : null,
      lastYear: years.length ? years[years.length - 1].year : null,
      years,
      busiestYear,
      builds: new Set(entries.filter((e) => e.fig.waveBaf).map((e) => e.fig.waveBaf)).size,
      bafWaveCount: new Set(entries.filter((e) => e.fig.waveBaf).map((e) => e.fig.waveId)).size,
      characterCount: characters.size,
      debutCount: debuts,
      exclusiveCount,
      variantCount: entries.filter((e) => e.fig.variant).length,
      topChannels,
      firstWave: waveRows.length
        ? { waveId: waveRows[0].waveId, waveSeries: waveRows[0].waveSeries, year: waveRows[0].year }
        : null,
      lastWave: waveRows.length
        ? { waveId: waveRows[waveRows.length - 1].waveId, waveSeries: waveRows[waveRows.length - 1].waveSeries, year: waveRows[waveRows.length - 1].year }
        : null,
      _characters: characters,
      _firstIdx: Math.min(...entries.map((e) => e.idx)),
    });
  }

  houses.sort((a, b) => a._firstIdx - b._firstIdx);

  /* characters under more than one house, and each house's own-only
     count, the overlap is a fact of the catalog, counted once. */
  const housesPerChar = new Map();
  for (const h of houses) {
    for (const c of h._characters) {
      housesPerChar.set(c, (housesPerChar.get(c) || 0) + 1);
    }
  }
  const sharedCharacters = [...housesPerChar.values()].filter((n) => n > 1).length;
  for (const h of houses) {
    h.onlyCount = [...h._characters].filter((c) => housesPerChar.get(c) === 1).length;
    delete h._characters;
    delete h._firstIdx;
  }

  const succession = [];
  for (let i = 0; i + 1 < houses.length; i += 1) {
    succession.push({
      from: houses[i].name,
      to: houses[i + 1].name,
      closingWave: houses[i].lastWave,
      openingWave: houses[i + 1].firstWave,
    });
  }

  const allYears = list.map((f) => f.year);
  return {
    total: houses.length,
    figureCount: list.length,
    waveCount: houses.reduce((n, h) => n + h.waveCount, 0),
    characterCount: firstByChar.size,
    span: allYears.length ? [Math.min(...allYears), Math.max(...allYears)] : [null, null],
    houses,
    succession,
    sharedCharacters,
  };
}
