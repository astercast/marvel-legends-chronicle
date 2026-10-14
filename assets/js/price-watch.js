/* price-watch.js, pure Price Watch logic: compare a user's target price
   against the Chronicle's reported market signals. No DOM, no storage,
   no fetch: callers supply the watchlist entries and the signals array
   (from data/price-signals.json or data/v1/price-signals.json). Every
   number shown traces to a reported listing/sold, never scraped, never
   invented. "Reported ranges, not live prices." */

export function money(n) {
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/* All reported signals for a figure id (a figure can carry more than one,
   e.g. the white vs green Epic Heroes Doom decos). */
export function signalForFigure(figId, signals) {
  if (!figId || !Array.isArray(signals)) return [];
  return signals.filter((s) => s && s.figId === figId);
}

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/* The market verdict for one signal against one user target.
   Returns { status, delta, low, high } where status is one of:
   - "no-target": the user hasn't set a target yet
   - "no-data": no reported signal for this figure
   - "in-range": target sits inside (or at/under) the reported band
   - "above": the cheapest reported price is above the target (delta = low - target)
   - "below": the top of the reported band is under the target (delta = target - high) */
export function watchVerdict(signal, target) {
  const t = num(target);
  if (t === null) return { status: "no-target", delta: null, low: null, high: null };
  const low = num(signal?.low);
  const high = num(signal?.high);
  if (low === null) return { status: "no-data", delta: null, low: null, high: null };
  const hi = high === null ? low : high;
  if (t >= low && t <= hi) return { status: "in-range", delta: 0, low, high: hi };
  if (t < low) return { status: "above", delta: low - t, low, high: hi };
  return { status: "below", delta: t - hi, low, high: hi };
}

/* How close the user's target is to the reported market: target/low,
   capped at 1 (1 = the target covers the cheapest reported price).
   Used to weight Grail Quest recommendations, never presented as a price. */
export function closenessToTarget(signal, target) {
  const t = num(target);
  const low = num(signal?.low);
  if (t === null || low === null || low === 0) return null;
  return Math.min(t / low, 1);
}

/* Rank the user's watched figures as quest hunts: unwatched-owned figures
   are excluded; entries with a reported signal sort by closeness to target
   (closest first), entries without data keep their order at the end.
   Returns [{ entry, signals, best, verdict, closeness }]. */
export function rankWatchHunts(entries, ownedIds, signals) {
  const owned = new Set(Array.isArray(ownedIds) ? ownedIds : []);
  const list = (Array.isArray(entries) ? entries : [])
    .filter((e) => e && e.figId && !owned.has(e.figId));
  const ranked = list.map((entry) => {
    const sigs = signalForFigure(entry.figId, signals);
    const scored = sigs.map((s) => ({
      signal: s,
      verdict: watchVerdict(s, entry.target),
      closeness: closenessToTarget(s, entry.target),
    }));
    const best = scored
      .filter((x) => x.closeness !== null)
      .sort((a, b) => b.closeness - a.closeness)[0] ?? scored[0] ?? null;
    return {
      entry,
      signals: sigs,
      best,
      verdict: best?.verdict ?? { status: sigs.length ? "no-target" : "no-data", delta: null, low: null, high: null },
      closeness: best?.closeness ?? null,
    };
  });
  ranked.sort((a, b) => {
    const ac = a.closeness ?? -1, bc = b.closeness ?? -1;
    return bc - ac;
  });
  return ranked;
}

/* One-line verdict copy, plain words for the page. */
export function verdictLine(verdict) {
  switch (verdict.status) {
    case "in-range": return "Your target sits inside the reported range.";
    case "above": return `Cheapest reported ${money(verdict.low)}, ${money(verdict.delta)} above your target.`;
    case "below": return `Top of the reported range is ${money(verdict.delta)} under your target, patience could pay off.`;
    case "no-target": return "Set a target price to get a verdict.";
    default: return "No reported market data for this figure yet.";
  }
}

/* Plain-text export of the watchlist for forums/Discord, targets and
   reported ranges only, no live prices claimed. */
export function shareWatchlistText(entries, signals) {
  const lines = ["My Price Watch: Marvel Legends Chronicle", "Reported ranges, not live prices.", ""];
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) {
    lines.push("Watchlist is empty, add figures on the Watchlist page.");
    return lines.join("\n");
  }
  for (const e of list) {
    const sigs = signalForFigure(e.figId, signals);
    const target = num(e.target) !== null ? money(e.target) : "no target set";
    const band = sigs.length
      ? sigs.map((s) => `${s.label}: ${s.display}`).join("; ")
      : "no reported market data";
    lines.push(`• ${e.name ?? e.figId}, target ${target} | reported: ${band}`);
  }
  return lines.join("\n");
}
