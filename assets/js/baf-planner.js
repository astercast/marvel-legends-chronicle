/* BAF planner, mark owned figures, see missing BAF pieces + acquisition guidance.
   Ownership syncs with the timeline tracker via the shared mlc_owned_v1 store. */
import { PATHS, STORE_KEYS } from "./config.js";
import { makeIdSet, load } from "./store.js";
import { escapeHtml } from "./figure-dialog.js";
import { soldSearchUrl } from "./listings.js";

const owned = makeIdSet(STORE_KEYS.owned);
const listEl = document.getElementById("baf-list");
const detailEl = document.getElementById("baf-detail");
const closestEl = document.getElementById("baf-closest");

let bafs = [];
let selected = null;

/* Sold-listings URL shared from listings.js (same pattern, single source). */

/* Build BAF entries from waves, same piece-carrier mapping as the BAF skills.
   Exported for tests (tests/test-baf.js). */
export function buildBafs(waves) {
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

export function pieceOwned(piece) {
  const u = ownedUnion();
  return piece.carriers.some((c) => u.has(c.id));
}

export function bafProgress(baf) {
  const total = baf.pieces.length;
  const got = baf.pieces.filter(pieceOwned).length;
  return { total, got };
}

/* ------------------------------------------------------------------ */
/* Wave 19, Grail Quest 2.0: purchase-backed ownership, journal-priced
   cheapest-path math, and "closest BAF to complete" rankings.
   - Ownership: tracker marks (mlc_owned_v1) + logged purchases
     (mlc_buys_v1, the ledger). The price journal (mlc_journal_v1) is a
     SOLD-price log, sold figures are NOT owned, so it never feeds
     ownership; it feeds the cheapest-path prices.
   - Every price-flavored number below is the user's OWN journal sold price
     (user-logged, never an index); figure-type tiers are an
     honestly-labeled proxy. */

/* Owned figure ids = tracker marks + ledger purchases (a logged purchase
   means the figure is on the shelf). Exported for tests. */
export function ownedUnion() {
  const u = new Set(owned.all());
  const buys = load(STORE_KEYS.buys, []);
  for (const e of Array.isArray(buys) ? buys : []) {
    if (typeof e.figId === "string" && e.figId) u.add(e.figId);
  }
  return u;
}

/* Median user-logged SOLD price per figure id, from the price journal.
   A sold price is a real transaction the user recorded, the cheapest
   honest "what does this carrier go for" signal on hand. Exported for tests. */
export function journalPriceMap() {
  const entries = load(STORE_KEYS.journal, []);
  const by = new Map();
  for (const e of Array.isArray(entries) ? entries : []) {
    const p = Number(e.price);
    if (typeof e.figId !== "string" || !e.figId) continue;
    if (!Number.isFinite(p) || p <= 0) continue;
    if (!by.has(e.figId)) by.set(e.figId, []);
    by.get(e.figId).push(p);
  }
  const out = new Map();
  for (const [id, ps] of by) {
    ps.sort((a, b) => a - b);
    out.set(id, ps[Math.floor(ps.length / 2)]);
  }
  return out;
}

/* Figure-type cost tier for ranking piece carriers, mirrors costTier() in
   quest-core.js, kept local so this module stays import-light. */
export function carrierTier(c) {
  const ex = c.exclusive ?? "";
  const series = c.waveSeries ?? "";
  if (ex === "HasLab" || ex === "Made-to-order") return 4;
  if (ex === "Box set exclusive" || /^(box set|2-packs?|3-packs?)\b/i.test(series) || /\bdeluxe\b/i.test(series)) return 2;
  if (ex) return 3;
  return 1;
}

/* cheapestPath(baf, priceMap), for each missing piece, the cheapest carrier:
   journal-logged SOLD prices first (real transactions the user recorded),
   figure-type tier as the tiebreak/proxy.
   Returns { legs: [{ piece, carrier, journalPrice|null, tier }],
   totalKnown (sum of journal-priced legs), unknownCount }.
   totalKnown is the user's own sold prices, an estimate, never a quote. */
export function cheapestPath(baf, priceMap) {
  const u = ownedUnion();
  const legs = [];
  for (const { piece, carriers } of baf.pieces) {
    if (carriers.some((c) => u.has(c.id))) continue;
    const ranked = [...carriers].sort((a, b) => {
      const pa = priceMap.get(a.id);
      const pb = priceMap.get(b.id);
      const aKnown = pa != null, bKnown = pb != null;
      if (aKnown && !bKnown) return -1;
      if (bKnown && !aKnown) return 1;
      if (aKnown && bKnown && pa !== pb) return pa - pb;
      return carrierTier(a) - carrierTier(b);
    });
    const best = ranked[0];
    legs.push({
      piece,
      carrier: best,
      journalPrice: priceMap.get(best.id) ?? null,
      tier: carrierTier(best),
    });
  }
  const known = legs.filter((l) => l.journalPrice != null);
  return {
    legs,
    totalKnown: known.reduce((s, l) => s + l.journalPrice, 0),
    unknownCount: legs.length - known.length,
  };
}

/* closestBafs(bafs, ownedIds), started-but-incomplete BAFs, fewest missing
   pieces first: the "closest BAF to complete" quest recommendations.
   Exported for tests. */
export function closestBafs(bafs, ownedIds) {
  const u = new Set(ownedIds);
  return bafs
    .map((baf) => {
      const missing = baf.pieces.filter(
        (p) => !p.carriers.some((c) => u.has(c.id))
      ).length;
      return { baf, total: baf.pieces.length, got: baf.pieces.length - missing, missing };
    })
    .filter((r) => r.missing > 0 && r.got > 0)
    .sort((a, b) => a.missing - b.missing || b.got - a.got || a.baf.name.localeCompare(b.baf.name));
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
  renderClosest();
}

/* "Closest to complete", started BAFs ranked by fewest missing pieces.
   Rendered above the full list; owned marks plus logged purchases count. */
function renderClosest() {
  if (!closestEl) return;
  const rows = closestBafs(bafs, [...ownedUnion()]).slice(0, 5);
  closestEl.innerHTML = "";
  if (!rows.length) {
    closestEl.innerHTML = `<div class="empty-state"><p>Mark BAF-wave figures owned (or log purchases in the ledger) and your nearest finishes will appear here.</p></div>`;
    return;
  }
  const frag = document.createDocumentFragment();
  for (const r of rows) {
    const card = document.createElement("article");
    card.className = "card";
    card.style.padding = "var(--space-4)";
    card.innerHTML = `
      <div class="entry-head">
        <span class="entry-name">${escapeHtml(r.baf.name)}</span>
        <span class="entry-wave">${escapeHtml(r.baf.series)} · ${r.baf.year}</span>
      </div>
      <p class="gift-why">${r.got}/${r.total} pieces, <strong>${r.missing} to go</strong>.</p>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-sm";
    btn.textContent = "Open in planner";
    btn.addEventListener("click", () => {
      selected = r.baf;
      renderList();
      renderDetail();
      detailEl.scrollIntoView({ block: "start" });
    });
    card.appendChild(btn);
    frag.appendChild(card);
  }
  closestEl.appendChild(frag);
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
    /* Cheapest-path math: journal-logged prices first, figure-type tier as
       the proxy tiebreak. "Known" dollars are the user's own journal, an
       estimate, never a market quote. */
    const plan = cheapestPath(selected, journalPriceMap());
    const items = plan.legs.map(({ piece, carrier, journalPrice }) => {
      const c = carrier;
      const q = `Marvel Legends ${c.name} BAF piece ${selected.name}`;
      const path = journalPrice != null
        ? `cheapest journal-logged path: <em>${escapeHtml(c.name)}</em>, your journal logs a sale at <strong>$${journalPrice.toFixed(2)}</strong>`
        : `cheapest path: <em>${escapeHtml(c.name)}</em>${c.variant ? ` (${escapeHtml(c.variant)})` : ""}, no journal price, verify with solds`;
      return `<li><strong>${escapeHtml(piece)}</strong>, ${path}. <a href="${soldSearchUrl(q)}" target="_blank" rel="noopener noreferrer">Check 90-day eBay solds ↗</a></li>`;
    }).join("");
    const knownNote = plan.totalKnown > 0
      ? `<p style="font-size:0.9rem;margin:var(--space-3) 0 0;"><strong>Known-path estimate: $${plan.totalKnown.toFixed(2)}</strong> across ${plan.legs.length - plan.unknownCount} of ${plan.legs.length} pieces, from your journal's sold prices, not market data.${plan.unknownCount ? ` ${plan.unknownCount} piece${plan.unknownCount === 1 ? "" : "s"} need${plan.unknownCount === 1 ? "s" : ""} research.` : ""}</p>`
      : `<p style="font-size:0.9rem;margin:var(--space-3) 0 0;">No journal sales logged for these pieces yet, log sales in the <a href="journal.html">journal</a> and this plan prices itself from your own transactions.</p>`;
    acq.innerHTML = `
      <h3>Acquisition plan, ${missing.length} piece${missing.length === 1 ? "" : "s"} to go</h3>
      <ul>${items}</ul>
      ${knownNote}
      <p style="font-size:0.85rem;color:var(--muted);margin:var(--space-3) 0 0;">Buy the figure, keep the piece: prioritize figures you want anyway, then the cheapest piece-carriers. Verify the variant carries the piece before buying, and authenticate first.</p>`;
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

/* Only auto-run on the BAF Planner page itself, other pages (quest-core)
   import this module for buildBafs only. */
if (listEl && detailEl) init();
