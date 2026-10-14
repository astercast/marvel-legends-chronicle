/* Timeline page, chronological waves, figure cards, search, filters. */
import { loadData, searchFigures, computeStats, sourceLabel, sourceCoverage } from "./data.js";
import { openFigureDialog, badgeFor, escapeHtml } from "./figure-dialog.js";
import { ERAS, eraYears } from "./era-bands.js";
import { owned, wanted } from "./tracker.js";

const els = {
  stats: document.getElementById("stat-strip"),
  cabinet: document.getElementById("cabinet-note"),
  search: document.getElementById("f-search"),
  mfr: document.getElementById("f-mfr"),
  baf: document.getElementById("f-baf"),
  tracked: document.getElementById("f-tracked"),
  source: document.getElementById("f-source"),
  sourceNote: document.getElementById("source-note"),
  timeline: document.getElementById("timeline"),
  yearRail: document.getElementById("year-rail"),
  reset: document.getElementById("f-reset"),
  eraTabs: document.getElementById("era-tabs"),
  eraPlacard: document.getElementById("era-placard"),
};

/* The register opens one era at a time, the packaging eras are the
   archive's canonical periodization (assets/js/era-bands.js). Default: the
   newest era, so first-timers meet the present, not a 25-year wall. */
let activeEraId = ERAS[ERAS.length - 1].id;

function eraFromHash() {
  const m = /^#era=([a-z-]+)/.exec(location.hash || "");
  return ERAS.some((e) => e.id === m?.[1]) ? m[1] : null;
}

function setEra(id, { replace = true } = {}) {
  activeEraId = id;
  const url = `#era=${id}`;
  if (replace && "replaceState" in history) history.replaceState(null, "", url);
  else location.hash = url;
  syncEraTabs();
}

function syncEraTabs() {
  if (!els.eraTabs) return;
  Array.prototype.forEach.call(els.eraTabs.querySelectorAll('[role="tab"]'), (tab) => {
    const on = tab.dataset.era === activeEraId;
    tab.setAttribute("aria-selected", on ? "true" : "false");
    tab.tabIndex = on ? 0 : -1;
  });
}

function renderEraTabs(onSelect) {
  if (!els.eraTabs) return;
  els.eraTabs.innerHTML = "";
  ERAS.forEach((era) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.dataset.era = era.id;
    tab.id = `era-tab-${era.id}`;
    tab.innerHTML =
      `<span class="era-tab-years">${escapeHtml(eraYears(era))}</span>` +
      `<span class="era-tab-title">${escapeHtml(era.title)}</span>`;
    tab.addEventListener("click", () => onSelect(era.id));
    tab.addEventListener("keydown", (e) => {
      const tabs = Array.prototype.slice.call(els.eraTabs.querySelectorAll('[role="tab"]'));
      const i = tabs.indexOf(tab);
      let j = null;
      if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = tabs.length - 1;
      if (j !== null) { e.preventDefault(); tabs[j].focus(); onSelect(tabs[j].dataset.era); }
    });
    tab.className = "era-tab";
    els.eraTabs.appendChild(tab);
  });
  syncEraTabs();
}

function renderEraPlacard(searching) {
  if (!els.eraPlacard) return;
  const era = ERAS.find((e) => e.id === activeEraId);
  if (!era) { els.eraPlacard.innerHTML = ""; return; }
  els.eraPlacard.innerHTML =
    `<p class="era-kicker">Packaging era · ${escapeHtml(eraYears(era))}</p>` +
    `<h3 class="era-title">${escapeHtml(era.title)}</h3>` +
    `<p class="era-note">${escapeHtml(era.note)} ` +
    `<a href="${escapeHtml(era.learnMore)}">Packaging history&nbsp;→</a>` +
    (searching ? ` <span class="era-search-note">Searching the whole archive; era tabs resume when the search clears.</span>` : "") +
    `</p>`;
}

function state() {
  return {
    q: els.search.value.trim(),
    mfr: els.mfr.value,
    baf: els.baf.value,
    tracked: els.tracked.value,
    source: els.source.value,
  };
}

