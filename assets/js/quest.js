/* Grail Quest — turn your collection into a game.
   Reads your real browser-local state (owned, wanted, watchlist, hunt) and the
   archive data to generate quests, achievements, a collector level, and a
   shareable quest card. No invented figures, prices, or rarity: every signal
   (chase flags, retro notes, variants, exclusives, Toy Biz era, BAF pieces)
   comes from data/figures.json. Prices are never shown — the "cost" proxy is a
   figure-type tier labeled honestly, and watchlist sightings are flagged as
   user-reported.
   The pure logic is exported for the test suite (tests/test-quest.js); the
   page wiring lives at the bottom of this file. */
import { STORE_KEYS } from "./config.js";
import { load } from "./store.js";
import { loadData, figureById } from "./data.js";
import { buildBafs } from "./baf-planner.js";
import { escapeHtml, badgeFor } from "./figure-dialog.js";
import { marketplaceQuery, soldSearchUrl } from "./listings.js";
import { owned, trackerButtons } from "./tracker.js";

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

/* ------------------------------------------------------------------ */
/* Shareable quest card — plain text for forums/Discord. */

export function shareCardText({ level, ownedCount, completedBafs, achievements, quests, latestAchievement }) {
  const lines = [
    `🏆 My Marvel Legends Grail Quest — ${level.title} (Level ${level.level + 1}, ${level.xp} XP)`,
    `⭐ ${ownedCount} figures owned · ${completedBafs} BAF${completedBafs === 1 ? "" : "s"} completed · ${achievements.filter((a) => a.unlocked).length}/${achievements.length} achievements`,
  ];
  const top = quests.slice(0, 3);
  if (top.length) {
    lines.push("🎯 Active quests:");
    for (const q of top) lines.push(`• ${q.title} (${q.got}/${q.total})`);
  }
  if (latestAchievement) lines.push(`🎖️ Latest achievement: ${latestAchievement.icon} ${latestAchievement.name}`);
  lines.push("Tracked with the Marvel Legends Chronicle — Grail Quest.");
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Page wiring. */

const els = {
  main: document.getElementById("quest-main"),
  empty: document.getElementById("quest-empty"),
  board: document.getElementById("quest-board"),
  levelTitle: document.getElementById("level-title"),
  levelXp: document.getElementById("level-xp"),
  levelMath: document.getElementById("level-math"),
  levelBar: document.getElementById("level-bar"),
  questCount: document.getElementById("quest-count"),
  questList: document.getElementById("quest-list"),
  recBaf: document.getElementById("rec-baf"),
  recCheap: document.getElementById("rec-cheap"),
  recGrail: document.getElementById("rec-grail"),
  achCount: document.getElementById("ach-count"),
  achGrid: document.getElementById("ach-grid"),
  shareText: document.getElementById("share-text"),
  shareCopy: document.getElementById("share-copy"),
  shareStatus: document.getElementById("share-status"),
};

function figureRow(fig) {
  const row = document.createElement("div");
  row.className = "missing-row";
  row.innerHTML = `
    <div class="missing-info">
      <span class="missing-name">${escapeHtml(fig.name)}</span>
      <span class="missing-wave">${escapeHtml(fig.waveSeries ?? "")} · ${fig.year ?? ""}</span>
      <span class="tag-row">${badgeFor(fig)}</span>
    </div>`;
  const links = document.createElement("div");
  links.className = "missing-links";
  const waveLink = document.createElement("a");
  waveLink.href = `waves/${fig.waveId}.html`;
  waveLink.textContent = "Wave page";
  const soldLink = document.createElement("a");
  soldLink.href = soldSearchUrl(marketplaceQuery(fig));
  soldLink.target = "_blank";
  soldLink.rel = "noopener";
  soldLink.textContent = "eBay solds";
  links.append(waveLink, soldLink);
  row.appendChild(links);
  row.appendChild(trackerButtons(fig.id));
  return row;
}

function questCard(q) {
  const card = document.createElement("article");
  card.className = "card quest-card";
  const pct = q.total ? Math.round((q.got / q.total) * 100) : 0;
  const details = document.createElement("details");
  details.className = "quest-missing";
  const summary = document.createElement("summary");
  summary.textContent = `Missing pieces (${q.missingCount})`;
  details.appendChild(summary);
  const list = document.createElement("div");
  list.className = "missing-list";
  for (const f of q.missing.slice(0, 12)) list.appendChild(figureRow(f));
  if (q.missing.length > 12) {
    const more = document.createElement("p");
    more.className = "chart-sub";
    more.textContent = `+ ${q.missing.length - 12} more missing — see the wave pages for the full list.`;
    list.appendChild(more);
  }
  details.appendChild(list);
  card.innerHTML = `
    <div class="quest-top">
      <span class="badge badge-difficulty">${escapeHtml(q.difficulty)}</span>
      <span class="badge">${escapeHtml(q.kind === "baf" ? "Build-A-Figure" : q.kind === "character" ? "Character run" : "Series run")}</span>
    </div>
    <h3>${escapeHtml(q.title)}</h3>
    <p class="chart-sub">${escapeHtml(q.sub)}</p>
    <div class="progress-wrap">
      <div class="progress-bar" role="progressbar" aria-valuenow="${q.got}" aria-valuemin="0" aria-valuemax="${q.total}" aria-label="${escapeHtml(q.title)} progress">
        <span style="width:${pct}%"></span>
      </div>
      <p class="quest-prog">${q.got} of ${q.total} secured · ${pct}%</p>
    </div>`;
  card.appendChild(details);
  return card;
}

function recCard(kind, title, bodyHtml) {
  const card = document.createElement("article");
  card.className = "card rec-card";
  card.innerHTML = `
    <span class="badge">${escapeHtml(kind)}</span>
    <h3>${escapeHtml(title)}</h3>
    <div class="rec-body"></div>`;
  card.querySelector(".rec-body").innerHTML = bodyHtml;
  return card;
}

function achievementCard(a) {
  const card = document.createElement("article");
  card.className = "card ach-card" + (a.unlocked ? " ach-unlocked" : " ach-locked");
  const pct = a.need ? Math.min(100, Math.round((a.got / a.need) * 100)) : 100;
  card.innerHTML = `
    <span class="ach-icon" aria-hidden="true">${a.icon}</span>
    <h3>${escapeHtml(a.name)}</h3>
    <p class="chart-sub">${escapeHtml(a.blurb)}</p>
    <div class="progress-wrap">
      <div class="progress-bar" role="progressbar" aria-valuenow="${Math.min(a.got, a.need)}" aria-valuemin="0" aria-valuemax="${a.need}" aria-label="${escapeHtml(a.name)} achievement progress">
        <span style="width:${pct}%"></span>
      </div>
      <p class="quest-prog">${a.unlocked ? "Unlocked ✓" : `${a.got} of ${a.need}`}</p>
    </div>`;
  return card;
}

function renderAll(figures, waves) {
  const ownedIds = owned.all();
  const watchlist = load(STORE_KEYS.watchlist, []);
  const achievements = computeAchievements(figures, waves, ownedIds);
  const unlocked = achievements.filter((a) => a.unlocked);
  const quests = generateQuests(figures, waves, ownedIds);

  /* Collector level. */
  const bafs = buildBafs(waves);
  const ownedSet = new Set(ownedIds);
  const completedBafs = bafs.filter((b) =>
    b.pieces.every((p) => pieceGot(p, ownedSet))
  ).length;
  const level = computeLevel(ownedIds.length, completedBafs, unlocked.length);
  const bd = xpBreakdown(ownedIds.length, completedBafs, unlocked.length);

  els.levelTitle.textContent = `${level.title} · Level ${level.level + 1}`;
  els.levelXp.textContent = `${level.xp} XP`;
  els.levelMath.textContent =
    `= ${bd.fromOwned} owned ×1 + ${completedBafs} BAF${completedBafs === 1 ? "" : "s"} ×25 + ${unlocked.length} achievement${unlocked.length === 1 ? "" : "s"} ×10`;
  const barPct = level.nextXp ? Math.round((level.xpIntoLevel / level.xpForNext) * 100) : 100;
  els.levelBar.innerHTML = `
    <div class="progress-bar" role="progressbar" aria-valuenow="${level.xpIntoLevel}" aria-valuemin="0" aria-valuemax="${level.xpForNext}" aria-label="Progress to next collector level">
      <span style="width:${barPct}%"></span>
    </div>
    <p class="quest-prog">${level.nextTitle ? `${level.nextXp - level.xp} XP to ${level.nextTitle}` : "Max level — Living Legend. Absolute unit."}</p>`;

  /* Active quests. */
  els.questCount.textContent = `${quests.length} active quest${quests.length === 1 ? "" : "s"}`;
  els.questList.innerHTML = "";
  if (!quests.length) {
    els.questList.innerHTML = `<div class="empty-state"><p>No active quests — everything you own is either complete or hasn't been started. Mark more figures owned in the <a href="checklist.html">checklist</a> to open new quests.</p></div>`;
  } else {
    for (const q of quests) els.questList.appendChild(questCard(q));
  }

  /* Next-quest recommendations. */
  const rec = recommendNext(figures, waves, ownedIds, watchlist);
  els.recBaf.innerHTML = "";
  els.recCheap.innerHTML = "";
  els.recGrail.innerHTML = "";
  if (rec.baf) {
    els.recBaf.appendChild(recCard("Closest BAF",
      rec.baf.title,
      `<p class="quest-prog">${rec.baf.got}/${rec.baf.total} pieces — just ${rec.baf.missingCount} to go.</p>
       <ul class="rec-list">${rec.baf.missing.slice(0, 4).map((f) =>
         `<li>${escapeHtml(f.name)} <span class="chart-sub">(${escapeHtml(f.waveSeries)} · ${f.year})</span></li>`).join("")}</ul>`));
  } else {
    els.recBaf.appendChild(recCard("Closest BAF", "No BAF started",
      `<p>Mark BAF-wave figures owned in the <a href="baf-planner.html">BAF planner</a> and this slot will point at your nearest finish.</p>`));
  }
  if (rec.cheapPiece) {
    const { fig, tier, quest } = rec.cheapPiece;
    els.recCheap.appendChild(recCard("Cheapest missing piece",
      fig.name,
      `<p class="quest-prog">Figure-type proxy: <strong>${escapeHtml(COST_TIER_LABELS[tier])}</strong> (tier ${tier}/4).</p>
       <p class="chart-sub">Fills: ${escapeHtml(quest.title)} (${quest.got}/${quest.total})</p>
       <p class="honesty">A rough guess from the figure type, not a price. Verify with <a href="${escapeHtml(soldSearchUrl(marketplaceQuery(fig)))}" target="_blank" rel="noopener">eBay solds</a>.</p>`));
  } else {
    els.recCheap.appendChild(recCard("Cheapest missing piece", "No open runs",
      `<p>Start a character or series run by marking figures owned, and this slot will surface the cheapest gap to close.</p>`));
  }
  if (rec.grail) {
    const e = rec.grail.entry;
    const fig = figureById(figures, e.figId);
    const priceLine = rec.grail.price !== null
      ? `Best reported sighting: <strong>$${rec.grail.price}</strong>`
      : (e.target ? `Your target: <strong>$${escapeHtml(String(e.target))}</strong>` : "No sightings logged yet");
    els.recGrail.appendChild(recCard("Watchlist grail",
      escapeHtml(e.name ?? fig?.name ?? "Watchlist item"),
      `<p class="quest-prog">${priceLine}</p>
       <p class="honesty">Reported sighting — user-logged, not verified market data. <a href="watchlist.html">Open the watchlist</a>.</p>`));
  } else {
    els.recGrail.appendChild(recCard("Watchlist grail", "Watchlist empty",
      `<p>Add figures to your <a href="watchlist.html">grail watchlist</a> with target prices and sightings, and this slot will point at your nearest grail.</p>`));
  }

  /* Achievements. */
  els.achCount.textContent = `${unlocked.length} of ${achievements.length} unlocked`;
  els.achGrid.innerHTML = "";
  for (const a of achievements) els.achGrid.appendChild(achievementCard(a));

  /* Share card. */
  const latest = [...unlocked].pop() ?? null;
  els.shareText.value = shareCardText({
    level, ownedCount: ownedIds.length, completedBafs,
    achievements, quests, latestAchievement: latest,
  });
}

async function init() {
  if (owned.count() === 0) {
    els.empty.hidden = false;
    els.board.hidden = true;
    return;
  }
  els.empty.hidden = true;
  els.board.hidden = false;
  try {
    const { figures, waves } = await loadData();
    renderAll(figures, waves);
    /* Re-render when tracker toggles fire (owned set changed). */
    els.main.addEventListener("click", (e) => {
      if (e.target.closest(".tracker-btns")) {
        setTimeout(() => {
          loadData().then(({ figures: f, waves: w }) => renderAll(f, w)).catch(() => {});
        }, 60);
      }
    });
  } catch (err) {
    els.questList.innerHTML = `<div class="empty-state"><p>Couldn't load the figure archive (${escapeHtml(err.message)}). Check your connection and reload.</p></div>`;
  }
}

if (els.shareCopy) {
  els.shareCopy.addEventListener("click", async () => {
    const text = els.shareText.value;
    try {
      await navigator.clipboard.writeText(text);
      els.shareStatus.textContent = "Copied — paste it anywhere.";
    } catch {
      els.shareText.select();
      try {
        document.execCommand("copy");
        els.shareStatus.textContent = "Copied — paste it anywhere.";
      } catch {
        els.shareStatus.textContent = "Copy didn't work — select the text manually.";
      }
    }
  });
}

init();
