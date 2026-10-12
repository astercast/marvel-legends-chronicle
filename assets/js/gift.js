/* Gift Finder 2.0 — budget + character/team + recipient → ranked gift picks
   from the REAL archive data.
   - Ranking: scoreGift() from archive signals only (character/team match,
     recency, figure type, rarity signals, KO-risk penalties, recipient
     profile weights). No invented prices: price tiers are figure-type
     classes, honestly labeled; the only dollar numbers shown are the user's
     OWN journal-logged prices or announced pre-order MSRPs.
   - KO-risk notes come from assets/js/ko-targets.js (the archive's own
     authentication research), never guesses.
   - "Buy this, not that": each pick may name a same-character alternate to
     skip (pricier variant, exclusive at markup, known KO target).
   - Market-briefing cross-link: hallOfFame reissueRadar notes from
     data/encyclopedia.json annotate matched picks.
   - Pre-order cross-link: figures matching a live preorder/available item
     in data/preorders.json are flagged "pre-orderable now".
   Pure ranking logic is exported for the test suite (tests/test-gift.js);
   page wiring lives in main() at the bottom. */
import { PATHS, STORE_KEYS } from "./config.js";
import { loadData } from "./data.js";
import { load } from "./store.js";
import { escapeHtml, badgeFor } from "./figure-dialog.js";
import { researchLinks } from "./listings.js";
import { trackerButtons } from "./tracker.js";
import { koNoteFor } from "./ko-targets.js";
import { journalPriceMap } from "./baf-planner.js";

/* ------------------------------------------------------------------ */
/* Recipient profiles — scoring weights over archive signals. */

export const RECIPIENTS = {
  kid: {
    label: "a kid",
    blurb: "Recent, recognizable, retail-easy — play over provenance.",
    weights: { recent: 6, standard: 6, bafPiece: 4, exclusive: -10, variant: -5, chase: -4, retro: 1, toyBiz: -8, ko: -8 },
  },
  casual: {
    label: "a casual fan",
    blurb: "Recent releases of the character they love — no hunting required.",
    weights: { recent: 4, standard: 3, bafPiece: 3, exclusive: 0, variant: 0, chase: 0, retro: 1, toyBiz: -4, ko: -6 },
  },
  collector: {
    label: "a collector",
    blurb: "Rarity signals first — exclusives, variants, chases, shelf centerpieces.",
    weights: { recent: 1, standard: -2, bafPiece: 4, exclusive: 8, variant: 6, chase: 8, retro: 5, toyBiz: 5, ko: -4 },
  },
};

/* Team matching — matched against figure NAME + wave SERIES text, labeled as
   a keyword match. Exported for tests. */
export const TEAMS = {
  "X-Men": ["x-men", "mutant"],
  "Avengers": ["avenger", "a-force"],
  "Spider-Man": ["spider-man", "spider man", "spider-verse", "venom", "carnage"],
  "Fantastic Four": ["fantastic four", "doom", "galactus", "silver surfer"],
  "Guardians of the Galaxy": ["guardians", "star-lord", "groot", "rocket raccoon", "drax"],
  "Deadpool": ["deadpool"],
};

export function teamKeysFor(input) {
  const q = String(input ?? "").trim().toLowerCase();
  if (!q) return [];
  for (const [team, keys] of Object.entries(TEAMS)) {
    if (team.toLowerCase() === q || keys.includes(q)) return keys;
  }
  return [];
}

function isChaseFig(fig) {
  return /chase/i.test(`${fig.notes ?? ""} ${fig.variant ?? ""}`);
}

function isRetroFig(fig) {
  return /retro/i.test(`${fig.notes ?? ""} ${fig.variant ?? ""}`);
}

export function baseName(n) {
  return String(n ?? "").replace(/\s*\(.*?\)\s*/g, "").trim().toLowerCase();
}

/* Budget band → allowed figure types. Honest proxy, labeled as such. */
export function bandAllows(band, fig) {
  const isStandard = !fig.exclusive && !fig.variant;
  if (band === "under25") return isStandard;
  return true; // under50 + splurge allow everything
}

/* Figure-type price tier — a class, never a price. Exported for tests. */
export function priceTier(fig) {
  const ex = fig.exclusive ?? "";
  if (ex === "HasLab" || ex === "Made-to-order") {
    return { tier: 4, label: "Made-to-order tier — the dearest class" };
  }
  if (ex === "Box set exclusive") {
    return { tier: 2, label: "Box set tier — multi-pack value" };
  }
  if (ex) return { tier: 3, label: `Exclusive tier — ${ex}, above retail` };
  if (fig.variant) return { tier: 3, label: `Variant tier — “${fig.variant}”, above retail` };
  const series = fig.waveSeries ?? "";
  if (/^(box set|2-packs?|3-packs?)\b/i.test(series) || /\bdeluxe\b/i.test(series)) {
    return { tier: 2, label: "Multi-pack tier — more plastic per dollar" };
  }
  return { tier: 1, label: "Standard single — the retail class" };
}

