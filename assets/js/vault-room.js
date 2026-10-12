/* The Vault Room — a browsable vault of every Marvel Legends figure, 2002-2026.
   Shelves are built from the real archive datasets (data/v1/figures.json,
   data/v1/waves.json, data/v1/timeline.json); nothing is invented. Drawers open
   into an archive-drawer dialog (shared accessible modal: focus trap, Esc,
   focus restore). Deep-link any drawer: #fig=<figure id>.
   Animation is transform/opacity only; reduced-motion readers get the full
   timeline as a readable list and no parallax. */
import { openModal } from "./modal.js";
import { escapeHtml, badgeFor } from "./figure-dialog.js";
import { trackerButtons } from "./tracker.js";
import { renderResearchLinks } from "./listings.js";

const els = {
  journey: document.getElementById("journey"),
  journeyList: document.getElementById("journey-list"),
  journeyNow: document.getElementById("journey-now"),
  room: document.getElementById("vault-room"),
  years: document.getElementById("room-years"),
  loading: document.getElementById("room-loading"),
  coverage: document.getElementById("vault-room-coverage"),
};

const reduceMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches ||
  document.documentElement.dataset.motion === "reduce";

/* Character pages (characters/<slug>.html) — lazy index so a drawer story can
   link "Every <character> release" when one exists. Resolved against this
   module's own URL (always <root>/assets/js/), so the fetch works at any
   page depth. */
const charIndex = new Map();
fetch(new URL("../../characters/manifest.json", import.meta.url))
  .then((r) => (r.ok ? r.json() : []))
  .then((m) => {
    for (const c of m) charIndex.set(String(c.name).toLowerCase(), c.slug);
  })
  .catch(() => {});

function characterSlugFor(name) {
  const base = String(name).replace(/\s*\(.*?\)\s*/g, "").trim();
  return charIndex.get(base.toLowerCase()) ?? null;
}

async function loadRoomData() {
  const [figures, waves, timeline] = await Promise.all(
    ["data/v1/figures.json", "data/v1/waves.json", "data/v1/timeline.json"].map((u) =>
      fetch(u).then((r) => {
        if (!r.ok) throw new Error(`${u}: ${r.status}`);
        return r.json();
      })
    )
  );
  return { figures, waves, timeline: timeline.years ?? [] };
}

/* ---------- The journey: 2002 -> 2026 ----------
   onTravel(year) renders that year's shelves before the browser scrolls, so
   lazy rendering can't shift the landing point mid-journey. */
function buildJourney(years, onTravel) {
  const frag = document.createDocumentFragment();
  for (const y of years) {
    const li = document.createElement("li");
    // The era + summary ride along in every item: hidden in the compact rail,
    // but the reduced-motion stylesheet reveals the whole rail as a readable list.
    li.innerHTML =
      `<a href="#year-${y.year}" data-year="${y.year}">` +
      `<span class="journey-era">${escapeHtml(y.era)}</span>` +
      `${y.year}` +
      `<span class="journey-summary"><strong>${escapeHtml(y.headline)}.</strong> ${escapeHtml(y.summary)}</span>` +
      `</a>`;
    frag.appendChild(li);
  }
  els.journeyList.appendChild(frag);

  els.journeyList.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-year]");
    if (!a) return;
    e.preventDefault();
    onTravel(Number(a.dataset.year));
  });

  // Arrow keys travel the rail; Enter follows via the click handler above.
  els.journeyList.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const links = Array.from(els.journeyList.querySelectorAll("a"));
    const i = links.indexOf(document.activeElement);
    if (i === -1) return;
    e.preventDefault();
    const next = links[(i + (e.key === "ArrowRight" ? 1 : -1) + links.length) % links.length];
    next.focus();
  });
}

function markActiveYear(year, era) {
  for (const a of els.journeyList.querySelectorAll("a")) {
    if (Number(a.dataset.year) === year) a.setAttribute("aria-current", "true");
    else a.removeAttribute("aria-current");
  }
  els.journeyNow.textContent = `${year} · ${era}`;
}

