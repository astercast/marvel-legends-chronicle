/* long-wait-model.js, the pure math behind The Long Wait
   (long-wait.html). No DOM, no storage: given the catalog's flat
   figure list, it works out, for every distinct character, the
   longest silence between one figure and the next, and files the
   characters who never got a second figure as still waiting.

   WHAT COUNTS AS A CHARACTER: the archive's own rule, imported from
   the debut ledger (debuts-model.js) so the two pages cannot
   disagree, a figure's character is its name with any parenthetical
   removed. Nothing else is normalized.

   THE WAIT RULES (deterministic, catalog data only, printed on the
   page): a character's releases are ordered by year, ties by catalog
   order. A "wait" is the gap in years between two consecutive
   releases; a character's longest wait is the largest such gap, and
   the wait that ended names the exact figures on both sides of it.
   A character with exactly one figure is still waiting: their wait
   is counted from their only figure's year through the catalog's
   latest year, and it is labelled as running, never presented as a
   completed wait, because the catalog records no second figure.

   HONESTY: no prices anywhere (a returns ledger is the record, not
   the market); a character links to its character page only when
   the archive actually publishes one, the model takes that slug
   set as an input and leaves the rest unlinked. */
import { baseName, slugify } from "./debuts-model.js";

/* figures: the catalog's flat figure list (data/v1/figures.json shape).
   characterSlugs: Set of slugs with a published character page.
   Returns { total, returnedCount, waitingCount, latestYear,
             returned, waiting, longest }, `returned` sorted by
   longest wait desc (ties: earlier wait-start year, then name);
   `waiting` sorted by running wait desc (ties: earlier debut year,
   then name). */
export function buildLongWaitModel(figures, characterSlugs = new Set()) {
  const byChar = new Map(); // base name -> [{ fig, idx }]
  let latestYear = null;
  (figures || []).forEach((fig, idx) => {
    const base = baseName(fig.name);
    if (!base) return;
    if (latestYear === null || fig.year > latestYear) latestYear = fig.year;
    if (!byChar.has(base)) byChar.set(base, []);
    byChar.get(base).push({ fig, idx });
  });

  const returned = [];
  const waiting = [];
  for (const [name, entries] of byChar) {
    const rel = entries.slice().sort((a, b) => a.fig.year - b.fig.year || a.idx - b.idx);
    const slug = slugify(name);
    const common = {
      name,
      slug,
      hasPage: characterSlugs.has(slug),
      releases: rel.length,
      debutYear: rel[0].fig.year,
      debutFigure: rel[0].fig.name,
      debutWaveId: rel[0].fig.waveId,
      debutWaveSeries: rel[0].fig.waveSeries,
      latestYearSeen: rel[rel.length - 1].fig.year,
    };
    if (rel.length === 1) {
      waiting.push({
        ...common,
        waitingYears: latestYear === null ? 0 : latestYear - rel[0].fig.year,
        onlyFigure: rel[0].fig.name,
        onlyWaveId: rel[0].fig.waveId,
        onlyWaveSeries: rel[0].fig.waveSeries,
        onlyManufacturer: rel[0].fig.manufacturer,
      });
      continue;
    }
    let gap = null;
    for (let i = 1; i < rel.length; i++) {
      const years = rel[i].fig.year - rel[i - 1].fig.year;
      if (!gap || years > gap.years) {
        gap = {
          years,
          fromYear: rel[i - 1].fig.year,
          toYear: rel[i].fig.year,
          beforeFigure: rel[i - 1].fig.name,
          beforeWaveId: rel[i - 1].fig.waveId,
          beforeWaveSeries: rel[i - 1].fig.waveSeries,
          afterFigure: rel[i].fig.name,
          afterWaveId: rel[i].fig.waveId,
          afterWaveSeries: rel[i].fig.waveSeries,
          afterManufacturer: rel[i].fig.manufacturer,
        };
      }
    }
    returned.push({ ...common, longestGap: gap });
  }

  returned.sort((a, b) =>
    b.longestGap.years - a.longestGap.years ||
    a.longestGap.fromYear - b.longestGap.fromYear ||
    a.name.localeCompare(b.name));
  waiting.sort((a, b) =>
    b.waitingYears - a.waitingYears ||
    a.debutYear - b.debutYear ||
    a.name.localeCompare(b.name));

  return {
    total: byChar.size,
    returnedCount: returned.length,
    waitingCount: waiting.length,
    latestYear,
    returned,
    waiting,
    longest: returned.length ? returned[0] : null,
  };
}
