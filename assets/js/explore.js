/* Archive Explorer — serendipitous discovery.
   - "Surprise me": seeded shuffle (mulberry32) over all figures, no repeats
     until the deck is exhausted; seed + seen ids persist in localStorage.
   - Curated rabbit holes, all computed from the archive at runtime:
     variant oddities, deepest Toy Biz cuts, one-figure characters,
     the ten oldest BAFs. Methodology is stated on the page, not guessed. */
import { PATHS, STORE_KEYS } from "./config.js";
import { loadData } from "./data.js";
import { load, save } from "./store.js";
import { escapeHtml, badgeFor, openFigureDialog } from "./figure-dialog.js";
import { trackerButtons, owned, wanted } from "./tracker.js";

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const baseName = (n) => String(n ?? "").replace(/\s*\(.*?\)\s*/g, "").trim().toLowerCase();

const ODDITY_WORDS = ["chase", "translucent", "unmasked", "stealth", "error", "zombie", "first appearance"];

const els = {
  card: document.getElementById("surprise-card"),
  progress: document.getElementById("surprise-progress"),
  btnSurprise: document.getElementById("btn-surprise"),
  btnReshuffle: document.getElementById("btn-reshuffle"),
  gridVariants: document.getElementById("grid-variants"),
  gridToybiz: document.getElementById("grid-toybiz"),
  gridOnefig: document.getElementById("grid-onefig"),
  gridBafs: document.getElementById("grid-bafs"),
  onefigCount: document.getElementById("onefig-count"),
  onefigMore: document.getElementById("onefig-more"),
};

let figures = [];
let seed = load(STORE_KEYS.exploreSeed, null);
let seen = new Set(load(STORE_KEYS.exploreSeen, []));
if (seed === null) {
  seed = (Date.now() % 2147483647) || 1;
  save(STORE_KEYS.exploreSeed, seed);
}

function figureCard(fig, opts = {}) {
  const art = document.createElement("article");
  art.className = "card exp-card";
  art.dataset.figId = fig.id;
  const dots = owned.has(fig.id)
    ? `<span class="owned-dot" aria-hidden="true"></span>`
    : wanted.has(fig.id) ? `<span class="wanted-dot" aria-hidden="true"></span>` : "";
  art.innerHTML = `
    <h3>${escapeHtml(fig.name)}${dots}</h3>
    <div class="sub">${escapeHtml(fig.waveSeries)} · ${fig.year} · ${escapeHtml(fig.manufacturer)}</div>
    ${opts.line ? `<div class="sub" style="color:var(--gold)">${escapeHtml(opts.line)}</div>` : ""}
    <div class="tag-row">${badgeFor(fig)}</div>
    ${fig.notes ? `<p class="chart-sub" style="margin-top:var(--space-2)">${escapeHtml(fig.notes)}</p>` : ""}
    <div class="card-actions">
      <button type="button" class="btn btn-sm" data-details>Details</button>
      <a class="btn btn-sm" href="waves/${fig.waveId}.html">Wave →</a>
    </div>`;
  art.appendChild(trackerButtons(fig.id));
  art.querySelector("[data-details]").addEventListener("click", () => openFigureDialog(fig));
  return art;
}

function drawSurprise() {
  let pool = figures.filter((f) => !seen.has(f.id));
  if (!pool.length) {
    seen = new Set();
    save(STORE_KEYS.exploreSeen, []);
    pool = figures;
  }
  const rng = mulberry32(seed + seen.size * 2654435761);
  const fig = pool[Math.floor(rng() * pool.length)];
  seen.add(fig.id);
  save(STORE_KEYS.exploreSeen, [...seen]);

  els.card.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.innerHTML = `<h3>${escapeHtml(fig.name)}</h3>
    <div class="sub">${escapeHtml(fig.waveSeries)} · ${fig.year} · ${escapeHtml(fig.manufacturer)}</div>
    <div class="tag-row">${badgeFor(fig)}</div>
    ${fig.notes ? `<p class="chart-sub" style="margin-top:var(--space-2)">${escapeHtml(fig.notes)}</p>` : ""}`;
  const actions = document.createElement("div");
  actions.className = "surprise-actions";
  const detailsBtn = document.createElement("button");
  detailsBtn.type = "button";
  detailsBtn.className = "btn btn-sm";
  detailsBtn.textContent = "Full details";
  detailsBtn.addEventListener("click", () => openFigureDialog(fig));
  const waveLink = document.createElement("a");
  waveLink.className = "btn btn-sm";
  waveLink.href = `waves/${fig.waveId}.html`;
  waveLink.textContent = "See its wave →";
  actions.append(detailsBtn, waveLink, trackerButtons(fig.id));
  els.card.append(wrap, actions);
  els.progress.textContent = `${seen.size} of ${figures.length} discovered`;
}

