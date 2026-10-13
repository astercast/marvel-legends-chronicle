/* roll-call-model.js — the pure math behind The Roll Call
   (roll-call.html). No DOM, no storage: given the catalog's flat
   figure list, it calls the roll of every distinct character and
   counts how many figures the catalog gives each of them — the
   returns census of the line.

   WHAT COUNTS AS A CHARACTER: the debut ledger's own rule — the
   name with any parenthetical removed — imported from
   debuts-model.js so the pages cannot disagree. Nothing else is
   normalized: "The Punisher" and "Punisher" are two entries in
   the catalog and stay two entries here.

   THE COUNTING RULES (deterministic, catalog data only, printed
   on the page): a character's count is the number of catalog
   figures filed under that name; its span is its earliest and
   latest figure years; its wave count is the number of distinct
   waves its figures appear in. The roll is ordered by count
   descending, ties by earliest year, then by catalog order of
   first appearance — so the order is a fact of the record, never
   an editorial ranking. The bands are fixed ranges of the count
   (1 · 2 · 3–4 · 5–9 · 10–19 · 20–49 · 50 and over), and every
   band's characters and figures sum back to the archive's own
   totals.

   HONESTY: no prices anywhere (a census of the roll is the
   record, not the market). A character the catalog files once is
   counted once — the long tail is reported at its true size,
   never trimmed to flatter the head of the roll. */
import { baseName } from "./debuts-model.js";

export const ROLL_BANDS = [
  { label: "1 figure", min: 1, max: 1 },
  { label: "2 figures", min: 2, max: 2 },
  { label: "3–4 figures", min: 3, max: 4 },
  { label: "5–9 figures", min: 5, max: 9 },
  { label: "10–19 figures", min: 10, max: 19 },
  { label: "20–49 figures", min: 20, max: 49 },
  { label: "50+ figures", min: 50, max: Infinity },
];

/* figures: the catalog's flat figure list (data/v1/figures.json shape).
   Returns { figureCount, characterCount, roll, bands, singletons,
             returners, top } — `roll` is every character in roll
   order ({ name, count, firstYear, lastYear, waveCount }); `bands`
   carries each fixed band's character and figure totals; `top` is
   the head of the roll (the first 25 in roll order). */
export function buildRollCallModel(figures) {
  const list = figures || [];

  const byChar = new Map(); // base name -> entries [{fig, idx}]
  list.forEach((fig, idx) => {
    const key = baseName(fig.name);
    if (!byChar.has(key)) byChar.set(key, []);
    byChar.get(key).push({ fig, idx });
  });

  const roll = [...byChar.entries()].map(([name, entries]) => ({
    name,
    count: entries.length,
    firstYear: Math.min(...entries.map((e) => e.fig.year)),
    lastYear: Math.max(...entries.map((e) => e.fig.year)),
    waveCount: new Set(entries.map((e) => e.fig.waveId)).size,
    _firstIdx: Math.min(...entries.map((e) => e.idx)),
  })).sort((a, b) =>
    b.count - a.count || a.firstYear - b.firstYear || a._firstIdx - b._firstIdx);
  for (const r of roll) delete r._firstIdx;

  const bands = ROLL_BANDS.map((b) => {
    const inBand = roll.filter((r) => r.count >= b.min && r.count <= b.max);
    return {
      label: b.label,
      min: b.min,
      max: b.max === Infinity ? null : b.max,
      characters: inBand.length,
      figures: inBand.reduce((n, r) => n + r.count, 0),
    };
  });

  const singletons = roll.filter((r) => r.count === 1);
  const returners = roll.filter((r) => r.count >= 2);

  return {
    figureCount: list.length,
    characterCount: roll.length,
    roll,
    bands,
    singletons: {
      characters: singletons.length,
      figures: singletons.reduce((n, r) => n + r.count, 0),
    },
    returners: {
      characters: returners.length,
      figures: returners.reduce((n, r) => n + r.count, 0),
    },
    top: roll.slice(0, 25),
    topTenFigures: roll.slice(0, 10).reduce((n, r) => n + r.count, 0),
  };
}
