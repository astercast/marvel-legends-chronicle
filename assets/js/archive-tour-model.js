/* archive-tour-model.js, the pure math behind The Archive Tour
   (archive-tour.html). No DOM, no storage: given the catalog (loadData
   shape), it cuts the 25-year archive into four era chapters and works
   out exactly what each chapter spread renders, wave / figure / BAF /
   exclusive / variant counts, a per-year ledger, and the curator picks.

   THE CHAPTER BREAKS (set from the catalog's own wave data, not from
   vibes):
   - 2002–2006 closes the Toy Biz run: all 31 waves in the chapter are
     Toy Biz, and every 2007 wave is Hasbro, the manufacturer field
     itself draws the line. The Build-A-Figure arrives mid-chapter
     (first BAF wave: Series 9 - Galactus, 2005).
   - 2007–2012 is Hasbro's early, lean stretch: output bottoms out in
     2009–2011 (4 waves, 31 figures across three years, the thinnest
     run in the archive) and the chapter closes on the wave the catalog
     itself names "Return of Marvel Legends" (Arnim Zola Wave, 2012).
   - 2013–2019 is the rebuild: the BAF becomes the default architecture
     (46 of the chapter's 54 waves carry one) and annual output climbs
     from 36 figures (2013) to a 157-figure peak (2018). Recorded
     variants nearly vanish, 4 in this chapter against 90 across the
     two before it.
   - 2020–2026 is the modern era: the largest chapter by figures (965),
     exclusives outnumber the three earlier chapters combined, the
     average wave is the biggest in the archive, and the catalog
     records no variants at all.

   CURATOR-PICK SELECTION RULES (deterministic, catalog data only,
   the same rules are printed on the page; invent nothing, no prices):
   1. "Opens the chapter", the first figure, in catalog order, of the
      chapter's earliest wave (ties: catalog order).
   2. "Closes the chapter", the first figure, in catalog order, of the
      chapter's latest wave (ties: last in catalog order).
   3. "Completes the first BAF", the last piece-carrying figure, in
      catalog order, of the chapter's earliest BAF wave: collect that
      wave in order and this is the piece that finishes the build.
   4. "Completes the last BAF", the same rule on the chapter's latest
      BAF wave.
   5. "First variant", the first figure in the chapter, in catalog
      order, carrying a recorded variant.
   6. "First exclusive", the first figure in the chapter, in catalog
      order, carrying a recorded exclusive.
   Picks are de-duplicated by figure id (the earliest rule wins). A
   rule that finds nothing in a chapter produces NO pick, the modern
   chapter's variant slot stands honestly empty, and the page says so. */

export const CHAPTERS = [
  {
    id: "toybiz-twilight",
    title: "Toy Biz Twilight",
    years: [2002, 2006],
    kicker: "Chapter I · 2002–2006",
    why: "Every wave in this chapter is Toy Biz, and every wave after it is Hasbro. The catalog's own manufacturer field draws this line: 2006 is the last Toy Biz year, 2007 the first Hasbro one. The Build-A-Figure is born mid-chapter, in 2005.",
  },
  {
    id: "hasbro-early",
    title: "Hasbro's Early Years",
    years: [2007, 2012],
    kicker: "Chapter II · 2007–2012",
    why: "Hasbro takes over, and the line goes lean. Output bottoms out in 2009–2011, the thinnest three-year run in the archive, before the chapter closes on the wave the catalog itself names the Return of Marvel Legends.",
  },
  {
    id: "the-rebuild",
    title: "The Rebuild",
    years: [2013, 2019],
    kicker: "Chapter III · 2013–2019",
    why: "The rebuild makes the Build-A-Figure the default architecture of a wave and climbs, year on year, to the archive's then-biggest annual output. Recorded variants, everywhere in the first two chapters, nearly vanish.",
  },
  {
    id: "modern-era",
    title: "The Modern Era",
    years: [2020, 2026],
    kicker: "Chapter IV · 2020–2026",
    why: "The biggest chapter in the archive: more figures than the first two chapters combined, exclusives outnumbering all three earlier chapters put together, and the largest waves the line has shipped. The catalog records no variants here at all.",
  },
];

/* The pick rules, in the order they are applied. `find` receives the
   chapter's waves (with catalog index) and figures (catalog order). */
const byYearThenOrder = (a, b) => a.wave.year - b.wave.year || a.idx - b.idx;
const byYearThenOrderDesc = (a, b) => b.wave.year - a.wave.year || b.idx - a.idx;

function waveFigure(figures, waveId, lastPieceCarrier = false) {
  const inWave = figures.filter((f) => f.waveId === waveId);
  if (!inWave.length) return null;
  if (lastPieceCarrier) {
    const carriers = inWave.filter((f) => f.bafPiece);
    return carriers.length ? carriers[carriers.length - 1] : null;
  }
  return inWave[0];
}