/* scoreGift(fig, ctx) — pure ranking score from archive signals.
   ctx: { charQ, teamKeys, recipient }. Exported for tests. */
export function scoreGift(fig, { charQ = "", teamKeys = [], recipient = "casual" } = {}) {
  const w = (RECIPIENTS[recipient] ?? RECIPIENTS.casual).weights;
  let s = 0;
  const base = baseName(fig.name);
  if (charQ) {
    if (base.startsWith(charQ)) s += 50;
    else if (base.includes(charQ)) s += 20;
    else if (fig.name.toLowerCase().includes(charQ)) s += 10;
  }
  if (teamKeys.length) {
    const hay = `${fig.name} ${fig.waveSeries}`.toLowerCase();
    if (teamKeys.some((k) => hay.includes(k))) s += 15;
  }
  if (fig.year >= 2024) s += w.recent;
  else if (fig.year >= 2020) s += Math.max(0, w.recent - 3);
  if (!fig.exclusive && !fig.variant) s += w.standard;
  if (fig.exclusive) s += w.exclusive;
  if (fig.variant) s += w.variant;
  if (isChaseFig(fig)) s += w.chase;
  if (isRetroFig(fig)) s += w.retro;
  if (fig.bafPiece) s += w.bafPiece;
  if (fig.manufacturer === "Toy Biz") s += w.toyBiz;
  if (koNoteFor(fig.name)) s += w.ko;
  return s;
}

/* rankGifts(figures, opts) — filter then score-sort. opts: band, charQ,
   recipient, ownedIds, hideOwned, source. Exported for tests. */
export function rankGifts(figures, {
  band = "under50", charQ = "", recipient = "casual",
  ownedIds = new Set(), hideOwned = false, source = "all",
} = {}) {
  const teamKeys = teamKeysFor(charQ);
  const q = charQ.trim().toLowerCase();
  const pool = figures.filter((f) => {
    if (!bandAllows(band, f)) return false;
    if (source !== "all" && (f.source ?? "unclassified") !== source) return false;
    if (hideOwned && ownedIds.has(f.id)) return false;
    if (teamKeys.length) {
      const hay = `${f.name} ${f.waveSeries}`.toLowerCase();
      if (!teamKeys.some((k) => hay.includes(k))) return false;
    } else if (q) {
      if (!(baseName(f.name).includes(q) || f.name.toLowerCase().includes(q))) return false;
    }
    return true;
  });
  const scored = pool.map((f) => ({
    fig: f,
    score: scoreGift(f, { charQ: teamKeys.length ? "" : q, teamKeys, recipient }),
  }));
  scored.sort((a, b) =>
    b.score - a.score || b.fig.year - a.fig.year || a.fig.name.localeCompare(b.fig.name));
  return scored;
}

/* notThat(fig, poolFigs) — same-character alternate to SKIP: a pricier
   variant, an exclusive at markup, or a known KO target. Returns
   { fig, reason } | null. Exported for tests. */
export function notThat(fig, poolFigs) {
  const base = baseName(fig.name);
  if (!base) return null;
  const alts = poolFigs.filter(
    (f) => f.id !== fig.id && baseName(f.name) === base);
  if (!alts.length) return null;
  const that = alts.find((f) => koNoteFor(f.name))
    ?? alts.find((f) => (f.exclusive || f.variant) && !(fig.exclusive || fig.variant))
    ?? null;
  if (!that) return null;
  if (koNoteFor(that.name)) {
    return { fig: that, reason: "known KO target — buy the standard at retail, not a marketplace copy" };
  }
  if (that.exclusive) return { fig: that, reason: `skip the ${that.exclusive} at a premium` };
  if (that.variant) return { fig: that, reason: `skip the “${that.variant}” variant at markup` };
  return null;
}

/* URL params for prefilled links (holiday guide): ?budget=&for=&character=. */
export function prefillFromParams(search) {
  const p = new URLSearchParams(search ?? "");
  const budget = ["under25", "under50", "splurge"].includes(p.get("budget")) ? p.get("budget") : "under50";
  const recipient = Object.keys(RECIPIENTS).includes(p.get("for")) ? p.get("for") : "casual";
  const character = (p.get("character") ?? "").slice(0, 60);
  return { budget, recipient, character };
}

