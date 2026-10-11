/* Figure compare — pick 2–4 figures, side-by-side quick facts + a verdict-free
   comparison table. Differing rows are highlighted; no winner is declared.
   Selection is in-memory only (no new storage). */
import { loadData, searchFigures, figureById } from "./data.js";
import { escapeHtml } from "./figure-dialog.js";

const MAX = 4;
let figures = [];
let selected = [];

const els = {
  search: document.getElementById("cmp-search"),
  results: document.getElementById("cmp-results"),
  slots: document.getElementById("cmp-slots"),
  cards: document.getElementById("cmp-cards"),
  table: document.getElementById("cmp-table"),
  empty: document.getElementById("cmp-empty"),
  clear: document.getElementById("cmp-clear"),
};

function badges(f) {
  const out = [];
  if (f.waveBaf) out.push(`<span class="badge badge-baf">BAF: ${escapeHtml(f.waveBaf)}</span>`);
  if (f.exclusive) out.push(`<span class="badge badge-exclusive">${escapeHtml(f.exclusive)}</span>`);
  if (f.variant) out.push(`<span class="badge badge-variant">${escapeHtml(f.variant)}</span>`);
  if (f.manufacturer === "Toy Biz") out.push(`<span class="badge badge-toybiz">Toy Biz</span>`);
  return out.join(" ");
}

function attrRows(f) {
  return [
    ["Name", f.name],
    ["Wave", `${f.waveSeries} (${f.year})`],
    ["Manufacturer", f.manufacturer],
    ["BAF piece", f.bafPiece || "—"],
    ["Exclusive", f.exclusive || "—"],
    ["Variant", f.variant || "—"],
    ["Notes", f.notes || "—"],
  ];
}

function render() {
  /* Slots */
  els.slots.innerHTML = "";
  for (let i = 0; i < MAX; i++) {
    const f = selected[i];
    const slot = document.createElement("div");
    slot.className = "cmp-slot" + (f ? " filled" : "");
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
      render();
    });
  });

  const ready = selected.length >= 2;
  els.empty.hidden = ready;
  els.cards.hidden = !ready;
  els.table.hidden = !ready;
  els.clear.hidden = selected.length === 0;
  if (!ready) return;

  /* Cards */
  els.cards.innerHTML = selected.map((f) => `
    <article class="card cmp-card">
      <h3>${escapeHtml(f.name)}</h3>
      <p class="cmp-wave">${escapeHtml(f.waveSeries)} · ${f.year} · ${escapeHtml(f.manufacturer)}</p>
      <div class="cmp-badges">${badges(f)}</div>
      ${f.notes ? `<p class="cmp-notes">${escapeHtml(f.notes)}</p>` : ""}
    </article>`).join("");

  /* Table — highlight rows where values differ */
  const rows = attrRows(selected[0]).map(([label], i) => {
    const vals = selected.map((f) => attrRows(f)[i][1]);
    const differs = new Set(vals).size > 1;
    return `<tr class="${differs ? "differs" : ""}"><th scope="row">${escapeHtml(label)}</th>${vals.map((v) => `<td>${escapeHtml(v)}</td>`).join("")}</tr>`;
  }).join("");
  els.table.innerHTML = `
    <table class="cmp-table">
      <caption>Side-by-side comparison — highlighted rows differ between figures. No winner declared; the data is the verdict.</caption>
      <thead><tr><th scope="col"><span class="visually-hidden">Attribute</span></th>${selected.map((f) => `<th scope="col">${escapeHtml(f.name)}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
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
    const full = selected.length >= MAX;
    li.innerHTML = `
      <div class="res-main"><strong>${escapeHtml(f.name)}</strong>
      <span class="res-sub">${escapeHtml(f.waveSeries)} · ${f.year}${f.variant ? ` · ${escapeHtml(f.variant)}` : ""}</span></div>
      <button type="button" class="btn btn-sm" ${inSel || full ? "disabled" : ""}>${inSel ? "Added" : full ? "Full" : "Compare"}</button>`;
    if (!inSel && !full) {
      li.querySelector("button").addEventListener("click", () => {
        selected.push(f);
        render();
        renderResults(searchFigures(figures, els.search.value));
      });
    }
    els.results.appendChild(li);
  }
}

async function main() {
  try {
    ({ figures } = await loadData());
  } catch (err) {
    els.empty.innerHTML = `<p>Could not load the figure archive.</p>`;
    els.empty.hidden = false;
    return;
  }
  let deb;
  els.search.addEventListener("input", () => {
    clearTimeout(deb);
    deb = setTimeout(() => renderResults(searchFigures(figures, els.search.value)), 150);
  });
  els.clear.addEventListener("click", () => {
    selected = [];
    els.search.value = "";
    els.results.innerHTML = "";
    render();
  });
  render();
}

main();
