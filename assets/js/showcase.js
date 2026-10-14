/* Shelfie Showcase, curate a top 10 from owned figures.
   - Add owned figures (datalist, max 10).
   - Reorder by drag-and-drop OR the Up/Down buttons (keyboard-accessible;
     drag is a progressive enhancement, never the only path).
   - One "why it made the cut" line per slot, persisted with the order in
     mlc_showcase_v1 = { order: [figId], notes: { figId: text } }.
   - Print stylesheet renders a clean ranked list. */
import { PATHS, STORE_KEYS } from "./config.js";
import { loadData, figureById } from "./data.js";
import { load, save } from "./store.js";
import { escapeHtml, badgeFor } from "./figure-dialog.js";
import { owned } from "./tracker.js";
import { buildBafs } from "./baf-planner.js";
import {
  generateQuests, recommendNext, computeAchievements, computeLevel,
} from "./quest-core.js";
import { buildQuestShareText } from "./quest-share.js";

const MAX_SLOTS = 10;

const els = {
  list: document.getElementById("showcase-list"),
  search: document.getElementById("show-search"),
  datalist: document.getElementById("show-owned-list"),
  btnAdd: document.getElementById("btn-add"),
  btnPrint: document.getElementById("btn-print"),
  btnClear: document.getElementById("btn-clear"),
  count: document.getElementById("show-count"),
  pickerNote: document.getElementById("picker-note"),
  pickerEmpty: document.getElementById("picker-empty"),
  shareText: document.getElementById("quest-share-text"),
  shareCopy: document.getElementById("quest-share-copy"),
  shareStatus: document.getElementById("quest-share-status"),
};

let figures = [];
let state = load(STORE_KEYS.showcase, { order: [], notes: {} });
if (!Array.isArray(state.order)) state.order = [];
if (typeof state.notes !== "object" || state.notes === null) state.notes = {};

function persist() {
  save(STORE_KEYS.showcase, state);
}

function figLabel(fig) {
  return `${fig.name}, ${fig.waveSeries} (${fig.year})`;
}

function refreshPicker() {
  const ownedFigs = figures.filter((f) => owned.has(f.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  els.datalist.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const f of ownedFigs) {
    const opt = document.createElement("option");
    opt.value = figLabel(f);
    opt.dataset.figId = f.id;
    frag.appendChild(opt);
  }
  els.datalist.appendChild(frag);
  els.pickerEmpty.hidden = ownedFigs.length > 0;
  els.pickerNote.textContent = ownedFigs.length
    ? `${ownedFigs.length} owned figures available · ${state.order.length}/${MAX_SLOTS} slots filled`
    : "";
}

/* Pure ordering helper, moves id by dir within a copy of order, returned.
   Tested in tests/test-showcase.js. */
export function moveId(order, id, dir) {
  const next = [...order];
  const i = next.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= next.length) return next;
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function move(id, dir) {
  const next = moveId(state.order, id, dir);
  if (next.length === state.order.length && next.every((x, i) => x === state.order[i])) return;
  state.order = next;
  persist();
  render();
}

function removeSlot(id) {
  state.order = state.order.filter((x) => x !== id);
  delete state.notes[id];
  persist();
  render();
}

function slotEl(fig, rank) {
  const li = document.createElement("li");
  li.className = "show-slot";
  li.draggable = true;
  li.dataset.figId = fig.id;
  const note = state.notes[fig.id] ?? "";
  const stillOwned = owned.has(fig.id);
  li.innerHTML = `
    <div class="rank" aria-hidden="true">${String(rank).padStart(2, "0")}</div>
    <div>
      <h3>${escapeHtml(fig.name)} <span class="chart-sub">#${rank} of ${state.order.length}</span></h3>
      <div class="sub">${escapeHtml(fig.waveSeries)} · ${fig.year} · ${escapeHtml(fig.manufacturer)}</div>
      <div class="tag-row">${badgeFor(fig)}</div>
      ${stillOwned ? "" : `<p class="chart-sub">No longer marked owned, kept for history.</p>`}
      <div class="field">
        <label for="why-${escapeHtml(fig.id)}">Why it made the cut</label>
        <textarea class="input" id="why-${escapeHtml(fig.id)}" maxlength="280"
          placeholder="The sculpt, the hunt, the memory…">${escapeHtml(note)}</textarea>
      </div>
      <div class="slot-actions">
        <span class="drag-handle" aria-hidden="true" title="Drag to reorder">⠿ drag</span>
        <button type="button" class="btn btn-sm" data-move="-1" ${rank === 1 ? "disabled" : ""}>↑ Up</button>
        <button type="button" class="btn btn-sm" data-move="1" ${rank === state.order.length ? "disabled" : ""}>↓ Down</button>
        <button type="button" class="btn btn-sm" data-remove>Remove</button>
        <a class="btn btn-sm" href="waves/${fig.waveId}.html">Wave →</a>
      </div>
    </div>`;

  li.querySelector("textarea").addEventListener("input", (e) => {
    state.notes[fig.id] = e.target.value;
    persist();
  });
  li.querySelectorAll("[data-move]").forEach((b) =>
    b.addEventListener("click", () => move(fig.id, Number(b.dataset.move))));
  li.querySelector("[data-remove]").addEventListener("click", () => removeSlot(fig.id));

  li.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", fig.id);
    e.dataTransfer.effectAllowed = "move";
    li.classList.add("dragging");
  });
  li.addEventListener("dragend", () => li.classList.remove("dragging"));
  return li;
}

