/* quest-core.js, pure Grail Quest logic, shared by quest.js (page) and
   showcase.js ("Copy my quest" export). No DOM, no storage, no init:
   safe to import from any page. All signals derive from the archive
   data and the caller's owned/watchlist ids, nothing invented. */
import { buildBafs } from "./baf-planner.js";
import {
  signalForFigure, closenessToTarget, rankWatchHunts,
} from "./price-watch.js";
import { monthKey, buysInMonth, totalFor } from "./budget-core.js";

/* ------------------------------------------------------------------ */
/* Archive signals, all derived from the figure records, nothing added. */

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
   values, nothing guessed. */
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
   a roughness, not a price, real prices come from sold listings. */
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
/* The Grail Ladder, a rarity-signal score, never a value index. Every
   point comes from the archive's own documented signals (the wave-23 Rarity
   Guide tiers) or the Chronicle's reported price signals (market recognition
   that a piece trades as a grail, e.g. the white Epic Heroes Doom's
   $115–$200 reported band). Honest labeling: this measures documented
   scarcity signals, not worth. */
export function grailScore(fig, signals = []) {
  let score = 0;
  const text = `${fig?.notes ?? ""} ${fig?.variant ?? ""}`;
  if (/chase/i.test(text)) score += 100; // Toy Biz chases, the dead era
  const ex = fig?.exclusive ?? "";
  if (ex === "HasLab") score += 90;
  else if (CONVENTION_EXCLUSIVES.has(ex)) score += 80;
  else if (ex === "Made-to-order") score += 70;
  else if (ex) score += 40; // retailer / store exclusive
  if (fig?.variant) score += 25;
  if (/retro/i.test(text)) score += 10;
  if (fig?.manufacturer === "Toy Biz") score += 10;
  const sigs = signalForFigure(fig?.id, signals);
  if (sigs.some((s) => Number(s?.high) >= 100)) score += 20;
  else if (sigs.some((s) => Number(s?.high) >= 40)) score += 10;
  return score;
}

export function grailTier(score) {
  if (score >= 80) return "mythic";
  if (score >= 45) return "rare";
  if (score >= 20) return "notable";
  return "common";
}

export const GRAIL_TIER_LABELS = {
  mythic: "Mythic grail",
  rare: "Rare",
  notable: "Notable",
  common: "Common",
};

/* Rarest owned figure, the crown jewel of the shelf. Ties break on the
   figure name so the pick is deterministic. */
