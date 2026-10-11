/* Your Shelf — read-only dashboard over the existing owned/wanted tracker data.
   Storage keys are the shared ones from config.js (mlc_owned_v1 / mlc_wanted_v1);
   this page never writes tracking data, it only aggregates it. */
import { PATHS, STORE_KEYS } from "./config.js";
import { loadData } from "./data.js";
import { load } from "./store.js";
import { escapeHtml } from "./figure-dialog.js";
import { soldSearchUrl, marketplaceQuery } from "./listings.js";

const els = {
  empty: document.getElementById("shelf-empty"),
  dash: document.getElementById("shelf-dash"),
  kpis: document.getElementById("shelf-kpis"),
  era: document.getElementById("shelf-era"),
  years: document.getElementById("shelf-years"),
  chars: document.getElementById("shelf-chars"),
  bafs: document.getElementById("shelf-bafs"),
  complete: document.getElementById("shelf-complete"),
};

function bar(pct) {
  return `<div class="progress-bar" role="img" aria-label="${pct.toFixed(1)} percent complete"><span style="width:${Math.min(100, pct).toFixed(1)}%"></span></div>`;
}

function kpi(label, value, sub) {
  return `<div class="stat"><div class="stat-value">${value}</div><div class="stat-label">${label}</div>${sub ? `<div class="chart-sub" style="margin:4px 0 0">${sub}</div>` : ""}</div>`;
}

