/* Shared accessible modal (focus trap-lite: focus close on open, restore on close). */
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
