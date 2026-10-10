/* Data layer — loads the figure database once, exposes query helpers.
   figId format: "<waveId>::<figureName>" (stable, derived from wave + name). */
import { PATHS } from "./config.js";

let cache = null;

export async function loadData() {
  if (cache) return cache;
  const res = await fetch(PATHS.figures);
  if (!res.ok) throw new Error(`Failed to load figures.json (${res.status})`);
  const raw = await res.json();
  const waves = raw.waves ?? [];
  const figures = [];
  for (const wave of waves) {
    for (const fig of wave.figures ?? []) {
      figures.push({
        id: `${wave.id}::${fig.name}`,
        waveId: wave.id,
        waveSeries: wave.series,
        year: wave.year,
        manufacturer: wave.manufacturer,
        waveBaf: wave.baf ?? null,
        ...fig,
      });
    }
  }
  cache = { waves, figures };
  return cache;
}

export function searchFigures(figures, query) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return figures.filter((f) =>
    f.name.toLowerCase().includes(q) ||
    (f.variant ?? "").toLowerCase().includes(q) ||
    f.waveSeries.toLowerCase().includes(q) ||
    (f.waveBaf ?? "").toLowerCase().includes(q)
  );
}

export function figureById(figures, id) {
  return figures.find((f) => f.id === id) ?? null;
}

export function computeStats(waves, figures) {
  const byYear = {};
  const byManufacturer = {};
  for (const w of waves) {
    byYear[w.year] = (byYear[w.year] ?? 0) + w.figures.length;
    byManufacturer[w.manufacturer] = (byManufacturer[w.manufacturer] ?? 0) + w.figures.length;
  }
  return {
    waves: waves.length,
    figures: figures.length,
    yearMin: Math.min(...waves.map((w) => w.year)),
    yearMax: Math.max(...waves.map((w) => w.year)),
    bafWaves: waves.filter((w) => w.baf).length,
    exclusiveFigures: figures.filter((f) => f.exclusive).length,
    variantFigures: figures.filter((f) => f.variant).length,
    byYear,
    byManufacturer,
  };
}
