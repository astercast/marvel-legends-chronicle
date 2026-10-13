/* Collection tracker — Owned / Wanted / Watching state per figure id.
   Owned and Wanted are mutually exclusive (a figure is on your shelf or on
   your want list, never both). Watching is the third shelf: an eye kept on a
   figure you neither own nor actively hunt. Marking a figure Owned clears
   both other shelves for it — it came home, so the hunt and the watch end. */
import { STORE_KEYS } from "./config.js";
import { makeIdSet } from "./store.js";

export const owned = makeIdSet(STORE_KEYS.owned);
export const wanted = makeIdSet(STORE_KEYS.wanted);
export const watching = makeIdSet(STORE_KEYS.watching);

export const TRACK_KINDS = ["owned", "wanted", "watching"];
const SETS = { owned, wanted, watching };

/* The state machine, kept DOM-free so tests can exercise the real rules.
   Returns the figure's full state after the toggle. */
export function applyTrackToggle(kind, figId) {
  if (!SETS[kind]) throw new Error(`unknown track kind: ${kind}`);
  const nowOn = SETS[kind].toggle(figId);
  if (nowOn && kind === "owned") {
    if (wanted.has(figId)) wanted.toggle(figId);
    if (watching.has(figId)) watching.toggle(figId);
  }
  if (nowOn && kind === "wanted" && owned.has(figId)) {
    owned.toggle(figId);
  }
  return trackState(figId);
}

export function trackState(figId) {
  return {
    owned: owned.has(figId),
    wanted: wanted.has(figId),
    watching: watching.has(figId),
  };
}

/* Renders Owned/Wanted/Watching toggle buttons for a figure card or modal. */
export function trackerButtons(figId) {
  const wrap = document.createElement("div");
  wrap.className = "tracker-btns";
  const state = trackState(figId);
  wrap.innerHTML = `
    <button type="button" class="btn btn-sm" data-track="owned" aria-pressed="${state.owned}">Owned</button>
    <button type="button" class="btn btn-sm" data-track="wanted" aria-pressed="${state.wanted}">Wanted</button>
    <button type="button" class="btn btn-sm" data-track="watching" aria-pressed="${state.watching}">Watching</button>`;
  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-track]");
    if (!btn) return;
    const next = applyTrackToggle(btn.dataset.track, figId);
    for (const kind of TRACK_KINDS) {
      wrap.querySelector(`[data-track="${kind}"]`)?.setAttribute("aria-pressed", String(next[kind]));
    }
    syncCardDots(figId);
  });
  return wrap;
}

/* Refresh the tracker dot on every card for this figure. */
export function syncCardDots(figId) {
  document.querySelectorAll(`[data-fig-id="${CSS.escape(figId)}"]`).forEach((card) => {
    card.querySelector(".owned-dot, .wanted-dot, .watching-dot")?.remove();
    const dot = document.createElement("span");
    if (owned.has(figId)) dot.className = "owned-dot";
    else if (wanted.has(figId)) dot.className = "wanted-dot";
    else if (watching.has(figId)) dot.className = "watching-dot";
    else return;
    dot.setAttribute("aria-hidden", "true");
    card.appendChild(dot);
  });
}

export function trackerSummary() {
  return { owned: owned.count(), wanted: wanted.count(), watching: watching.count() };
}