/* ---------- Shelves and drawers ---------- */

function yearShell(y) {
  const sec = document.createElement("section");
  sec.className = "year-shelf";
  sec.id = `year-${y.year}`;
  sec.dataset.year = String(y.year);
  sec.setAttribute("aria-labelledby", `year-${y.year}-h`);
  sec.innerHTML =
    `<div class="year-head">` +
    `<h2 id="year-${y.year}-h">${y.year}</h2>` +
    `<span class="year-era">${escapeHtml(y.era)}</span>` +
    `<span class="year-count" data-year-count></span>` +
    `</div>` +
    `<div class="year-story">` +
    `<p class="headline">${escapeHtml(y.headline)}</p>` +
    `<p>${escapeHtml(y.summary)}</p>` +
    (y.packaging ? `<p class="year-pack">Packaging: ${escapeHtml(y.packaging)}</p>` : "") +
    `</div>` +
    `<div class="wave-shelves" data-wave-shelves></div>`;
  return sec;
}

function waveShelfEl(wave, figs, yearCtx, spotlightById) {
  const wrap = document.createElement("div");
  wrap.className = "wave-shelf";
  wrap.dataset.waveId = wave.id;
  const head =
    `<div class="wave-shelf-head">` +
    `<h3><a href="${escapeHtml(wave.page)}">${escapeHtml(wave.series)}</a></h3>` +
    (wave.baf ? `<span class="wave-baf">Build-A-Figure: ${escapeHtml(wave.baf)}</span>` : "") +
    `<span class="wave-baf">${figs.length} figure${figs.length === 1 ? "" : "s"}</span>` +
    `</div>`;
  const board = document.createElement("div");
  board.className = "shelf-board";
  board.setAttribute("role", "group");
  board.setAttribute("aria-label", `${wave.series} drawers`);
  for (const fig of figs) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "drawer" + (spotlightById.has(fig.id) ? " drawer-spot" : "");
    b.dataset.figId = fig.id;
    b.setAttribute("aria-haspopup", "dialog");
    b.innerHTML =
      `<span class="drawer-name">${escapeHtml(fig.name)}</span>` +
      `<span class="drawer-sub">${escapeHtml(fig.waveSeries)}${fig.variant ? ` · ${escapeHtml(fig.variant)}` : ""}</span>`;
    b.addEventListener("click", () =>
      openDrawer(fig, yearCtx, spotlightById.get(fig.id) ?? null)
    );
    board.appendChild(b);
  }
  // Arrow keys walk the shelf grid; Enter/Space opens the focused drawer.
  board.addEventListener("keydown", (e) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    const drawers = Array.from(board.querySelectorAll(".drawer"));
    const i = drawers.indexOf(document.activeElement);
    if (i === -1) return;
    e.preventDefault();
    const cols = Math.max(1, getComputedStyle(board).gridTemplateColumns.split(" ").length);
    let n = i;
    if (e.key === "ArrowRight") n = Math.min(drawers.length - 1, i + 1);
    else if (e.key === "ArrowLeft") n = Math.max(0, i - 1);
    else if (e.key === "ArrowDown") n = Math.min(drawers.length - 1, i + cols);
    else n = Math.max(0, i - cols);
    drawers[n].focus();
  });
  wrap.innerHTML = head;
  wrap.appendChild(board);
  return wrap;
}

/* ---------- The drawer story ---------- */

function clearFigHash() {
  if (location.hash.startsWith("#fig=")) {
    history.replaceState(null, "", location.pathname + location.search);
  }
}

function watchDrawerClose() {
  // Every close path (Esc, backdrop click, close button) removes the backdrop.
  const obs = new MutationObserver(() => {
    if (!document.querySelector(".modal-backdrop")) {
      obs.disconnect();
      clearFigHash();
    }
  });
  obs.observe(document.body, { childList: true });
}

function kvRow(k, vHtml) {
  return `<div><dt>${escapeHtml(k)}</dt><dd>${vHtml}</dd></div>`;
}

