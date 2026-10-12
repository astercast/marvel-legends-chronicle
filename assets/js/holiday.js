/* 2026 Holiday Buying Guide (wave 16) — recipient picks rendered from the
   archive's real data: data/preorders.json (wave-12 researched items only).
   No invented figures, prices, dates, or retailers anywhere.
   Pure functions are exported for unit tests; init() hydrates [data-picks]. */

import { soldSearchUrl } from "./listings.js";
import { retailerById, parseYMD } from "./preorders.js";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/* ---- pure helpers ---- */

/** "$27.99 · announced MSRP" — never a market price. */
export function priceBandText(item) {
  const p = item && item.price;
  if (typeof p === "number" && Number.isFinite(p)) {
    return `$${p.toFixed(2)} · announced MSRP (at reveal, per research)`;
  }
  return "Price not announced — check eBay solds";
}

/** "2026-10-06" -> "Oct 6, 2026"; strict parse, null-safe. */
export function formatPickDate(iso) {
  const d = parseYMD(iso);
  if (!d) return null;
  return `${MONTHS[d.m - 1]} ${d.d}, ${d.y}`;
}

/** Honest status line from researched status + release window. */
export function statusLine(item) {
  const window = item && item.releaseWindow ? item.releaseWindow : "release window unreported";
  switch (item && item.status) {
    case "preorder": {
      const when = formatPickDate(item.preorderDate);
      return `Pre-order${when ? ` opened ${when}` : ""} · ${window}`;
    }
    case "available":
      return `Available now · ${window}`;
    case "revealed":
      return `Revealed · expected ${window}`;
    default:
      return `Status unreported · ${window}`;
  }
}

/* ---- picks (one per card): itemId must exist in data/preorders.json.
   why = one data-grounded line. avoid = market-briefing / auth-wizard intel. */

export const PICKS = {
  new: [
    {
      itemId: "mini-comics-wave-3",
      why: "Every figure ships with a physical mini comic, and the lineup spans comic eras — classic red Elektra (first since 2018), Fraction/Aja Hawkeye, Acroyear, Earth X Captain America.",
    },
    {
      itemId: "xmen97-retro-wave",
      why: "The '97 character looks anyone recognizes — Death Gambit, team-suit Cyclops (2 heads), Jean Grey — on retro blister cards. One wave, instantly readable shelf.",
    },
    {
      itemId: "tas-retro-wave",
      why: "First-ever solo-carded 6\" Aunt May, plus Mary Jane, Smythe, and Carnage — cartoon nostalgia that reads instantly to non-collectors.",
    },
    {
      itemId: "doomsday-wave",
      why: "Doctor Doom, Magneto, Gambit, Cyclops — marquee characters with movie-adjacent momentum at the standard $27.99 MSRP.",
    },
    {
      itemId: "final-swing-spidey",
      why: "No Way Home \"Final Swing\" Spider-Man at the standard $27.99 — the iconic movie moment, available now instead of on a pre-order wait.",
    },
  ],
  kid: [
    {
      itemId: "tas-retro-wave",
      why: "The Spider-Man cartoon cast — the characters a kid points at on the box. Recognizable beats rare for young collectors.",
    },
    {
      itemId: "xmen97-retro-wave",
      why: "Team-suit X-Men from the hit animated series — the whole crew in one wave, easy to ask for by name.",
    },
    {
      itemId: "spidey-60s-3pack",
      why: "Spider-Man, Lizard, and Electro in one box — an instant play set instead of a shelf piece.",
    },
    {
      itemId: "mtg-wave-2",
      why: "Each figure includes a playable Magic: The Gathering card — two hobbies in one box if the kid already plays.",
    },
  ],
  completionist: [
    {
      itemId: "mini-comics-wave-3",
      why: "Real gap-fills: classic red Elektra (first since 2018), Elsa Bloodstone, Acroyear, Earth X Captain America — pre-order opened Oct 6, 2026.",
    },
    {
      itemId: "xmen97-retro-wave",
      why: "The '97 run continues: Death Gambit, Vindicator (Morph), X-Factor Havoc and Polaris — pre-order opened Oct 21, 2026.",
    },
    {
      itemId: "tas-retro-wave",
      why: "Fills the VHS-sellout gaps on retro cards — pre-order opened Sep 29, 2026. See the reissue note below before touching aftermarket listings.",
    },
    {
      itemId: "bastion-trask-2pack",
      why: "Fall 2027 2-pack: Prime Sentinel Bastion with bladed wings + Bolivar Trask. Plan the '97 villain shelf now; it's the furthest-out announced item.",
    },
    {
      itemId: "prof-x-hoverchair",
      why: "SDCC 2026 exclusive headed to Hasbro Pulse — the '97 shelf centerpiece. Convention exclusives don't restock like retail waves.",
    },
    {
      itemId: "onslaught-target",
      why: "X-Men Onslaught is reported \"extremely hit or miss in stores\" — and Target cancelled many confirmed 2026 preorders. In-hand beats preordered here.",
    },
    {
      itemId: "cypher-target",
      why: "The first-ever Cypher figure. New-character firsts are the gaps completionists feel longest.",
    },
  ],
  bargain: [
    {
      itemId: "tas-vhs-reissues",
      why: "The Pulse \"VHS\" Animated Series sellouts (Mary Jane, Aunt May, Smythe, Maximum Carnage) spiked on the aftermarket — then Hasbro reissued them on retro cards at the standard $27.99. Buy retail; the old VHS premium is dead money.",
      avoid: "Don't pay the aftermarket VHS markup — the reissue is the same shelf story at retail price. Check the Market Briefing's reissue-cooling section first.",
    },
    {
      itemId: "tas-retro-wave",
      why: "Standard $27.99 MSRP at retail, pre-ordered Sep 29, 2026. Retail is the price floor — anything far under it should raise KO questions, not celebration.",
      avoid: "Carnage is a documented KO target (silver-eyes telltale). Vet marketplace copies with the auth wizard.",
    },
    {
      itemId: "doomsday-wave",
      why: "Fall 2026 waves hold the $27.99 standard — pre-ordering at retail beats every panic-buy later. Revealed items have no date yet, so watch the calendar, not eBay.",
    },
  ],
};

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

