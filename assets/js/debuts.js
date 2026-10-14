/* First Appearances, the debut ledger.
   Every distinct character in the catalog, filed under the year of
   their first Marvel Legends figure: the exact debut figure, its
   wave and its maker, counted from the catalog itself and laid out
   in the Archive Tour's four era chapters. A character links to its
   character page only when the archive publishes one; the rest are
   named in full and left unlinked rather than pointed at pages that
   do not exist. No prices, a ledger of firsts, not a market. */
import { loadData } from "./data.js";
import { escapeHtml } from "./figure-dialog.js";
import { buildDebutsModel } from "./debuts-model.js";

const els = {
  kpis: document.getElementById("debut-kpis"),
  latest: document.getElementById("debut-latest"),
  chapters: document.getElementById("debut-chapters"),
  years: document.getElementById("debut-years"),
  error: document.getElementById("debut-error"),
};

const fmt = (n) => n.toLocaleString("en-US");

function kpi(label, value, sub) {
  return `<div class="db-stat"><div class="db-stat-value">${value}</div><div class="db-stat-label">${label}</div>${sub ? `<div class="db-stat-sub">${sub}</div>` : ""}</div>`;
}

function debutRow(d) {
  const name = d.hasPage
    ? `<a href="characters/${escapeHtml(d.slug)}.html">${escapeHtml(d.name)}</a>`
    : escapeHtml(d.name);
  return `<li class="db-row">
      <span class="db-year">${d.year}</span>
      <span class="db-name">${name}</span>
      <span class="db-fig">first figure: ${escapeHtml(d.figure)}</span>
      <span class="db-wave"><a href="waves/${escapeHtml(d.waveId)}.html">${escapeHtml(d.waveSeries)}</a> · ${escapeHtml(d.manufacturer)}</span>
      <span class="db-count">${d.releases} release${d.releases === 1 ? "" : "s"} since</span>
    </li>`;
}

async function main() {
  try {
    const catalog = await loadData();
    let slugs = new Set();
    try {
      const res = await fetch("data/v1/characters.json");
      if (res.ok) {
        const payload = await res.json();
        slugs = new Set((payload.characters || []).map((c) => c.slug));
      }
    } catch { /* character pages are a link affordance, not a dependency */ }
    const m = buildDebutsModel(catalog.figures, slugs);

    els.kpis.innerHTML = [
      kpi("Characters catalogued", fmt(m.total), `first appearances ${m.span[0]}–${m.span[1]}`),
      kpi("Most recent debut year", m.latestYear ?? "n/a", `${m.latest.length} first appearance${m.latest.length === 1 ? "" : "s"} in ${m.latestYear}`),
      kpi("Debuts in the modern era", fmt(m.byChapter[3].debuts.length), `${m.byChapter[3].years[0]}–${m.byChapter[3].years[1]} · the largest chapter`),
      kpi("With a character page", fmt(m.debuts.filter((d) => d.hasPage).length), "the archive's most-collected, linked below"),
    ].join("");

    els.latest.innerHTML = m.latest.length
      ? `<ul class="db-rows">${m.latest.map(debutRow).join("")}</ul>`
      : `<p class="db-none">The catalog records no debuts yet.</p>`;

    els.chapters.innerHTML = m.byChapter.map((c, i) => `
      <section class="db-chapter" aria-labelledby="db-chapter-${i}">
        <div class="db-chapter-head">
          <h3 id="db-chapter-${i}">${escapeHtml(c.title)}</h3>
          <span class="db-chapter-count">${c.years[0]}–${c.years[1]} · ${c.debuts.length} debuts</span>
        </div>
        ${c.debuts.length
          ? `<ul class="db-rows">${c.debuts.map(debutRow).join("")}</ul>`
          : `<p class="db-none">No character debuted in this chapter.</p>`}
      </section>`).join("");

    els.years.innerHTML = m.byYear.map((r) =>
      `<li><span class="db-year">${r.year}</span> <span class="db-year-count">${r.count} debut${r.count === 1 ? "" : "s"}</span></li>`).join("");
  } catch (err) {
    els.error.hidden = false;
    els.error.textContent = "The debut ledger could not be read from the catalog. The archive itself is unaffected, try reloading the page.";
  }
}

main();
