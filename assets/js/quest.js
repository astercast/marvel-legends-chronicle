/* Grail Quest — turn your collection into a game.
   Reads your real browser-local state (owned, wanted, watchlist, hunt) and the
   archive data to generate quests, achievements, a collector level, and a
   shareable quest card. No invented figures, prices, or rarity: every signal
   (chase flags, retro notes, variants, exclusives, Toy Biz era, BAF pieces)
   comes from data/figures.json. Market dollars are never invented — the only
   dollars shown are the Chronicle's reported price signals (data/price-signals.json,
   labeled "reported ranges, not live prices"), the user's own watchlist
   targets, and the user's own logged purchases. The "cost" proxy stays a
   figure-type tier labeled honestly, and watchlist sightings are flagged as
   user-reported.
   The pure logic is exported for the test suite (tests/test-quest.js); the
   page wiring lives at the bottom of this file. */
import { STORE_KEYS, PATHS } from "./config.js";
import { load, save } from "./store.js";
import { loadData, figureById } from "./data.js";
import { escapeHtml, badgeFor } from "./figure-dialog.js";
import { marketplaceQuery, soldSearchUrl } from "./listings.js";
import { owned, trackerButtons } from "./tracker.js";
import { buildQuestShareText } from "./quest-share.js";
import { verdictLine, money as questMoney } from "./price-watch.js";
import {
  upcomingPreorders, countdownText, preorderCountdown, money, todayStr,
  recentlyOpened, launchPrep,
} from "./preorders.js";
import {
  CONVENTION_EXCLUSIVES, isChase, isRetro, isToyBiz, isVariant,
  isConventionExclusive, baseName, runKey, costTier, COST_TIER_LABELS,
  difficultyFor, generateQuests, recommendNext, computeAchievements,
  LEVELS, xpBreakdown, computeLevel,
  characterRuns, countCompletedBafs,
} from "./quest-core.js";
/* Re-exported so existing importers (tests) keep working. */
export {
  CONVENTION_EXCLUSIVES, isChase, isRetro, isToyBiz, isVariant,
  isConventionExclusive, baseName, runKey, costTier, COST_TIER_LABELS,
  difficultyFor, generateQuests, recommendNext, computeAchievements,
  LEVELS, xpBreakdown, computeLevel,
  characterRuns, countCompletedBafs,
};
import {
  completionByWave, completionByYear, characterCompletions, oneFigureAway,
  findDuplicateIds, shelfValueRange, growthByMonth, growthSeries,
  computeMilestones, buildCollectionReport, money as insightsMoney,
} from "./insights.js";


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
  recHunts: document.getElementById("rec-hunts"),
  recInsight: document.getElementById("rec-insight"),
  alertSub: document.getElementById("alerts-sub"),
  alertList: document.getElementById("alerts-list"),
  prepSub: document.getElementById("prep-sub"),
  prepList: document.getElementById("prep-list"),
  achCount: document.getElementById("ach-count"),
  achGrid: document.getElementById("ach-grid"),
  insWave: document.getElementById("ins-wave"),
  insYear: document.getElementById("ins-year"),
  insChar: document.getElementById("ins-char"),
  insGaps: document.getElementById("ins-gaps"),
  insDupes: document.getElementById("ins-dupes"),
  insShelf: document.getElementById("ins-shelf"),
  growthTable: document.getElementById("growth-table"),
  growthNote: document.getElementById("growth-note"),
  milestoneList: document.getElementById("milestone-list"),
  reportText: document.getElementById("report-text"),
  reportCopy: document.getElementById("report-copy"),
  reportDownload: document.getElementById("report-download"),
  reportStatus: document.getElementById("report-status"),
  shareText: document.getElementById("share-text"),
  shareCopy: document.getElementById("share-copy"),
  shareStatus: document.getElementById("share-status"),
};

/* Reported market signals — a bonus layer, never a blocker. */
let priceSignals = [];
async function loadSignals() {
  try {
    const res = await fetch(PATHS.priceSignals);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.signals)) priceSignals = data.signals;
    }
  } catch { /* offline: watchlist/budget quest features degrade gracefully */ }
}

