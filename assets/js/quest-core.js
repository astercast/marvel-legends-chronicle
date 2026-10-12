/* quest-core.js — pure Grail Quest logic, shared by quest.js (page) and
   showcase.js ("Copy my quest" export). No DOM, no storage, no init:
   safe to import from any page. All signals derive from the archive
   data and the caller's owned/watchlist ids — nothing invented. */
import { buildBafs } from "./baf-planner.js";

/* ------------------------------------------------------------------ */
/* Archive signals — all derived from the figure records, nothing added. */

/* Convention exclusives: the archive's `exclusive` strings for con events. */
export const CONVENTION_EXCLUSIVES = new Set([
  "San Diego Comic-Con",
  "New York Comic-Con",
  "HASCON",
  "Hasbro PulseCon",
]);

export function isChase(fig) {
  return /chase/i.test(`${fig.notes ?? ""} ${fig.variant ?? ""}`);
}

/* Same gate retro.js uses: retro-carded when the archive's own notes or
   variant text says "retro". Retro status is never guessed. */
export function isRetro(fig) {
  return /retro/i.test(`${fig.notes ?? ""} ${fig.variant ?? ""}`);
}

export function isToyBiz(fig) {
  return fig.manufacturer === "Toy Biz";
}

export function isVariant(fig) {
  return Boolean(fig.variant);
}

export function isConventionExclusive(fig) {
  return CONVENTION_EXCLUSIVES.has(fig.exclusive);
}

/* Rarity tiers the wave-23 guide documents: HasLab (funded-only production)
   and made-to-order (order-window production). Both are archive `exclusive`
   values — nothing guessed. */
export function isHasLab(fig) {
  return fig.exclusive === "HasLab";
}

export function isMadeToOrder(fig) {
  return fig.exclusive === "Made-to-order";
}

/* Strip parenthetical qualifiers, mirroring the character pages'
   base_name() in scripts/build_characters.py. */
export function baseName(n) {
  return String(n ?? "").replace(/\s*\(.*?\)\s*/g, "").trim();
}

/* Collapse numbered wave suffixes so "X-Men '97 Wave 1/2/3" becomes one run. */
export function runKey(series) {
  return String(series ?? "")
    .replace(/\s+(wave|series|vol\.?|volume)\s*\d+$/i, "")
    .trim();
}

/* Figure-type cost proxy for "cheapest missing piece". Honest labeling only:
   standard singles tend cheapest, made-to-order/HasLab tend dearest. This is
   a roughness, not a price — real prices come from sold listings. */
export function costTier(fig) {
  const ex = fig.exclusive ?? "";
  const series = fig.waveSeries ?? "";
  if (ex === "HasLab" || ex === "Made-to-order") return 4;
  if (ex === "Box set exclusive" || /^(box set|2-packs?|3-packs?)\b/i.test(series) || /\bdeluxe\b/i.test(series)) return 2;
  if (ex) return 3;
  return 1;
}

export const COST_TIER_LABELS = {
  1: "Standard single",
  2: "Box set / multi-pack",
  3: "Retailer or convention exclusive",
  4: "Made-to-order / HasLab",
};

export function difficultyFor(missing) {
  if (missing <= 1) return "Quick win";
  if (missing <= 3) return "Medium";
  return "Long haul";
}

/* ------------------------------------------------------------------ */
/* Quest generation. */

function pieceGot(piece, ownedSet) {
  return piece.carriers.some((c) => ownedSet.has(c.id));
}

/* missingFigureIds(figures, ids): map id -> full figure record. */
function figuresById(figures) {
  const m = new Map();
  for (const f of figures) m.set(f.id, f);
  return m;
}

