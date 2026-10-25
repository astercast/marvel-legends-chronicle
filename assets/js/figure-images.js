/* figure-images.js, the Visual Database's shared rendering kit.
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
   the same way, never a broken-image box, never a placeholder
   graphic. Pictures are lazy-loaded outbound references: no
   proxying, no per-image function calls. */
import { escapeHtml } from "./figure-dialog.js";

export const FIGURE_IMAGES_PATH = "data/v1/figure-images.json";

/* Picture policy (OWNER REVERSAL 2026-10-24): pictures are pulled from
   stores and other sites and shown as the primary source; the seller
   plate below renders only where no picture exists from any source. */
const isHotlink = (url) => /^https?:/i.test(url || "");

function sellerPlateHtml(entry) {
  return `<figure class="fig-plate"><div class="notplate"><p class="micro"><a href="${escapeHtml(entry.sourceUrl)}" rel="noopener nofollow" target="_blank">Photo at ${escapeHtml(entry.imageSource)}</a></p></div></figure>`;
}

export async function loadFigureImages(path = FIGURE_IMAGES_PATH) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`figure images manifest: HTTP ${res.status}`);
  const doc = await res.json();
  const entries = Array.isArray(doc.entries) ? doc.entries : [];
  return new Map(entries.map((e) => [e.figureId, e]));
}

/* plate2 (2026-10-24 bundle): the JS twin of scripts/plate2.py. One 4:5
   plate everywhere: the typographic floor under a photo that fades in over
   it (assets/js/plate2.js settles load/error and alt second chances), the
   matte from the photo's measured corners, fill for tight busts, contain
   for boxes and loose figures so watermarks are never cropped, and the
   round-3 credit wording, "Photo at <shop>". */
const HEX = /^#[0-9a-fA-F]{6}$/;
export function usableEntry(entry) {
  return Boolean(entry && entry.imageUrl && entry.status !== "dead");
}
function altsAttr(entry) {
  const urls = (entry.alts || []).map((a) => a.imageUrl).filter((u) => /^https:\/\//.test(u));
  return urls.length ? ` data-alts="${escapeHtml(urls.join(" "))}"` : "";
}
export function plate2Html(entry, name, href, opts = {}) {
  const floor = `<span class="p-floor"><span class="p-name">${escapeHtml(name)}</span><span class="p-micro">Not pictured</span></span>`;
  const cls = `plate2${opts.thumb ? " is-thumb" : ""}`;
  if (!usableEntry(entry)) {
    return href
      ? `<a class="${cls}" data-state="none" href="${escapeHtml(href)}">${floor}</a>`
      : `<div class="${cls}" data-state="none">${floor}</div>`;
  }
  const fit = ["fill", "box", "square"].includes(entry.fit) ? ` data-fit="${entry.fit}"` : "";
  const style = HEX.test(entry.matte || "") ? ` style="--matte:${entry.matte}"` : "";
  const w = Number(entry.w) || 345;
  const h = Number(entry.h) || 460;
  const img = `<img src="${escapeHtml(entry.imageUrl)}" alt="${escapeHtml(name)} figure photograph" width="${w}" height="${h}" decoding="async" referrerpolicy="no-referrer"${opts.eager ? ' fetchpriority="high"' : ' loading="lazy"'}${altsAttr(entry)}>`;
  const credit = opts.thumb ? "" : `<span class="p-credit">Photo at ${escapeHtml(entry.imageSource)}</span>`;
  return href
    ? `<a class="${cls}" data-state="wait"${fit}${style} href="${escapeHtml(href)}">${floor}${img}${credit}</a>`
    : `<div class="${cls}" data-state="wait"${fit}${style}>${floor}${img}${credit}</div>`;
}

/* The plate: the picture itself as a plate2 plate, linked out to its
   source product page. Kept as a named export for existing callers. */
export function plateHtml(entry, name) {
  if (!entry || !entry.imageUrl) return "";
  return plate2Html(entry, name, entry.sourceUrl);
}

/* The featured plate on a figure's own surface: plate2 with the view
   transition name the spec sheet assigns. The Rijksmuseum caption the old
   plate carried moves to the page's own tombstone text; the plate itself
   is the same 4:5 plate as everywhere else. */
export function plateFigureHtml(entry, name, opts = {}) {
  if (!entry || !entry.imageUrl) return "";
  return plate2Html(entry, name, entry.sourceUrl, { eager: true });
}

/* Places to buy: outbound links only. The price shown is the price
   the retailer itself listed on priceSeen, and the link is where it
   is checked, this archive sells nothing and checks nothing out. */
export function buyLinksHtml(entry) {
  if (!entry || !Array.isArray(entry.buy) || !entry.buy.length) return "";
  const links = entry.buy.map((b) => {
    const price = typeof b.priceUSD === "number"
      ? `, $${b.priceUSD.toFixed(2)} listed ${escapeHtml(b.priceSeen || "")}`.trimEnd()
      : ", price at the retailer";
    return `<a class="buy-link" href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.retailer)}${price} ↗</a>`;
  }).join("");
  return `<p class="fig-buy"><span class="fig-buy-label">Places to buy</span>${links}</p>`;
}
