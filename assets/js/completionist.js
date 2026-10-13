/* The Completionist — set-completion intelligence over My Vault.
   Reads the same three shelves the vault plates (Owned / Wanted /
   Watching, in this browser only) and works out, from the catalog
   itself: how complete each wave is, which waves sit one or two
   figures from finished — with the exact missing figures named and
   linked into the archive — and how completion runs by era, using
   the Archive Tour's four chapters. Completion means Owned; Wanted
   and Watching are plans, never holdings. No figure is invented for
   a visitor with no shelves yet: the empty state shows what this
   page becomes, counted from the catalog's structure alone. */
import { STORE_KEYS } from "./config.js";
import { loadData } from "./data.js";
import { load } from "./store.js";
import { escapeHtml } from "./figure-dialog.js";
import { buildCompletionistModel } from "./completionist-model.js";

const els = {
  empty: document.getElementById("comp-empty"),
  preview: document.getElementById("comp-preview"),
  dash: document.getElementById("comp-dash"),
  kpis: document.getElementById("comp-kpis"),
  nearest: document.getElementById("comp-nearest"),
  eras: document.getElementById("comp-eras"),
  ledger: document.getElementById("comp-ledger"),
  error: document.getElementById("comp-error"),
};

let catalog = null; // { waves, figures }

function marks() {
  return {
    owned: new Set(load(STORE_KEYS.owned, [])),
    wanted: new Set(load(STORE_KEYS.wanted, [])),
    watching: new Set(load(STORE_KEYS.watching, [])),
  };
}

const fmt = (n) => n.toLocaleString("en-US");

function bar(pct) {
  return `<div class="cp-bar" role="img" aria-label="${pct.toFixed(1)} percent owned"><span style="width:${Math.min(100, pct).toFixed(1)}%"></span></div>`;
}

function kpi(label, value, sub) {
  return `<div class="cp-stat"><div class="cp-stat-value">${value}</div><div class="cp-stat-label">${label}</div>${sub ? `<div class="cp-stat-sub">${sub}</div>` : ""}</div>`;
}

function figState(fig, markSets) {
  if (markSets.owned.has(fig.id)) return "owned";
  if (markSets.wanted.has(fig.id)) return "wanted";
  if (markSets.watching.has(fig.id)) return "watching";
  return "unmarked";
}

function missingList(row, markSets) {
  return `<ul class="cp-missing">${row.missing.map((fig) => {
    const state = figState(fig, markSets);
    return `<li class="cp-missing-row">
      <span class="cp-missing-name">${escapeHtml(fig.name)}</span>
      ${fig.bafPiece ? `<span class="badge badge-baf">BAF piece · ${escapeHtml(fig.bafPiece)}</span>` : ""}
      ${state !== "unmarked" ? `<span class="cp-missing-state">${state}</span>` : ""}
      <a class="cp-missing-link" href="waves/${escapeHtml(fig.waveId)}.html">View in the archive →</a>
    </li>`;
  }).join("")}</ul>`;
}

function wavePlate(row, markSets, tag) {
  return `<article class="cp-plate" data-wave-id="${escapeHtml(row.id)}">
    <div class="cp-plate-kicker"><span>${row.year ?? ""} · ${escapeHtml(row.manufacturer)}</span><span class="cp-plate-tag">${tag}</span></div>
    <h3 class="cp-plate-name"><a href="waves/${escapeHtml(row.id)}.html">${escapeHtml(row.series)}</a></h3>
    <p class="cp-plate-meta">${row.owned} of ${row.total} owned${row.baf ? ` · builds ${escapeHtml(row.baf)}` : ""}${row.wanted ? ` · ${row.wanted} wanted` : ""}${row.watching ? ` · ${row.watching} watching` : ""}</p>
    ${bar(row.pct)}
    <p class="cp-plate-missing-label">Still missing — ${row.missingCount === 1 ? "the one figure" : `the ${row.missingCount} figures`} between you and a finished set:</p>
    ${missingList(row, markSets)}
  </article>`;
}

function nearestSection(title, rows, markSets, tag, emptyNote) {
  return `<section class="cp-block" aria-label="${title}">
    <div class="cp-block-head"><h2>${title}</h2><span class="cp-block-count">${rows.length} ${rows.length === 1 ? "wave" : "waves"}</span></div>
    ${rows.length
      ? `<div class="cp-plates">${rows.map((r) => wavePlate(r, markSets, tag)).join("")}</div>`
      : `<p class="cp-none">${emptyNote}</p>`}
  </section>`;
}

