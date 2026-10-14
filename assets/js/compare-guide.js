/* VS-mode compare logic, pure functions, zero DOM. Shared by compare.js and the
   test suite. Data-grounded: every bullet cites the archive field that produced
   it. No invented figures, dates, or prices, and no winner is ever declared.

   Anchor algorithm MUST stay in parity with scripts/compare_lib.py wave_anchors:
   tests/test-compare.js recomputes anchors from the real data and asserts they
   match data/v1/compare.json's deepLinks. */

"use strict";

const PARAM_KEYS = ["a", "b", "c", "d"];
export const MAX_SLOTS = 4;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* parseCompareParams("?a=<id>&b=<id>") -> [ids], max 4, deduped, order-kept.
   Unknown ids are NOT filtered here, resolution happens against the archive. */
export function parseCompareParams(search) {
  const out = [];
  try {
    const params = new URLSearchParams(String(search ?? "").replace(/^[?#]/, ""));
    for (const k of PARAM_KEYS) {
      const v = (params.get(k) ?? "").trim();
      if (v && !out.includes(v)) out.push(v);
      if (out.length >= MAX_SLOTS) break;
    }
  } catch {
    /* malformed query, no params */
  }
  return out;
}

/* buildCompareUrl([ids]) -> "compare.html?a=<enc>&b=<enc>" (shareable deep link). */
export function buildCompareUrl(ids) {
  const parts = (ids ?? []).slice(0, MAX_SLOTS).map((id, i) =>
    `${PARAM_KEYS[i]}=${encodeURIComponent(id)}`);
  return `compare.html${parts.length ? `?${parts.join("&")}` : ""}`;
}

function slug(s) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/* waveAnchors([{name, variant}]) -> [anchorIds], one per figure in wave order.
   Parity with scripts/compare_lib.py: fig-<slug(name)>, disambiguated by variant
   slug (or 1-based index) when a name repeats inside one wave. */
export function waveAnchors(figs) {
  const seen = {};
  const anchors = new Array(figs.length);
  figs.forEach((f, i) => {
    const base = `fig-${slug(f.name)}`;
    const n = (seen[base] ?? 0) + 1;
    seen[base] = n;
    if (n === 1) {
      anchors[i] = base;
    } else {
      anchors[i] = `${base}-${slug(f.variant) || String(n)}`;
    }
  });
  figs.forEach((f, i) => {
    const base = `fig-${slug(f.name)}`;
    if (seen[base] > 1 && anchors[i] === base) {
      anchors[i] = `${base}-${slug(f.variant) || "1"}`;
    }
  });
  return anchors;
}

/* reviewSearchUrl(name, variant) -> YouTube review-search URL (same pattern as
   the wave pages' research affordance, never a scraped or invented review). */
export function reviewSearchUrl(name, variant) {
  const q = ["Marvel Legends", name, variant].filter(Boolean).join(" ") + " review";
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

/* Honest upgrade-path trade-off notes, generated from the relation, the API
   stores the relation only (see data/v1/schema/compare-profile.json). */
export function upgradeNote(path) {
  const label = path.variant ? ` (${path.variant})`
    : path.exclusive ? ` (${path.exclusive} exclusive)` : "";
  switch (path.relation) {
    case "variant":
      return `Documented variant${label}, variants are the scarcer release and usually price higher; the base release is the documented budget path.`;
    case "base-release":
      return `Documented base release, usually the cheaper path to this character on your shelf.`;
    case "reissue":
      return `Documented reissue, reissues usually undercut the original aftermarket; originals keep a premium only when the value driver is rarity or provenance.`;
    case "exclusive":
      return `Documented exclusive${label}, exclusives often carry an aftermarket premium.`;
    default:
      return `Another documented release of this character${label}.`;
  }
}

function money(n) {
  return Number.isFinite(Number(n)) ? `$${Number(n).toLocaleString("en-US")}` : "n/a";
}

function kindLabel(kind) {
  return { "sold-band": "sold band", "sold-avg": "sold average", listing: "listing", claimed: "claimed price" }[kind] ?? kind;
}

/* guidanceFor(figs, profById) -> [{kind, html}], "which to buy" guidance,
   grounded in the data. figs: archive figure objects; profById: compare.json
   profiles keyed by figure id. Every bullet names its evidence; the last bullet
   always declines to declare a winner. */
export function guidanceFor(figs, profById) {
  const out = [];
  const prof = (f) => profById.get(f.id) ?? null;

  /* --- reported price bands --- */
  const withSignals = figs.map((f) => ({ f, p: prof(f) }))
    .filter(({ p }) => p && (p.priceSignals ?? []).length);
  if (withSignals.length >= 2) {
    const lines = withSignals.map(({ f, p }) => {
      const s = p.priceSignals[0];
      const band = s.high != null && s.high !== s.low
        ? `${money(s.low)}–${money(s.high)}` : s.display;
      return `<strong>${esc(f.name)}</strong> (${esc(f.waveSeries)}, ${f.year}): ` +
        `${esc(band)}, ${esc(kindLabel(s.kind))}, ${esc(s.source)}` +
        (s.singleSource ? ` <span class="badge badge-flag">single source</span>` : "");
    });
    const lows = withSignals.map(({ p }) => p.priceSignals[0].low).filter((n) => Number.isFinite(n));
    let verdict = "";
    if (lows.length >= 2) {
      const lo = Math.min(...lows), hi = Math.max(...lows);
      const kinds = new Set(withSignals.map(({ p }) => p.priceSignals[0].kind));
      verdict = ` The lowest reported low sits ${money(hi - lo)} below the highest reported low.` +
        (kinds.size > 1 ? ` Kinds differ (${[...kinds].map(kindLabel).join(" vs ")}), so the bands are not directly comparable.` : "");
    }
    out.push({
      kind: "price",
      html: `Reported bands, ${lines.join(" · ")}.${verdict} Reported ranges, not live prices.`,
    });
  } else if (withSignals.length === 1) {
    const { f, p } = withSignals[0];
    const s = p.priceSignals[0];
    out.push({
      kind: "price",
      html: `Only <strong>${esc(f.name)}</strong> carries a reported price signal ` +
        `(${esc(s.display)}, ${esc(kindLabel(s.kind))}, ${esc(s.source)}). ` +
        `No reported band for the other figure, check eBay solds before paying.`,
    });
  } else {
    out.push({
      kind: "price",
      html: `No reported price signals for these figures, the Chronicle publishes no price index. ` +
        `Check eBay sold listings for each before paying.`,
    });
  }

  /* --- rarity signals --- */
  for (const f of figs) {
    const p = prof(f);
    const r = p?.rarity;
    if (!r) continue;
    out.push({
      kind: "rarity",
      html: `<strong>${esc(f.name)}</strong> is a documented <a href="rarity.html#tier-${esc(r.tier)}">${esc(r.tierName)}</a> ` +
        `example, rarity ≠ value; read the tier's value note before paying a premium.` +
        (r.questAchievement ? ` Counts toward the <strong>${esc(r.questAchievement)}</strong> Grail Quest achievement.` : ""),
    });
  }

  /* --- KO watch --- */
  for (const f of figs) {
    const k = prof(f)?.koWatch;
    if (!k) continue;
    out.push({
      kind: "ko",
      html: `⚠️ <strong>${esc(f.name)}</strong>: ${esc(k.note)} ` +
        `<a href="auth-wizard.html">Run the Auth Wizard →</a> <span class="chart-sub">(${esc(k.source)})</span>`,
    });
  }

  /* --- variant vs base (same character) --- */
  const names = new Set(figs.map((f) => f.name));
  if (names.size === 1 && figs.length === 2) {
    const [a, b] = figs;
    const variantFig = a.variant && !b.variant ? a : b.variant && !a.variant ? b : null;
    if (variantFig) {
      const base = variantFig === a ? b : a;
      out.push({
        kind: "variant",
        html: `<strong>${esc(variantFig.name)}</strong> (${esc(variantFig.variant)}) is a documented variant of ` +
          `<strong>${esc(base.name)}</strong> (${esc(base.waveSeries)}, ${base.year}). Variants are the scarcer ` +
          `release and usually price higher, the base release is the documented budget path.`,
      });
    }
  }

  /* --- documented reissues in the upgrade paths --- */
  for (const f of figs) {
    const paths = prof(f)?.upgradePaths ?? [];
    if (paths.some((u) => u.relation === "reissue")) {
      out.push({
        kind: "reissue",
        html: `<strong>${esc(f.name)}</strong> has a documented reissue among its ${paths.length} recorded ` +
          `other releases, reissues usually undercut the original aftermarket; originals keep a premium ` +
          `only when the value driver is rarity or provenance.`,
      });
      break;
    }
  }

  /* --- honest close --- */
  out.push({
    kind: "close",
    html: `No winner declared, the rows above are the verdict. Articulation counts and accessory lists ` +
      `are not in the archive; sculpt and pack-in notes live in each figure's archive notes, and video ` +
      `reviews cover articulation.`,
  });
  return out;
}