function renderCurated(waves) {
  // Variant oddities: variant figures whose variant/notes text the archive flags
  // with unusual words (chase, translucent, unmasked, stealth, error, zombie...).
  const oddities = figures.filter((f) => {
    if (!f.variant) return false;
    const blob = `${f.variant} ${f.notes ?? ""}`.toLowerCase();
    return ODDITY_WORDS.some((w) => blob.includes(w));
  }).sort((a, b) => a.name.localeCompare(b.name));
  const frag = document.createDocumentFragment();
  for (const f of oddities) frag.appendChild(figureCard(f));
  els.gridVariants.appendChild(frag);

  // Deepest Toy Biz cuts: Toy Biz figures of characters with <= 2 archive figures.
  const charCounts = new Map();
  for (const f of figures) charCounts.set(baseName(f.name), (charCounts.get(baseName(f.name)) ?? 0) + 1);
  const deepCuts = figures
    .filter((f) => f.manufacturer === "Toy Biz" && (charCounts.get(baseName(f.name)) ?? 0) <= 2)
    .sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));
  const frag2 = document.createDocumentFragment();
  for (const f of deepCuts) frag2.appendChild(figureCard(f));
  els.gridToybiz.appendChild(frag2);

  // One-figure characters.
  const ones = [...charCounts.entries()].filter(([, n]) => n === 1).map(([c]) => c).sort();
  els.onefigCount.textContent = ones.length.toLocaleString();
  const oneFigs = figures.filter((f) => charCounts.get(baseName(f.name)) === 1)
    .sort((a, b) => a.name.localeCompare(b.name));
  const frag3 = document.createDocumentFragment();
  const CAP = 60;
  for (const f of oneFigs.slice(0, CAP)) frag3.appendChild(figureCard(f));
  els.gridOnefig.appendChild(frag3);
  if (oneFigs.length > CAP) {
    els.onefigMore.textContent = `Showing ${CAP} of ${oneFigs.length.toLocaleString()} — search the timeline for the rest.`;
  }

  // Forgotten BAFs: the ten oldest BAF waves.
  const bafWaves = waves.filter((w) => w.baf).sort((a, b) => a.year - b.year);
  const frag4 = document.createDocumentFragment();
  for (const w of bafWaves.slice(0, 10)) {
    const art = document.createElement("article");
    art.className = "card exp-card";
    art.innerHTML = `
      <h3>Build-A-Figure: ${escapeHtml(w.baf)}</h3>
      <div class="sub">${escapeHtml(w.series)} · ${w.year} · ${escapeHtml(w.manufacturer)}</div>
      <div class="tag-row"><span class="badge badge-baf">${w.figures.length} figures in wave</span></div>
      <div class="card-actions"><a class="btn btn-sm" href="waves/${w.id}.html">Wave details →</a></div>`;
    frag4.appendChild(art);
  }
  els.gridBafs.appendChild(frag4);
}

async function main() {
  let waves = [];
  try {
    ({ waves, figures } = await loadData());
  } catch {
    els.card.innerHTML = `<div class="empty-state"><p>Could not load the figure archive.</p></div>`;
    return;
  }
  // Drop stale seen ids (in case the archive changed).
  const valid = new Set(figures.map((f) => f.id));
  seen = new Set([...seen].filter((id) => valid.has(id)));
  save(STORE_KEYS.exploreSeen, [...seen]);

  els.btnSurprise.addEventListener("click", drawSurprise);
  els.btnReshuffle.addEventListener("click", () => {
    seed = (Date.now() % 2147483647) || 1;
    seen = new Set();
    save(STORE_KEYS.exploreSeed, seed);
    save(STORE_KEYS.exploreSeen, []);
    drawSurprise();
  });

  drawSurprise();
  renderCurated(waves);
}

main();
