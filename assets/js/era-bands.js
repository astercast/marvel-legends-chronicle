/* Timeline era bands — packaging eras of the Marvel Legends line.
   Year ranges follow the transitions documented in data/encyclopedia.json
   (packagingGuide): Toy Biz 2002–2006, Hasbro takeover 2007, Infinite Series
   window-box relaunch 2014, windowless 2022–2023, windows return late 2023→2024.
   The one-line notes are summaries of the encyclopedia's sourced items.
   Boundaries are the documented transitions — nothing is invented. */
import { escapeHtml } from "./figure-dialog.js";

export const ERAS = [
  {
    id: "toybiz",
    startYear: 2002,
    endYear: 2006,
    title: "Toy Biz era",
    note: "Clamshell packaging with a 32-page reprint comic — plus a display stand — in every box.",
    learnMore: "encyclopedia.html#packaging",
  },
  {
    id: "hasbro-early",
    startYear: 2007,
    endYear: 2013,
    title: "Hasbro takes over",
    note: "The comic pack-in is dropped and Toy Biz's finger joints go with it — but the Build-A-Figure carries on.",
    learnMore: "encyclopedia.html#packaging",
  },
  {
    id: "infinite",
    startYear: 2014,
    endYear: 2021,
    title: "Infinite Series",
    note: "Scooped-side window boxes; MCU characters fold into the main line instead of per-movie waves.",
    learnMore: "encyclopedia.html#packaging",
  },
  {
    id: "windowless",
    startYear: 2022,
    endYear: 2023,
    title: "Windowless era",
    note: "Plastic windows removed in a sustainability push — printed box art by real comic artists instead.",
    learnMore: "encyclopedia.html#packaging",
  },
  {
    id: "windows-return",
    startYear: 2024,
    endYear: 2026,
    title: "Windows return + retro",
    note: "Collector windows come back in bio-PET after fan feedback while retro-carded nostalgia lines thrive.",
    learnMore: "encyclopedia.html#packaging",
  },
];

export function eraForYear(year) {
  return ERAS.find((e) => year >= e.startYear && year <= e.endYear) ?? null;
}

export function eraYears(era) {
  return `${era.startYear}–${era.endYear}`;
}

/* Legend strip rendered above the timeline. */
export function renderEraLegend() {
  const nav = document.createElement("nav");
  nav.className = "era-legend";
  nav.setAttribute("aria-label", "Packaging eras");
  for (const era of ERAS) {
    const a = document.createElement("a");
    a.className = "era-chip";
    a.href = era.learnMore;
    a.innerHTML =
      `<span class="era-chip-years">${escapeHtml(eraYears(era))}</span>` +
      `<span class="era-chip-title">${escapeHtml(era.title)}</span>`;
    nav.appendChild(a);
  }
  return nav;
}

/* Full-width divider inserted between year groups when the era changes. */
export function eraDivider(era) {
  const div = document.createElement("div");
  div.className = "era-band";
  div.innerHTML =
    `<p class="era-kicker">Packaging era · ${escapeHtml(eraYears(era))}</p>` +
    `<h2 class="era-title">${escapeHtml(era.title)}</h2>` +
    `<p class="era-note">${escapeHtml(era.note)} ` +
    `<a href="${escapeHtml(era.learnMore)}">Packaging history&nbsp;→</a></p>`;
  return div;
}
