/* My Vault, the personal collection tracker, plated like a museum wall.
   Every figure in the archive can be marked Owned / Wanted / Watching from
   its card, its dialog, or right here; the marks live in this browser under
   the shared tracker keys (mlc_owned_v1 / mlc_wanted_v1 / mlc_watching_v1).
   This page renders those marks as accession plates and keeps the ledgers:
   counts, completion by year, completion by wave. It never invents data,
   no values, no estimates, and a shelf with nothing on it says so. */
import { STORE_KEYS } from "./config.js";
import { loadData } from "./data.js";
import { load } from "./store.js";
import { escapeHtml } from "./figure-dialog.js";
import { trackerButtons } from "./tracker.js";
import { buildVaultModel, HALLS } from "./vault-model.js";

const els = {
  empty: document.getElementById("vault-empty"),
  dash: document.getElementById("vault-dash"),
  kpis: document.getElementById("vault-kpis"),
  filter: document.getElementById("vault-filter"),
  halls: document.getElementById("vault-halls"),
  years: document.getElementById("vault-years"),
  waves: document.getElementById("vault-waves"),
};

let catalog = null; // { waves, figures }

function marks() {
  return {
    owned: new Set(load(STORE_KEYS.owned, [])),
    wanted: new Set(load(STORE_KEYS.wanted, [])),
    watching: new Set(load(STORE_KEYS.watching, [])),
  };
}

function bar(pct) {
  return `<div class="mv-bar" role="img" aria-label="${pct.toFixed(1)} percent owned"><span style="width:${Math.min(100, pct).toFixed(1)}%"></span></div>`;
}

function kpi(label, value, sub) {
  return `<div class="mv-stat"><div class="mv-stat-value">${value}</div><div class="mv-stat-label">${label}</div>${sub ? `<div class="mv-stat-sub">${sub}</div>` : ""}</div>`;
}

function badges(fig) {
  const out = [];
  if (fig.bafPiece) out.push(`<span class="badge badge-baf">BAF piece · ${escapeHtml(fig.bafPiece)}</span>`);
  if (fig.exclusive) out.push(`<span class="badge badge-exclusive">${escapeHtml(fig.exclusive)}</span>`);
  if (fig.variant) out.push(`<span class="badge badge-variant">${escapeHtml(fig.variant)}</span>`);
  return out.length ? `<div class="mv-plate-tags">${out.join("")}</div>` : "";
}

function plate(fig, kind) {
  const search = `${fig.name} ${fig.waveSeries} ${fig.year} ${fig.manufacturer}`.toLowerCase();
  return `<article class="mv-plate mv-plate-${kind}" data-fig-id="${escapeHtml(fig.id)}" data-search="${escapeHtml(search)}">
    <div class="mv-plate-kicker"><span>${fig.year} · ${escapeHtml(fig.manufacturer)}</span><span class="mv-plate-state">${kind}</span></div>
    <h3 class="mv-plate-name">${escapeHtml(fig.name)}</h3>
    <p class="mv-plate-meta">${escapeHtml(fig.waveSeries)}${fig.waveBaf ? ` · builds ${escapeHtml(fig.waveBaf)}` : ""}</p>
    ${badges(fig)}
    ${fig.notes ? `<p class="mv-plate-notes">${escapeHtml(fig.notes)}</p>` : ""}
    <div class="mv-plate-btns"></div>
    <a class="mv-plate-link" href="waves/${escapeHtml(fig.waveId)}.html">View in the archive →</a>
  </article>`;
}

const HALL_EMPTY = {
  owned: "Nothing on this shelf yet. When a figure comes home, mark it <strong>Owned</strong> on its card and its plate hangs here.",
  wanted: "The hunt list is empty. Mark any figure <strong>Wanted</strong> and its plate hangs here until it comes home.",
  watching: "No watch running. Mark a figure <strong>Watching</strong> to keep an eye on it without joining the hunt.",
};

