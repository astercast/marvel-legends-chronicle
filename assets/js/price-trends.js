/* Per-figure price trends, computed from the user's OWN journal entries
   (mlc_journal_v1). Never a market index: every number traces to a sale the
   user logged. Figures need 3+ dated entries before a trend is shown. */
import { escapeHtml } from "./figure-dialog.js";

/* Match journal entries to a figure: figId first, then case-insensitive
   name fallback (same matching the journal's value table uses). */
export function entriesForFigure(entries, figId, figName) {
  const name = String(figName ?? "").toLowerCase();
  return entries.filter((e) =>
    (e.figId && e.figId === figId) ||
    (!e.figId && String(e.name ?? "").toLowerCase() === name));
}

/* Trend from dated entries, oldest → newest.
   Compares the median of the earliest third to the median of the latest
   third; |change| < 10% counts as stable. */
export function trendStats(entries) {
  const dated = entries
    .filter((e) => e && Number.isFinite(Number(e.price)) && Number(e.price) > 0 && e.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (dated.length < 3) return null;
  const med = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  const third = Math.max(1, Math.floor(dated.length / 3));
  const first = med(dated.slice(0, third).map((e) => Number(e.price)));
  const last = med(dated.slice(-third).map((e) => Number(e.price)));
  if (!(first > 0)) return null;
  const changePct = ((last - first) / first) * 100;
  const direction = changePct >= 10 ? "up" : changePct <= -10 ? "down" : "stable";
  return {
    n: dated.length,
    first, last, changePct, direction,
    from: dated[0].date, to: dated[dated.length - 1].date,
  };
}

/* SVG price-over-time sparkline. Accessible: role="img" + <title>. */
export function sparklineSVG(entries, { width = 160, height = 44 } = {}) {
  const dated = entries
    .filter((e) => e && Number.isFinite(Number(e.price)) && Number(e.price) > 0 && e.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (dated.length < 2) return "";
  const prices = dated.map((e) => Number(e.price));
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const span = hi - lo || 1;
  const pad = 4;
  const xs = dated.map((_, i) => pad + (i / (dated.length - 1)) * (width - pad * 2));
  const ys = prices.map((p) => pad + (1 - (p - lo) / span) * (height - pad * 2));
  const pts = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const money = (n) => "$" + n.toFixed(n < 10 ? 2 : 0);
  return `<svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Price trend sparkline">
    <title>Sold prices from ${money(lo)} to ${money(hi)} across ${dated.length} logged sales</title>
    <polyline points="${pts}" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${xs.map((x, i) => `<circle cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="2.4" fill="var(--gold)"><title>${escapeHtml(String(dated[i].date))}: ${money(prices[i])}</title></circle>`).join("")}
  </svg>`;
}

export function directionBadge(direction) {
  const label = { up: "Trending up", down: "Trending down", stable: "Stable" }[direction] ?? direction;
  const arrow = { up: "▲", down: "▼", stable: "●" }[direction] ?? "";
  return `<span class="badge badge-trend-${direction}">${arrow} ${label}</span>`;
}
