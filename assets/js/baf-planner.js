/* BAF planner — mark owned figures, see missing BAF pieces + acquisition guidance.
   Ownership syncs with the timeline tracker via the shared mlc_owned_v1 store. */
import { PATHS, STORE_KEYS } from "./config.js";
import { makeIdSet } from "./store.js";
import { escapeHtml } from "./figure-dialog.js";
import { soldSearchUrl } from "./listings.js";

const owned = makeIdSet(STORE_KEYS.owned);
const listEl = document.getElementById("baf-list");
const detailEl = document.getElementById("baf-detail");

let bafs = [];
let selected = null;

/* Sold-listings URL shared from listings.js (same pattern, single source). */

/* Build BAF entries from waves — same piece-carrier mapping as the BAF skills. */
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
      if (seen.has(key)) continue; // variant rows may repeat the same carrier
      seen.add(key);
      if (!byPiece.has(f.bafPiece)) byPiece.set(f.bafPiece, []);
      byPiece.get(f.bafPiece).push({
        id, name: f.name, variant: f.variant, exclusive: f.exclusive,
        waveSeries: w.series, year: w.year,
      });
    }
    if (!byPiece.size) continue;
    out.push({
      name: w.baf, year: w.year, series: w.series,
      pieces: [...byPiece.entries()].map(([piece, carriers]) => ({ piece, carriers })),
    });
  }
  return out;
}

function pieceOwned(piece) {
  return piece.carriers.some((c) => owned.has(c.id));
}

function bafProgress(baf) {
  const total = baf.pieces.length;
  const got = baf.pieces.filter(pieceOwned).length;
  return { total, got };
}

function renderList() {
  listEl.innerHTML = "";
  for (const baf of bafs) {
    const { total, got } = bafProgress(baf);
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card baf-item";
    btn.setAttribute("aria-current", baf === selected ? "true" : "false");
    btn.innerHTML = `
      <span class="baf-name">${escapeHtml(baf.name)}</span>
      <span class="baf-sub">${escapeHtml(baf.series)} · ${baf.year}</span>
      <span class="baf-prog">${got}/${total} pieces</span>`;
    btn.addEventListener("click", () => {
      selected = baf;
      renderList();
      renderDetail();
    });
    li.appendChild(btn);
    listEl.appendChild(li);
  }
}

function carrierRow(c) {
  const isOwned = owned.has(c.id);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-sm" + (isOwned ? " btn-gold" : "");
  btn.setAttribute("aria-pressed", isOwned ? "true" : "false");
  btn.textContent = isOwned ? "Owned ✓" : "Mark owned";
  btn.addEventListener("click", () => {
    owned.toggle(c.id);
    renderList();
    renderDetail();
  });
  const wrap = document.createElement("div");
  wrap.className = "carrier";
  const tags = [
    c.variant ? `<span class="badge badge-variant">${escapeHtml(c.variant)}</span>` : "",
    c.exclusive ? `<span class="badge badge-exclusive">${escapeHtml(c.exclusive)}</span>` : "",
  ].join("");
  wrap.innerHTML = `
    <span class="c-name">${escapeHtml(c.name)}</span>${tags}
    <span class="c-wave">${escapeHtml(c.waveSeries)} · ${c.year}</span>`;
  wrap.appendChild(btn);
  return wrap;
}

function renderDetail() {
  if (!selected) return;
  const { total, got } = bafProgress(selected);
  const pct = total ? Math.round((got / total) * 100) : 0;
  detailEl.innerHTML = "";

  const head = document.createElement("div");
  head.innerHTML = `
    <h2 style="font-size:1.4rem;margin-bottom:var(--space-1);">${escapeHtml(selected.name)}</h2>
    <p style="color:var(--muted);font-size:0.9rem;margin-bottom:var(--space-4);">${escapeHtml(selected.series)} · ${selected.year}</p>
    <div class="progress-wrap">
      <div class="progress-bar" role="progressbar" aria-valuenow="${got}" aria-valuemin="0" aria-valuemax="${total}" aria-label="${escapeHtml(selected.name)} completion">
        <span style="width:${pct}%"></span>
      </div>
      <p style="font-size:0.85rem;color:var(--ink-dim);margin-top:var(--space-2);">${got} of ${total} pieces secured</p>
    </div>`;
  detailEl.appendChild(head);

  const missing = [];
  for (const { piece, carriers } of selected.pieces) {
    const done = pieceOwned({ carriers });
    const card = document.createElement("section");
    card.className = "piece" + (done ? " done" : "");
    card.setAttribute("aria-label", `${piece} piece`);
    const h = document.createElement("div");
    h.className = "piece-head";
    h.innerHTML = `<span class="piece-name">${escapeHtml(piece)}</span>
      <span class="badge ${done ? "" : "badge-flag"}" style="${done ? "color:var(--green);border-color:rgba(93,255,143,.5);" : ""}">${done ? "Secured" : "Missing"}</span>`;
    card.appendChild(h);
    for (const c of carriers) card.appendChild(carrierRow(c));
    detailEl.appendChild(card);
    if (!done) missing.push({ piece, carriers });
  }

  if (missing.length) {
    const acq = document.createElement("section");
    acq.className = "acquire";
    acq.setAttribute("aria-label", "Acquisition guidance");
    const items = missing.map(({ piece, carriers }) => {
      const c = carriers[0];
      const q = `Marvel Legends ${c.name} BAF piece ${selected.name}`;
      return `<li><strong>${escapeHtml(piece)}</strong> — cheapest path is usually <em>${escapeHtml(c.name)}</em>${c.variant ? ` (${escapeHtml(c.variant)})` : ""}. <a href="${soldSearchUrl(q)}" target="_blank" rel="noopener noreferrer">Check 90-day eBay solds ↗</a></li>`;
    }).join("");
    acq.innerHTML = `
      <h3>Acquisition plan — ${missing.length} piece${missing.length === 1 ? "" : "s"} to go</h3>
      <ul>${items}</ul>
      <p style="font-size:0.85rem;color:var(--muted);margin:var(--space-3) 0 0;">Buy the figure, keep the piece: prioritize figures you want anyway, then the cheapest piece-carriers. Verify the variant carries the piece before buying — and authenticate first.</p>`;
    detailEl.appendChild(acq);
  } else {
    const done = document.createElement("div");
    done.className = "acquire";
    done.innerHTML = `<h3>🎉 ${escapeHtml(selected.name)} complete</h3><p style="font-size:0.9rem;color:var(--ink-dim);margin:0;">Every piece secured. Time to build.</p>`;
    detailEl.appendChild(done);
  }
}

async function init() {
  try {
    const res = await fetch(PATHS.figures);
    if (!res.ok) throw new Error(`figures.json: ${res.status}`);
    const data = await res.json();
    bafs = buildBafs(data.waves).sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
    if (!bafs.length) {
      detailEl.innerHTML = `<div class="empty-state"><p>No Build-A-Figure data found.</p></div>`;
      return;
    }
    renderList();
    selected = bafs[0];
    renderList();
    renderDetail();
  } catch (err) {
    console.error(err);
    detailEl.innerHTML = `<div class="empty-state"><p>Could not load BAF data.</p></div>`;
  }
}

init();