function render() {
  const model = buildVaultModel(catalog.figures, catalog.waves, marks());

  if (model.empty) {
    els.empty.hidden = false;
    els.dash.hidden = true;
    return;
  }
  els.empty.hidden = true;
  els.dash.hidden = false;

  const c = model.counts;
  els.kpis.innerHTML =
    kpi("Owned", c.owned.toLocaleString(), "plates on the shelf") +
    kpi("Wanted", c.wanted.toLocaleString(), "on the hunt") +
    kpi("Watching", c.watching.toLocaleString(), "under an eye") +
    kpi("Archive held", `${c.ownedPct.toFixed(1)}%`, `${c.owned.toLocaleString()} of ${c.total.toLocaleString()} figures owned`) +
    kpi("Waves touched", model.wavesTouched.toLocaleString(), `${model.completeWaves.length} complete`);

  els.halls.innerHTML = HALLS.map(({ kind, title, note }) => {
    const figs = model.halls[kind];
    return `<section class="mv-hall" aria-label="${title}" data-hall="${kind}">
      <div class="mv-hall-head"><h2>${title}</h2><span class="mv-hall-count">${figs.length.toLocaleString()} ${figs.length === 1 ? "plate" : "plates"}</span></div>
      <p class="mv-hall-note">${note}</p>
      ${figs.length
        ? `<div class="mv-plates">${figs.map((f) => plate(f, kind)).join("")}</div>`
        : `<p class="mv-hall-empty">${HALL_EMPTY[kind]}</p>`}
      <p class="mv-nomatch" hidden>No plates in this hall match your filter.</p>
    </section>`;
  }).join("");
  // Tracker buttons are live DOM (they own their click handling), mount
  // one set per plate, exactly as the wave pages and dialogs do.
  els.halls.querySelectorAll(".mv-plate").forEach((el) => {
    el.querySelector(".mv-plate-btns").appendChild(trackerButtons(el.getAttribute("data-fig-id")));
  });

  els.years.innerHTML = `<h2>Completion by year</h2>
    <p class="mv-ledger-note">Owned against the whole archive, year by year. Wanted and Watching counts ride along, they are plans, not holdings, and never inflate the bar.</p>
    <div class="mv-year-grid">${model.byYear.map((r) => `
      <div class="mv-year-row"><span class="mv-year-label">${r.year}</span>${bar(r.pct)}<span class="mv-year-count">${r.owned}/${r.total}</span><span class="mv-year-extra">${r.wanted ? `+${r.wanted} wanted` : ""}${r.watching ? ` · ${r.watching} watching` : ""}</span></div>`).join("")}
    </div>`;

  els.waves.innerHTML = `<h2>Completion by wave</h2>
    ${model.byWave.length
      ? `<p class="mv-ledger-note">Every wave you have touched, closest to complete first. A wave counts as complete only when every figure in it is Owned.</p>
         <ul class="mv-wave-list">${model.byWave.map((r) => `
           <li class="mv-wave-row">
             <div class="mv-wave-main"><a href="waves/${escapeHtml(r.id)}.html">${escapeHtml(r.series)}</a>
               <span class="mv-wave-meta">${r.year ?? ""} · ${escapeHtml(r.manufacturer)}</span>
               ${r.complete ? `<span class="badge badge-baf">Complete</span>` : ""}</div>
             <div class="mv-wave-bar">${bar(r.pct)}</div>
             <span class="mv-wave-count">${r.owned}/${r.total} owned${r.wanted ? ` · ${r.wanted} wanted` : ""}${r.watching ? ` · ${r.watching} watching` : ""}</span>
           </li>`).join("")}
         </ul>`
      : `<p class="mv-ledger-note">No wave touched yet.</p>`}`;

  applyFilter();
}

function applyFilter() {
  const q = (els.filter.value || "").trim().toLowerCase();
  els.halls.querySelectorAll(".mv-hall").forEach((hall) => {
    let visible = 0;
    hall.querySelectorAll(".mv-plate").forEach((p) => {
      const show = !q || p.getAttribute("data-search").includes(q);
      p.hidden = !show;
      if (show) visible += 1;
    });
    const note = hall.querySelector(".mv-nomatch");
    if (note) note.hidden = !(q && visible === 0 && hall.querySelector(".mv-plate"));
  });
}

async function main() {
  try {
    catalog = await loadData();
  } catch (err) {
    els.dash.innerHTML = `<div class="empty-state"><p>Could not load the figure archive.</p></div>`;
    els.dash.hidden = false;
    return;
  }
  render();
  els.filter.addEventListener("input", applyFilter);
  /* A tracker toggle anywhere on the page rewrites storage first (the
     button's own handler runs before this one bubbles up), so re-rendering
     here always reads fresh state. Focus is restored to the same plate's
     same button so keyboard collectors don't lose their place. */
  els.dash.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-track]");
    if (!btn) return;
    const plateEl = btn.closest("[data-fig-id]");
    const figId = plateEl?.getAttribute("data-fig-id");
    const kind = btn.getAttribute("data-track");
    render();
    if (figId && kind) {
      els.dash.querySelector(`[data-fig-id="${CSS.escape(figId)}"] [data-track="${kind}"]`)?.focus();
    }
  });
}

main();
