/* Atrium: the "On the desk this week" drop teaser on the homepage.
   Reads data/v1/drop-week.json, finds the next upcoming drop, and renders
   a live countdown. Static fallback (the section's own link) stays for
   no-JS readers and fetch failures — the teaser enhances, never gates. */
import { escapeHtml } from "./figure-dialog.js";

const MOUNT_ID = "desk-drop";

function pad(n) {
  return String(n).padStart(2, "0");
}

function tick(dropAt, els) {
  const ms = dropAt - Date.now();
  if (ms <= 0) {
    els.cd.innerHTML = '<span class="cd-num">Live</span>';
    els.meta.textContent = "The window is open — the command center has the battle plan.";
    return;
  }
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  els.cd.innerHTML =
    `<span class="cd-num">${d}</span><span class="cd-unit">days</span><span class="cd-sep" aria-hidden="true">·</span>` +
    `<span class="cd-num">${pad(h)}</span><span class="cd-unit">hrs</span><span class="cd-sep" aria-hidden="true">·</span>` +
    `<span class="cd-num">${pad(m)}</span><span class="cd-unit">min</span><span class="cd-sep" aria-hidden="true">·</span>` +
    `<span class="cd-num">${pad(s)}</span><span class="cd-unit">sec</span>`;
  els.sr.textContent = `Next drop in ${d} days, ${h} hours, ${m} minutes.`;
}

async function main() {
  const mount = document.getElementById(MOUNT_ID);
  if (!mount) return;
  let payload;
  try {
    const res = await fetch("data/v1/drop-week.json", { cache: "no-store" });
    if (!res.ok) return;
    payload = await res.json();
  } catch {
    return; // the static fallback card stays
  }
  const drops = (payload.drops || [])
    .map((d) => ({ ...d, at: d.windowAt ? Date.parse(d.windowAt) : NaN }))
    .filter((d) => Number.isFinite(d.at))
    .sort((a, b) => a.at - b.at);
  if (!drops.length) return;
  const now = Date.now();
  const next = drops.find((d) => d.at > now) || drops[drops.length - 1];

  const when = new Date(next.at).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
  const figs = (next.figures || []).slice(0, 3).map((f) => f.name).filter(Boolean);
  const price = next.price && next.price.kind === "msrp" ? ` · ${next.price.text.split("—")[0].trim()}` : "";

  mount.innerHTML = `
    <p class="desk-kicker">On the desk this week · ${escapeHtml(next.kindLabel || "Drop")}</p>
    <h2 class="desk-drop-name">${escapeHtml(next.title)}</h2>
    <p class="desk-drop-meta">${escapeHtml(when)}${figs.length ? ` — ${escapeHtml(figs.join(" · "))}` : ""}${escapeHtml(price)}</p>
    <div class="desk-countdown" id="desk-countdown" aria-hidden="true"></div>
    <p class="visually-hidden" role="status" id="desk-countdown-sr"></p>
    <p class="desk-cta"><a class="btn btn-seal" href="drop-week.html">Open the Drop Week Command Center</a></p>`;
  const els = {
    cd: mount.querySelector("#desk-countdown"),
    sr: mount.querySelector("#desk-countdown-sr"),
  };
  tick(next.at, els);
  setInterval(() => tick(next.at, els), 1000);
}

main();