export function generateQuests(figures, waves, ownedIds) {
  const ownedSet = new Set(ownedIds);
  const byId = figuresById(figures);
  const quests = [];

  /* BAF quests — started but unfinished, nearest completion first.
     Disambiguate repeat BAF names across waves with the year. */
  const bafNameCounts = new Map();
  const allBafs = buildBafs(waves);
  for (const b of allBafs) bafNameCounts.set(b.name, (bafNameCounts.get(b.name) ?? 0) + 1);
  for (const baf of allBafs) {
    const gotPieces = baf.pieces.filter((p) => pieceGot(p, ownedSet));
    const total = baf.pieces.length;
    const got = gotPieces.length;
    if (got === 0 || got === total) continue;
    const name = bafNameCounts.get(baf.name) > 1 ? `${baf.name} (${baf.year})` : baf.name;
    const missing = [];
    for (const p of baf.pieces) {
      if (pieceGot(p, ownedSet)) continue;
      const carrier = p.carriers[0];
      missing.push(byId.get(carrier.id) ?? carrier);
    }
    quests.push({
      kind: "baf",
      id: `baf:${baf.name}:${baf.year}`,
      title: `Finish BAF: ${name}`,
      sub: `${baf.series} · ${baf.year}`,
      total,
      got,
      missing,
    });
  }

  /* Series-run quests — numbered waves of one line grouped by runKey. */
  const runs = new Map();
  for (const f of figures) {
    const key = runKey(f.waveSeries);
    if (!key) continue;
    if (!runs.has(key)) runs.set(key, []);
    runs.get(key).push(f);
  }
  for (const [key, figs] of runs) {
    if (figs.length < 3) continue;
    const gotFigs = figs.filter((f) => ownedSet.has(f.id));
    const got = gotFigs.length;
    if (got === 0 || got === figs.length) continue;
    const wavesInRun = [...new Set(figs.map((f) => f.waveSeries))].join(" · ");
    quests.push({
      kind: "run",
      id: `run:${key}`,
      title: `Complete the ${key} run`,
      sub: wavesInRun,
      total: figs.length,
      got,
      missing: figs.filter((f) => !ownedSet.has(f.id)),
    });
  }

  /* Character-run quests — same base_name() grouping as the character pages. */
  const chars = new Map();
  for (const f of figures) {
    const name = baseName(f.name);
    if (!name) continue;
    if (!chars.has(name)) chars.set(name, []);
    chars.get(name).push(f);
  }
  for (const [name, figs] of chars) {
    if (figs.length < 5) continue;
    const got = figs.filter((f) => ownedSet.has(f.id)).length;
    if (got === 0 || got === figs.length) continue;
    quests.push({
      kind: "character",
      id: `character:${name}`,
      title: `Close the gap: ${name} run`,
      sub: `${figs.length} releases in the archive`,
      total: figs.length,
      got,
      missing: figs.filter((f) => !ownedSet.has(f.id)),
    });
  }

  for (const q of quests) {
    q.missingCount = q.total - q.got;
    q.difficulty = difficultyFor(q.missingCount);
  }
  quests.sort((a, b) => a.missingCount - b.missingCount || a.total - b.total);
  return quests;
}

/* ------------------------------------------------------------------ */
/* "Next quest" recommendations. */

export function recommendNext(figures, waves, ownedIds, watchlist) {
  const ownedSet = new Set(ownedIds);
  const quests = generateQuests(figures, waves, ownedIds);
  const out = { baf: null, cheapPiece: null, grail: null };

  /* Closest BAF: fewest pieces missing among started BAFs. */
  const bafQuests = quests.filter((q) => q.kind === "baf");
  if (bafQuests.length) out.baf = bafQuests[0];

  /* Cheapest missing piece of a character/series run, by figure-type proxy —
     labeled honestly as a proxy, not a price. */
  let best = null;
  for (const q of quests) {
    if (q.kind !== "character" && q.kind !== "run") continue;
    for (const f of q.missing) {
      const tier = costTier(f);
      if (!best || tier < best.tier) best = { fig: f, tier, quest: q };
    }
  }
  if (best) out.cheapPiece = best;

  /* Nearest watchlist grail: lowest user-reported sighting price; flagged as
     reported, never presented as market data. */
  const entries = Array.isArray(watchlist) ? watchlist : [];
  let grail = null;
  for (const e of entries) {
    const sightings = Array.isArray(e.sightings) ? e.sightings : [];
    const prices = sightings
      .map((s) => Number(s.price))
      .filter((p) => Number.isFinite(p) && p > 0);
    const price = prices.length ? Math.min(...prices) : null;
    const cand = { entry: e, price, reported: price !== null };
    if (!grail || (cand.price !== null && (grail.price === null || cand.price < grail.price))) {
      grail = cand;
    }
  }
  if (grail) out.grail = grail;

  return out;
}

/* ------------------------------------------------------------------ */
/* Achievements — unlockable badges from archive signals only. */

