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
import { buildQuestShareText } from "./quest-share.js";
import {
  CONVENTION_EXCLUSIVES, isChase, isRetro, isToyBiz, isVariant,
  isConventionExclusive, baseName, runKey, costTier, COST_TIER_LABELS,
  difficultyFor, generateQuests, recommendNext, computeAchievements,
  LEVELS, xpBreakdown, computeLevel,
} from "./quest-core.js";
/* Re-exported so existing importers (tests) keep working. */
export {
  CONVENTION_EXCLUSIVES, isChase, isRetro, isToyBiz, isVariant,
  isConventionExclusive, baseName, runKey, costTier, COST_TIER_LABELS,
  difficultyFor, generateQuests, recommendNext, computeAchievements,
  LEVELS, xpBreakdown, computeLevel,
};


/* ------------------------------------------------------------------ */
/* Shareable quest card — plain text for forums/Discord. */

export function shareCardText(input) {
  return buildQuestShareText(input);
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
    level, ownedCount: ownedIds.length, archiveCount: figures.length,
    completedBafs, achievements, quests, latestAchievement: latest, recs: rec,
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
