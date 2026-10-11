/* Printable checklist — renders mlc_owned_v1 / mlc_wanted_v1 as a paper-ready,
   wave-grouped checklist. Checkboxes sync with the shared tracker. */
import { loadData } from "./data.js";
import { escapeHtml } from "./figure-dialog.js";
import { owned, wanted } from "./tracker.js";

const els = {
  list: document.getElementById("checklist"),
  show: document.getElementById("c-show"),
  era: document.getElementById("c-era"),
  print: document.getElementById("c-print"),
  summary: document.getElementById("check-summary"),
  printDate: document.getElementById("print-date"),
};

function state() {
  return { show: els.show.value, era: els.era.value };
}

function visible(fig, s) {
  const isOwned = owned.has(fig.id);
  const isWanted = wanted.has(fig.id);
  if (s.show === "owned" && !isOwned) return false;
  if (s.show === "wanted" && !isWanted) return false;
  if (s.show === "missing" && (isOwned || isWanted)) return false;
  return true;
}

function itemRow(fig) {
  const isOwned = owned.has(fig.id);
  const isWanted = wanted.has(fig.id);
  const li = document.createElement("li");
  li.className = `check-item${isOwned ? " is-owned" : ""}${isWanted ? " is-wanted" : ""}`;

  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = isOwned;
  box.setAttribute("aria-label", `Owned: ${fig.name}${fig.variant ? `, ${fig.variant}` : ""}, ${fig.waveSeries} (${fig.year})`);
  box.addEventListener("change", () => {
    const nowOn = owned.toggle(fig.id);
    if (nowOn && wanted.has(fig.id)) wanted.toggle(fig.id); // mutually exclusive
    render(); // re-render keeps counts, filters, and wanted markers consistent
  });

  const meta = [fig.variant, fig.exclusive, fig.bafPiece ? `BAF: ${fig.bafPiece}` : null]
    .filter(Boolean)
    .join(" · ");
  const text = document.createElement("div");
  text.innerHTML = `<span class="nm">${escapeHtml(fig.name)}</span>${meta ? `<span class="meta">${escapeHtml(meta)}</span>` : ""}`;

  li.append(box, text);
  return li;
}

let lastFigures = [];
let lastWaves = [];

function render() {
  const s = state();
  els.list.innerHTML = "";
  let shown = 0;
  let ownedShown = 0;

  const years = [...new Set(lastWaves.map((w) => w.year))].sort((a, b) => a - b);
  for (const year of years) {
    const yearSection = document.createElement("section");
    yearSection.className = "check-year";
    yearSection.innerHTML = `<h2>${year}</h2>`;
    let yearShown = 0;

    for (const wave of lastWaves.filter((w) => w.year === year)) {
      if (s.era !== "all" && wave.manufacturer !== s.era) continue;
      const figs = lastFigures.filter((f) => f.waveId === wave.id && visible(f, s));
      if (!figs.length) continue;
      yearShown += figs.length;
      shown += figs.length;

      const block = document.createElement("div");
      block.className = "check-wave";
      const head = document.createElement("h3");
      head.textContent = `${wave.series}${wave.baf ? ` — BAF: ${wave.baf}` : ""}`;
      const ul = document.createElement("ul");
      ul.className = "check-list";
      for (const f of figs) {
        if (owned.has(f.id)) ownedShown += 1;
        ul.appendChild(itemRow(f));
      }
      block.append(head, ul);
      yearSection.appendChild(block);
    }

    if (yearShown) els.list.appendChild(yearSection);
  }

  if (!shown) {
    els.list.innerHTML = `<div class="empty-state"><p>Nothing matches. Try a different filter — or track some figures on the <a href="index.html">timeline</a> first.</p></div>`;
  }
  updateSummary(shown, ownedShown);
}

function updateSummary(shown, ownedShown) {
  els.summary.textContent = `Showing ${shown.toLocaleString()} figures · ${ownedShown.toLocaleString()} marked owned.`;
  if (els.printDate) {
    els.printDate.textContent = `Printed ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`;
  }
}

async function init() {
  try {
    const { waves, figures } = await loadData();
    lastWaves = waves;
    lastFigures = figures;
    els.show.addEventListener("change", render);
    els.era.addEventListener("change", render);
    els.print.addEventListener("click", () => window.print());
    render();
  } catch (err) {
    console.error(err);
    els.list.innerHTML = `<div class="empty-state"><p>Could not load the figure database. Check your connection and reload.</p></div>`;
  }
}

init();