export function openDrawer(fig, yearCtx, spotlightWhy) {
  history.replaceState(null, "", `#fig=${encodeURIComponent(fig.id)}`);
  openModal((titleEl, bodyEl) => {
    const modal = bodyEl.closest(".modal");
    modal.classList.add("drawer-story");
    titleEl.textContent = fig.name;

    const acc = document.createElement("p");
    acc.className = "drawer-acc";
    acc.textContent = `Archive № ${fig.id}`;
    bodyEl.appendChild(acc);

    const badges = document.createElement("p");
    badges.innerHTML = badgeFor(fig);
    bodyEl.appendChild(badges);

    const dl = document.createElement("dl");
    dl.className = "kv";
    const waveLink = `<a href="waves/${encodeURIComponent(fig.waveId)}.html">${escapeHtml(fig.waveSeries)}</a>`;
    const yearLink = `<a href="#year-${fig.year}">${fig.year}</a>`;
    dl.innerHTML =
      kvRow("Wave", waveLink) +
      kvRow("Year", yearLink) +
      kvRow("Manufacturer", escapeHtml(fig.manufacturer)) +
      (fig.variant ? kvRow("Variant", escapeHtml(fig.variant)) : "") +
      (fig.exclusive ? kvRow("Exclusive", escapeHtml(fig.exclusive)) : "") +
      (fig.bafPiece ? kvRow("BAF piece", escapeHtml(fig.bafPiece)) : "") +
      (fig.waveBaf ? kvRow("Wave BAF", escapeHtml(fig.waveBaf)) : "") +
      (fig.notes ? kvRow("From the archive", escapeHtml(fig.notes)) : "");
    bodyEl.appendChild(dl);

    if (spotlightWhy) {
      const why = document.createElement("blockquote");
      why.className = "drawer-why";
      why.innerHTML = `${escapeHtml(spotlightWhy)}<cite>— the archive's spotlight pick for ${fig.year}</cite>`;
      bodyEl.appendChild(why);
    }

    if (yearCtx) {
      const ys = document.createElement("div");
      ys.className = "drawer-year-story";
      ys.innerHTML =
        `<h3>${fig.year}: ${escapeHtml(yearCtx.headline)}</h3>` +
        `<p>${escapeHtml(yearCtx.summary)}</p>` +
        (yearCtx.packaging ? `<p class="year-pack">Packaging: ${escapeHtml(yearCtx.packaging)}</p>` : "");
      bodyEl.appendChild(ys);
    }

    const links = document.createElement("div");
    links.className = "drawer-links";
    links.innerHTML = `<a class="btn" href="waves/${encodeURIComponent(fig.waveId)}.html">Full ${escapeHtml(fig.waveSeries)} wave →</a>`;
    const slug = characterSlugFor(fig.name);
    if (slug) {
      const a = document.createElement("a");
      a.className = "btn";
      a.href = `characters/${slug}.html`;
      a.textContent = "Every release of this character →";
      links.appendChild(a);
    }
    bodyEl.appendChild(links);

    bodyEl.appendChild(trackerButtons(fig.id));
    bodyEl.appendChild(renderResearchLinks(fig));
  });
  watchDrawerClose();
  // Return focus context: the opener stays in the tab order behind the modal.
}

/* ---------- The drawer index: full-text search across every drawer ----------
   Pure ranking over the archive (exported for tests). AND semantics across
   tokens: every token must hit somewhere. Name hits outrank variant/exclusive,
   which outrank wave/BAF piece, which outrank notes/year/manufacturer. */
