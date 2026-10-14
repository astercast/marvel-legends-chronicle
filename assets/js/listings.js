/* Marketplace links, search-link builders (mock integration, no live inventory). */
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

/* eBay sold-listings URL, same pattern as baf-planner.js soldSearchUrl().
   LH_Sold + LH_Complete = completed sold listings, i.e. actual sale prices. */
export function soldSearchUrl(query) {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;
}

/* Per-figure research links: sold listings, video reviews, general web search.
   These are pre-filled external searches, no prices scraped, no reviews
   invented. The query matches marketplaceQuery() so results stay on-figure. */
export function researchQuery(figure) {
  return marketplaceQuery(figure);
}

export function researchLinks(figure) {
  const q = researchQuery(figure);
  return [
    { id: "ebay-sold", label: "eBay sold listings", href: soldSearchUrl(q) },
    {
      id: "youtube",
      label: "YouTube reviews",
      href: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${q} review`)}`,
    },
    {
      id: "web",
      label: "Web search",
      href: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    },
  ];
}

export function renderResearchLinks(figure) {
  const wrap = document.createElement("div");
  wrap.className = "research-links";
  const head = document.createElement("h3");
  head.className = "dialog-subhead";
  head.textContent = "Research this figure";
  wrap.appendChild(head);
  const note = document.createElement("p");
  note.className = "link-note";
  note.textContent =
    "External searches, eBay solds show what figures actually sold for, not asking prices. " +
    "Reviews and web results are third-party content; we don't verify them.";
  wrap.appendChild(note);
  const row = document.createElement("div");
  row.className = "btn-row";
  for (const link of researchLinks(figure)) {
    const a = document.createElement("a");
    a.className = "btn btn-sm";
    a.href = link.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = link.label;
    row.appendChild(a);
  }
  wrap.appendChild(row);
  return wrap;
}

export function renderMarketplaceLinks(figure) {
  const row = document.createElement("div");
  row.className = "btn-row";
  const note = document.createElement("p");
  note.style.cssText = "font-size:0.78rem;color:var(--muted);width:100%;margin:0;";
  note.textContent = "Mock integration, these open pre-filled marketplace searches, not live inventory.";
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