function render() {
  const markSets = marks();
  const model = buildCompletionistModel(catalog.figures, catalog.waves, markSets);

  if (model.empty) {
    els.empty.hidden = false;
    els.dash.hidden = true;
    const p = model.preview;
    els.preview.innerHTML = `
      <div class="cp-kpis" aria-label="The archive this page reads">
        ${kpi("Waves in the archive", fmt(p.eras.reduce((n, e) => n + e.waves, 0)), "every one gets a completion row")}
        ${kpi("Figures in the archive", fmt(model.counts.totalFigures), "counted from the catalog itself")}
        ${kpi("Shortest set", `${p.minWaveSize} figures`, "the smallest wave in the archive")}
        ${kpi("Longest set", `${p.maxWaveSize} figures`, "the largest wave in the archive")}
      </div>
      <h3 class="cp-preview-title">Completion by era — the four chapters waiting for your shelves</h3>
      <div class="cp-eras">${p.eras.map((e) => `
        <div class="cp-era">
          <div class="cp-era-head"><span class="cp-era-name">${escapeHtml(e.title)}</span><span class="cp-era-years">${e.years[0]}–${e.years[1]}</span></div>
          <p class="cp-era-meta">${fmt(e.waves)} waves · ${fmt(e.figures)} figures — your owned count will stand against these totals.</p>
        </div>`).join("")}
      </div>
      <h3 class="cp-preview-title">The shortest sets in the archive</h3>
      <p class="cp-preview-note">The waves a new collector finishes first, by size alone — catalog structure, not a collection. Mark figures Owned in <a href="my-vault.html">My Vault</a> and this page starts counting <em>your</em> nearest sets instead.</p>
      <ul class="cp-shortest">${p.smallestWaves.map((w) => `
        <li><a href="waves/${escapeHtml(w.id)}.html">${escapeHtml(w.series)}</a> <span class="cp-short-meta">${w.year ?? ""} · ${escapeHtml(w.manufacturer)} · ${w.total} figures</span></li>`).join("")}
      </ul>`;
    return;
  }
  els.empty.hidden = true;
  els.dash.hidden = false;

  const c = model.counts;
  els.kpis.innerHTML =
    kpi("Archive held", `${c.ownedPct.toFixed(1)}%`, `${fmt(c.owned)} of ${fmt(c.totalFigures)} figures owned`) +
    kpi("Waves complete", fmt(model.completeWaves.length), `of ${fmt(c.totalWaves)} waves in the archive`) +
    kpi("One figure away", fmt(model.oneAway.length), model.oneAway.length ? "the closest sets you own" : "no started wave is that close yet") +
    kpi("Two figures away", fmt(model.twoAway.length), model.twoAway.length ? "one good hunt from the finish line" : "no started wave is that close yet") +
    kpi("Waves touched", fmt(model.touchedWaves.length), "any shelf — owned, wanted or watching");

  els.nearest.innerHTML =
    nearestSection("One figure away", model.oneAway, markSets, "1 to go",
      "No started wave is one figure from complete. Start a wave — one figure Owned — and the moment only one is missing, it hangs here with that figure named.") +
    nearestSection("Two figures away", model.twoAway, markSets, "2 to go",
      "No started wave is two figures from complete yet. Waves at three or more to go wait in the full ledger below.");

  els.eras.innerHTML = `<h2>Completion by era</h2>
    <p class="cp-ledger-note">The Archive Tour's four chapters, counted against your shelves. Every wave and figure belongs to exactly one chapter, so the eras add back up to the whole archive — the same partition the <a href="archive-tour.html">Archive Tour</a> walks.</p>
    <div class="cp-eras">${model.byEra.map((e) => `
      <div class="cp-era">
        <div class="cp-era-head"><span class="cp-era-name">${escapeHtml(e.title)}</span><span class="cp-era-years">${e.years[0]}–${e.years[1]}</span></div>
        ${bar(e.pct)}
        <p class="cp-era-meta">${fmt(e.owned)} of ${fmt(e.figures)} figures owned (${e.pct.toFixed(1)}%) · ${e.wavesComplete} of ${e.waves} waves complete · ${e.wavesTouched} touched${e.oneAway ? ` · ${e.oneAway} one away` : ""}${e.twoAway ? ` · ${e.twoAway} two away` : ""}${e.wanted ? ` · ${fmt(e.wanted)} wanted` : ""}${e.watching ? ` · ${fmt(e.watching)} watching` : ""}</p>
      </div>`).join("")}
    </div>`;

  els.ledger.innerHTML = `<h2>The full ledger — every wave you have touched</h2>
    <p class="cp-ledger-note">Nearest first: fewest figures missing leads. A wave counts as complete only when every figure in it is Owned. Untouched waves stay in the archive — they are unstarted, not nearly done.</p>
    ${model.completeWaves.length ? `<h3 class="cp-ledger-sub">Finished sets</h3>
      <ul class="cp-finished">${model.completeWaves.map((r) => `
        <li><a href="waves/${escapeHtml(r.id)}.html">${escapeHtml(r.series)}</a> <span class="cp-short-meta">${r.year ?? ""} · ${escapeHtml(r.manufacturer)} · ${r.owned}/${r.total} owned</span> <span class="badge badge-baf">Complete</span></li>`).join("")}
      </ul>` : ""}
    <div class="cp-plates">${model.touchedWaves.filter((r) => !r.complete).map((r) =>
      wavePlate(r, markSets, r.started ? `${r.missingCount} to go` : "not started")).join("")}
    </div>`;
}

async function main() {
  try {
    catalog = await loadData();
  } catch (err) {
    els.error.hidden = false;
    els.empty.hidden = true;
    els.dash.hidden = true;
    return;
  }
  render();
}

main();