export function searchDrawers(figures, query, limit = 50) {
  const tokens = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const scored = [];
  for (const fig of figures) {
    const name = (fig.name || "").toLowerCase();
    const variant = (fig.variant || "").toLowerCase();
    const exclusive = (fig.exclusive || "").toLowerCase();
    const wave = (fig.waveSeries || "").toLowerCase();
    const baf = (fig.bafPiece || "").toLowerCase();
    const waveBaf = (fig.waveBaf || "").toLowerCase();
    const notes = (fig.notes || "").toLowerCase();
    const year = String(fig.year || "");
    const manu = (fig.manufacturer || "").toLowerCase();
    let score = 0;
    let missed = false;
    for (const t of tokens) {
      let hit = 0;
      if (name.includes(t)) hit = 4;
      else if (variant.includes(t) || exclusive.includes(t)) hit = 3;
      else if (wave.includes(t) || baf.includes(t) || waveBaf.includes(t)) hit = 2;
      else if (notes.includes(t) || year === t || manu.includes(t)) hit = 1;
      if (!hit) { missed = true; break; }
      score += hit;
    }
    if (!missed) scored.push({ fig, score });
  }
  scored.sort((a, b) => b.score - a.score || a.fig.name.localeCompare(b.fig.name));
  return scored.slice(0, limit).map((s) => s.fig);
}

function initDrawerSearch(figures, yearByNum) {
  const form = document.getElementById("drawer-search-form");
  const input = document.getElementById("drawer-search-input");
  const results = document.getElementById("drawer-search-results");
  const status = document.getElementById("drawer-search-status");
  if (!form || !input || !results || !status) return;

  let active = -1;
  let current = [];
  let truncated = false;
  let debounceT = null;
  let hideT = null;

  function openResult(fig) {
    const yearCtx = yearByNum.get(fig.year) ?? null;
    const why = (yearCtx?.spotlight ?? []).find((s) => s.id === fig.id)?.why ?? null;
    openDrawer(fig, yearCtx, why);
  }

  function setActive(i) {
    const options = results.querySelectorAll('[role="option"]');
    options.forEach((o, k) => o.setAttribute("aria-selected", String(k === i)));
    active = i;
    if (i >= 0 && options[i]) {
      input.setAttribute("aria-activedescendant", options[i].id);
      options[i].scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  function render() {
    results.textContent = "";
    setActive(-1);
    if (!current.length) {
      results.hidden = true;
      input.setAttribute("aria-expanded", "false");
      return;
    }
    const frag = document.createDocumentFragment();
    current.forEach((fig, i) => {
      const o = document.createElement("div");
      o.className = "dsr-option";
      o.id = `dsr-${i}`;
      o.setAttribute("role", "option");
      o.setAttribute("aria-selected", "false");
      o.innerHTML =
        `<span class="dsr-name">${escapeHtml(fig.name)}</span>` +
        `<span class="dsr-sub">${escapeHtml(fig.waveSeries)}` +
        `${fig.variant ? ` · ${escapeHtml(fig.variant)}` : ""}` +
        `${fig.exclusive ? ` · ${escapeHtml(fig.exclusive)}` : ""} · ${fig.year}</span>`;
      // mousedown + preventDefault: the click lands before the input's blur
      // hides the panel.
      o.addEventListener("mousedown", (e) => {
        e.preventDefault();
        openResult(fig);
      });
      frag.appendChild(o);
    });
    results.appendChild(frag);
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function announce(q) {
    if (!q) {
      status.textContent = "";
    } else if (!current.length) {
      status.textContent = `No drawers match “${q}”. Try a character, wave, or BAF name.`;
    } else {
      const total = truncated ? "50+" : String(current.length);
      status.textContent =
        `${total} drawer${current.length === 1 && !truncated ? "" : "s"} match — ` +
        `↑↓ to browse, Enter to pull one open.`;
    }
  }

  function runSearch() {
    const q = input.value.trim();
    if (!q) {
      current = [];
      truncated = false;
      render();
      announce("");
      return;
    }
    const found = searchDrawers(figures, q, 51);
    truncated = found.length > 50;
    current = found.slice(0, 50);
    render();
    announce(q);
  }

  input.addEventListener("input", () => {
    clearTimeout(debounceT);
    debounceT = setTimeout(runSearch, 120);
  });
  input.addEventListener("focus", () => {
    clearTimeout(hideT);
    if (current.length && results.hidden) {
      results.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }
  });
  input.addEventListener("blur", () => {
    clearTimeout(hideT);
    hideT = setTimeout(() => {
      results.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }, 150);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!current.length) return;
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive((active + d + current.length) % current.length);
    } else if (e.key === "Home" || e.key === "End") {
      if (!current.length) return;
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : current.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0) openResult(current[active]);
      else if (current.length) openResult(current[0]);
    } else if (e.key === "Escape") {
      input.value = "";
      runSearch();
    }
  });
  form.addEventListener("submit", (e) => e.preventDefault());
}

