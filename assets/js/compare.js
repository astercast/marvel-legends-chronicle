/* Figure compare (VS mode) — pick 2–4 figures from the real archive and compare
   side by side: release info, archive notes, BAF/exclusive/variant, reported
   price bands (w25 reported signals — never invented), rarity signals (w23),
   KO-spotter notes, documented upgrade paths, and honest "which to buy"
   guidance. No winner is ever declared.

   Shareable links: compare.html?a=<id>&b=<id> (c/d for slots 3–4). Selection
   syncs to the URL via history.replaceState; invalid ids are ignored with a
   notice. Enrichment (compare.json profiles) loads lazily after first render. */
import { loadData, searchFigures, figureById } from "./data.js";
import { PATHS } from "./config.js";
import { escapeHtml } from "./figure-dialog.js";
import {
  MAX_SLOTS, parseCompareParams, buildCompareUrl,
  reviewSearchUrl, upgradeNote, guidanceFor,
} from "./compare-guide.js";

let figures = [];
let selected = [];
let profiles = null; // Map<figId, profile> from api/v1/compare.json, lazy

const els = {
  search: document.getElementById("cmp-search"),
  results: document.getElementById("cmp-results"),
  slots: document.getElementById("cmp-slots"),
  cards: document.getElementById("cmp-cards"),
  table: document.getElementById("cmp-table"),
  empty: document.getElementById("cmp-empty"),
  clear: document.getElementById("cmp-clear"),
  share: document.getElementById("cmp-share"),
  notice: document.getElementById("cmp-notice"),
  guide: document.getElementById("cmp-guide"),
  live: document.getElementById("cmp-live"),
};

function announce(msg) {
  if (els.live) els.live.textContent = msg;
}

function profFor(f) {
  return profiles?.get(f.id) ?? null;
}

function syncUrl() {
  const url = buildCompareUrl(selected.map((f) => f.id));
  history.replaceState(null, "", url);
}

function badges(f) {
  const out = [];
  if (f.waveBaf) out.push(`<span class="badge badge-baf">BAF: ${escapeHtml(f.waveBaf)}</span>`);
  if (f.exclusive) out.push(`<span class="badge badge-exclusive">${escapeHtml(f.exclusive)}</span>`);
  if (f.variant) out.push(`<span class="badge badge-variant">${escapeHtml(f.variant)}</span>`);
  if (f.manufacturer === "Toy Biz") out.push(`<span class="badge badge-toybiz">Toy Biz</span>`);
  return out.join(" ");
}

function priceCell(f) {
  const p = profFor(f);
  const sigs = p?.priceSignals ?? [];
  if (!sigs.length) return "No reported signal — check eBay solds";
  return sigs.map((s) =>
    `<div class="cmp-signal"><strong>${escapeHtml(s.display)}</strong><br>` +
    `<span class="chart-sub">${escapeHtml(s.label)} · ${escapeHtml(s.kind.replace(/-/g, " "))} · ${escapeHtml(s.source)}` +
    (s.singleSource ? ` · <span class="badge badge-flag">single source</span>` : "") +
    `</span></div>`).join("");
}

function rarityCell(f) {
  const r = profFor(f)?.rarity;
  if (!r) return "—";
  return `<a href="rarity.html#tier-${escapeHtml(r.tier)}">${escapeHtml(r.tierName)}</a>` +
    (r.questAchievement ? `<br><span class="chart-sub">Quest: ${escapeHtml(r.questAchievement)}</span>` : "");
}

function koCell(f) {
  const k = profFor(f)?.koWatch;
  if (!k) return "—";
  return `⚠️ ${escapeHtml(k.note)} <a href="auth-wizard.html">Auth Wizard →</a>`;
}

function upgradeCell(f) {
  const p = profFor(f);
  const paths = p?.upgradePaths ?? [];
  if (!paths.length) return "No other documented releases of this character in the archive.";
  return `<ul class="cmp-upgrades">${paths.map((u) =>
    `<li><a href="${buildCompareUrl([f.id, u.id])}">${escapeHtml(u.waveSeries)} (${u.year})</a>` +
    `${u.variant ? ` · <span class="badge badge-variant">${escapeHtml(u.variant)}</span>` : ""}` +
    `${u.exclusive ? ` · <span class="badge badge-exclusive">${escapeHtml(u.exclusive)}</span>` : ""}` +
    `<br><span class="chart-sub">${escapeHtml(upgradeNote(u))}</span></li>`).join("")}</ul>`;
}

