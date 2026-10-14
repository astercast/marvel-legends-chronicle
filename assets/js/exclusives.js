/* Exclusives browser, browse the 587 retailer exclusives by retailer.
   Retailer comes straight from the figure's `exclusive` field; values that
   name no retailer ("Box set exclusive", "Made-to-order") are grouped as
   "Other / retailer unconfirmed" rather than guessed. */
import { PATHS, STORE_KEYS } from "./config.js";
import { loadData, searchFigures } from "./data.js";
import { load } from "./store.js";
import { escapeHtml } from "./figure-dialog.js";
import { trackerButtons, owned, wanted } from "./tracker.js";
import { renderResearchLinks } from "./listings.js";

const UNCONFIRMED = new Set(["Box set exclusive", "Made-to-order"]);

function retailerOf(fig) {
  const v = (fig.exclusive || "").trim();
  if (!v || UNCONFIRMED.has(v)) return "Other / retailer unconfirmed";
  return v;
}

const els = {
  chips: document.getElementById("exc-chips"),
  search: document.getElementById("exc-search"),
  count: document.getElementById("exc-count"),
  grid: document.getElementById("exc-grid"),
  empty: document.getElementById("exc-empty"),
  coverage: document.getElementById("exc-coverage"),
};

let allExclusives = [];
let activeRetailer = "all";

function card(fig) {
  const art = document.createElement("article");
  art.className = "card exc-card";
  art.dataset.figId = fig.id;
  const dots = owned.has(fig.id)
    ? `<span class="owned-dot" aria-hidden="true"></span>`
    : wanted.has(fig.id) ? `<span class="wanted-dot" aria-hidden="true"></span>` : "";
  art.innerHTML = `
    <h3>${escapeHtml(fig.name)}${dots}</h3>
    <div class="sub">${escapeHtml(fig.waveSeries)} · ${fig.year} · ${escapeHtml(fig.manufacturer)}</div>
    <div class="tag-row">
      <span class="badge badge-exc">${escapeHtml(retailerOf(fig))}</span>
      ${fig.variant ? `<span class="badge badge-variant">${escapeHtml(fig.variant)}</span>` : ""}
      ${fig.waveBaf ? `<span class="badge">BAF: ${escapeHtml(fig.waveBaf)}</span>` : ""}
    </div>`;
  art.appendChild(trackerButtons(fig.id));
  const det = document.createElement("details");
  det.className = "research";
  const sum = document.createElement("summary");
  sum.textContent = "Research this figure";
  det.appendChild(sum);
  det.appendChild(renderResearchLinks(fig));
  art.appendChild(det);
  return art;
}

function render() {
  const q = els.search.value.trim().toLowerCase();
  let list = allExclusives.filter((f) => activeRetailer === "all" || retailerOf(f) === activeRetailer);
  if (q.length >= 2) {
    list = list.filter((f) =>
      f.name.toLowerCase().includes(q) ||
      (f.variant ?? "").toLowerCase().includes(q) ||
      f.waveSeries.toLowerCase().includes(q));
  }
  els.count.textContent = `${list.length} of ${allExclusives.length} exclusives`;
  els.empty.hidden = list.length > 0;
  els.grid.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const f of list.slice(0, 400)) frag.appendChild(card(f));
  els.grid.appendChild(frag);
  if (list.length > 400) {
    const more = document.createElement("p");
    more.className = "chart-sub";
    more.textContent = `Showing the first 400 of ${list.length}, narrow the search or pick a retailer.`;
    els.grid.appendChild(more);
  }
  els.chips.querySelectorAll("[data-ret]").forEach((c) => {
    const on = c.dataset.ret === activeRetailer;
    c.classList.toggle("chip-on", on);
    c.setAttribute("aria-pressed", String(on));
  });
}

async function main() {
  let figures = [];
  try {
    ({ figures } = await loadData());
  } catch {
    els.grid.innerHTML = `<div class="empty-state"><p>Could not load the figure archive.</p></div>`;
    return;
  }
  allExclusives = figures.filter((f) => f.exclusive).sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));

  const byRet = new Map();
  for (const f of allExclusives) {
    const r = retailerOf(f);
    byRet.set(r, (byRet.get(r) ?? 0) + 1);
  }
  const rets = [...byRet.entries()].sort((a, b) => b[1] - a[1]);
  const named = allExclusives.filter((f) => retailerOf(f) !== "Other / retailer unconfirmed").length;

  els.coverage.innerHTML =
    `<strong>${allExclusives.length}</strong> exclusives in the archive · ` +
    `<strong>${named}</strong> with a named retailer · ` +
    `<strong>${allExclusives.length - named}</strong> grouped as "retailer unconfirmed" ` +
    `(<em>Box set exclusive</em> / <em>Made-to-order</em>, we don't guess). ` +
    `Retailer taxonomy: <a href="encyclopedia.html#variants">encyclopedia → variants &amp; exclusives</a>.`;

  const frag = document.createDocumentFragment();
  const mkChip = (ret, n, label) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.dataset.ret = ret;
    b.setAttribute("aria-pressed", ret === "all" ? "true" : "false");
    b.innerHTML = `${escapeHtml(label)} <span class="chip-n">${n}</span>`;
    b.addEventListener("click", () => { activeRetailer = ret; render(); });
    return b;
  };
  frag.appendChild(mkChip("all", allExclusives.length, "All retailers"));
  for (const [r, n] of rets) frag.appendChild(mkChip(r, n, r));
  els.chips.appendChild(frag);

  let debounce;
  els.search.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(render, 180);
  });

  render();
}

main();