/* Same piece-carrier mapping as the BAF planner. */
function buildBafs(waves) {
  const out = [];
  for (const w of waves) {
    if (!w.baf) continue;
    const byPiece = new Map();
    const seen = new Set();
    for (const f of w.figures) {
      if (!f.bafPiece) continue;
      const id = `${w.id}::${f.name}`;
      const key = `${f.bafPiece}::${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!byPiece.has(f.bafPiece)) byPiece.set(f.bafPiece, []);
      byPiece.get(f.bafPiece).push(id);
    }
    if (!byPiece.size) continue;
    out.push({ name: w.baf, year: w.year, series: w.series, pieces: [...byPiece.values()] });
  }
  return out;
}

async function main() {
  let data;
  try {
    data = await loadData();
  } catch (err) {
    els.dash.innerHTML = `<div class="empty-state"><p>Could not load the figure archive.</p></div>`;
    return;
  }
  const { waves, figures } = data;
  const ownedIds = new Set(load(STORE_KEYS.owned, []));
  const wantedIds = new Set(load(STORE_KEYS.wanted, []));
  const byId = new Map(figures.map((f) => [f.id, f]));
  const ownedFigs = [...ownedIds].map((id) => byId.get(id)).filter(Boolean);

  if (ownedFigs.length === 0 && wantedIds.size === 0) {
    els.empty.hidden = false;
    els.dash.hidden = true;
    return;
  }

  const total = figures.length;
  const ownedPct = (ownedFigs.length / total) * 100;

  /* KPIs */
  els.kpis.innerHTML =
    kpi("Collection complete", `${ownedPct.toFixed(1)}%`, `${ownedFigs.length.toLocaleString()} of ${total.toLocaleString()} figures`) +
    kpi("Owned", ownedFigs.length.toLocaleString(), "") +
    kpi("Wanted", [...wantedIds].filter((id) => byId.has(id)).length.toLocaleString(), "") +
    kpi("Waves touched", new Set(ownedFigs.map((f) => f.waveId)).size.toLocaleString(), `of ${waves.length} waves`);

  /* Era split: Toy Biz (2002–2006) vs Hasbro (2007–2026) */
  const eraRows = [["Toy Biz", "Toy Biz"], ["Hasbro", "Hasbro"]].map(([label, mfr]) => {
    const eraFigs = figures.filter((f) => f.manufacturer === mfr);
    const got = ownedFigs.filter((f) => f.manufacturer === mfr).length;
    const pct = eraFigs.length ? (got / eraFigs.length) * 100 : 0;
    return `<div class="era-row"><div class="era-head"><strong>${label}</strong><span>${got.toLocaleString()} / ${eraFigs.length.toLocaleString()} · ${pct.toFixed(1)}%</span></div>${bar(pct)}</div>`;
  }).join("");
  els.era.innerHTML = `<h2>By era</h2>${eraRows}`;

  /* By year */
  const byYearTotal = {};
  for (const f of figures) byYearTotal[f.year] = (byYearTotal[f.year] ?? 0) + 1;
  const byYearOwned = {};
  for (const f of ownedFigs) byYearOwned[f.year] = (byYearOwned[f.year] ?? 0) + 1;
  const yearRows = Object.keys(byYearTotal).map(Number).sort((a, b) => a - b).map((y) => {
    const got = byYearOwned[y] ?? 0;
    const tot = byYearTotal[y];
    const pct = (got / tot) * 100;
    return `<div class="year-row"><span class="year-label">${y}</span>${bar(pct)}<span class="year-count">${got}/${tot}</span></div>`;
  }).join("");
  els.years.innerHTML = `<h2>By year</h2><div class="year-grid">${yearRows}</div>`;

  /* Top characters */
  const byChar = {};
  for (const f of ownedFigs) byChar[f.name] = (byChar[f.name] ?? 0) + 1;
  const topChars = Object.entries(byChar).sort((a, b) => b[1] - a[1]).slice(0, 10);
  els.chars.innerHTML = `<h2>Top characters on your shelf</h2>` +
    (topChars.length
      ? `<ol class="char-list">${topChars.map(([name, n]) => `<li><span>${escapeHtml(name)}</span><span class="count">${n}</span></li>`).join("")}</ol>`
      : `<p class="chart-sub">Nothing owned yet.</p>`);

  /* BAF completion */
  const bafs = buildBafs(waves);
  let piecesTotal = 0, piecesGot = 0, bafsComplete = 0;
  const bafRows = bafs.map((b) => {
    const total = b.pieces.length;
    const got = b.pieces.filter((carriers) => carriers.some((id) => ownedIds.has(id))).length;
    piecesTotal += total; piecesGot += got;
    if (got === total && total > 0) bafsComplete++;
    return { ...b, total, got };
  }).sort((a, b) => (b.got / b.total) - (a.got / a.total));
  const bafPct = piecesTotal ? (piecesGot / piecesTotal) * 100 : 0;
  const topBafs = bafRows.filter((b) => b.got > 0).slice(0, 8);
  els.bafs.innerHTML = `<h2>Build-A-Figure completion</h2>
    <div class="baf-summary"><strong>${bafPct.toFixed(1)}%</strong> of BAF pieces owned · <strong>${bafsComplete}</strong> of ${bafs.length} BAFs complete</div>
    ${bar(bafPct)}
    ${topBafs.length ? `<ul class="baf-mini">${topBafs.map((b) => `<li><span>${escapeHtml(b.name)} <span class="muted">${b.year}</span></span><span class="count">${b.got}/${b.total}</span></li>`).join("")}</ul>
    <p class="chart-sub">Finish them in the <a href="baf-planner.html">BAF Planner</a>.</p>` : `<p class="chart-sub">No BAF pieces owned yet — the <a href="baf-planner.html">BAF Planner</a> shows what you're missing.</p>`}`;

  /* Almost-there recommendations */
  renderComplete(figures, waves, ownedIds, byId);
}

/* ---------- "Almost there" recommendations ----------
   Read-only over the user's tracker data: BAFs missing 1–2 pieces, waves
   past 50%, characters nearly complete. Missing pieces link out to eBay
   solds via listings.js — no prices shown, just the search. */
function baseName(n) {
  return n.replace(/\s*\(.*?\)\s*/g, "").trim();
}

function missRow(fig) {
  const q = marketplaceQuery(fig);
  return `<li><span>${escapeHtml(fig.name)}${fig.variant ? ` <span class="badge badge-variant">${escapeHtml(fig.variant)}</span>` : ""}<br><span class="miss-meta">${escapeHtml(fig.waveSeries)} (${fig.year})</span></span><a class="btn btn-sm" href="${soldSearchUrl(q)}" target="_blank" rel="noopener noreferrer">eBay solds</a></li>`;
}

function renderComplete(figures, waves, ownedIds, byId) {
  const cards = [];

  /* BAFs missing 1–2 pieces (and at least one piece already owned) */
  const bafCards = [];
  for (const w of waves) {
    if (!w.baf) continue;
    const pieces = new Map(); // piece -> Set<figId>
    for (const f of w.figures) {
      if (!f.bafPiece) continue;
      const id = `${w.id}::${f.name}`;
      if (!pieces.has(f.bafPiece)) pieces.set(f.bafPiece, new Set());
      pieces.get(f.bafPiece).add(id);
    }
    if (!pieces.size) continue;
    const missing = [];
    let got = 0;
    for (const [piece, carriers] of pieces) {
      if ([...carriers].some((id) => ownedIds.has(id))) got++;
      else missing.push({ piece, rep: byId.get([...carriers][0]) });
    }
    const total = pieces.size;
    if (got > 0 && missing.length >= 1 && missing.length <= 2 && got < total) {
      bafCards.push({ w, got, total, missing });
    }
  }
  bafCards.sort((a, b) => (a.total - a.got) - (b.total - b.got) || b.got - a.got);
  for (const b of bafCards.slice(0, 6)) {
    const n = b.total - b.got;
    cards.push(`<article class="card complete-card">
      <span class="complete-kicker">Build-A-Figure · ${b.w.year}</span>
      <h3>You're ${n} ${n === 1 ? "piece" : "pieces"} from finishing <strong>${escapeHtml(b.w.baf)}</strong></h3>
      <ul class="missing-list">${b.missing.map((m) => missRow(m.rep)).join("")}</ul>
      <a class="btn btn-sm" href="baf-planner.html">Open in BAF Planner</a>
    </article>`);
  }

  /* Waves past 50% */
  const waveRows = waves.map((w) => {
    const total = w.figures.length;
    const got = w.figures.filter((f) => ownedIds.has(`${w.id}::${f.name}`)).length;
    return { w, got, total, pct: total ? got / total : 0 };
  }).filter((r) => r.pct >= 0.5 && r.pct < 1 && r.got > 0)
    .sort((a, b) => b.pct - a.pct).slice(0, 6);
  for (const r of waveRows) {
    cards.push(`<article class="card complete-card">
      <span class="complete-kicker">Wave · ${r.w.year} · ${escapeHtml(r.w.manufacturer)}</span>
      <h3><strong>${Math.round(r.pct * 100)}%</strong> of ${escapeHtml(r.w.series)}</h3>
      <p class="miss-meta" style="margin:0 0 var(--space-3)">${r.got} of ${r.total} owned — ${r.total - r.got} to go.</p>
      <a class="btn btn-sm" href="checklist.html">Checklist it</a>
    </article>`);
  }

  /* Characters nearly complete */
  const byChar = new Map();
  for (const f of figures) {
    const b = baseName(f.name);
    if (!b) continue;
    if (!byChar.has(b)) byChar.set(b, { total: 0, got: 0 });
    const e = byChar.get(b);
    e.total++;
    if (ownedIds.has(f.id)) e.got++;
  }
  const charRows = [...byChar.entries()]
    .map(([name, e]) => ({ name, ...e, pct: e.total ? e.got / e.total : 0 }))
    .filter((r) => r.got >= 1 && r.pct >= 0.5 && r.pct < 1)
    .sort((a, b) => b.pct - a.pct || b.got - a.got).slice(0, 6);
  for (const r of charRows) {
    cards.push(`<article class="card complete-card">
      <span class="complete-kicker">Character run</span>
      <h3><strong>${Math.round(r.pct * 100)}%</strong> of every ${escapeHtml(r.name)}</h3>
      <p class="miss-meta" style="margin:0 0 var(--space-3)">${r.got} of ${r.total} owned — ${r.total - r.got} to go.</p>
      <a class="btn btn-sm" href="index.html">Hunt on the timeline</a>
    </article>`);
  }

  els.complete.innerHTML = `<h2>Almost there</h2>
    ${cards.length
      ? `<p class="chart-sub">The closest finishes in your tracker — knock these out next.</p><div class="complete-grid">${cards.join("")}</div>`
      : `<p class="chart-sub">Nothing close yet. Mark more figures <strong>Owned</strong> on the timeline and your nearest completions will appear here.</p>`}`;
}

main();
