/* Marketplace links — search-link builders (mock integration, no live inventory). */
import { MARKETPLACES } from "./config.js";

export function marketplaceQuery(figure) {
  const parts = ["Marvel Legends", figure.name];
  if (figure.variant) parts.push(figure.variant);
  return parts.join(" ");
}

export function marketplaceLinks(figure) {
  const q = marketplaceQuery(figure);
  return MARKETPLACES.map((m) => ({ id: m.id, label: m.label, href: m.url(q) }));
}

export function renderMarketplaceLinks(figure) {
  const row = document.createElement("div");
  row.className = "btn-row";
  const note = document.createElement("p");
  note.style.cssText = "font-size:0.78rem;color:var(--muted);width:100%;margin:0;";
  note.textContent = "Mock integration — these open pre-filled marketplace searches, not live inventory.";
  row.appendChild(note);
  for (const link of marketplaceLinks(figure)) {
    const a = document.createElement("a");
    a.className = "btn btn-sm";
    a.href = link.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = `Search ${link.label}`;
    row.appendChild(a);
  }
  return row;
}
