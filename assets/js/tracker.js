/* Collection tracker — Owned / Wanted state per figure id. */
import { STORE_KEYS } from "./config.js";
import { makeIdSet } from "./store.js";

export const owned = makeIdSet(STORE_KEYS.owned);
export const wanted = makeIdSet(STORE_KEYS.wanted);

/* Renders Owned/Wanted toggle buttons for a figure card or modal. */
export function trackerButtons(figId) {
  const wrap = document.createElement("div");
  wrap.className = "tracker-btns";
  wrap.innerHTML = `
    <button type="button" class="btn btn-sm" data-track="owned" aria-pressed="${owned.has(figId)}">Owned</button>
    <button type="button" class="btn btn-sm" data-track="wanted" aria-pressed="${wanted.has(figId)}">Wanted</button>`;
  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-track]");
    if (!btn) return;
    const kind = btn.dataset.track;
    const store = kind === "owned" ? owned : wanted;
    const other = kind === "owned" ? wanted : owned;
    const nowOn = store.toggle(figId);
    if (nowOn && other.has(figId)) other.toggle(figId); // mutually exclusive
    btn.setAttribute("aria-pressed", String(nowOn));
    // If we turned "owned" on, turn the paired "wanted" button off (and vice versa)
    const otherBtn = wrap.querySelector(`[data-track="${kind === "owned" ? "wanted" : "owned"}"]`);
    otherBtn?.setAttribute("aria-pressed", "false");
    syncCardDots(figId);
  });
  return wrap;
}

/* Refresh the owned/wanted dot on every card for this figure. */
export function syncCardDots(figId) {
  document.querySelectorAll(`[data-fig-id="${CSS.escape(figId)}"]`).forEach((card) => {
    card.querySelector(".owned-dot, .wanted-dot")?.remove();
    const dot = document.createElement("span");
    if (owned.has(figId)) dot.className = "owned-dot";
    else if (wanted.has(figId)) dot.className = "wanted-dot";
    else return;
    dot.setAttribute("aria-hidden", "true");
    card.appendChild(dot);
  });
}

export function trackerSummary() {
  return { owned: owned.count(), wanted: wanted.count() };
}
