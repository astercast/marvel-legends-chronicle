/* year-ledger-model.js — the pure math behind The Year Ledger
   (year-ledger.html). No DOM, no storage: given the catalog's flat
   figure list, it files every figure under its release year and
   counts the years themselves — how much the line shipped in each
   of its twenty-five years, and where the figures actually sit.

   WHAT COUNTS AS A YEAR: the catalog's own `year` field on each
   figure — every figure in the catalog carries one, the span runs
   2002–2026 with no gap year, and a test cross-checks each year's
   wave count and figure count against waves.json (whose years
   agree with the figures' years on all 167 waves).

   THE COUNTING RULES (deterministic, catalog data only, printed
   on the page): years are filed chronologically; a year's figures
   are the figures the catalog dates to it; its waves are the
   distinct waves those figures file under; its characters are the
   distinct characters among them and its debuts the characters
   whose first figure in the line falls in it — both under the
   debut ledger's own character rule (name minus parenthetical,
   imported from debuts-model.js, so the pages cannot disagree).
   The bands are fixed ranges of the annual figure count (1–24 ·
   25–49 · 50–74 · 75–99 · 100–149 · 150 and over), and every
   band's years and figures sum back to the archive's own totals.
   The median year is the middle year when all twenty-five are
   ordered by figure count. A "flood year" ships 100 or more
   figures. The biggest rise and fall are between consecutive
   years of the span.

   HONESTY: no prices anywhere (a ledger of years is the record,
   not the market). Quiet years are reported at their true size —
   2011 shipped a single figure — never folded into neighbours. */
import { baseName } from "./debuts-model.js";

export const YEAR_BANDS = [
  { label: "1–24 figures", min: 1, max: 24 },
  { label: "25–49 figures", min: 25, max: 49 },
  { label: "50–74 figures", min: 50, max: 74 },
  { label: "75–99 figures", min: 75, max: 99 },
  { label: "100–149 figures", min: 100, max: 149 },
  { label: "150+ figures", min: 150, max: Infinity },
];

export const FLOOD_MIN = 100;

/* figures: the catalog's flat figure list (data/v1/figures.json shape).
   Returns { figureCount, waveCount, yearCount, firstYear, lastYear,
             years, bands, median, busiest, quietest, flood,
             biggestRise, biggestFall } — `years` is every year of the
   span in chronological order ({ year, figures, waves, characters,
   debuts, exclusives, bafWaves, manufacturer }); `flood` covers the
   years at FLOOD_MIN figures or more; rises and falls name the two
   consecutive years and the signed change. */
export function buildYearLedgerModel(figures) {
  const list = figures || [];

  // Debuts: a character's first figure (earliest year, catalog-order
  // tie-break — the debut ledger's rule) files its debut year.
  const first = new Map(); // base name -> { fig, idx }
  list.forEach((fig, idx) => {
    const base = baseName(fig.name);
    if (!base) return;
    const cur = first.get(base);
    if (!cur || fig.year < cur.fig.year) first.set(base, { fig, idx });
  });
  const debutCount = new Map(); // year -> debuts
  for (const { fig } of first.values()) {
    debutCount.set(fig.year, (debutCount.get(fig.year) || 0) + 1);
  }

  const byYear = new Map(); // year -> accumulator
  list.forEach((fig) => {
    if (!byYear.has(fig.year)) {
      byYear.set(fig.year, {
        year: fig.year, figures: 0, waveIds: new Set(), chars: new Set(),
        exclusives: 0, bafWaveIds: new Set(), manufacturers: new Set(),
      });
    }
    const y = byYear.get(fig.year);
    y.figures += 1;
    y.waveIds.add(fig.waveId);
    const base = baseName(fig.name);
    if (base) y.chars.add(base);
    if (fig.exclusive) y.exclusives += 1;
    if (fig.waveBaf) y.bafWaveIds.add(fig.waveId);
    if (fig.manufacturer) y.manufacturers.add(fig.manufacturer);
  });

  const years = [...byYear.values()].sort((a, b) => a.year - b.year).map((y) => ({
    year: y.year,
    figures: y.figures,
    waves: y.waveIds.size,
    characters: y.chars.size,
    debuts: debutCount.get(y.year) || 0,
    exclusives: y.exclusives,
    bafWaves: y.bafWaveIds.size,
    manufacturer: [...y.manufacturers].join(" · "),
  }));

  const bands = YEAR_BANDS.map((b) => {
    const inBand = years.filter((y) => y.figures >= b.min && y.figures <= b.max);
    return {
      label: b.label,
      min: b.min,
      max: b.max === Infinity ? null : b.max,
      years: inBand.length,
      figures: inBand.reduce((n, y) => n + y.figures, 0),
    };
  });

  const countsAsc = years.map((y) => y.figures).sort((a, b) => a - b);
  const median = countsAsc.length
    ? countsAsc[Math.floor((countsAsc.length - 1) / 2)] : null;

  const busiest = years.length
    ? years.reduce((best, y) => (y.figures > best.figures ? y : best), years[0]) : null;
  const quietest = years.length
    ? years.reduce((best, y) => (y.figures < best.figures ? y : best), years[0]) : null;

  const floodYears = years.filter((y) => y.figures >= FLOOD_MIN);
  const flood = {
    years: floodYears.length,
    figures: floodYears.reduce((n, y) => n + y.figures, 0),
    firstYear: floodYears.length ? floodYears[0].year : null,
    lastYear: floodYears.length ? floodYears[floodYears.length - 1].year : null,
  };

  let biggestRise = null;
  let biggestFall = null;
  for (let i = 1; i < years.length; i++) {
    const delta = years[i].figures - years[i - 1].figures;
    const swing = { fromYear: years[i - 1].year, toYear: years[i].year, delta };
    if (delta > 0 && (!biggestRise || delta > biggestRise.delta)) biggestRise = swing;
    if (delta < 0 && (!biggestFall || delta < biggestFall.delta)) biggestFall = swing;
  }

  return {
    figureCount: list.length,
    waveCount: years.reduce((n, y) => n + y.waves, 0),
    yearCount: years.length,
    firstYear: years.length ? years[0].year : null,
    lastYear: years.length ? years[years.length - 1].year : null,
    years,
    bands,
    median,
    busiest,
    quietest,
    flood,
    biggestRise,
    biggestFall,
  };
}
