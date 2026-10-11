/* Shared accessible modal: focus trap, Escape to close, focus restore, backdrop dismiss. */
let lastFocused = null;

export function openModal(buildContent) {
  closeModal();
  lastFocused = document.activeElement;
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-head">
        <h2 id="modal-title"></h2>
        <button type="button" class="modal-close" aria-label="Close dialog">&times;</button>
      </div>
      <div class="modal-body"></div>
    </div>`;
  const close = () => closeModal();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector(".modal-close").addEventListener("click", close);
  document.addEventListener("keydown", escHandler);
  /* Full focus trap: Tab cycles within the dialog. */
  backdrop.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const focusables = Array.prototype.slice.call(
      backdrop.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  document.body.appendChild(backdrop);
  document.body.style.overflow = "hidden";
  buildContent(backdrop.querySelector("#modal-title"), backdrop.querySelector(".modal-body"), close);
  backdrop.querySelector(".modal-close").focus();
  return close;
}

function escHandler(e) {
  if (e.key === "Escape") closeModal();
}

export function closeModal() {
  document.querySelector(".modal-backdrop")?.remove();
  document.removeEventListener("keydown", escHandler);
  document.body.style.overflow = "";
  if (lastFocused instanceof HTMLElement) lastFocused.focus();
  lastFocused = null;
}
