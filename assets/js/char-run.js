/* Character run completion, "Your Spider-Man run: 12 of 86 (14%)".
   Read-only over the existing mlc_owned_v1 / mlc_wanted_v1 tracker data.
   Release rows carry data-fig-id matching the canonical `${wave.id}::${name}`
   ids from data.js, so this stays in sync with the timeline tracker. */
import { STORE_KEYS } from "./config.js";
import { load } from "./store.js";
import { trackerButtons } from "./tracker.js";
import { escapeHtml } from "./figure-dialog.js";

function readSet(key) {
  const raw = load(key, []);
  return new Set(Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : []);
}

function render() {
  const panel = document.getElementById("run-panel");
  if (!panel) return;
  const char = panel.dataset.char || "Character";
  const rows = [...document.querySelectorAll("li.release[data-fig-id]")];
  const total = rows.length;
  const owned = readSet(STORE_KEYS.owned);
  const wanted = readSet(STORE_KEYS.wanted);

  const ownedRows = rows.filter((li) => owned.has(li.dataset.figId));
  const n = ownedRows.length;
  const pct = total ? Math.round((n / total) * 100) : 0;
  const wantedCount = rows.filter((li) => wanted.has(li.dataset.figId)).length;

  const missing = rows.filter((li) => !owned.has(li.dataset.figId));

  panel.innerHTML = `
    <p class="bookplate-mark">Ex Libris: this copy belongs to its collector</p>
    <h2 class="run-title">Your ${escapeHtml(char)} run</h2>
    <p class="run-summary" aria-live="polite"><strong>${n} of ${total}</strong> (${pct}%) owned${wantedCount ? ` · ${wantedCount} wanted` : ""}</p>
    <div class="run-bar" role="progressbar" aria-label="${escapeHtml(char)} run completion"
         aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="${total}">
      <div class="run-fill" style="width:${pct}%"></div>
    </div>
    ${n === 0 ? `<p class="method-note">Mark figures <strong>Owned</strong> on the timeline and this run fills in. Nothing here changes your tracker, it only reads it.</p>` : ""}
    ${missing.length ? `
    <details class="run-missing" ${n === 0 ? "" : "open"}>
      <summary>Missing from your run (${missing.length}): the complete-the-run checklist</summary>
      <ul class="run-missing-list">
        ${missing.map((li) => {
          const id = li.dataset.figId;
          const name = li.querySelector(".release-name")?.textContent ?? id;
          const wave = li.querySelector(".release-wave")?.textContent ?? "";
          return `<li class="run-missing-row" data-fig-id="${escapeHtml(id)}">
            <span class="run-missing-name">${escapeHtml(name)} <span class="muted">${escapeHtml(wave)}</span></span>
            <span class="run-missing-btns" data-run-btns="${escapeHtml(id)}"></span>
          </li>`;
        }).join("")}
      </ul>
    </details>` : `<p class="run-complete">Run complete. Every ${escapeHtml(char)} in the archive, on your shelf.</p>`}
  `;

  // Attach tracker toggle buttons to each missing row.
  panel.querySelectorAll("[data-run-btns]").forEach((slot) => {
    slot.replaceChildren(trackerButtons(slot.dataset.runBtns));
  });
}

// Re-render when any tracker toggle on this page changes.
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-track]")) {
    // Let tracker.js persist first, then recompute.
    setTimeout(render, 0);
  }
});

render();