function figureCard(fig) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "figure-card";
  card.dataset.figId = fig.id;
  card.innerHTML = `
    <h3>${escapeHtml(fig.name)}</h3>
    <div class="sub">${escapeHtml(fig.waveSeries)} · ${fig.year}</div>
    ${fig.variant || fig.exclusive ? `<div class="sub">${escapeHtml([fig.variant ? "Variant: " + fig.variant : "", fig.exclusive ? "Exclusive: " + fig.exclusive : ""].filter(Boolean).join(" · "))}</div>` : ""}
    <div class="cat-no">${escapeHtml(fig.id)}</div>
    <div class="tag-row">${badgeFor(fig)}</div>`;
  if (owned.has(fig.id)) {
    card.insertAdjacentHTML("beforeend", `<span class="owned-dot" aria-hidden="true"></span>`);
  } else if (wanted.has(fig.id)) {
    card.insertAdjacentHTML("beforeend", `<span class="wanted-dot" aria-hidden="true"></span>`);
  }
  card.setAttribute("aria-label", `${fig.name}, ${fig.waveSeries} (${fig.year}). Open details.`);
  card.addEventListener("click", () => openFigureDialog(fig));
  return card;
}

function waveBlock(wave, s) {
  const figs = wave.figures.filter((f) => {
    if (s.mfr !== "all" && f.manufacturer !== s.mfr) return false;
    if (s.baf === "baf" && !f.waveBaf) return false;
    if (s.baf === "nobaf" && f.waveBaf) return false;
    if (s.tracked === "owned" && !owned.has(f.id)) return false;
    if (s.tracked === "wanted" && !wanted.has(f.id)) return false;
    if (s.source !== "all" && (f.source ?? "unclassified") !== s.source) return false;
    return true;
  });
  if (!figs.length) return null;

  const section = document.createElement("section");
  section.className = "wave";
  section.innerHTML = `
    <div class="wave-head">
      <h3 class="wave-title">${escapeHtml(wave.series)}</h3>
      <div class="wave-meta">
        <span class="badge ${wave.manufacturer === "Toy Biz" ? "badge-toybiz" : ""}">${escapeHtml(wave.manufacturer)}</span>
        <span class="badge">${figs.length} figure${figs.length === 1 ? "" : "s"}</span>
      </div>
    </div>
    ${wave.baf ? `<p class="wave-baf">Build-A-Figure: <strong>${escapeHtml(wave.baf)}</strong></p>` : ""}`;
  const grid = document.createElement("div");
  grid.className = "figure-grid";
  for (const f of figs) grid.appendChild(figureCard(f));
  section.appendChild(grid);
  return section;
}

function renderTimeline(waves, figures) {
  const s = state();
  els.timeline.innerHTML = "";
  els.yearRail.innerHTML = "";
  if (yearObserver) { yearObserver.disconnect(); yearObserver = null; }

  // Search mode: flat results list, capped for DOM sanity
  if (s.q.length >= 2) {
    renderEraPlacard(true);
    const results = searchFigures(figures, s.q).slice(0, 240);
    const meta = document.createElement("p");
    meta.className = "search-results-meta";
    meta.textContent = `${results.length}${results.length === 240 ? "+" : ""} result${results.length === 1 ? "" : "s"} for "${s.q}"`;
    els.timeline.appendChild(meta);
    if (!results.length) {
      els.timeline.insertAdjacentHTML("beforeend",
        `<div class="empty-state"><p>No figures match that search. Try a character, wave, or BAF name.</p><button type="button" class="btn btn-sm" data-reset-filters>Clear search &amp; filters</button></div>`);
      return;
    }
    const grid = document.createElement("div");
    grid.className = "figure-grid";
    grid.style.padding = "0";
    for (const f of results) grid.appendChild(figureCard(f));
    els.timeline.appendChild(grid);
    return;
  }

  const era = ERAS.find((e) => e.id === activeEraId);
  const years = [...new Set(waves.map((w) => w.year))]
    .filter((y) => !era || (y >= era.startYear && y <= era.endYear))
    .sort((a, b) => a - b);
  renderEraPlacard(s.q.length >= 2);
  let totalWaves = 0, totalFigs = 0;
  for (const year of years) {
    const rail = document.createElement("a");
    rail.href = `#year-${year}`;
    rail.textContent = year;
    els.yearRail.appendChild(rail);

    const yearWaves = waves.filter((w) => w.year === year);
    const blocks = yearWaves.map((w) => waveBlock(w, s)).filter(Boolean);
    if (!blocks.length) continue;

    const section = document.createElement("section");
    section.className = "year-section";
    section.id = `year-${year}`;
    const count = blocks.reduce((n, b) => n + b.querySelectorAll(".figure-card").length, 0);
    section.innerHTML = `
      <div class="year-head">
        <h2>${year}</h2>
        <span class="year-count">${blocks.length} wave${blocks.length === 1 ? "" : "s"} · ${count} figures</span>
      </div>`;
    for (const b of blocks) section.appendChild(b);
    els.timeline.appendChild(section);
    totalWaves += blocks.length;
    totalFigs += count;
  }

  if (!totalWaves) {
    els.timeline.insertAdjacentHTML("beforeend",
      `<div class="empty-state"><p>No waves match these filters.</p><button type="button" class="btn btn-sm" data-reset-filters>Clear filters</button></div>`);
  }
  setupYearSpy();
}