function figureRow(fig) {  const row = document.createElement("div");
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

/* Pre-order alerts: confirmed pre-order dates opening in the next 30 days.
   Read from data/preorders.json, not from archive data — announced-but-unreleased
   items live on the pre-order layer, never in the archive waves. */
async function renderAlerts() {
  if (!els.alertList) return;
  els.alertList.innerHTML = "";
  els.alertSub.textContent = "";
  let items;
  try {
    const res = await fetch(PATHS.preorders);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    items = raw.items ?? raw ?? [];
  } catch {
    els.alertSub.textContent = "Pre-order data couldn't be loaded right now — the full tracker is at the pre-order page.";
    return;
  }
  const today = todayStr();
  const upcoming = upcomingPreorders(items, today, 30);
  /* Fresh windows: pre-orders that opened in the last 14 days — still at
     MSRP, still orderable, a hunt with a deadline. */
  const fresh = recentlyOpened(items, today, 14);
  const freshHtml = fresh.length ? `<p class="chart-sub" style="margin:var(--space-3) 0 var(--space-2)">🟢 <strong>Fresh windows</strong> (opened in the last 14 days — orderable now, MSRP): ${fresh.map((f) => `${escapeHtml(f.item.name)} (${f.daysOpen}d ago)`).join("; ")}. Our alerts' track record is on the <a href="market-briefing.html#alert-accuracy-h">market briefing</a>.</p>` : "";
  if (upcoming.length === 0) {
    els.alertSub.textContent = "No confirmed pre-order dates in the next 30 days.";
    els.alertList.innerHTML = `<p class="chart-sub" style="margin:0">Announced-but-undated items are on the <a href="preorders.html">pre-order tracker</a> — they open whenever Hasbro says so, and the dates there are reported, never invented.</p>` + freshHtml;
    return;
  }
  els.alertSub.textContent = `${upcoming.length} confirmed pre-order ${upcoming.length === 1 ? "date" : "dates"} in the next 30 days — your quest clock starts here.`;
  for (const item of upcoming) {
    const row = document.createElement("div");
    row.className = "missing-row";
    const price = money(item.price);
    const cd = preorderCountdown(item, today);
    row.innerHTML = `
      <div class="missing-info">
        <span class="missing-name">${escapeHtml(item.name)}</span>
        <span class="missing-wave">${escapeHtml(countdownText(cd))}${price ? ` · ${escapeHtml(price)} MSRP` : ""}</span>
      </div>
      <div class="missing-links"><a href="preorders.html">Pre-order tracker</a></div>`;
    els.alertList.appendChild(row);
  }
  if (freshHtml) {
    const div = document.createElement("div");
    div.innerHTML = freshHtml;
    els.alertList.appendChild(div);
  }
}

/* Launch-day prep quests (Grail Quest 5.0): for each upcoming exact-date
   pre-order/sale window within 14 days, a tickable prep checklist. Ticks
   persist per quest in mlc_launchprep_v1 — browser-local only. */
async function renderPrep() {
  if (!els.prepList) return;
  els.prepList.innerHTML = "";
  els.prepSub.textContent = "";
  let items;
  try {
    const res = await fetch(PATHS.preorders);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    items = raw.items ?? raw ?? [];
  } catch {
    els.prepSub.textContent = "Prep data couldn't be loaded right now — the full tracker is at the pre-order page.";
    return;
  }
  const today = todayStr();
  const quests = launchPrep(items, today, 14);
  if (quests.length === 0) {
    els.prepSub.textContent = "No pre-order windows in the next 14 days — nothing to prep for yet.";
    return;
  }
  const ticks = load(STORE_KEYS.launchPrep, {});
  els.prepSub.textContent = `${quests.length} launch ${quests.length === 1 ? "window" : "windows"} in the next 14 days — run the checklist and beat the sellout.`;
  for (const q of quests) {
    const done = Array.isArray(ticks[q.id]) ? ticks[q.id] : [];
    const got = q.steps.filter((_, i) => done[i]).length;
    const pct = Math.round((got / q.steps.length) * 100);
    const card = document.createElement("div");
    card.className = "missing-row";
    const when = q.days === 0 ? "today" : `in ${q.days} day${q.days === 1 ? "" : "s"}`;
    const stepsHtml = q.steps.map((s, i) => {
      const cid = `prep-${q.id}-${i}`;
      return `<label class="prep-step" for="${cid}"><input type="checkbox" id="${cid}" data-quest="${escapeHtml(q.id)}" data-step="${i}"${done[i] ? " checked" : ""}> ${escapeHtml(s)}</label>`;
    }).join("");
    card.innerHTML = `
      <div class="missing-info" style="flex:1 1 100%">
        <span class="missing-name">🎯 Be ready: ${escapeHtml(q.name)}</span>
        <span class="missing-wave">${q.kind === "sale-window" ? "On sale" : "Pre-order opens"} ${when} (${q.date})${q.msrp ? ` · ${escapeHtml(money(q.msrp))} MSRP` : ""}${got === q.steps.length ? " — <strong>Ready ✓</strong>" : ""}</span>
        <div class="progress-bar" role="progressbar" aria-valuenow="${got}" aria-valuemin="0" aria-valuemax="${q.steps.length}" aria-label="Prep progress for ${escapeHtml(q.name)}" style="margin:var(--space-2) 0">
          <span style="width:${pct}%"></span>
        </div>
        <div class="prep-steps">${stepsHtml}</div>
      </div>`;
    els.prepList.appendChild(card);
  }
  wirePrepTicks();
}

/* One persistent change listener for the prep checkboxes (survives re-renders). */
let prepWired = false;
function wirePrepTicks() {
  if (prepWired || !els.prepList) return;
  prepWired = true;
  els.prepList.addEventListener("change", (e) => {
    const box = e.target.closest("input[type=checkbox][data-quest]");
    if (!box) return;
    const id = box.dataset.quest, i = Number(box.dataset.step);
    const cur = load(STORE_KEYS.launchPrep, {});
    const arr = Array.isArray(cur[id]) ? cur[id].slice() : [];
    arr[i] = box.checked;
    cur[id] = arr;
    save(STORE_KEYS.launchPrep, cur);
    /* Re-render to update the progress bar + Ready state. */
    renderPrep().catch(() => {});
  });
}

/* ------------------------------------------------------------------ */
/* Collection insights dashboard (Grail Quest 4.0). Pure-computed from the
   archive + the user's own localStorage state; every dollar is a reported
   band or a user-logged price, never an appraisal. */

function progressRowHtml(label, sub, got, total, ariaLabel) {
  const pct = total ? Math.round((got / total) * 100) : 0;
  return `
    <div class="ins-row">
      <div class="ins-row-head">
        <span class="ins-label">${escapeHtml(label)}</span>
        <span class="ins-sub">${escapeHtml(sub)}</span>
        <span class="ins-num">${got}/${total} · ${pct}%</span>
      </div>
      <div class="progress-bar" role="progressbar" aria-valuenow="${got}" aria-valuemin="0" aria-valuemax="${total}" aria-label="${escapeHtml(ariaLabel)}">
        <span style="width:${pct}%"></span>
      </div>
    </div>`;
}

let latestReport = "";

function renderInsights(figures, waves, ownedIds, buys, completedBafs, achievements) {
  if (!els.insWave) return; /* section absent — older markup; degrade gracefully */
  const milestones = computeMilestones({ ownedCount: ownedIds.length, completedBafs, buys });
  const priceSigs = priceSignals;

  /* Completion by wave: started waves, most-complete first, top 8. */
  const waveRows = completionByWave(figures, waves, ownedIds);
  const done = waveRows.filter((w) => w.pct === 100);
  const started = waveRows.filter((w) => w.got > 0 && w.pct < 100).slice(0, 8);
  els.insWave.innerHTML = done.length || started.length
    ? `<p class="chart-sub">${done.length} wave${done.length === 1 ? "" : "s"} complete · ${started.length ? "your closest finishes:" : "no unfinished waves — everything you touch is complete."}</p>` +
      started.map((w) => progressRowHtml(w.series, String(w.year ?? ""), w.got, w.total, `${w.series} completion`)).join("")
    : `<p class="chart-sub">Mark figures owned and your wave-by-wave completion appears here.</p>`;

  /* Completion by year: compact list. */
  const yearRows = completionByYear(figures, ownedIds);
  const yearStarted = yearRows.filter((r) => r.got > 0);
  els.insYear.innerHTML = yearStarted.length
    ? yearStarted.map((r) => progressRowHtml(String(r.year), "archive year", r.got, r.total, `Completion for ${r.year}`)).join("")
    : `<p class="chart-sub">No years started yet.</p>`;

  /* Completion by character: fewest missing first, top 8. */
  const charRows = characterCompletions(figures, ownedIds).filter((c) => c.got > 0).slice(0, 8);
  els.insChar.innerHTML = charRows.length
    ? charRows.map((c) => progressRowHtml(c.name, c.missingCount === 0 ? "run complete" : `${c.missingCount} to go`, c.got, c.total, `${c.name} run completion`)).join("")
    : `<p class="chart-sub">No character runs started (5+ archive releases per character).</p>`;

  /* Gap analysis: one figure away. */
  const gaps = oneFigureAway(figures, ownedIds);
  els.insGaps.innerHTML = gaps.length
    ? `<ul class="rec-list">` + gaps.slice(0, 6).map((g) => {
        const miss = g.missing[0];
        return `<li><strong>${escapeHtml(g.name)}</strong> — ${g.got}/${g.total}; missing <strong>${escapeHtml(miss?.name ?? "unknown")}</strong> <span class="chart-sub">(${escapeHtml(miss?.waveSeries ?? "")} · ${miss?.year ?? ""})</span></li>`;
      }).join("") + `</ul>
      <p class="honesty">The most-wanted list: complete one of these runs and the Character Loyalist achievement is yours.</p>`
    : `<p class="chart-sub">No character run is exactly one figure from complete.</p>`;

  /* Duplicate detection — honest nudge, never an auto-delete. */
  const rawOwned = load(STORE_KEYS.owned, []);
  const dupes = findDuplicateIds(rawOwned);
  els.insDupes.innerHTML = dupes.length
    ? `<ul class="rec-list">` + dupes.map((d) => {
        const fig = figureById(figures, d.id);
        return `<li><strong>${escapeHtml(fig?.name ?? d.id)}</strong> <span class="chart-sub">(${escapeHtml(d.id)})</span> logged ${d.count}× — did you mean to log it twice? The tracker treats it as one figure; remove the extra entry in the <a href="checklist.html">checklist</a> if it was an accident.</li>`;
      }).join("") + `</ul>`
    : `<p class="chart-sub">Clean — no figure id logged twice.</p>`;

  /* Shelf value — reported ranges, not an appraisal. */
  const shelf = shelfValueRange(figures, ownedIds, priceSigs);
  els.insShelf.innerHTML = `
    <p class="shelf-band">${shelf.covered ? `${insightsMoney(shelf.low)}–${insightsMoney(shelf.high)}` : "—"}</p>
    <p class="chart-sub">${shelf.covered
      ? `Reported band across ${shelf.covered} of your figures with reported market data.`
      : "No reported market data for the figures you own yet."}
      ${shelf.uncovered ? `${shelf.uncovered} owned figure${shelf.uncovered === 1 ? "" : "s"} without a reported signal — excluded, never guessed.` : ""}</p>
    <p class="honesty">Reported ranges, not an appraisal — summed from the Chronicle's published price signals. Not insurance-grade; see the export below for the full record.</p>`;

  /* Growth view — monthly buckets from the Ledger's purchase dates. */
  const months = growthByMonth(buys);
  if (!months.length) {
    els.growthNote.textContent = "No dated purchases logged yet — add purchase dates in the Ledger and your growth chart fills in (\"since you started logging\").";
    els.growthTable.innerHTML = "";
  } else {
    const skipped = growthSeries(buys).skipped;
    els.growthNote.textContent = `Since you started logging: ${months.length} month${months.length === 1 ? "" : "s"} of purchases${skipped ? ` · ${skipped} purchase${skipped === 1 ? "" : "s"} without a parseable date excluded` : ""}.`;
    els.growthTable.innerHTML = `
      <table class="data-table">
        <caption class="visually-hidden">Collection growth by month</caption>
        <thead><tr><th scope="col">Month</th><th scope="col">Added</th><th scope="col">Spent</th><th scope="col">Total figures</th><th scope="col">Total spent</th></tr></thead>
        <tbody>${months.map((m) =>
          `<tr><th scope="row">${escapeHtml(m.month)}</th><td>${m.added}</td><td>${insightsMoney(m.spend)}</td><td>${m.totalCount}</td><td>${insightsMoney(m.totalSpend)}</td></tr>`).join("")}
        </tbody>
      </table>`;
  }

  /* Milestones. */
  els.milestoneList.innerHTML = milestones.map((m) => `
    <li class="milestone ${m.unlocked ? "milestone-done" : ""}">
      <span class="ach-icon" aria-hidden="true">${m.icon}</span>
      <div><strong>${escapeHtml(m.name)}</strong>
      <span class="chart-sub">${escapeHtml(m.blurb)}</span>
      <span class="milestone-state">${escapeHtml(m.detail)}</span></div>
    </li>`).join("");

  /* Export — the markdown report. */
  latestReport = buildCollectionReport({
    generatedAt: new Date().toISOString().slice(0, 10),
    figures, waves, ownedIds, signals: priceSigs, buys, achievements, milestones,
  });
  els.reportText.value = latestReport;
}

/* Export wiring: copy + download the report. Attached once at init. */
function wireReportExport() {
  if (!els.reportCopy || els.reportCopy.dataset.wired) return;
  els.reportCopy.dataset.wired = "1";
  els.reportCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(els.reportText.value);
      els.reportStatus.textContent = "Copied — paste it anywhere.";
    } catch {
      els.reportText.select();
      try { document.execCommand("copy"); els.reportStatus.textContent = "Copied — paste it anywhere."; }
      catch { els.reportStatus.textContent = "Copy didn't work — select the text manually."; }
    }
  });
  els.reportDownload.addEventListener("click", () => {
    const blob = new Blob([els.reportText.value], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `marvel-legends-collection-report-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
    els.reportStatus.textContent = "Downloaded — keep it with your insurance records.";
  });
}

function renderAll(figures, waves) {
  const ownedIds = owned.all();
  const watchlist = load(STORE_KEYS.watchlist, []);
  const buys = load(STORE_KEYS.buys, []);
  const budget = load(STORE_KEYS.budget, {});
  const achievements = computeAchievements(figures, waves, ownedIds, {
    watchlist, signals: priceSignals, buys, budget, today: new Date(),
  });
  const unlocked = achievements.filter((a) => a.unlocked);
  const quests = generateQuests(figures, waves, ownedIds);

  /* Collector level. (countCompletedBafs is the exported helper — quest.js
     once reached for quest-core's private piece check here and would have
     thrown a ReferenceError the moment the board rendered.) */
  const completedBafs = countCompletedBafs(figures, waves, ownedIds);
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
  const rec = recommendNext(figures, waves, ownedIds, watchlist, { signals: priceSignals });
  els.recBaf.innerHTML = "";
  els.recCheap.innerHTML = "";
  els.recGrail.innerHTML = "";
  els.recHunts.innerHTML = "";
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
    const { fig, tier, quest, watchNote } = rec.cheapPiece;
    els.recCheap.appendChild(recCard("Cheapest missing piece",
      fig.name,
      `<p class="quest-prog">Figure-type proxy: <strong>${escapeHtml(COST_TIER_LABELS[tier])}</strong> (tier ${tier}/4).${watchNote ? ` <span class="badge">weighted by your watchlist target</span>` : ""}</p>
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

  /* Watchlist hunts: watched figures ranked by reported market vs your target. */
  if (rec.watchHunts.length) {
    const rows = rec.watchHunts.map((h) => {
      const e = h.entry;
      const sig = h.best?.signal ?? h.signals[0] ?? null;
      const v = h.verdict;
      const band = sig ? `<span class="chart-sub">reported: ${escapeHtml(sig.display)}</span>` : `<span class="chart-sub">no reported market data</span>`;
      const line = v.status === "no-data" || v.status === "no-target"
        ? `<span class="chart-sub">${escapeHtml(verdictLine(v))}</span>`
        : `<span class="deal ${v.status === "above" ? "deal-bad" : "deal-good"} deal-inline">${escapeHtml(verdictLine(v))}</span>`;
      return `<li><strong>${escapeHtml(e.name ?? e.figId)}</strong> — target <strong>${questMoney(e.target)}</strong> · ${band} · ${line}</li>`;
    }).join("");
    els.recHunts.appendChild(recCard("Watchlist hunts",
      "Closest to your target",
      `<ul class="rec-list">${rows}</ul>
       <p class="honesty">Reported ranges, not live prices — from the Chronicle's own research. <a href="watchlist.html">Open the price watch</a>.</p>`));
  } else {
    els.recHunts.appendChild(recCard("Watchlist hunts", "No hunts open",
      `<p>Add figures with target prices to your <a href="watchlist.html">watchlist</a> and this slot ranks them by how close the reported market is to your number.</p>`));
  }

  /* Insight-driven recommendation: the nearest one-figure-away character
     run — the gap analysis feeds the quest board directly. */
  const gaps = oneFigureAway(figures, ownedIds);
  if (gaps.length) {
    const g = gaps[0];
    const miss = g.missing[0];
    els.recInsight.appendChild(recCard("Insight pick · one figure away",
      `Close the gap: ${g.name} run`,
      `<p class="quest-prog">${g.got}/${g.total} secured — one figure stands between you and a complete run.</p>
       <ul class="rec-list"><li><strong>${escapeHtml(miss.name)}</strong> <span class="chart-sub">(${escapeHtml(miss.waveSeries ?? "")} · ${miss.year ?? ""})</span></li></ul>
       <p class="honesty">From the collection insights below — computed from the archive and your tracker, no prices involved.</p>`));
  } else {
    els.recInsight.appendChild(recCard("Insight pick",
      "No one-figure-away runs",
      `<p>No character run sits exactly one figure from complete. Start one by marking figures owned in the <a href="checklist.html">checklist</a> — the gap analysis in the insights section will light up when you're close.</p>`));
  }

  /* Collection insights dashboard (Grail Quest 4.0). */
  renderInsights(figures, waves, ownedIds, buys, completedBafs, achievements);

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
    await loadSignals();
    renderAll(figures, waves);
    renderAlerts().catch(() => {});
    renderPrep().catch(() => {});
    wireReportExport();
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