function attrRows(f) {
  const p = profFor(f);
  const deepLink = p?.deepLink ?? `waves/${f.waveId}.html`;
  return [
    ["Release", `${escapeHtml(f.waveSeries)} (${f.year}) · ${escapeHtml(f.manufacturer)}`],
    ["Deep link", `<a href="${escapeHtml(deepLink)}">Open in the wave archive →</a>`],
    ["Archive notes", f.notes ? escapeHtml(f.notes) : "—"],
    ["BAF piece", f.bafPiece ? escapeHtml(f.bafPiece) : "—"],
    ["Exclusive", f.exclusive ? escapeHtml(f.exclusive) : "—"],
    ["Variant", f.variant ? escapeHtml(f.variant) : "—"],
    ["Reported price band", priceCell(f)],
    ["Rarity signal", rarityCell(f)],
    ["KO watch", koCell(f)],
    ["Articulation", `Not documented in the archive — <a href="${reviewSearchUrl(f.name, f.variant)}" target="_blank" rel="noopener noreferrer">video reviews</a> cover it`],
    ["Accessories / pack-ins", `Not documented as a separate field — pack-in notes appear in Archive notes above when the archive records them`],
    ["Upgrade path", upgradeCell(f)],
  ];
}

function render() {
  /* Slots */
  els.slots.innerHTML = "";
  for (let i = 0; i < MAX_SLOTS; i++) {
    const f = selected[i];
    const slot = document.createElement("div");
    slot.className = `cmp-slot${f ? " filled" : ""}`;
    if (f) {
      slot.innerHTML = `<span class="slot-name">${escapeHtml(f.name)}</span>
        <span class="slot-wave">${escapeHtml(f.waveSeries)} · ${f.year}</span>
        <button type="button" class="btn btn-sm btn-ghost" data-remove="${escapeHtml(f.id)}" aria-label="Remove ${escapeHtml(f.name)} from comparison">✕</button>`;
    } else {
      slot.innerHTML = `<span class="slot-empty">Slot ${i + 1} — search below</span>`;
    }
    els.slots.appendChild(slot);
  }
  els.slots.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selected = selected.filter((f) => f.id !== btn.dataset.remove);
      syncUrl();
      render();
      announce("Figure removed from comparison.");
      els.search.focus();
    });
  });

  const ready = selected.length >= 2;
  els.empty.hidden = ready;
  els.cards.hidden = !ready;
  els.table.hidden = !ready;
  els.guide.hidden = !ready;
  els.clear.hidden = selected.length === 0;
  els.share.hidden = !ready;
  if (!ready) return;

  /* Cards */
  els.cards.innerHTML = selected.map((f) => {
    const p = profFor(f);
    const deepLink = p?.deepLink ?? `waves/${f.waveId}.html`;
    return `
    <article class="card cmp-card">
      <h3>${escapeHtml(f.name)}</h3>
      <p class="cmp-wave">${escapeHtml(f.waveSeries)} · ${f.year} · ${escapeHtml(f.manufacturer)}</p>
      <div class="cmp-badges">${badges(f)}</div>
      ${f.notes ? `<p class="cmp-notes">${escapeHtml(f.notes)}</p>` : ""}
      <p class="cmp-links"><a href="${escapeHtml(deepLink)}">Deep link →</a> ·
        <a href="waves/${escapeHtml(f.waveId)}.html">Wave page →</a></p>
    </article>`;
  }).join("");

  /* Table — highlight rows where values differ */
  const firstRows = attrRows(selected[0]);
  const rows = firstRows.map(([label], i) => {
    const vals = selected.map((f) => attrRows(f)[i][1]);
    const differs = new Set(vals).size > 1;
    return `<tr class="${differs ? "differs" : ""}"><th scope="row">${escapeHtml(label)}</th>${vals.map((v) => `<td>${v}</td>`).join("")}</tr>`;
  }).join("");
  els.table.innerHTML = `
    <table class="cmp-table">
      <caption>Side-by-side comparison — highlighted rows differ between figures. No winner declared; the data is the verdict.</caption>
      <thead><tr><th scope="col"><span class="visually-hidden">Attribute</span></th>${selected.map((f) => `<th scope="col">${escapeHtml(f.name)}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  /* Guidance — honest, data-grounded, never a winner */
  const guide = guidanceFor(selected, profiles ?? new Map());
  els.guide.innerHTML = `
    <h2>Reading the data</h2>
    <p class="chart-sub">Which to buy, grounded in what's actually documented — no hype, no winner.</p>
    <ul class="cmp-guide-list">${guide.map((g) => `<li class="cmp-guide-${g.kind}">${g.html}</li>`).join("")}</ul>`;
}

