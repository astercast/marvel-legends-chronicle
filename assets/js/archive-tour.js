/* The Archive Tour, a guided museum tour through the catalog's
   25 years. Four era chapters, each a designed editorial spread:
   the counts the catalog itself carries, a per-year ledger, and
   curator picks chosen by the printed selection rules (see
   archive-tour-model.js) from catalog data only. No prices anywhere:
   a tour is about the record, not the market. */
import { loadData } from "./data.js";
import { escapeHtml } from "./figure-dialog.js";
import { buildTourModel } from "./archive-tour-model.js";

const els = {
  kpis: document.getElementById("tour-kpis"),
  route: document.getElementById("tour-route"),
  chapters: document.getElementById("tour-chapters"),
  error: document.getElementById("tour-error"),
};

const fmt = (n) => n.toLocaleString("en-US");

function kpi(label, value, sub) {
  return `<div class="at-stat"><div class="at-stat-value">${value}</div><div class="at-stat-label">${label}</div>${sub ? `<div class="at-stat-sub">${sub}</div>` : ""}</div>`;
}

function badges(fig) {
  const out = [];
  if (fig.bafPiece) out.push(`<span class="badge badge-baf">BAF piece · ${escapeHtml(fig.bafPiece)}</span>`);
  if (fig.exclusive) out.push(`<span class="badge badge-exclusive">${escapeHtml(fig.exclusive)}</span>`);
  if (fig.variant) out.push(`<span class="badge badge-variant">${escapeHtml(fig.variant)}</span>`);
  return out.length ? `<div class="at-pick-tags">${out.join("")}</div>` : "";
}

function pickCard(pick) {
  const fig = pick.figure;
  return `<article class="at-pick" data-pick-kind="${escapeHtml(pick.kind)}">
    <div class="at-pick-kicker"><span>${escapeHtml(pick.label)}</span><span>${fig.year}</span></div>
    <h4 class="at-pick-name">${escapeHtml(fig.name)}</h4>
    <p class="at-pick-meta">${escapeHtml(fig.waveSeries)} · ${escapeHtml(fig.manufacturer)}${fig.waveBaf ? ` · builds ${escapeHtml(fig.waveBaf)}` : ""}</p>
    ${badges(fig)}
    ${fig.notes ? `<p class="at-pick-notes">${escapeHtml(fig.notes)}</p>` : ""}
    <p class="at-pick-rule">Selection rule, ${escapeHtml(pick.rule.toLowerCase())}.</p>
    <a class="at-pick-link" href="waves/${escapeHtml(fig.waveId)}.html">View its wave in the archive →</a>
  </article>`;
}

function chapterSection(ch, i, total) {
  const c = ch.counts;
  const prev = i > 0 ? `<a href="#chapter-${i}">← Chapter ${["I", "II", "III", "IV"][i - 1]}</a>` : "";
  const next = i < total - 1
    ? `<a href="#chapter-${i + 2}">Chapter ${["I", "II", "III", "IV"][i + 1]} →</a>`
    : `<a href="vault-room.html">Finish in the Vault Room →</a>`;
  const maxFigs = Math.max(...ch.yearRows.map((r) => r.figures), 1);
  return `<section class="at-chapter" id="chapter-${i + 1}" aria-labelledby="chapter-title-${i + 1}">
    <div class="at-chapter-head">
      <span class="hero-kicker">${escapeHtml(ch.kicker)}</span>
      <h2 id="chapter-title-${i + 1}">${escapeHtml(ch.title)}</h2>
      <p class="at-why">${escapeHtml(ch.why)}</p>
    </div>
    <div class="at-counts" aria-label="Chapter counts">
      ${kpi("Waves", fmt(c.waves), `${ch.years[0]}–${ch.years[1]}`)}
      ${kpi("Figures", fmt(c.figures), `${c.avgWaveSize.toFixed(1)} per wave on average`)}
      ${kpi("BAF waves", fmt(c.bafWaves), `${fmt(c.bafPieceFigures)} piece-carrying figures`)}
      ${kpi("Exclusives", fmt(c.exclusives), "figures the catalog marks exclusive")}
      ${kpi("Variants", fmt(c.variants), "figures the catalog marks as variants")}
    </div>
    <div class="at-years" aria-label="Year by year in this chapter">
      ${ch.yearRows.map((r) => `
        <div class="at-year-row">
          <span class="at-year-label">${r.year}</span>
          <div class="at-bar" role="img" aria-label="${r.figures} figures in ${r.year}"><span style="width:${((r.figures / maxFigs) * 100).toFixed(1)}%"></span></div>
          <span class="at-year-count">${r.figures} figs · ${r.waves} waves${r.bafWaves ? ` · ${r.bafWaves} BAF` : ""}</span>
        </div>`).join("")}
    </div>
    <h3 class="at-picks-title">Curator picks</h3>
    <p class="at-picks-note">Chosen by the selection rules printed under <a href="#how-picks-work">How the picks work</a>, catalog data only, the same rules in every chapter.</p>
    <div class="at-picks">${ch.picks.map(pickCard).join("")}</div>
    ${ch.emptyRules.length ? `<p class="at-empty-rules">${ch.emptyRules.map((r) => `No <strong>${escapeHtml(r.label.toLowerCase())}</strong> pick hangs in this chapter, the rule (${escapeHtml(r.rule.toLowerCase())}) found nothing in the catalog for these years, so the slot stands empty rather than filled by hand.`).join(" ")}</p>` : ""}
    <nav class="at-chapter-nav" aria-label="Tour route">${prev}<span class="at-chapter-step">Stop ${i + 1} of ${total}</span>${next}</nav>
  </section>`;
}

function render(model) {
  const t = model.totals;
  els.kpis.innerHTML =
    kpi("Years on tour", `${t.yearMin}–${t.yearMax}`, "four chapters, one archive") +
    kpi("Waves", fmt(t.waves), "every wave in the catalog, chaptered") +
    kpi("Figures", fmt(t.figures), "counted from the catalog itself") +
    kpi("BAF waves", fmt(t.bafWaves), "waves carrying a Build-A-Figure") +
    kpi("Exclusives", fmt(t.exclusives), "retailer & convention pieces") +
    kpi("Variants", fmt(t.variants), "recorded variants, all eras");

  els.route.innerHTML = model.chapters.map((ch, i) =>
    `<a class="at-route-stop" href="#chapter-${i + 1}"><span class="at-route-years">${ch.years[0]}–${ch.years[1]}</span><span class="at-route-title">${escapeHtml(ch.title)}</span><span class="at-route-count">${fmt(ch.counts.figures)} figures · ${fmt(ch.counts.waves)} waves</span></a>`
  ).join("");

  els.chapters.innerHTML = model.chapters.map((ch, i) => chapterSection(ch, i, model.chapters.length)).join("");
}

async function main() {
  let catalog;
  try {
    catalog = await loadData();
  } catch (err) {
    els.error.hidden = false;
    return;
  }
  render(buildTourModel(catalog.figures, catalog.waves));
}

main();
