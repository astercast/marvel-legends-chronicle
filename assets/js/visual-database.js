/* The Visual Database — the archive's picture census (door 56).
   Every pictured figure hangs here as an embedded product
   photograph from its retailer/manufacturer source, with its
   places to buy as outbound links; every unpictured figure is
   filed in the fill-in queue and renders typographically, the
   way this whole archive did before pictures. The census is
   counted in this browser from the catalog and the manifest. */
import { loadData } from "./data.js";
import { escapeHtml } from "./figure-dialog.js";
import { loadFigureImages, plateHtml, buyLinksHtml } from "./figure-images.js";
import { buildVisualDatabaseModel } from "./visual-database-model.js";

const els = {
  kpis: document.getElementById("visual-database-kpis"),
  core: document.getElementById("visual-database-core"),
  shelf: document.getElementById("visual-database-shelf"),
  queue: document.getElementById("visual-database-queue"),
  error: document.getElementById("visual-database-error"),
};

const fmt = (n) => n.toLocaleString("en-US");

function kpi(label, value, sub) {
  return `<div class="db-stat"><div class="db-stat-value">${value}</div><div class="db-stat-label">${label}</div>${sub ? `<div class="db-stat-sub">${sub}</div>` : ""}</div>`;
}

function row(label, fig, count) {
  return `<li class="db-row">
      <span class="db-name">${escapeHtml(label)}</span>
      <span class="db-fig">${fig}</span>
      ${count ? `<span class="db-count">${escapeHtml(count)}</span>` : ""}
    </li>`;
}

async function main() {
  try {
    const catalog = await loadData();
    const images = await loadFigureImages();
    const m = buildVisualDatabaseModel(catalog.figures, [...images.values()]);
    const figById = new Map(catalog.figures.map((f) => [f.id, f]));

    els.kpis.innerHTML = [
      kpi("Pictured", fmt(m.picturedCount), `of ${fmt(m.total)} figures in the catalog — the census, counted from the manifest`),
      kpi("Waves with pictures", fmt(m.coveredWaves), `of ${fmt(m.waveRows.length)} waves — ${fmt(m.completeWaves)} of them pictured whole`),
      kpi("Buy links priced", fmt(m.priced), "pictured figures whose retailer listing carried a price when it was recorded — the price lives outbound, at the retailer"),
      kpi("Still typographic", fmt(m.unpicturedCount), "figures in the fill-in queue — they render in type, never as a broken box"),
    ].join("");

    // The pictured core, wave by wave, oldest first.
    els.core.innerHTML = m.waveRows.filter((w) => w.pictured.length).map((w) => `
      <div class="db-chapter">
        <div class="db-chapter-head">
          <h3><a href="waves/${escapeHtml(w.waveId)}.html">${escapeHtml(w.series)}</a></h3>
          <span class="db-chapter-count">${w.year} · ${w.pictured.length} of ${w.total} pictured</span>
        </div>
        <div class="vd-grid">
          ${w.pictured.map((id) => {
            const fig = figById.get(id);
            const entry = m.pictured.get(id);
            return `<article class="vd-card">
              ${plateHtml(entry, fig.name)}
              <h4 class="vd-card-name">${escapeHtml(fig.name)}</h4>
              <p class="vd-card-meta">${escapeHtml(w.series)} · ${w.year}</p>
              ${buyLinksHtml(entry)}
            </article>`;
          }).join("")}
        </div>
      </div>`).join("");

    // The typographic shelf: the unpictured figures of the covered
    // waves, in the archive's plain type treatment — the fallback,
    // shown on purpose.
    const shelfRows = [];
    for (const w of m.waveRows) {
      if (!w.pictured.length) continue;
      for (const name of w.missing) {
        shelfRows.push(row(name, `${escapeHtml(w.series)} · ${w.year}`, "no picture yet — filed typographic"));
      }
    }
    els.shelf.innerHTML = shelfRows.length
      ? `<ul class="db-rows">${shelfRows.join("")}</ul>`
      : `<p class="db-none">Every figure in the pictured waves has its picture — the shelf is empty.</p>`;

    // The fill-in queue: every wave with figures still unpictured,
    // nearest complete first, then most recent first.
    els.queue.innerHTML = `<ul class="db-rows">${m.queue.map((w) =>
      row(`${w.series} (${w.year})`,
        `${w.pictured.length} of ${w.total} pictured — still to file: ${escapeHtml(w.missing.join(", "))}`,
        `${w.missing.length} to go`)).join("")}</ul>`;
  } catch (err) {
    els.error.hidden = false;
    els.error.textContent = "The visual database could not be counted. The archive itself is unaffected — try reloading the page.";
  }
}

main();
