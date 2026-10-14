/* Shelf analytics v2, deeper insights over the existing localStorage data.
   Read-only: manufacturer split (owned + wanted), peak collecting year,
   collection growth trend (snapshot history), journal value over time, and
   shelf-vs-archive rarity per packaging era. Runs after shelf.js; if the
   dashboard is hidden (empty shelf) this module does nothing. */
import { STORE_KEYS } from "./config.js";
import { loadData } from "./data.js";
import { load, save } from "./store.js";
import { escapeHtml } from "./figure-dialog.js";
import { ERAS } from "./era-bands.js";

const els = {
  dash: document.getElementById("shelf-dash"),
  mfr: document.getElementById("shelf-mfr"),
  peak: document.getElementById("shelf-peak"),
  trend: document.getElementById("shelf-trend"),
  jval: document.getElementById("shelf-jval"),
  rarity: document.getElementById("shelf-rarity"),
};

function bar(pct, label) {
  return `<div class="progress-bar" role="img" aria-label="${escapeHtml(label ?? `${pct.toFixed(1)} percent`)}"><span style="width:${Math.min(100, Math.max(0, pct)).toFixed(1)}%"></span></div>`;
}

function money(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------- BAF piece mapping (same as shelf.js / baf-planner) ---------- */
function bafStats(waves, ownedIds) {
  let piecesTotal = 0, piecesGot = 0, bafsComplete = 0, bafCount = 0;
  for (const w of waves) {
    if (!w.baf) continue;
    const byPiece = new Map();
    for (const f of w.figures) {
      if (!f.bafPiece) continue;
      const id = `${w.id}::${f.name}`;
      if (!byPiece.has(f.bafPiece)) byPiece.set(f.bafPiece, []);
      byPiece.get(f.bafPiece).push(id);
    }
    if (!byPiece.size) continue;
    bafCount++;
    let got = 0;
    for (const carriers of byPiece.values()) {
      piecesTotal++;
      if (carriers.some((id) => ownedIds.has(id))) { got++; piecesGot++; }
    }
    if (got === byPiece.size) bafsComplete++;
  }
  return { piecesTotal, piecesGot, bafsComplete, bafCount };
}

/* ---------- growth trend: one snapshot per day, only when something changed ---------- */
function recordSnapshot(owned, wanted, bafDone) {
  const hist = load(STORE_KEYS.shelfHistory, []);
  const clean = Array.isArray(hist) ? hist.filter((h) => h && typeof h.d === "string") : [];
  const last = clean[clean.length - 1];
  if (!last || last.owned !== owned || last.wanted !== wanted || last.bafDone !== bafDone) {
    clean.push({ d: todayISO(), owned, wanted, bafDone });
    save(STORE_KEYS.shelfHistory, clean.slice(-365));
    return clean.slice(-365);
  }
  return clean;
}

function sparkline(points, w, h) {
  if (points.length < 2) return "";
  const max = Math.max(...points, 1);
  const step = w / (points.length - 1);
  const pts = points.map((p, i) => `${(i * step).toFixed(1)},${(h - (p / max) * (h - 4) - 2).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Collection growth: ${points[0]} to ${points[points.length - 1]} owned figures over ${points.length} snapshots">
    <polyline points="${pts}" fill="none" stroke="var(--gold)" stroke-width="2"/></svg>`;
}

/* ---------- main ---------- */
async function main() {
  if (!els.dash || els.dash.hidden) return;
  let data;
  try {
    data = await loadData();
  } catch {
    return;
  }
  const { waves, figures } = data;
  const ownedIds = new Set(load(STORE_KEYS.owned, []));
  const wantedIds = new Set(load(STORE_KEYS.wanted, []));
  const byId = new Map(figures.map((f) => [f.id, f]));
  const ownedFigs = [...ownedIds].map((id) => byId.get(id)).filter(Boolean);

  /* 1. Manufacturer split, owned AND wanted per manufacturer */
  const mfrs = [...new Set(figures.map((f) => f.manufacturer))];
  els.mfr.innerHTML = `<h2>By manufacturer</h2>` + mfrs.map((m) => {
    const tot = figures.filter((f) => f.manufacturer === m).length;
    const got = ownedFigs.filter((f) => f.manufacturer === m).length;
    const want = [...wantedIds].map((id) => byId.get(id)).filter((f) => f && f.manufacturer === m).length;
    return `<div class="era-row"><div class="era-head"><strong>${escapeHtml(m)}</strong>` +
      `<span>${got.toLocaleString()} owned · ${want.toLocaleString()} wanted · ${tot.toLocaleString()} in archive</span></div>` +
      bar(tot ? (got / tot) * 100 : 0, `${m}: ${got} of ${tot} owned`) + `</div>`;
  }).join("");

  /* 2. Peak collecting year */
  const byYear = {};
  for (const f of ownedFigs) byYear[f.year] = (byYear[f.year] ?? 0) + 1;
  const ranked = Object.entries(byYear).map(([y, n]) => ({ y: Number(y), n })).sort((a, b) => b.n - a.n);
  els.peak.innerHTML = `<h2>Your peak years</h2>` + (ranked.length
    ? `<p class="chart-sub" style="font-size:1rem">Your biggest year: <strong>${ranked[0].y}</strong>, ${ranked[0].n} figure${ranked[0].n === 1 ? "" : "s"}.</p>
       <ol class="char-list">${ranked.slice(0, 5).map((r) => `<li><span>${r.y}</span><span class="count">${r.n}</span></li>`).join("")}</ol>`
    : `<p class="chart-sub">Mark figures Owned and your collecting rhythm appears here.</p>`);

  /* 3. Growth trend */
  const bs = bafStats(waves, ownedIds);
  const hist = recordSnapshot(ownedFigs.length, wantedIds.size, bs.bafsComplete);
  const ownedPts = hist.map((h) => h.owned);
  els.trend.innerHTML = `<h2>Collection growth</h2>` + (hist.length >= 2
    ? `${sparkline(ownedPts, 520, 90)}
       <p class="chart-sub">${ownedPts[0]} → ${ownedPts[ownedPts.length - 1]} owned across ${hist.length} snapshots (first ${hist[0].d}, latest ${hist[hist.length - 1].d}). BAFs completed: ${bs.bafsComplete} of ${bs.bafCount}. Snapshots record automatically when your shelf changes, one per day at most.</p>`
    : `<p class="chart-sub">Not enough history yet, this page snapshots your shelf once a day whenever it changes, and the trend line grows from there. BAFs completed right now: <strong>${bs.bafsComplete}</strong> of ${bs.bafCount}.</p>`);

  /* 4. Journal value over time, from YOUR logged sold listings only */
  const entries = load(STORE_KEYS.journal, []);
  const validEntries = Array.isArray(entries) ? entries.filter((e) => e && Number.isFinite(Number(e.price)) && Number(e.price) > 0 && typeof e.date === "string") : [];
  if (!validEntries.length) {
    els.jval.innerHTML = `<h2>Journal value over time</h2><p class="chart-sub">No journal entries yet, log eBay solds in the <a href="journal.html">price journal</a> and this chart tracks what you logged, month by month. Every dollar here comes from your own entries.</p>`;
  } else {
    const byMonth = {};
    for (const e of validEntries) {
      const m = e.date.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { total: 0, n: 0 };
      byMonth[m].total += Number(e.price);
      byMonth[m].n++;
    }
    const months = Object.keys(byMonth).sort();
    const max = Math.max(...months.map((m) => byMonth[m].total), 1);
    const grand = validEntries.reduce((s, e) => s + Number(e.price), 0);
    els.jval.innerHTML = `<h2>Journal value over time</h2>
      <p class="chart-sub">${money(grand)} logged across ${validEntries.length} sold ${validEntries.length === 1 ? "listing" : "listings"}, your entries, your numbers.</p>
      <div class="month-bars">${months.map((m) => {
        const v = byMonth[m];
        return `<div class="month-bar"><div class="month-fill" style="height:${Math.max(3, (v.total / max) * 100).toFixed(1)}%" role="img" aria-label="${m}: ${money(v.total)} across ${v.n} listings"></div><span class="month-label">${m.slice(2)}</span></div>`;
      }).join("")}</div>
      <p class="chart-sub">Bar height = total sold $ you logged that month. See the <a href="journal.html">price journal</a> for the per-figure breakdown.</p>`;
  }

  /* 5. Shelf vs archive rarity per packaging era */
  els.rarity.innerHTML = `<h2>Shelf vs archive, by packaging era</h2>` + ERAS.map((era) => {
    const eraFigs = figures.filter((f) => f.year >= era.startYear && f.year <= era.endYear);
    const got = ownedFigs.filter((f) => f.year >= era.startYear && f.year <= era.endYear).length;
    const pct = eraFigs.length ? (got / eraFigs.length) * 100 : 0;
    return `<div class="era-row"><div class="era-head"><strong>${escapeHtml(era.title)} <span class="muted">${era.startYear}–${era.endYear}</span></strong>` +
      `<span>${got.toLocaleString()} / ${eraFigs.length.toLocaleString()} · ${pct.toFixed(1)}%</span></div>` +
      bar(pct, `${era.title}: own ${pct.toFixed(1)} percent of the archive`) + `</div>`;
  }).join("") + `<p class="chart-sub">Era boundaries follow the <a href="encyclopedia.html#packaging">documented packaging history</a>.</p>`;
}

main();
