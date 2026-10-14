/* "Milestone anniversaries" strip for the timeline.
   The archive records release years only (no month/day), so this surfaces
   waves celebrating round-number anniversaries this year, rotating the
   selection weekly. Nothing is presented as a release date. */
import { PATHS } from "./config.js";

const MILESTONES = [5, 10, 15, 20, 25];

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function main() {
  const mount = document.getElementById("history-strip");
  if (!mount) return;
  let waves;
  try {
    const res = await fetch(PATHS.figures);
    if (!res.ok) throw new Error("fetch failed");
    waves = (await res.json()).waves ?? [];
  } catch {
    return; // fail silently, the strip is decorative
  }
  const year = new Date().getFullYear();
  const picks = waves
    .filter((w) => MILESTONES.includes(year - w.year))
    .map((w) => ({ ...w, ago: year - w.year }))
    .sort((a, b) => b.ago - a.ago || a.series.localeCompare(b.series));
  if (!picks.length) return;

  const week = isoWeek(new Date());
  const shown = [];
  for (let i = 0; i < Math.min(3, picks.length); i++) {
    shown.push(picks[(week + i) % picks.length]);
  }
  mount.innerHTML = `
    <div class="container history-inner">
      <span class="history-kicker" aria-hidden="true">⏳</span>
      <p><strong>Milestone anniversaries:</strong> ${shown.map((w) =>
        `<span class="history-item"><strong>${w.ago} years ago</strong>, ${esc(w.series)} (${w.year}) · ${esc(w.manufacturer)}</span>`
      ).join('<span class="history-sep" aria-hidden="true"> · </span>')}
      <span class="history-note">Waves are dated by release year in the archive.</span></p>
    </div>`;
  mount.hidden = false;
}

main();
