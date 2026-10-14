/* debuts-model.js, the pure math behind First Appearances
   (debuts.html). No DOM, no storage: given the catalog's flat figure
   list, it works out every distinct character's first figure in the
   line, their debut, and lays the debuts out in the Archive Tour's
   four era chapters.

   WHAT COUNTS AS A CHARACTER: the archive's own rule, the same one
   the character pages are built with (scripts/build_characters.py):
   a figure's character is its name with any parenthetical removed,
   "Spider-Man (No Way Home)" files under "Spider-Man". Nothing else
   is normalized: "The Punisher" and "Punisher" are two entries in
   the catalog and stay two entries here, because that is what the
   archive records.

   THE DEBUT RULE (deterministic, catalog data only, printed on the
   page): a character's debut is their earliest figure in the catalog
  , lowest year, ties broken by catalog order. The debut names the
   exact figure, its wave and its manufacturer, all carried by the
   catalog itself.

   HONESTY: no prices anywhere (a debut ledger is the record, not the
   market); a character links to its character page only when the
   archive actually publishes one (the top-66 manifest), the model
   takes that slug set as an input and leaves the rest unlinked
   rather than pointing at pages that do not exist. */
import { CHAPTERS } from "./archive-tour-model.js";

export function baseName(name) {
  return String(name || "").replace(/\s*\(.*?\)\s*/g, "").trim();
}

export function slugify(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function chapterForYear(year) {
  return CHAPTERS.find((c) => year >= c.years[0] && year <= c.years[1]) || null;
}

/* figures: the catalog's flat figure list (data/v1/figures.json shape).
   characterSlugs: Set of slugs with a published character page.
   Returns { total, debuts, byChapter, byYear, latestYear, latest,
             span }, debuts sorted by (year, catalog order). */
export function buildDebutsModel(figures, characterSlugs = new Set()) {
  const first = new Map(); // base name -> { fig, idx }
  const counts = new Map(); // base name -> release count
  (figures || []).forEach((fig, idx) => {
    const base = baseName(fig.name);
    if (!base) return;
    counts.set(base, (counts.get(base) || 0) + 1);
    const cur = first.get(base);
    if (!cur || fig.year < cur.fig.year) first.set(base, { fig, idx });
  });

  const debuts = [...first.entries()].map(([name, { fig, idx }]) => {
    const slug = slugify(name);
    return {
      name,
      slug,
      hasPage: characterSlugs.has(slug),
      figure: fig.name,
      figureId: fig.id,
      year: fig.year,
      waveId: fig.waveId,
      waveSeries: fig.waveSeries,
      manufacturer: fig.manufacturer,
      releases: counts.get(name) || 0,
      chapterId: (chapterForYear(fig.year) || {}).id || null,
      _idx: idx,
    };
  }).sort((a, b) => a.year - b.year || a._idx - b._idx)
    .map(({ _idx, ...d }) => d);

  // Era chapters partition the debuts: every debut lands in exactly
  // one chapter (chapter year ranges cover 2002-2026 without gaps).
  const byChapter = CHAPTERS.map((c) => ({
    ...c,
    debuts: debuts.filter((d) => d.chapterId === c.id),
  }));

  const byYear = new Map();
  for (const d of debuts) byYear.set(d.year, (byYear.get(d.year) || 0) + 1);
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const latestYear = years.length ? years[years.length - 1] : null;

  return {
    total: debuts.length,
    debuts,
    byChapter,
    byYear: years.map((y) => ({ year: y, count: byYear.get(y) })),
    latestYear,
    latest: latestYear === null ? [] : debuts.filter((d) => d.year === latestYear),
    span: years.length ? [years[0], latestYear] : [null, null],
  };
}