export const PICK_RULES = [
  {
    kind: "opener",
    label: "Opens the chapter",
    rule: "First figure of the chapter's earliest wave",
    find(figures, waves) {
      const first = [...waves].sort(byYearThenOrder)[0];
      return first ? waveFigure(figures, first.wave.id) : null;
    },
  },
  {
    kind: "closer",
    label: "Closes the chapter",
    rule: "First figure of the chapter's latest wave",
    find(figures, waves) {
      const last = [...waves].sort(byYearThenOrderDesc)[0];
      return last ? waveFigure(figures, last.wave.id) : null;
    },
  },
  {
    kind: "baf-first",
    label: "Completes the first BAF",
    rule: "Last piece-carrying figure of the chapter's earliest BAF wave",
    find(figures, waves) {
      const baf = waves.filter((e) => e.wave.baf).sort(byYearThenOrder)[0];
      return baf ? waveFigure(figures, baf.wave.id, true) : null;
    },
  },
  {
    kind: "baf-last",
    label: "Completes the last BAF",
    rule: "Last piece-carrying figure of the chapter's latest BAF wave",
    find(figures, waves) {
      const baf = waves.filter((e) => e.wave.baf).sort(byYearThenOrderDesc)[0];
      return baf ? waveFigure(figures, baf.wave.id, true) : null;
    },
  },
  {
    kind: "variant",
    label: "First variant",
    rule: "First figure in the chapter carrying a recorded variant",
    find(figures) {
      return figures.find((f) => f.variant) ?? null;
    },
  },
  {
    kind: "exclusive",
    label: "First exclusive",
    rule: "First figure in the chapter carrying a recorded exclusive",
    find(figures) {
      return figures.find((f) => f.exclusive) ?? null;
    },
  },
];

export function buildTourModel(figures, waves) {
  const waveIndex = new Map(waves.map((w, i) => [w.id, i]));
  const chapters = CHAPTERS.map((ch) => {
    const [lo, hi] = ch.years;
    const chWaves = waves
      .filter((w) => w.year >= lo && w.year <= hi)
      .map((w) => ({ wave: w, idx: waveIndex.get(w.id) }));
    const chFigures = figures.filter((f) => f.year >= lo && f.year <= hi);

    const yearRows = [];
    for (let y = lo; y <= hi; y += 1) {
      const yw = chWaves.filter((e) => e.wave.year === y);
      const yf = chFigures.filter((f) => f.year === y);
      yearRows.push({
        year: y,
        waves: yw.length,
        figures: yf.length,
        bafWaves: yw.filter((e) => e.wave.baf).length,
      });
    }

    const seen = new Set();
    const picks = [];
    const foundKinds = new Set();
    for (const rule of PICK_RULES) {
      const fig = rule.find(chFigures, chWaves);
      if (!fig) continue;
      foundKinds.add(rule.kind);
      if (seen.has(fig.id)) continue;
      seen.add(fig.id);
      picks.push({ kind: rule.kind, label: rule.label, rule: rule.rule, figure: fig });
    }
    /* Rules that found nothing, named honestly on the page rather
       than back-filled with a pick the rule did not select. A rule
       whose figure was already picked under an earlier rule is not
       empty; it simply shares its plate. */
    const emptyRules = PICK_RULES
      .filter((r) => !foundKinds.has(r.kind))
      .map((r) => ({ kind: r.kind, label: r.label, rule: r.rule }));

    const bafWaves = chWaves.filter((e) => e.wave.baf).length;
    return {
      ...ch,
      counts: {
        waves: chWaves.length,
        figures: chFigures.length,
        bafWaves,
        bafPieceFigures: chFigures.filter((f) => f.bafPiece).length,
        exclusives: chFigures.filter((f) => f.exclusive).length,
        variants: chFigures.filter((f) => f.variant).length,
        manufacturers: [...new Set(chWaves.map((e) => e.wave.manufacturer))],
        avgWaveSize: chWaves.length ? chFigures.length / chWaves.length : 0,
      },
      yearRows,
      picks,
      emptyRules,
    };
  });

  return {
    chapters,
    totals: {
      waves: waves.length,
      figures: figures.length,
      bafWaves: waves.filter((w) => w.baf).length,
      exclusives: figures.filter((f) => f.exclusive).length,
      variants: figures.filter((f) => f.variant).length,
      yearMin: chapters.length ? chapters[0].years[0] : null,
      yearMax: chapters.length ? chapters[chapters.length - 1].years[1] : null,
    },
    /* Chapters partition the archive: every wave and every figure
       belongs to exactly one chapter. The page states this; the test
       suite holds it true. */
    partitioned:
      chapters.reduce((n, c) => n + c.counts.waves, 0) === waves.length &&
      chapters.reduce((n, c) => n + c.counts.figures, 0) === figures.length,
  };
}