const STATUS_LABEL = { preorder: "Pre-order", available: "Available", revealed: "Revealed" };

/** Full pick card HTML from a preorders item + pick config. */
export function renderPick(item, pick) {
  const solds = soldSearchUrl(item.query || item.name);
  const retailLinks = (item.retailers || [])
    .map((id) => retailerById(id))
    .filter(Boolean)
    .map((r) => `<a class="btn btn-sm" href="${esc(r.url(item.query || item.name))}" target="_blank" rel="noopener noreferrer">${esc(r.label)} search ↗</a>`)
    .join("");
  const avoid = pick.avoid
    ? `<p class="pick-avoid"><strong>Don't get burned:</strong> ${esc(pick.avoid)}</p>`
    : "";
  return (
    `<article class="card gift-pick">` +
    `<div class="entry-head"><span class="entry-name">${esc(item.name)}</span></div>` +
    `<div class="tag-row">` +
    `<span class="badge badge-status">${esc(STATUS_LABEL[item.status] || item.status)}</span>` +
    `<span class="badge badge-msrp">${esc(priceBandText(item))}</span>` +
    `</div>` +
    `<p class="pick-status muted">${esc(statusLine(item))}</p>` +
    `<p class="gift-why">${esc(pick.why)}</p>` +
    avoid +
    `<div class="btn-row" style="margin-top:var(--space-2)">` +
    `<a class="btn btn-sm" href="preorders.html">Pre-order tracker</a>` +
    `<a class="btn btn-sm" href="${esc(solds)}" target="_blank" rel="noopener noreferrer">Check eBay solds ↗</a>` +
    retailLinks +
    `</div></article>`
  );
}

/* ---- page init ---- */

async function loadPreorders() {
  const res = await fetch("data/preorders.json");
  if (!res.ok) throw new Error(`preorders.json ${res.status}`);
  const raw = await res.json();
  return raw.items ?? [];
}

export function byId(items) {
  const map = new Map();
  for (const it of items) map.set(it.id, it);
  return map;
}

export async function init() {
  const mounts = [...document.querySelectorAll("[data-picks]")];
  if (!mounts.length) return;
  let items = [];
  try {
    items = await loadPreorders();
  } catch (e) {
    for (const m of mounts) {
      m.innerHTML = `<p class="error-note">Picks couldn't be loaded — open <a href="preorders.html">the pre-order tracker</a> directly. (${esc(String(e.message || e))})</p>`;
    }
    return;
  }
  const lookup = byId(items);
  for (const mount of mounts) {
    const key = mount.getAttribute("data-picks");
    const picks = (PICKS[key] || [])
      .map((p) => ({ item: lookup.get(p.itemId), pick: p }))
      .filter(({ item }) => item);
    mount.innerHTML = picks.map(({ item, pick }) => renderPick(item, pick)).join("");
  }
}

init();
