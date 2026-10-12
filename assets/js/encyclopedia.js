/* Encyclopedia page — history, hall of fame, bootleg guide, resources. */
import { PATHS } from "./config.js";
import { escapeHtml } from "./figure-dialog.js";

const els = {
  history: document.getElementById("history-list"),
  hof: document.getElementById("hof-grid"),
  hofSearch: document.getElementById("hof-search"),
  hofEra: document.getElementById("hof-era"),
  guides: document.getElementById("guide-grid"),
  resources: document.getElementById("resource-grid"),
  packaging: document.getElementById("packaging-grid"),
  variants: document.getElementById("variants-grid"),
  grading: document.getElementById("grading-grid"),
};

const CONF_LABEL = {
  "single-source": "Single source",
  anecdote: "Anecdote",
  unverified: "Unverified",
  analysis: "Chronicle analysis",
};

function provenance(it) {
  const src = it.url
    ? `<a href="${escapeHtml(it.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(it.source)}</a>`
    : escapeHtml(it.source);
  const badge = CONF_LABEL[it.confidence]
    ? `<span class="badge-conf ${escapeHtml(it.confidence)}">${CONF_LABEL[it.confidence]}</span>`
    : "";
  return `<span class="provenance">Source: ${src}${badge}</span>`;
}

function renderDocGuide(el, sections) {
  if (!el) return;
  el.innerHTML = "";
  for (const s of sections) {
    const card = document.createElement("article");
    card.className = "card doc-card";
    const items = s.items
      .map((it) => `<li>${escapeHtml(it.text)}${provenance(it)}</li>`)
      .join("");
    card.innerHTML = `
      <h3>${escapeHtml(s.title)}</h3>
      <div class="doc-time">${escapeHtml(s.timeframe)}</div>
      <ul>${items}</ul>`;
    el.appendChild(card);
  }
}

function renderHistory(events) {
  els.history.innerHTML = "";
  for (const e of events) {
    const div = document.createElement("div");
    div.className = "history-event";
    div.innerHTML = `
      <span class="history-year">${e.year}</span>
      <span class="history-era">${escapeHtml(e.era)}</span>
      <p>${escapeHtml(e.detail)}</p>`;
    els.history.appendChild(div);
  }
}

function hofCard(h, stopNo) {
  const card = document.createElement("article");
  card.className = "card hof-card";
  const radar = h.reissueRadar
    ? `<p class="radar-line">Reissue radar: <span class="${h.reissueRadar.level === "resilient" ? "radar-res" : "radar-vul"}">${escapeHtml(h.reissueRadar.level)}</span> <span class="radar-note">— ${escapeHtml(h.reissueRadar.note)}</span></p>`
    : "";
  card.innerHTML = `
    <span class="stop-no">Audio-guide stop № ${stopNo}</span>
    <h3>${escapeHtml(h.name)}</h3>
    <div class="tag-row">
      <span class="badge ${h.era === "Toy Biz" ? "badge-toybiz" : ""}">${escapeHtml(h.era)}</span>
      ${h.verified ? "" : `<span class="badge badge-flag">Unverified claim</span>`}
    </div>
    ${h.price ? `<div class="hof-price">${escapeHtml(h.price)}</div>` : ""}
    <p>${escapeHtml(h.why)}</p>
    ${radar}
    <p style="font-size:0.78rem;color:var(--muted);margin:0;">${escapeHtml(h.priceNote ?? "")}</p>`;
  return card;
}

function renderHof(list) {
  const q = els.hofSearch.value.trim().toLowerCase();
  const era = els.hofEra.value;
  els.hof.innerHTML = "";
  const filtered = list.filter((h) => {
    if (era !== "all" && h.era !== era) return false;
    if (q && !(h.name + " " + h.why).toLowerCase().includes(q)) return false;
    return true;
  });
  if (!filtered.length) {
    els.hof.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><p>No hall-of-fame entries match.</p></div>`;
    return;
  }
  for (const h of filtered) els.hof.appendChild(hofCard(h, String(list.indexOf(h) + 1).padStart(2, "0")));
}

function renderGuides(sections) {
  els.guides.innerHTML = "";
  for (const s of sections) {
    const card = document.createElement("article");
    card.className = "card guide-card";
    card.innerHTML = `<h3>${escapeHtml(s.title)}</h3><ul>${s.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
    els.guides.appendChild(card);
  }
}

function renderResources(resources) {
  els.resources.innerHTML = "";
  for (const r of resources) {
    const a = document.createElement("a");
    a.className = "card resource-card";
    a.href = r.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.innerHTML = `
      <h3>${escapeHtml(r.name)}</h3>
      <p>${escapeHtml(r.bestFor)}</p>
      <span class="ext">${escapeHtml(new URL(r.url).hostname)} ↗</span>`;
    els.resources.appendChild(a);
  }
}

async function init() {
  try {
    const res = await fetch(PATHS.encyclopedia);
    if (!res.ok) throw new Error(`encyclopedia.json: ${res.status}`);
    const data = await res.json();
    renderHistory(data.history);
    renderHof(data.hallOfFame);
    renderGuides(data.bootlegGuide.sections);
    renderResources(data.resources);
    renderDocGuide(els.packaging, (data.packagingGuide || {}).sections);
    renderDocGuide(els.variants, (data.variantsGuide || {}).sections);
    renderDocGuide(els.grading, (data.gradingGuide || {}).sections);
    let debounce;
    els.hofSearch.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => renderHof(data.hallOfFame), 180);
    });
    els.hofEra.addEventListener("change", () => renderHof(data.hallOfFame));
  } catch (err) {
    console.error(err);
    document.getElementById("encyc-main").innerHTML =
      `<div class="empty-state"><p>Could not load the encyclopedia data.</p></div>`;
  }
}

init();