function renderResults(list) {
  els.results.innerHTML = "";
  if (!list.length) {
    els.results.innerHTML = `<li class="chart-sub">No matches — try a character, wave, or BAF name.</li>`;
    return;
  }
  for (const f of list.slice(0, 12)) {
    const li = document.createElement("li");
    const inSel = selected.some((s) => s.id === f.id);
    const full = selected.length >= MAX_SLOTS;
    li.innerHTML = `
      <div class="res-main"><strong>${escapeHtml(f.name)}</strong>
      <span class="res-sub">${escapeHtml(f.waveSeries)} · ${f.year}${f.variant ? ` · ${escapeHtml(f.variant)}` : ""}</span></div>
      <button type="button" class="btn btn-sm" ${inSel || full ? "disabled" : ""}>${inSel ? "Added" : full ? "Full" : "Compare"}</button>`;
    if (!inSel && !full) {
      li.querySelector("button").addEventListener("click", () => {
        selected.push(f);
        syncUrl();
        render();
        announce(`${f.name} added to comparison.`);
        renderResults(searchFigures(figures, els.search.value));
      });
    }
    els.results.appendChild(li);
  }
}

async function loadProfiles() {
  try {
    const res = await fetch(PATHS.compare);
    if (!res.ok) throw new Error(`compare.json: ${res.status}`);
    const data = await res.json();
    // First-wins: the archive's figureById also resolves duplicate ids
    // (<waveId>::<name> shared by 2 figures in a wave) to the first figure.
    profiles = new Map();
    for (const p of data.profiles ?? []) {
      if (!profiles.has(p.id)) profiles.set(p.id, p);
    }
    if (selected.length >= 2) render(); // enrich rows once profiles land
  } catch {
    /* enrichment is progressive — the archive fields render without it */
  }
}

async function copyLink() {
  const url = new URL(buildCompareUrl(selected.map((f) => f.id)), location.href).href;
  try {
    await navigator.clipboard.writeText(url);
    announce("Compare link copied to clipboard.");
  } catch {
    prompt("Copy this compare link:", url);
  }
}

async function main() {
  try {
    ({ figures } = await loadData());
  } catch (e) {
    els.empty.innerHTML = `<p>Could not load the figure archive (${escapeHtml(e.message)}).</p>`;
    return;
  }

  /* Deep links: ?a=<id>&b=<id> (c/d for slots 3–4). Unknown ids are ignored. */
  const ids = parseCompareParams(location.search);
  const unknown = [];
  for (const id of ids) {
    const f = figureById(figures, id);
    if (f && !selected.some((s) => s.id === f.id) && selected.length < MAX_SLOTS) {
      selected.push(f);
    } else if (!f) {
      unknown.push(id);
    }
  }
  if (unknown.length) {
    els.notice.hidden = false;
    els.notice.innerHTML = `<p>Ignored ${unknown.length === 1 ? "an unknown figure id" : `${unknown.length} unknown figure ids`} from the link — the archive has no such figure.</p>`;
  }
  render();
  if (selected.length) announce(`${selected.length} figures loaded from the compare link.`);

  let t = null;
  els.search.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const list = searchFigures(figures, els.search.value);
      renderResults(list);
      announce(list.length ? `${Math.min(list.length, 12)} matching figures.` : "No matching figures.");
    }, 150);
  });
  els.search.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.activeElement === els.search) {
      els.search.value = "";
      renderResults([]);
      els.search.blur();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "")) {
      e.preventDefault();
      els.search.focus();
    }
  });
  els.clear.addEventListener("click", () => {
    selected = [];
    syncUrl();
    render();
    announce("Comparison cleared.");
  });
  els.share.addEventListener("click", copyLink);

  loadProfiles(); // lazy enrichment — archive fields render immediately
}

main();
