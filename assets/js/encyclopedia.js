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
};

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

function hofCard(h) {
  const card = document.createElement("article");
  card.className = "card hof-card";
  card.innerHTML = `
    <h3>${escapeHtml(h.name)}</h3>
    <div class="tag-row">
      <span class="badge ${h.era === "Toy Biz" ? "badge-toybiz" : ""}">${escapeHtml(h.era)}</span>
      ${h.verified ? "" : `<span class="badge badge-flag">Unverified claim</span>`}
    </div>
    ${h.price ? `<div class="hof-price">${escapeHtml(h.price)}</div>` : ""}
    <p>${escapeHtml(h.why)}</p>
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
  for (const h of filtered) els.hof.appendChild(hofCard(h));
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