function render() {
  // Drop ids that no longer exist in the archive (data corrections happen).
  const valid = new Set(figures.map((f) => f.id));
  const before = state.order.length;
  state.order = state.order.filter((id) => valid.has(id));
  if (state.order.length !== before) persist();

  els.list.innerHTML = "";
  const frag = document.createDocumentFragment();
  state.order.forEach((id, i) => {
    const fig = figureById(figures, id);
    if (fig) frag.appendChild(slotEl(fig, i + 1));
  });
  els.list.appendChild(frag);

  // Drag-over reordering on the list (drop target = nearest slot).
  els.count.textContent = state.order.length
    ? `${state.order.length} of ${MAX_SLOTS} slots filled`
    : "Empty, add figures from your shelf to build your showcase.";

  if (!state.order.length) {
    els.list.innerHTML = `<div class="empty-state"><p>Your showcase is empty. Add up to ${MAX_SLOTS} owned figures and tell the story of your shelf.</p></div>`;
  }
  refreshPicker();
}

function addFromSearch() {
  const val = els.search.value.trim().toLowerCase();
  if (!val) return;
  const fig = figures.find((f) => owned.has(f.id) && figLabel(f).toLowerCase() === val)
    ?? figures.find((f) => owned.has(f.id) && f.name.toLowerCase() === val);
  if (!fig) {
    els.pickerNote.textContent = "No owned figure matches that exactly, pick from the suggestions.";
    return;
  }
  if (state.order.includes(fig.id)) {
    els.pickerNote.textContent = "That figure is already in your showcase.";
    return;
  }
  if (state.order.length >= MAX_SLOTS) {
    els.pickerNote.textContent = `Showcase is full (${MAX_SLOTS}). Remove one to add another.`;
    return;
  }
  state.order.push(fig.id);
  persist();
  els.search.value = "";
  render();
}

/* "Copy my quest" export, the same quest-card text as Grail Quest,
   recomputed here from the shared tracker stores. */
function refreshShareText(waves) {
  if (!els.shareText) return;
  const ownedIds = owned.all();
  const watchlist = load(STORE_KEYS.watchlist, []);
  const achievements = computeAchievements(figures, waves, ownedIds);
  const unlocked = achievements.filter((a) => a.unlocked);
  const quests = generateQuests(figures, waves, ownedIds);
  const bafs = buildBafs(waves);
  const ownedSet = new Set(ownedIds);
  const completedBafs = bafs.filter((b) =>
    b.pieces.every((p) => p.carriers.some((c) => ownedSet.has(c.id)))
  ).length;
  const level = computeLevel(ownedIds.length, completedBafs, unlocked.length);
  const recs = recommendNext(figures, waves, ownedIds, watchlist);
  const latest = [...unlocked].pop() ?? null;
  els.shareText.value = buildQuestShareText({
    level, ownedCount: ownedIds.length, archiveCount: figures.length,
    completedBafs, achievements, quests, latestAchievement: latest, recs,
  });
}

async function main() {
  let waves = [];
  try {
    ({ figures, waves } = await loadData());
  } catch {
    els.list.innerHTML = `<div class="empty-state"><p>Could not load the figure archive.</p></div>`;
    return;
  }
  refreshShareText(waves);
  els.shareCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(els.shareText.value);
      els.shareStatus.textContent = "Copied, paste it anywhere.";
    } catch {
      els.shareText.select();
      try {
        document.execCommand("copy");
        els.shareStatus.textContent = "Copied, paste it anywhere.";
      } catch {
        els.shareStatus.textContent = "Copy didn't work, select the text manually.";
      }
    }
  });

  els.list.addEventListener("dragover", (e) => {
    const dragging = els.list.querySelector(".dragging");
    if (!dragging) return;
    e.preventDefault();
    const after = [...els.list.querySelectorAll(".show-slot:not(.dragging)")]
      .find((el) => e.clientY < el.getBoundingClientRect().top + el.offsetHeight / 2);
    if (after) els.list.insertBefore(dragging, after);
    else els.list.appendChild(dragging);
  });
  els.list.addEventListener("drop", (e) => {
    e.preventDefault();
    const ids = [...els.list.querySelectorAll(".show-slot")].map((el) => el.dataset.figId);
    state.order = ids.filter((id) => state.order.includes(id));
    persist();
    render();
  });

  els.btnAdd.addEventListener("click", addFromSearch);
  els.search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addFromSearch(); }
  });
  els.btnPrint.addEventListener("click", () => window.print());
  els.btnClear.addEventListener("click", () => {
    if (state.order.length && confirm("Clear your whole showcase?")) {
      state = { order: [], notes: {} };
      persist();
      render();
    }
  });

  render();
}

main();