export function computeAchievements(figures, waves, ownedIds) {
  const ownedSet = new Set(ownedIds);
  const ownedFigs = figures.filter((f) => ownedSet.has(f.id));

  const bafs = buildBafs(waves);
  const completedBafs = bafs.filter((b) =>
    b.pieces.every((p) => pieceGot(p, ownedSet))
  ).length;

  let completedWaves = 0;
  for (const w of waves) {
    const figs = w.figures ?? [];
    if (!figs.length) continue;
    const allOwned = figs.every((f) => ownedSet.has(`${w.id}::${f.name}`));
    if (allOwned) completedWaves++;
  }

  const catalog = [
    {
      id: "first-steps", name: "First Steps", icon: "🐾",
      blurb: "Log your first 5 figures in the tracker.",
      got: Math.min(ownedFigs.length, 5), need: 5,
    },
    {
      id: "chase-hunter", name: "Chase Hunter", icon: "🎯",
      blurb: "Own the archive's chase-flagged figures (variant/notes say \"chase\").",
      got: ownedFigs.filter(isChase).length,
      need: figures.filter(isChase).length || 1,
    },
    {
      id: "build-a-master", name: "Build-A-Master", icon: "🧩",
      blurb: "Complete a Build-A-Figure — every piece secured.",
      got: Math.min(completedBafs, 1), need: 1,
    },
    {
      id: "retro-royalty", name: "Retro Royalty", icon: "🕰️",
      blurb: "Own 10+ retro-carded figures (archive notes say \"retro\").",
      got: ownedFigs.filter(isRetro).length, need: 10,
    },
    {
      id: "variant-vault", name: "Variant Vault", icon: "🔀",
      blurb: "Own 10+ documented variants.",
      got: ownedFigs.filter(isVariant).length, need: 10,
    },
    {
      id: "toy-biz-pioneer", name: "Toy Biz Pioneer", icon: "📼",
      blurb: "Own 10+ figures from the Toy Biz era (2002–2006).",
      got: ownedFigs.filter(isToyBiz).length, need: 10,
    },
    {
      id: "convention-floor", name: "Convention Floor", icon: "🎪",
      blurb: "Own 5+ convention-exclusive figures (SDCC, NYCC, HASCON, PulseCon).",
      got: ownedFigs.filter(isConventionExclusive).length, need: 5,
    },
    {
      id: "haslab-backer", name: "HasLab Backer", icon: "🏗️",
      blurb: "Own any HasLab exclusive figure (funded-only production, per the Rarity Guide).",
      got: ownedFigs.filter(isHasLab).length, need: 1,
    },
    {
      id: "made-to-order", name: "Made To Order", icon: "📋",
      blurb: "Own a made-to-order figure — scarcity was the calendar, not a chase ratio.",
      got: ownedFigs.filter(isMadeToOrder).length, need: 1,
    },
    {
      id: "rarity-trifecta", name: "Rarity Trifecta", icon: "🏆",
      blurb: "Own a chase, a convention exclusive, AND a HasLab figure — one of each tier.",
      got: [isChase, isConventionExclusive, isHasLab].filter((fn) => ownedFigs.some(fn)).length,
      need: 3,
    },
    {
      id: "completionist", name: "Completionist", icon: "✅",
      blurb: "Complete a full wave run — every figure owned.",
      got: Math.min(completedWaves, 1), need: 1,
    },
    {
      id: "century-shelf", name: "Century Shelf", icon: "💯",
      blurb: "Own 100+ figures.",
      got: ownedFigs.length, need: 100,
    },
  ];

  return catalog.map((a) => ({
    ...a,
    unlocked: a.got >= a.need,
  }));
}

/* ------------------------------------------------------------------ */
/* Collector level — pure fun, honest math shown on the page. */

export const LEVELS = [
  { xp: 0, title: "Rookie" },
  { xp: 25, title: "Collector" },
  { xp: 100, title: "Archivist" },
  { xp: 250, title: "Curator" },
  { xp: 500, title: "Living Legend" },
];

export function xpBreakdown(ownedCount, completedBafs, achievementsUnlocked) {
  const fromOwned = ownedCount;
  const fromBafs = completedBafs * 25;
  const fromAchievements = achievementsUnlocked * 10;
  return { fromOwned, fromBafs, fromAchievements, total: fromOwned + fromBafs + fromAchievements };
}

export function computeLevel(ownedCount, completedBafs, achievementsUnlocked) {
  const { total } = xpBreakdown(ownedCount, completedBafs, achievementsUnlocked);
  let level = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (total >= LEVELS[i].xp) level = i;
  }
  const next = level + 1 < LEVELS.length ? LEVELS[level + 1] : null;
  return {
    xp: total,
    level,
    title: LEVELS[level].title,
    xpIntoLevel: total - LEVELS[level].xp,
    xpForNext: next ? next.xp - LEVELS[level].xp : 0,
    nextTitle: next ? next.title : null,
    nextXp: next ? next.xp : null,
  };
}