/* Market-briefing cross-link: hallOfFame reissueRadar notes keyed by base
   name (parens stripped, lowercased). Exported for tests. */
export function hofMap(entries) {
  const m = new Map();
  for (const e of entries ?? []) {
    const key = baseName(e.name ?? "");
    if (key && !m.has(key)) m.set(key, e);
  }
  return m;
}

export function marketNote(fig, map) {
  const e = map.get(baseName(fig.name));
  const level = e?.reissueRadar?.level;
  if (level === "vulnerable") {
    return "Market briefing: this premium is vulnerable to reissues — don't pay over retail.";
  }
  if (level === "resilient") {
    return "Market briefing: true-rarity premium — reissues don't touch this one.";
  }
  return null;
}

/* findPreorder(fig, items) — a preorder/available preorders.json item whose
   name+details mention every token of the figure's base name. Exported for
   tests. */
export function findPreorder(fig, items) {
  const toks = baseName(fig.name).split(/[^a-z0-9']+/).filter((t) => t.length >= 3);
  if (!toks.length) return null;
  for (const it of items ?? []) {
    if (it.status !== "preorder" && it.status !== "available") continue;
    const hay = `${it.name ?? ""} ${it.details ?? ""}`.toLowerCase();
    if (toks.every((t) => hay.includes(t))) return it;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Page wiring. */

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

function recipient() {
  const checked = document.querySelector('input[name="g-for"]:checked');
  const v = checked?.value;
  return Object.keys(RECIPIENTS).includes(v) ? v : "casual";
}

function whyLine(fig, recip) {
  const bits = [];
  if (recip === "kid") {
    if (!fig.exclusive && !fig.variant) bits.push("Standard mainline single — easy to find at retail, built for play.");
    else if (fig.variant) bits.push("A variant — fine for play, but the standard is the cheaper gift.");
    else bits.push(`${fig.exclusive} — harder to find; check availability before promising it.`);
  } else if (recip === "collector") {
    if (fig.exclusive) bits.push(`${fig.exclusive} exclusive — the shelf-centerpiece class.`);
    else if (fig.variant) bits.push(`Variant (“${fig.variant}”) — for the collector who has everything.`);
    else if (isChaseFig(fig)) bits.push("Archive-flagged chase — genuinely scarce.");
    else bits.push("Standard release — the affordable way in.");
  } else if (fig.exclusive) {
    bits.push(`${fig.exclusive} exclusive — harder to find, feels special.`);
  } else if (fig.variant) {
    bits.push(`Variant (“${fig.variant}”) — for the fan who has everything.`);
  } else {
    bits.push("Standard mainline single — the affordable way in.");
  }
  if (fig.bafPiece) bits.push("Includes a Build-A-Figure piece — two gifts in one.");
  if (fig.year >= 2024) bits.push("Recent release — easier to find at retail.");
  return bits.join(" ");
}

function giftCard(fig, { poolFigs, hof, preorders, journalPrices }) {
  const card = document.createElement("article");
  card.className = "card gift-card";
  card.style.padding = "var(--space-4)";
  const links = researchLinks(fig);
  const sold = links.find((l) => l.id === "ebay-sold");
  const yt = links.find((l) => l.id === "youtube");
  const tier = priceTier(fig);
  const ko = koNoteFor(fig.name);
  const market = marketNote(fig, hof);
  const pre = findPreorder(fig, preorders);
  const logged = journalPrices.get(fig.id);
  const alt = notThat(fig, poolFigs);
  const recip = recipient();

  const extra = [];
  extra.push(`<p class="gift-why">💰 ${escapeHtml(tier.label)}.${logged != null ? ` Your journal logs a sale at <strong>$${logged.toFixed(2)}</strong>.` : ""}</p>`);
  if (ko) {
    extra.push(`<p class="gift-ko"><strong>⚠️ KO risk:</strong> ${escapeHtml(ko.note)} <a href="auth-wizard.html">Run the Auth Wizard</a> <span class="muted">(${escapeHtml(ko.source)})</span></p>`);
  }
  if (market) extra.push(`<p class="gift-why">📈 ${escapeHtml(market)}</p>`);
  if (pre) {
    const msrp = typeof pre.price === "number" ? ` — announced MSRP $${pre.price.toFixed(2)}` : "";
    extra.push(`<p class="gift-why">🎁 Pre-orderable now: <strong>${escapeHtml(pre.name)}</strong>${msrp}. See the <a href="preorders.html">pre-order tracker</a>.</p>`);
  }
  if (alt) {
    extra.push(`<p class="gift-notthat"><strong>Buy this, not that:</strong> skip the <em>${escapeHtml(alt.fig.name)}</em> — ${escapeHtml(alt.reason)}.</p>`);
  }

  card.innerHTML = `
    <div class="entry-head">
      <span class="entry-name">${escapeHtml(fig.name)}</span>
      <span class="entry-wave">${escapeHtml(fig.waveSeries)} (${fig.year})</span>
    </div>
    <div class="tag-row">${badgeFor(fig)}</div>
    <p class="gift-why">${escapeHtml(whyLine(fig, recip))}</p>
    ${extra.join("")}
    <div class="btn-row" style="margin-top:var(--space-1)">
      <a class="btn btn-sm" href="${sold.href}" target="_blank" rel="noopener noreferrer">Check eBay solds ↗</a>
      <a class="btn btn-sm btn-ghost" href="${yt.href}" target="_blank" rel="noopener noreferrer">YouTube reviews ↗</a>
    </div>`;
  card.appendChild(trackerButtons(fig.id));
  return card;
}

async function main() {
  let figures = [];
  let hof = new Map();
  let preorders = [];
  try {
    ({ figures } = await loadData());
  } catch {
    els.empty.innerHTML = `<h2>Couldn't load the archive</h2><p>Check your connection and reload.</p>`;
    els.empty.hidden = false;
    return;
  }
  try {
    const res = await fetch("data/encyclopedia.json");
    if (res.ok) hof = hofMap((await res.json()).hallOfFame);
  } catch { /* market notes are a nicety */ }
  try {
    const res = await fetch(PATHS.preorders);
    if (res.ok) preorders = (await res.json()).items ?? [];
  } catch { /* pre-order flags are a nicety */ }

  /* Character + team datalist: teams first, then manifest names. */
  try {
    const res = await fetch("characters/manifest.json");
    if (res.ok) {
      const manifest = await res.json();
      const frag = document.createDocumentFragment();
      const seen = new Set();
      for (const t of Object.keys(TEAMS)) {
        const opt = document.createElement("option");
        opt.value = `${t} (team)`;
        frag.appendChild(opt);
        seen.add(t.toLowerCase());
      }
      for (const c of manifest) {
        if (seen.has(c.name.toLowerCase())) continue;
        seen.add(c.name.toLowerCase());
        const opt = document.createElement("option");
        opt.value = c.name;
        frag.appendChild(opt);
      }
      els.characters.appendChild(frag);
    }
  } catch { /* datalist is a nicety */ }

  /* Prefill from URL params (holiday guide links). */
  const pre = prefillFromParams(location.search);
  els.budget.value = pre.budget;
  const radio = document.querySelector(`input[name="g-for"][value="${pre.recipient}"]`);
  if (radio) radio.checked = true;
  if (pre.character) els.character.value = pre.character;

  const journalPrices = journalPriceMap();

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const band = els.budget.value;
    const charQ = els.character.value.replace(/\s*\(team\)\s*$/i, "").trim();
    const source = els.source.value;
    const hideOwned = els.hideOwned.checked;
    const recip = recipient();
    const ownedIds = new Set(load(STORE_KEYS.owned, []));

    const scored = rankGifts(figures, {
      band, charQ, recipient: recip, ownedIds, hideOwned, source,
    });
    const picks = scored.slice(0, 12);
    const poolFigs = scored.slice(0, 60).map((s) => s.fig);

    els.empty.hidden = picks.length > 0;
    els.results.innerHTML = "";
    const rLabel = RECIPIENTS[recip].label;
    els.heading.textContent = picks.length
      ? `Suggestions for ${rLabel} (${picks.length})`
      : "Suggestions";
    if (!picks.length) {
      els.empty.hidden = false;
      els.empty.innerHTML = charQ
        ? `<h2>No matches</h2><p>Nothing in the archive matches “${escapeHtml(els.character.value.trim())}” under these filters. Try a shorter name, a team (e.g. X-Men), a different universe, or a bigger budget.</p>`
        : `<h2>No matches</h2><p>Nothing passed those filters. Loosen the budget or universe and try again.</p>`;
      return;
    }
    const frag = document.createDocumentFragment();
    for (const { fig } of picks) {
      frag.appendChild(giftCard(fig, { poolFigs, hof, preorders, journalPrices }));
    }
    els.results.appendChild(frag);
  });

  /* Auto-run when prefilled from a link (e.g. the holiday guide). */
  if (new URLSearchParams(location.search).size > 0) {
    els.form.requestSubmit();
  }
}

main();
