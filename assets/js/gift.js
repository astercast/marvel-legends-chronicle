/* Gift Finder — budget + character → honest suggestions from the archive.
   Budget bands filter by FIGURE TYPE as a price proxy (the archive has no
   MSRP data); every card links eBay solds for real price verification.
   No invented prices anywhere. */
import { PATHS, STORE_KEYS } from "./config.js";
import { loadData } from "./data.js";
import { load } from "./store.js";
import { escapeHtml, badgeFor } from "./figure-dialog.js";
import { researchLinks } from "./listings.js";
import { trackerButtons, owned } from "./tracker.js";

const els = {
  form: document.getElementById("gift-form"),
  budget: document.getElementById("g-budget"),
  character: document.getElementById("g-character"),
  characters: document.getElementById("g-characters"),
  source: document.getElementById("g-source"),
  hideOwned: document.getElementById("g-hide-owned"),
  empty: document.getElementById("g-empty"),
  results: document.getElementById("g-results"),
  heading: document.getElementById("gift-results-heading"),
};

function baseName(n) {
  return String(n ?? "").replace(/\s*\(.*?\)\s*/g, "").trim().toLowerCase();
}

/* Budget band → allowed figure types. Honest proxy, labeled as such. */
function bandAllows(band, fig) {
  const isStandard = !fig.exclusive && !fig.variant;
  if (band === "under25") return isStandard;
  return true; // under50 + splurge allow everything; splurge sorts special-first
}

function whyLine(fig) {
  const bits = [];
  if (fig.exclusive) bits.push(`${fig.exclusive} exclusive — harder to find, feels special.`);
  else if (fig.variant) bits.push(`Variant (${fig.variant}) — for the collector who has everything.`);
  else bits.push("Standard mainline single — the affordable way in.");
  if (fig.bafPiece) bits.push("Includes a Build-A-Figure piece — two gifts in one.");
  if (fig.year >= 2024) bits.push("Recent release — easier to find at retail.");
  return bits.join(" ");
}

function giftCard(fig) {
  const card = document.createElement("article");
  card.className = "card gift-card";
  card.style.padding = "var(--space-4)";
  const links = researchLinks(fig);
  const sold = links.find((l) => l.id === "ebay-sold");
  const yt = links.find((l) => l.id === "youtube");
  card.innerHTML = `
    <div class="entry-head">
      <span class="entry-name">${escapeHtml(fig.name)}</span>
      <span class="entry-wave">${escapeHtml(fig.waveSeries)} (${fig.year})</span>
    </div>
    <div class="tag-row">${badgeFor(fig)}</div>
    <p class="gift-why">${escapeHtml(whyLine(fig))}</p>
    <div class="btn-row" style="margin-top:var(--space-1)">
      <a class="btn btn-sm" href="${sold.href}" target="_blank" rel="noopener noreferrer">Check eBay solds ↗</a>
      <a class="btn btn-sm btn-ghost" href="${yt.href}" target="_blank" rel="noopener noreferrer">YouTube reviews ↗</a>
    </div>`;
  card.appendChild(trackerButtons(fig.id));
  return card;
}

async function main() {
  let figures = [];
  try {
    ({ figures } = await loadData());
  } catch {
    els.empty.innerHTML = `<h2>Couldn't load the archive</h2><p>Check your connection and reload.</p>`;
    els.empty.hidden = false;
    return;
  }

  // Character datalist: manifest names + distinct figure base names.
  try {
    const res = await fetch("characters/manifest.json");
    if (res.ok) {
      const manifest = await res.json();
      const frag = document.createDocumentFragment();
      const seen = new Set();
      for (const c of manifest) {
        if (seen.has(c.name)) continue;
        seen.add(c.name);
        const opt = document.createElement("option");
        opt.value = c.name;
        frag.appendChild(opt);
      }
      els.characters.appendChild(frag);
    }
  } catch { /* datalist is a nicety */ }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const band = els.budget.value;
    const charQ = els.character.value.trim().toLowerCase();
    const source = els.source.value;
    const hideOwned = els.hideOwned.checked;
    const ownedIds = new Set(load(STORE_KEYS.owned, []));

    let pool = figures.filter((f) => {
      if (!bandAllows(band, f)) return false;
      if (source !== "all" && (f.source ?? "unclassified") !== source) return false;
      if (hideOwned && ownedIds.has(f.id)) return false;
      return true;
    });
    if (charQ) {
      pool = pool.filter((f) =>
        baseName(f.name).includes(charQ) || f.name.toLowerCase().includes(charQ));
    }
    // Rank: character-name starts-with first, then newer (likely available), then standard.
    pool.sort((a, b) => {
      const aStart = charQ && baseName(a.name).startsWith(charQ) ? 0 : 1;
      const bStart = charQ && baseName(b.name).startsWith(charQ) ? 0 : 1;
      if (aStart !== bStart) return aStart - bStart;
      const aSpecial = (a.exclusive || a.variant) ? 0 : 1;
      const bSpecial = (b.exclusive || b.variant) ? 0 : 1;
      if (band === "splurge" && aSpecial !== bSpecial) return aSpecial - bSpecial;
      return b.year - a.year;
    });

    const picks = pool.slice(0, 12);
    els.empty.hidden = picks.length > 0;
    els.results.innerHTML = "";
    els.heading.textContent = picks.length
      ? `Suggestions (${picks.length})`
      : "Suggestions";
    if (!picks.length) {
      els.empty.hidden = false;
      els.empty.innerHTML = charQ
        ? `<h2>No matches</h2><p>Nothing in the archive matches "${escapeHtml(els.character.value.trim())}" under these filters. Try a shorter name, a different universe, or a bigger budget.</p>`
        : `<h2>No matches</h2><p>Nothing passed those filters. Loosen the budget or universe and try again.</p>`;
      return;
    }
    const frag = document.createDocumentFragment();
    for (const f of picks) frag.appendChild(giftCard(f));
    els.results.appendChild(frag);
  });
}

main();
