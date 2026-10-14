/* Retro line browser, retro-carded figures identified from the archive's
   own figure notes. Retro status is never guessed: a figure is listed only
   when its notes or variant text mentions "retro". Line tags are parsed from
   the note text with ordered patterns; anything unmatched lands in
   "Other retro releases" rather than being forced into a line. */
import { PATHS } from "./config.js";
import { loadData } from "./data.js";
import { escapeHtml } from "./figure-dialog.js";
import { trackerButtons, owned, wanted } from "./tracker.js";
import { renderResearchLinks } from "./listings.js";

const LINE_PATTERNS = [
  [/marvel retro (x-men|avengers|fantastic four|iron man|secret wars|spider-man)(?: wave \d+)?/i,
    (m) => `Marvel Retro ${m[1].replace(/\b\w/g, (c) => c.toUpperCase())}`],
  [/marvel retro wave (\d+)/i, (m) => `Marvel Retro Wave ${m[1]}`],
  [/retro fan channel (\d{4})/i, (m) => `Retro fan channel ${m[1]}`],
  [/retro card (\d{4})/i, (m) => `Retro card ${m[1]}`],
  [/retro single(?: (\d{4}))?/i, (m) => (m[1] ? `Retro singles ${m[1]}` : "Retro singles")],
];

function retroLineOf(fig) {
  const blob = `${fig.notes ?? ""} ${fig.variant ?? ""}`;
  if (!/retro/i.test(blob)) return null;
  for (const [re, tag] of LINE_PATTERNS) {
    const m = blob.match(re);
    if (m) return tag(m);
  }
  return "Other retro releases";
}

const els = {
  chips: document.getElementById("retro-chips"),
  search: document.getElementById("retro-search"),
  count: document.getElementById("retro-count"),
  grid: document.getElementById("retro-grid"),
  empty: document.getElementById("retro-empty"),
  coverage: document.getElementById("retro-coverage"),
};

let allRetro = [];
let activeLine = "all";

function card(fig) {
  const art = document.createElement("article");
  art.className = "card retro-card";
  art.dataset.figId = fig.id;
  const dots = owned.has(fig.id)
    ? `<span class="owned-dot" aria-hidden="true"></span>`
    : wanted.has(fig.id) ? `<span class="wanted-dot" aria-hidden="true"></span>` : "";
  art.innerHTML = `
    <h3>${escapeHtml(fig.name)}${dots}</h3>
    <div class="sub">${escapeHtml(fig.waveSeries)} · ${fig.year} · ${escapeHtml(fig.manufacturer)}</div>
    <div class="line-tag">${escapeHtml(fig.retroLine)}</div>
    <div class="tag-row">
      ${fig.variant ? `<span class="badge badge-variant">${escapeHtml(fig.variant)}</span>` : ""}
      ${fig.exclusive ? `<span class="badge badge-exclusive">${escapeHtml(fig.exclusive)}</span>` : ""}
      ${fig.waveBaf ? `<span class="badge">BAF: ${escapeHtml(fig.waveBaf)}</span>` : ""}
    </div>
    ${fig.notes ? `<p class="chart-sub" style="margin-top:var(--space-2)">${escapeHtml(fig.notes)}</p>` : ""}`;
  art.appendChild(trackerButtons(fig.id));
  const det = document.createElement("details");
  det.className = "research";
  const sum = document.createElement("summary");
  sum.textContent = "Research this figure";
  det.appendChild(sum);
  det.appendChild(renderResearchLinks(fig));
  art.appendChild(det);
  return art;
}

function render() {
  const q = els.search.value.trim().toLowerCase();
  let list = allRetro.filter((f) => activeLine === "all" || f.retroLine === activeLine);
  if (q.length >= 2) {
    list = list.filter((f) =>
      f.name.toLowerCase().includes(q) ||
      f.waveSeries.toLowerCase().includes(q) ||
      (f.variant ?? "").toLowerCase().includes(q));
  }
  els.count.textContent = `${list.length} of ${allRetro.length} retro figures`;
  els.empty.hidden = list.length > 0;
  els.grid.innerHTML = "";
  const frag = document.createDocumentFragment();
  const CAP = 400;
  for (const f of list.slice(0, CAP)) frag.appendChild(card(f));
  els.grid.appendChild(frag);
  if (list.length > CAP) {
    const more = document.createElement("p");
    more.className = "chart-sub";
    more.textContent = `Showing the first ${CAP} of ${list.length}, narrow the search or pick a line.`;
    els.grid.appendChild(more);
  }
  els.chips.querySelectorAll("[data-line]").forEach((c) => {
    const on = c.dataset.line === activeLine;
    c.classList.toggle("chip-on", on);
    c.setAttribute("aria-pressed", String(on));
  });
}

async function main() {
  let figures = [];
  try {
    ({ figures } = await loadData());
  } catch {
    els.grid.innerHTML = `<div class="empty-state"><p>Could not load the figure archive.</p></div>`;
    return;
  }
  allRetro = figures
    .map((f) => ({ ...f, retroLine: retroLineOf(f) }))
    .filter((f) => f.retroLine)
    .sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));

  const byLine = new Map();
  for (const f of allRetro) byLine.set(f.retroLine, (byLine.get(f.retroLine) ?? 0) + 1);
  const lines = [...byLine.entries()].sort((a, b) => b[1] - a[1]);

  els.coverage.innerHTML =
    `<strong>${allRetro.length}</strong> retro-carded figures identified from the archive's own notes · ` +
    `<strong>${lines.length}</strong> retro lines. ` +
    `Retro status is never guessed, figures without a retro note aren't listed. ` +
    `Era context: <a href="encyclopedia.html#packaging">encyclopedia → packaging guide</a>.`;

  const frag = document.createDocumentFragment();
  const mkChip = (line, n, label) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.dataset.line = line;
    b.setAttribute("aria-pressed", line === "all" ? "true" : "false");
    b.innerHTML = `${escapeHtml(label)} <span class="chip-n">${n}</span>`;
    b.addEventListener("click", () => { activeLine = line; render(); });
    return b;
  };
  frag.appendChild(mkChip("all", allRetro.length, "All retro lines"));
  for (const [line, n] of lines) frag.appendChild(mkChip(line, n, line));
  els.chips.appendChild(frag);

  let debounce;
  els.search.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(render, 180);
  });

  render();
}

main();