export function rarestOwned(figures, ownedIds, signals = []) {
  const owned = new Set(Array.isArray(ownedIds) ? ownedIds : []);
  let best = null;
  for (const f of figures ?? []) {
    if (!owned.has(f?.id)) continue;
    const score = grailScore(f, signals);
    if (!best || score > best.score ||
        (score === best.score && String(f.name) < String(best.fig.name))) {
      best = { fig: f, score, tier: grailTier(score) };
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Character runs, the same base_name() grouping the character pages use.
   Shared by the quest generator, the achievements, and the insights
   dashboard so all three agree on what "a character run" is. Returns
   [{ name, figs, got, total, missing }] for characters with at least
   minReleases archive releases (default 5). */
export function characterRuns(figures, ownedIds, minReleases = 5) {
  const owned = new Set(Array.isArray(ownedIds) ? ownedIds : []);
  const chars = new Map();
  for (const f of figures ?? []) {
    const name = baseName(f?.name);
    if (!name) continue;
    if (!chars.has(name)) chars.set(name, []);
    chars.get(name).push(f);
  }
  const out = [];
  for (const [name, figs] of chars) {
    if (figs.length < minReleases) continue;
    const missing = figs.filter((f) => !owned.has(f.id));
    out.push({ name, figs, got: figs.length - missing.length, total: figs.length, missing });
  }
  return out;
}

/* Completed Build-A-Figures from the user's owned state. Exported so page
   layers never re-implement the piece check (quest.js once called the
   module-private pieceGot directly and would have thrown at runtime). */
export function countCompletedBafs(figures, waves, ownedIds) {
  const ownedSet = new Set(Array.isArray(ownedIds) ? ownedIds : []);
  return buildBafs(waves).filter((b) =>
    b.pieces.every((p) => pieceGot(p, ownedSet))
  ).length;
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

  /* BAF quests, started but unfinished, nearest completion first.
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

  /* Series-run quests, numbered waves of one line grouped by runKey. */
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

  /* Character-run quests, same grouping as the character pages (and the
     insights dashboard): characters with >= 5 archive releases. */
  for (const run of characterRuns(figures, ownedIds, 5)) {
    const { name, figs, got } = run;
    if (got === 0 || got === figs.length) continue;
    quests.push({
      kind: "character",
      id: `character:${name}`,
      title: `Close the gap: ${name} run`,
      sub: `${figs.length} releases in the archive`,
      total: figs.length,
      got,
      missing: run.missing,
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
/* Year-shelf commissions, the Vault Room's 25 year-shelves as quests.
   Completion % is quest progress: every shelf with at least one owned figure
   is a commission; a finished shelf joins the permanent exhibit. */
export function shelfCommissions(figures, ownedIds) {
  const owned = new Set(Array.isArray(ownedIds) ? ownedIds : []);
  const byYear = new Map();
  for (const f of figures ?? []) {
    const y = f?.year;
    if (!Number.isInteger(y)) continue;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(f);
  }
  const out = [];
  for (const year of [...byYear.keys()].sort((a, b) => a - b)) {
    const figs = byYear.get(year);
    const got = figs.filter((f) => owned.has(f.id)).length;
    out.push({
      kind: "shelf",
      id: `shelf:${year}`,
      title: `Exhibit the ${year} shelf`,
      sub: "Vault Room year-shelf",
      total: figs.length,
      got,
      missing: figs.filter((f) => !owned.has(f.id)),
      missingCount: figs.length - got,
      difficulty: difficultyFor(figs.length - got),
      year,
    });
  }
  return out;
}

/* Every commission the registrar tracks: active (started but unfinished)
   plus completed (the permanent exhibit). Commission ids are stable across
   renders so completion ceremonies can diff them. */
export function activeCommissions(figures, waves, ownedIds) {
  const quests = generateQuests(figures, waves, ownedIds);
  const shelves = shelfCommissions(figures, ownedIds).filter(
    (s) => s.got > 0 && s.missingCount > 0
  );
  const all = [...quests, ...shelves];
  all.sort((a, b) => a.missingCount - b.missingCount || a.total - b.total);
  return all;
}

export function completedCommissions(figures, waves, ownedIds) {
  const owned = new Set(Array.isArray(ownedIds) ? ownedIds : []);
  const done = [];

  /* Completed BAFs, every piece secured. */
  const bafNameCounts = new Map();
  const allBafs = buildBafs(waves);
  for (const b of allBafs) bafNameCounts.set(b.name, (bafNameCounts.get(b.name) ?? 0) + 1);
  for (const baf of allBafs) {
    if (!baf.pieces.every((p) => pieceGot(p, owned))) continue;
    const name = bafNameCounts.get(baf.name) > 1 ? `${baf.name} (${baf.year})` : baf.name;
    done.push({
      kind: "baf", id: `baf:${baf.name}:${baf.year}`,
      title: `Finish BAF: ${name}`, sub: `${baf.series} · ${baf.year}`,
      total: baf.pieces.length, got: baf.pieces.length,
    });
  }

  /* Completed series runs, numbered waves grouped by runKey, all owned. */
  const runs = new Map();
  for (const f of figures ?? []) {
    const key = runKey(f.waveSeries);
    if (!key) continue;
    if (!runs.has(key)) runs.set(key, []);
    runs.get(key).push(f);
  }
  for (const [key, figs] of runs) {
    if (figs.length < 3) continue;
    if (!figs.every((f) => owned.has(f.id))) continue;
    const wavesInRun = [...new Set(figs.map((f) => f.waveSeries))].join(" · ");
    done.push({
      kind: "run", id: `run:${key}`, title: `Complete the ${key} run`,
      sub: wavesInRun, total: figs.length, got: figs.length,
    });
  }

  /* Completed character runs + year shelves. */
  for (const r of characterRuns(figures, ownedIds, 5)) {
    if (r.got !== r.total) continue;
    done.push({
      kind: "character", id: `character:${r.name}`,
      title: `Close the gap: ${r.name} run`,
      sub: `${r.figs.length} releases in the archive`,
      total: r.figs.length, got: r.figs.length,
    });
  }
  for (const s of shelfCommissions(figures, ownedIds)) {
    if (s.total > 0 && s.got === s.total) done.push(s);
  }
  return done;
}

export function countCompletedCommissions(figures, waves, ownedIds) {
  return completedCommissions(figures, waves, ownedIds).length;
}

/* ------------------------------------------------------------------ */
/* "Next quest" recommendations. */

export function recommendNext(figures, waves, ownedIds, watchlist, extra = {}) {
  const ownedSet = new Set(Array.isArray(ownedIds) ? ownedIds : []);
  const signals = Array.isArray(extra.signals) ? extra.signals : [];
  const quests = generateQuests(figures, waves, ownedIds);
  const out = { baf: null, cheapPiece: null, grail: null, watchHunts: [], affordableGrail: null };

  /* Closest BAF: fewest pieces missing among started BAFs. */
  const bafQuests = quests.filter((q) => q.kind === "baf");
  if (bafQuests.length) out.baf = bafQuests[0];

  /* Cheapest missing piece of a character/series run, by figure-type proxy,
     labeled honestly as a proxy, not a price. When a missing piece is on the
     user's watchlist and the Chronicle has a reported market signal for it,
     the proxy is weighted by how close the reported range is to the user's
     target (flagged on the result, never presented as a price). */
  const watchByFig = new Map();
  for (const e of Array.isArray(watchlist) ? watchlist : []) {
    if (e && e.figId && Number(e.target) > 0 && !watchByFig.has(e.figId)) {
      watchByFig.set(e.figId, e);
    }
  }
  let best = null;
  for (const q of quests) {
    if (q.kind !== "character" && q.kind !== "run") continue;
    for (const f of q.missing) {
      const tier = costTier(f);
      let score = tier;
      let watchNote = null;
      const w = watchByFig.get(f.id);
      if (w && !ownedSet.has(f.id)) {
        for (const s of signalForFigure(f.id, signals)) {
          const c = closenessToTarget(s, w.target);
          if (c !== null && c > 0) {
            score = tier - Math.min(c, 0.9);
            watchNote = "watch-weighted";
            break;
          }
        }
      }
      if (!best || score < best.score) best = { fig: f, tier, score, quest: q, watchNote };
    }
  }
  if (best) out.cheapPiece = best;

  /* Rarest affordable grail: unowned figures with documented rarity (rare or
     mythic on the Grail Ladder), ranked by rarity-per-cost. Cost is the
     Chronicle's reported signal low when one exists, else the honest
     figure-type tier proxy, never an invented price. "Affordable" means the
     reported low is $60 or under, or (with no reported data) a standard /
     multi-pack figure type. The modern chase is effectively dead, so these
     are legacy hunts, finite supply, real money. */
  let grailBest = null;
  for (const f of figures ?? []) {
    if (ownedSet.has(f.id)) continue;
    const score = grailScore(f, signals);
    const rarity = grailTier(score);
    if (rarity !== "mythic" && rarity !== "rare") continue;
    const tier = costTier(f);
    if (tier >= 4) continue; // HasLab / made-to-order, never "affordable"
    const lows = signalForFigure(f.id, signals)
      .map((s) => Number(s?.low))
      .filter((n) => Number.isFinite(n) && n > 0);
    const reportedLow = lows.length ? Math.min(...lows) : null;
    if (reportedLow !== null ? reportedLow > 60 : tier > 2) continue;
    const cost = reportedLow ?? tier * 20; // tier proxy in comparable dollars
    const ratio = score / Math.max(cost, 1);
    if (!grailBest || ratio > grailBest.ratio) {
      grailBest = {
        fig: f, score, rarity, tier, reportedLow, ratio,
        costNote: reportedLow !== null
          ? `reported low $${reportedLow} (reported range, not a live price)`
          : `${COST_TIER_LABELS[tier]} (figure-type proxy, verify with eBay solds)`,
      };
    }
  }
  if (grailBest) out.affordableGrail = grailBest;

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

  /* Watchlist hunts: watched figures ranked by how close the Chronicle's
     reported market data is to the user's target, the "best next hunt".
     Reported ranges, never live prices. */
  out.watchHunts = rankWatchHunts(watchlist, ownedIds, signals).slice(0, 5);

  return out;
}

/* ------------------------------------------------------------------ */
/* Achievements, unlockable badges from archive signals only. */

export function computeAchievements(figures, waves, ownedIds, extra = {}) {
  const ownedSet = new Set(Array.isArray(ownedIds) ? ownedIds : []);
  const ownedFigs = figures.filter((f) => ownedSet.has(f.id));
  const watchlist = Array.isArray(extra.watchlist) ? extra.watchlist : [];
  const signals = Array.isArray(extra.signals) ? extra.signals : [];
  const buys = Array.isArray(extra.buys) ? extra.buys : [];
  const budget = extra.budget ?? {};
  const today = extra.today instanceof Date ? extra.today : new Date();

  const completedBafs = countCompletedBafs(figures, waves, ownedIds);

  /* Completed exhibition commissions (any kind), the Wing Curator bar. */
  const completedCount = countCompletedCommissions(figures, waves, ownedIds);

  /* Distinct archive years represented, the Decade Walker bar. */
  const yearsOwned = new Set(
    ownedFigs.map((f) => f.year).filter((y) => Number.isInteger(y))
  );

  /* Mythic-tier grails owned, the Crown Jewel bar (Grail Ladder, never a
     value index; the market-recognition boost comes from reported signals). */
  const mythicOwned = ownedFigs.filter(
    (f) => grailTier(grailScore(f, signals)) === "mythic"
  ).length;

  /* Full character runs owned, the Character Loyalist bar. */
  const completedRuns = characterRuns(figures, ownedIds, 5).filter((r) => r.got === r.total).length;

  let completedWaves = 0;
  for (const w of waves) {
    const figs = w.figures ?? [];
    if (!figs.length) continue;
    const allOwned = figs.every((f) => ownedSet.has(`${w.id}::${f.name}`));
    if (allOwned) completedWaves++;
  }

  /* --- wave-25: watchlist + budget achievements (all user-derived + reported data) --- */
  /* Patient Hunter: watched figures whose reported market low is at/under target. */
  const watchTargets = new Map();
  for (const e of watchlist) {
    const t = Number(e?.target);
    if (e?.figId && Number.isFinite(t) && t > 0 && !watchTargets.has(e.figId)) {
      watchTargets.set(e.figId, t);
    }
  }
  const patientHits = [];
  for (const [figId, target] of watchTargets) {
    const lows = signalForFigure(figId, signals)
      .map((s) => Number(s?.low))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (lows.length && Math.min(...lows) <= target) patientHits.push(figId);
  }
  /* Deal Day: purchases logged below the watchlist target for the same figure. */
  const dealHits = buys.filter((b) => {
    const t = watchTargets.get(b?.figId);
    const p = Number(b?.price);
    return t !== undefined && Number.isFinite(p) && p > 0 && p < t;
  });
  /* Budget Keeper: 10+ purchases logged AND this month's spend at/under the
     user's own monthly budget (injectable `today` keeps tests honest). */
  const monthTotal = totalFor(buysInMonth(buys, monthKey(today)));
  const monthlyLimit = Number(budget?.monthly);
  const withinBudget = Number.isFinite(monthlyLimit) && monthlyLimit > 0 && monthTotal <= monthlyLimit;

  const catalog = [
    {
      id: "patient-hunter", name: "Patient Hunter", icon: "🏹",
      blurb: "A watched figure's reported market low is at or under your target, patience paid off.",
      got: patientHits.length, need: 1,
    },
    {
      id: "deal-day", name: "Deal Day", icon: "🎉",
      blurb: "Log a purchase below the watchlist target you set for that figure.",
      got: dealHits.length, need: 1,
    },
    {
      id: "budget-keeper", name: "Budget Keeper", icon: "🧾",
      blurb: "Log 10+ purchases while keeping this month's spend at or under your own monthly budget.",
      got: Math.min(buys.length, 10), need: 10,
      unlocked: buys.length >= 10 && withinBudget,
    },
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
      blurb: "Complete a Build-A-Figure, every piece secured.",
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
      blurb: "Own a made-to-order figure, scarcity was the calendar, not a chase ratio.",
      got: ownedFigs.filter(isMadeToOrder).length, need: 1,
    },
    {
      id: "rarity-trifecta", name: "Rarity Trifecta", icon: "🏆",
      blurb: "Own a chase, a convention exclusive, AND a HasLab figure, one of each tier.",
      got: [isChase, isConventionExclusive, isHasLab].filter((fn) => ownedFigs.some(fn)).length,
      need: 3,
    },
    {
      id: "completionist", name: "Completionist", icon: "✅",
      blurb: "Complete a full wave run, every figure owned.",
      got: Math.min(completedWaves, 1), need: 1,
    },
    {
      id: "character-loyalist", name: "Character Loyalist", icon: "🦸",
      blurb: "Own every archive release of one character's full run (5+ releases).",
      got: Math.min(completedRuns, 1), need: 1,
    },
    {
      id: "archivist", name: "Archivist", icon: "🗄️",
      blurb: "Log 50 figures in the tracker.",
      got: Math.min(ownedFigs.length, 50), need: 50,
    },
    {
      id: "century-shelf", name: "Century Shelf", icon: "💯",
      blurb: "Own 100+ figures.",
      got: ownedFigs.length, need: 100,
    },
    {
      id: "crown-jewel", name: "Crown Jewel", icon: "👑",
      blurb: "Own a mythic-tier grail, the archive's rarest documented tier (chase, convention, or HasLab signals). The modern chase is effectively dead, so mythic pieces are legacy hunts.",
      got: Math.min(mythicOwned, 1), need: 1,
    },
    {
      id: "decade-walker", name: "Decade Walker", icon: "🗓️",
      blurb: "Own figures from 10+ different archive years, a walk through the whole line, 2002 to now.",
      got: Math.min(yearsOwned.size, 10), need: 10,
    },
    {
      id: "wing-curator", name: "Wing Curator", icon: "🏛️",
      blurb: "Complete a full exhibition commission, any Build-A-Figure, series run, character run, or year-shelf, hung complete.",
      got: Math.min(completedCount, 1), need: 1,
    },
  ];

  return catalog.map((a) => ({
    ...a,
    // Most achievements unlock on got >= need; a few (budget-keeper) carry
    // their own unlock rule combining progress with a user-set condition.
    unlocked: "unlocked" in a ? a.unlocked : a.got >= a.need,
  }));
}

/* ------------------------------------------------------------------ */
/* Collector level, pure fun, honest math shown on the page. */

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
