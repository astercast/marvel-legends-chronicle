/* Wave detail page, inline Owned/Wanted toggles per figure, live owned
   count, and the print-checklist button. figId format matches data.js:
   "<waveId>::<figureName>". */
import { trackerButtons, owned } from "./tracker.js";

function init() {
  const hero = document.querySelector("[data-wave-id]");
  if (!hero) return;

  document.querySelectorAll(".track-slot[data-track-for]").forEach((slot) => {
    const figId = slot.getAttribute("data-track-for");
    if (!figId) return;
    slot.appendChild(trackerButtons(figId));
  });

  const updateCount = () => {
    const rows = document.querySelectorAll(".fig[data-fig-id]");
    let n = 0;
    rows.forEach((r) => {
      if (owned.has(r.getAttribute("data-fig-id"))) n += 1;
    });
    const el = document.getElementById("owned-count");
    if (el) el.textContent = `You own ${n} of ${rows.length}`;
  };
  updateCount();
  /* Recompute when any tracker button on the page is toggled. */
  document.addEventListener("click", (e) => {
    if (e.target.closest('[data-track="owned"], [data-track="wanted"]')) {
      /* tracker.js toggles synchronously on click; recompute after. */
      setTimeout(updateCount, 0);
    }
  });

  const printBtn = document.getElementById("print-checklist");
  if (printBtn) printBtn.addEventListener("click", () => window.print());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
