/* BAF economics, cost-to-complete per Build-A-Figure from the user's own
   journal sold-sighting entries. No market claims: every dollar traces to
   mlc_journal_v1 entries. */
import { PATHS, STORE_KEYS } from "./config.js";
import { loadData } from "./data.js";
import { load } from "./store.js";
import { escapeHtml } from "./figure-dialog.js";
import { owned } from "./tracker.js";
import { soldSearchUrl, marketplaceQuery } from "./listings.js";

const els = {
  stats: document.getElementById("econ-stats"),
  list: document.getElementById("econ-list"),
  empty: document.getElementById("econ-empty"),
  excludeOwned: document.getElementById("econ-exclude-owned"),
  completeOnly: document.getElementById("econ-complete-only"),
  sort: document.getElementById("econ-sort"),
};

function money(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function getEntries() {
  const raw = load(STORE_KEYS.journal, []);
  return Array.isArray(raw) ? raw.filter((e) => e && typeof e === "object") : [];
}

/* Same figure-matching as journal.js renderValue(). */
function entriesFor(fig, entries) {
  return entries.filter(
    (e) =>
      (e.figId === fig.id ||
        (!e.figId && typeof e.name === "string" && e.name.toLowerCase() === fig.name.toLowerCase())) &&
      Number.isFinite(Number(e.price)) &&
      Number(e.price) > 0
  );
}

function buildBafs(waves) {
  const map = new Map(); // bafName -> { name, waves: [], pieces: Map(figId -> {fig, wave}) }
  for (const wave of waves) {
    if (!wave.baf) continue;
    if (!map.has(wave.baf)) map.set(wave.baf, { name: wave.baf, waves: [], pieces: new Map() });
    const b = map.get(wave.baf);
    b.waves.push(wave);
    for (const raw of wave.figures ?? []) {
      if (!raw.bafPiece) continue;
      const fig = {
        id: `${wave.id}::${raw.name}`,
        waveId: wave.id,
        waveSeries: wave.series,
        year: wave.year,
        manufacturer: wave.manufacturer,
        ...raw,
      };
      if (!b.pieces.has(fig.id)) b.pieces.set(fig.id, { fig, piece: raw.bafPiece, wave });
    }
  }
  return [...map.values()];
}

function analyze(bafs, entries, excludeOwned) {
  return bafs.map((b) => {
    const pieces = [...b.pieces.values()].map(({ fig, piece, wave }) => {
      const matched = entriesFor(fig, entries);
      const prices = matched.map((e) => Number(e.price));
      const isOwned = owned.has(fig.id);
      return {
        fig,
        piece,
        wave,
        n: matched.length,
        med: matched.length ? median(prices) : null,
        urls: matched.map((e) => e.url).filter(Boolean).slice(0, 3),
        isOwned,
        counted: !(excludeOwned && isOwned),
      };
    });
    const countedPieces = pieces.filter((p) => p.counted);
    const priced = countedPieces.filter((p) => p.med !== null);
    const cost = priced.reduce((s, p) => s + p.med, 0);
    const years = [...new Set(b.waves.map((w) => w.year))].sort((a, b) => a - b);
    const mfrs = [...new Set(b.waves.map((w) => w.manufacturer))];
    return {
      name: b.name,
      pieces,
      total: countedPieces.length,
      pricedCount: priced.length,
      cost,
      complete: priced.length === countedPieces.length && countedPieces.length > 0,
      years,
      mfrs,
      anyData: priced.length > 0,
    };
  });
}

function renderStats(analyzed, entryCount) {
  const withData = analyzed.filter((a) => a.anyData);
  const complete = analyzed.filter((a) => a.complete);
  els.stats.innerHTML = `
    <div class="stat"><div class="stat-value">${analyzed.length}</div><div class="stat-label">Build-A-Figures</div></div>
    <div class="stat"><div class="stat-value">${withData.length}</div><div class="stat-label">With priced pieces</div></div>
    <div class="stat"><div class="stat-value">${complete.length}</div><div class="stat-label">Fully priced</div></div>
    <div class="stat"><div class="stat-value">${entryCount}</div><div class="stat-label">Journal entries</div></div>`;
}

function pieceRow(p) {
  const q = marketplaceQuery(p.fig);
  const badges = [
    p.isOwned ? `<span class="badge">owned</span>` : ``,
    p.fig.exclusive ? `<span class="badge">${escapeHtml(p.fig.exclusive)}</span>` : ``,
  ].filter(Boolean).join("");
  const priceCell = p.med !== null
    ? `<td class="num"><strong>${money(p.med)}</strong> <span class="no-data">(${p.n})</span></td>`
    : `<td class="no-data">no data, <a href="${soldSearchUrl(q)}" target="_blank" rel="noopener noreferrer">find a sold ↗</a></td>`;
  return `
    <tr>
      <td>${escapeHtml(p.piece)}<br><span class="no-data">${escapeHtml(p.fig.name)}${p.fig.variant ? `, ${escapeHtml(p.fig.variant)}` : ""}</span> ${badges}</td>
      <td class="no-data">${escapeHtml(p.wave.series)} (${p.wave.year})</td>
      ${priceCell}
    </tr>`;
}

function render(analyzed) {
  const completeOnly = els.completeOnly.checked;
  const sort = els.sort.value;
  let rows = analyzed.filter((a) => a.anyData);
  if (completeOnly) rows = rows.filter((a) => a.complete);
  const by = {
    "cost-asc": (a, b) => a.cost - b.cost || b.pricedCount - a.pricedCount,
    "cost-desc": (a, b) => b.cost - a.cost,
    coverage: (a, b) => b.pricedCount / Math.max(1, b.total) - a.pricedCount / Math.max(1, a.total) || a.cost - b.cost,
    name: (a, b) => a.name.localeCompare(b.name),
  }[sort];
  rows.sort(by);

  els.list.innerHTML = rows
    .map((a, i) => {
      const partial = a.pricedCount < a.total;
      return `
    <article class="card baf-card" aria-labelledby="baf-${i}">
      <div class="baf-head">
        <span class="baf-rank" aria-hidden="true">#${i + 1}</span>
        <h2 class="baf-name" id="baf-${i}">${escapeHtml(a.name)}</h2>
        <div class="baf-cost">
          <div class="cost">${money(a.cost)}${partial ? "*" : ""}</div>
          <div class="partial">${partial ? `*partial, ${a.total - a.pricedCount} piece${a.total - a.pricedCount === 1 ? "" : "s"} unpriced` : "fully priced"}</div>
        </div>
      </div>
      <p class="baf-meta">
        ${a.mfrs.map(escapeHtml).join(" · ")} · ${a.years.join("–")} ·
        <span class="coverage${a.complete ? " full" : ""}">${a.pricedCount}/${a.total} pieces priced</span>
      </p>
      <details class="baf-details">
        <summary>Piece breakdown (${a.pieces.length})</summary>
        <div style="overflow-x:auto">
          <table class="piece-table">
            <thead><tr><th scope="col">Piece / figure</th><th scope="col">Wave</th><th scope="col">Your median</th></tr></thead>
            <tbody>${a.pieces.map(pieceRow).join("")}</tbody>
          </table>
        </div>
      </details>
    </article>`;
    })
    .join("");
}

async function init() {
  try {
    const { waves } = await loadData();
    const entries = getEntries();
    const bafs = buildBafs(waves);
    els.empty.hidden = entries.length > 0;
    if (!entries.length) {
      els.stats.innerHTML = "";
      els.list.innerHTML = "";
      return;
    }
    const rerender = () => {
      const analyzed = analyze(bafs, entries, els.excludeOwned.checked);
      renderStats(analyzed, entries.length);
      render(analyzed);
    };
    els.excludeOwned.addEventListener("change", rerender);
    els.completeOnly.addEventListener("change", rerender);
    els.sort.addEventListener("change", rerender);
    rerender();
  } catch (err) {
    console.error(err);
    els.list.innerHTML = `<div class="empty-state card"><p>Could not load the figure database. Check your connection and reload.</p></div>`;
  }
}

init();
