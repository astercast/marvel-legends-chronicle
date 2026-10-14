/* figure-images.js — the Visual Database's shared rendering kit.
   The archive's figure pictures live in data/v1/figure-images.json:
   one entry per pictured figure, holding the embed URL of the
   manufacturer's/retailer's own product photography (referenced,
   never copied, never AI-generated), its provenance, and its
   outbound places to buy. Every entry was verified live before it
   was filed (HTTP 200, image content type).

   THE FALLBACK LAW: a figure with no entry renders in the plain
   typographic museum-vault treatment, exactly as the whole archive
   did before pictures. A pictured figure whose embed fails to load
   removes its own plate (the img's error handler) and falls back
   the same way — never a broken-image box, never a placeholder
   graphic. Pictures are lazy-loaded outbound references: no
   proxying, no per-image function calls. */
import { escapeHtml } from "./figure-dialog.js";

export const FIGURE_IMAGES_PATH = "data/v1/figure-images.json";

export async function loadFigureImages(path = FIGURE_IMAGES_PATH) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`figure images manifest: HTTP ${res.status}`);
  const doc = await res.json();
  const entries = Array.isArray(doc.entries) ? doc.entries : [];
  return new Map(entries.map((e) => [e.figureId, e]));
}

/* The plate: the picture itself, linked out to its source product
   page, with the source named. If the embed dies, the plate removes
   itself and the typographic treatment underneath stands alone. */
export function plateHtml(entry, name) {
  if (!entry || !entry.imageUrl) return "";
  return `<figure class="fig-plate">
      <a href="${escapeHtml(entry.sourceUrl)}" target="_blank" rel="noopener noreferrer" title="Product page at ${escapeHtml(entry.imageSource)}">
        <img src="${escapeHtml(entry.imageUrl)}" alt="${escapeHtml(name)} — product photograph from ${escapeHtml(entry.imageSource)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.fig-plate').remove()">
      </a>
      <figcaption>Product photograph — ${escapeHtml(entry.imageSource)} · Hasbro product photography, embedded from the retailer</figcaption>
    </figure>`;
}

/* Places to buy: outbound links only. The price shown is the price
   the retailer itself listed on priceSeen, and the link is where it
   is checked — this archive sells nothing and checks nothing out. */
export function buyLinksHtml(entry) {
  if (!entry || !Array.isArray(entry.buy) || !entry.buy.length) return "";
  const links = entry.buy.map((b) => {
    const price = typeof b.priceUSD === "number"
      ? ` — $${b.priceUSD.toFixed(2)} listed ${escapeHtml(b.priceSeen || "")}`.trimEnd()
      : " — price at the retailer";
    return `<a class="buy-link" href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.retailer)}${price} ↗</a>`;
  }).join("");
  return `<p class="fig-buy"><span class="fig-buy-label">Places to buy</span>${links}</p>`;
}