let yearObserver = null;

/* Highlight the year-rail link for the year currently in view. */
function setupYearSpy() {
  if (yearObserver) { yearObserver.disconnect(); yearObserver = null; }
  const links = Array.prototype.slice.call(els.yearRail.querySelectorAll("a"));
  const sections = document.querySelectorAll(".year-section[id]");
  if (!links.length || !sections.length || !("IntersectionObserver" in window)) return;
  const byId = {};
  links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
  let current = null;
  yearObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      const link = byId[e.target.id];
      if (!link || link === current) return;
      if (current) { current.classList.remove("active"); current.removeAttribute("aria-current"); }
      link.classList.add("active");
      link.setAttribute("aria-current", "true");
      current = link;
      /* Keep the active year visible inside the horizontal rail without moving the page. */
      const railRect = els.yearRail.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      if (linkRect.left < railRect.left || linkRect.right > railRect.right) {
        els.yearRail.scrollLeft += linkRect.left - railRect.left - railRect.width / 2 + linkRect.width / 2;
      }
    });
  }, { rootMargin: "-25% 0px -65% 0px" });
  sections.forEach(function (s) { yearObserver.observe(s); });
}

function censusLine(value, label) {
  return `<p class="census-line"><span class="census-value">${value}</span><span class="census-label">${label}</span></p>`;
}

function renderStats(stats) {
  /* The census as ruled lines (the colophon form): a value in
     Catalogue Blue, its label in Pencil, one line each. The same
     lines stand beside the Visual Database's pictured core.
     Owned/wanted live one line down, and only when there's something to say. */
  els.stats.innerHTML =
    censusLine(stats.figures.toLocaleString(), "figures catalogued in the archive") +
    censusLine(stats.waves, "waves in the line") +
    censusLine(`${stats.yearMin}–${String(stats.yearMax).slice(2)}`, "years, first release to latest") +
    censusLine(stats.bafWaves, "waves carrying a Build-A-Figure");
  const o = owned.count(), w = wanted.count();
  if (els.cabinet) {
    if (o + w > 0) {
      els.cabinet.hidden = false;
      els.cabinet.innerHTML =
        `Your cabinet: <strong>${o}</strong> owned · <strong>${w}</strong> wanted: ` +
        `<a href="shelf.html">open your shelf</a>`;
    } else {
      els.cabinet.hidden = true;
      els.cabinet.innerHTML = "";
    }
  }
}

async function init() {
  try {
    const { waves, figures } = await loadData();
    const stats = computeStats(waves, figures);
    renderStats(stats);

    /* Honest coverage note for the "Featured In" facet: only waves whose
       series name explicitly names a screen/game source are classified. */
    if (els.sourceNote) {
      const { classified, total } = sourceCoverage(figures);
      const pct = Math.round((classified / total) * 100);
      els.sourceNote.textContent =
        `“Featured In” classifies ${classified.toLocaleString()} of ${total.toLocaleString()} figures (${pct}% of the archive), only where the wave name itself names the source. Everything else is Unclassified; we don't guess.`;
    }

    renderEraTabs((id) => { setEra(id); renderTimeline(waves, figures); });
    const fromHash = eraFromHash();
    if (fromHash) setEra(fromHash, { replace: false });

    let debounce;
    const rerender = () => {
      renderTimeline(waves, figures);
      renderStats(computeStats(waves, figures)); // refresh owned/wanted counts
    };
    els.search.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(rerender, 180);
    });
    for (const el of [els.mfr, els.baf, els.tracked, els.source]) el.addEventListener("change", rerender);
    els.reset.addEventListener("click", () => {
      els.search.value = "";
      els.mfr.value = "all";
      els.baf.value = "all";
      els.tracked.value = "all";
      els.source.value = "all";
      rerender();
    });
    /* Empty-state "clear" buttons delegate to the toolbar reset. */
    els.timeline.addEventListener("click", (e) => {
      if (e.target.closest("[data-reset-filters]")) els.reset.click();
    });
    renderTimeline(waves, figures);
  } catch (err) {
    console.error(err);
    els.timeline.innerHTML = `<div class="empty-state"><p>Could not load the figure database. Check your connection and reload.</p></div>`;
  }
}

init();
