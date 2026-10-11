/* Figure detail dialog — specs, BAF piece, notes, tracker, marketplace links. */
import { openModal } from "./modal.js";
import { trackerButtons, owned, wanted } from "./tracker.js";
import { renderMarketplaceLinks, renderResearchLinks } from "./listings.js";

export function badgeFor(fig) {
  const badges = [];
  if (fig.waveBaf) badges.push(`<span class="badge badge-baf">BAF: ${escapeHtml(fig.waveBaf)}</span>`);
  if (fig.exclusive) badges.push(`<span class="badge badge-exclusive">${escapeHtml(fig.exclusive)}</span>`);
  if (fig.variant) badges.push(`<span class="badge badge-variant">${escapeHtml(fig.variant)}</span>`);
  if (fig.bafPiece) badges.push(`<span class="badge">Builds: ${escapeHtml(fig.bafPiece)}</span>`);
  if (fig.source) {
    const label = { mcu: "MCU", animated: "Animated", videogame: "Video game" }[fig.source] ?? fig.source;
    badges.push(`<span class="badge badge-source">${escapeHtml(label)}</span>`);
  }
  return badges.join("");
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/* Character pages (characters/<slug>.html) — lazy index so the dialog can link
   "Every <character> release →" when one exists. */
const charIndex = new Map();
fetch("characters/manifest.json")
  .then((r) => (r.ok ? r.json() : []))
  .then((m) => {
    for (const c of m) charIndex.set(String(c.name).toLowerCase(), c.slug);
  })
  .catch(() => {});

function characterLinkFor(name) {
  const base = String(name).replace(/\s*\(.*?\)\s*/g, "").trim();
  const slug = charIndex.get(base.toLowerCase());
  return slug ? { base, slug } : null;
}

export function openFigureDialog(fig) {
  openModal((titleEl, bodyEl) => {
    titleEl.textContent = fig.name;
    const dl = document.createElement("dl");
    dl.className = "kv";
    const rows = [
      ["Wave", fig.waveSeries],
      ["Year", fig.year],
      ["Manufacturer", fig.manufacturer],
      ...(fig.variant ? [["Variant", fig.variant]] : []),
      ...(fig.exclusive ? [["Exclusive", fig.exclusive]] : []),
      ...(fig.bafPiece ? [["BAF piece", fig.bafPiece]] : []),
      ...(fig.waveBaf ? [["Wave BAF", fig.waveBaf]] : []),
      ...(fig.notes ? [["Notes", fig.notes]] : []),
    ];
    for (const [k, v] of rows) {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      dl.append(dt, dd);
    }
    bodyEl.appendChild(dl);

    const status = document.createElement("p");
    status.style.cssText = "font-size:0.85rem;color:var(--muted);";
    const flags = [];
    if (owned.has(fig.id)) flags.push("in your collection");
    if (wanted.has(fig.id)) flags.push("on your want list");
    status.textContent = flags.length ? `Status: ${flags.join(", ")}.` : "Not tracked yet.";
    bodyEl.appendChild(status);

    const cl = characterLinkFor(fig.name);
    if (cl) {
      const charLink = document.createElement("a");
      charLink.className = "btn btn-sm";
      charLink.href = `characters/${cl.slug}.html`;
      charLink.textContent = `Every ${cl.base} release →`;
      charLink.style.marginBottom = "var(--space-3)";
      bodyEl.appendChild(charLink);
    }

    bodyEl.appendChild(trackerButtons(fig.id));
    bodyEl.appendChild(renderMarketplaceLinks(fig));
    bodyEl.appendChild(renderResearchLinks(fig));
  });
}