/* The journey rail sticks beneath the sticky site header; measure the
   header so the rail never slides under it (the header wraps on narrow
   screens, so this is done in JS, not a magic CSS number). */
function stickJourney() {
  const header = document.querySelector(".site-header");
  if (header) {
    const top = header.offsetHeight;
    els.journey.style.top = `${top}px`;
    // Year anchors must clear both sticky bars.
    const margin = top + els.journey.offsetHeight + 12;
    for (const s of document.querySelectorAll(".year-shelf")) {
      s.style.scrollMarginTop = `${margin}px`;
    }
  }
}

/* ---------- Room assembly ---------- */

function showError(err) {
  els.loading.hidden = true;
  const p = document.createElement("p");
  p.className = "room-error card";
  p.innerHTML =
    `<strong>The vault door jammed.</strong> The figure archive could not be loaded ` +
    `(${escapeHtml(err.message)}). The collection is still browsable: ` +
    `<a href="waves/index.html">all 167 waves</a> · <a href="timeline.html">the 2002–2026 timeline</a>.`;
  els.years.appendChild(p);
}

async function init() {
  let data;
  try {
    data = await loadRoomData();
  } catch (err) {
    showError(err);
    return;
  }
  const { figures, waves, timeline } = data;
  const waveMeta = new Map();
  for (const w of waves) waveMeta.set(w.id, w);
  const yearByNum = new Map(timeline.map((y) => [y.year, y]));
  const figsByYear = new Map();
  for (const f of figures) {
    if (!figsByYear.has(f.year)) figsByYear.set(f.year, []);
    figsByYear.get(f.year).push(f);
  }

  els.coverage.textContent =
    `${figures.length.toLocaleString()} drawers · ${waves.length} waves · ${timeline.length} years — every one from the archive.`;

  // Year shells first (cheap), then drawers per wave — lazily as shelves
  // approach the viewport so the first paint stays fast.
  const pending = [];
  for (const y of timeline) {
    const sec = yearShell(y);
    const host = sec.querySelector("[data-wave-shelves]");
    const yearFigs = figsByYear.get(y.year) ?? [];
    const countEl = sec.querySelector("[data-year-count]");
    countEl.textContent = `${yearFigs.length} figures`;
    const spotlightById = new Map((y.spotlight ?? []).map((s) => [s.id, s.why]));
    // Wave order follows the archive's own year listing, then the wave index.
    const waveOrder = new Map((y.waves ?? []).map((w, i) => [w.id, i]));
    const byWave = new Map();
    for (const f of yearFigs) {
      if (!byWave.has(f.waveId)) byWave.set(f.waveId, []);
      byWave.get(f.waveId).push(f);
    }
    const waveIds = [...byWave.keys()].sort((a, b) => {
      const ao = waveOrder.has(a) ? waveOrder.get(a) : 1e9;
      const bo = waveOrder.has(b) ? waveOrder.get(b) : 1e9;
      return ao - bo || String(a).localeCompare(String(b));
    });
    const renderWaves = () => {
      if (host.dataset.rendered) return;
      host.dataset.rendered = "1";
      for (const wid of waveIds) {
        const meta = waveMeta.get(wid) ?? {};
        const tlWave = (y.waves ?? []).find((w) => w.id === wid) ?? {};
        host.appendChild(
          waveShelfEl(
            {
              id: wid,
              series: meta.series ?? tlWave.series ?? wid,
              baf: meta.baf ?? tlWave.baf ?? null,
              page: tlWave.page ?? `waves/${wid}.html`,
            },
            byWave.get(wid),
            y,
            spotlightById
          )
        );
      }
    };
    pending.push({ sec, renderWaves, year: y.year, era: y.era });
    els.years.appendChild(sec);
  }
  els.loading.hidden = true;

  const travelTo = (year) => {
    const job = pending.find((p) => p.year === year);
    if (!job) return;
    job.renderWaves(); // settle the layout before scrolling
    markActiveYear(year, job.era);
    const target = document.getElementById(`year-${year}`);
    if (target) {
      // Long hauls jump; short hops glide. A multi-thousand-pixel smooth
      // scroll is a blur that outruns the eye, so only nearby years animate.
      // NOTE: this Chromium ignores the `behavior` scroll option when CSS
      // scroll-behavior is smooth — drive it through the CSS property.
      const dy = target.getBoundingClientRect().top;
      if (reduceMotion() || Math.abs(dy) > innerHeight * 2) {
        // Pre-render the neighboring years first: shelves rendered AFTER the
        // jump would grow the document above the target and push it down.
        for (const p of pending) {
          if (Math.abs(p.year - year) <= 2) p.renderWaves();
        }
        const html = document.documentElement;
        const prev = html.style.scrollBehavior;
        html.style.scrollBehavior = "auto";
        target.scrollIntoView({ block: "start" });
        html.style.scrollBehavior = prev;
      } else {
        target.scrollIntoView({ block: "start" }); // CSS smooth applies
      }
    }
    history.replaceState(null, "", `#year-${year}`);
  };
  buildJourney(timeline, travelTo);

  if ("IntersectionObserver" in window) {
    const shelfIO = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            const job = pending.find((p) => p.sec === en.target);
            if (job) job.renderWaves();
            shelfIO.unobserve(en.target);
          }
        }
      },
      { rootMargin: "600px 0px" }
    );
    for (const p of pending) shelfIO.observe(p.sec);
  } else {
    for (const p of pending) p.renderWaves();
  }

  // The active year follows the shelf nearest the middle of the viewport.
  if ("IntersectionObserver" in window) {
    const yearIO = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            const y = Number(en.target.dataset.year);
            const ctx = yearByNum.get(y);
            if (ctx) markActiveYear(y, ctx.era);
          }
        }
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    for (const p of pending) yearIO.observe(p.sec);
  }

  initParallax();
  stickJourney();
  initDrawerSearch(figures, yearByNum);
  let stickT = null;
  addEventListener("resize", () => {
    clearTimeout(stickT);
    stickT = setTimeout(stickJourney, 150);
  });
  openHashDrawer(figures, yearByNum, pending);
}

function openHashDrawer(figures, yearByNum, pending) {
  const m = location.hash.match(/^#fig=(.+)$/);
  if (!m) return;
  const id = decodeURIComponent(m[1]);
  const fig = figures.find((f) => f.id === id);
  if (!fig) return; // unknown drawer: leave the hash alone, show the room
  const job = pending.find((p) => p.year === fig.year);
  if (job) job.renderWaves(); // the drawer must exist before it can open
  const yearCtx = yearByNum.get(fig.year);
  const why = (yearCtx?.spotlight ?? []).find((s) => s.id === fig.id)?.why ?? null;
  openDrawer(fig, yearCtx ?? null, why);
}

/* ---------- Parallax: transform-only, rAF-throttled, motion-gated ---------- */

function initParallax() {
  if (reduceMotion()) return;
  let ticking = false;
  const apply = () => {
    ticking = false;
    if (reduceMotion()) {
      els.room.style.setProperty("--py", "0px");
      return;
    }
    // The room's own offset keeps the layers glued to the room, not the page.
    const y = window.scrollY - els.room.offsetTop;
    els.room.style.setProperty("--py", `${Math.max(0, y)}px`);
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(apply);
    }
  };
  addEventListener("scroll", onScroll, { passive: true });
  apply();
}

init();
