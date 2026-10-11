/* Grail watchlist — track figures you hunt, set your own max price,
   log sightings, and get an honest "deal or no deal" against YOUR target.
   Storage: mlc_watchlist_v1. Targets are the user's own — no market claims. */
import { PATHS, STORE_KEYS } from "./config.js";
import { loadData } from "./data.js";
import { load, save } from "./store.js";
import { escapeHtml } from "./figure-dialog.js";
import { soldSearchUrl } from "./listings.js";

const WHERE_SUGGESTIONS = ["eBay", "eBay sold listings", "BigBadToyStore", "Hasbro Pulse", "Amazon", "Local comic shop", "Toy show / convention", "Facebook Marketplace", "Mercari", "Whatnot"];

const els = {
  form: document.getElementById("wl-form"),
  figure: document.getElementById("wl-figure"),
  figures: document.getElementById("wl-figures"),
  target: document.getElementById("wl-target"),
  note: document.getElementById("wl-note"),
  error: document.getElementById("wl-error"),
  summary: document.getElementById("wl-summary"),
  empty: document.getElementById("wl-empty"),
  list: document.getElementById("wl-list"),
  export: document.getElementById("watchlist-export"),
  import: document.getElementById("watchlist-import"),
  importLabel: document.getElementById("watchlist-import-label"),
};

let labelToFig = new Map();

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : `w${Date.now()}${Math.random().toString(16).slice(2)}`);
}

function getList() {
  const raw = load(STORE_KEYS.watchlist, []);
  return Array.isArray(raw) ? raw.filter((e) => e && typeof e === "object") : [];
}

function setList(list) {
  save(STORE_KEYS.watchlist, list);
}

function money(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function cleanSightings(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s) => s && typeof s === "object").map((s) => ({
    id: typeof s.id === "string" ? s.id : uid(),
    date: typeof s.date === "string" ? s.date : "",
    where: typeof s.where === "string" ? s.where.slice(0, 80) : "",
    price: Number.isFinite(Number(s.price)) && Number(s.price) > 0 ? Math.round(Number(s.price) * 100) / 100 : null,
    sold: s.sold === true,
    url: typeof s.url === "string" ? s.url.slice(0, 500) : "",
    note: typeof s.note === "string" ? s.note.slice(0, 140) : "",
  }));
}

/* Verdict of one sighting against the user's own target. */
function verdict(sighting, target) {
  if (sighting.price == null || !(target > 0)) return null;
  const diff = Math.round((sighting.price - target) * 100) / 100;
  if (diff <= 0) {
    return { cls: "deal-good", text: sighting.sold ? `Sold ${money(sighting.price)} — under your target by ${money(-diff)}` : `Under your target by ${money(-diff)} — deal` };
  }
  return { cls: "deal-bad", text: sighting.sold ? `Sold ${money(sighting.price)} — over your target by ${money(diff)}` : `Over your target by ${money(diff)} — no deal` };
}

function bestSighting(entry) {
  const priced = (entry.sightings || []).filter((s) => s.price != null);
  if (!priced.length) return null;
  return priced.reduce((a, b) => (a.price <= b.price ? a : b));
}

function renderSummary(list) {
  const deals = list.filter((e) => {
    const b = bestSighting(e);
    return b && e.target > 0 && b.price <= e.target;
  }).length;
  const withSightings = list.filter((e) => (e.sightings || []).length > 0).length;
  els.summary.innerHTML =
    `<div class="stat"><div class="stat-value">${list.length}</div><div class="stat-label">Hunts open</div></div>` +
    `<div class="stat"><div class="stat-value">${withSightings}</div><div class="stat-label">With sightings</div></div>` +
    `<div class="stat"><div class="stat-value">${deals}</div><div class="stat-label">Deals at/under target</div></div>`;
}

function sightingRow(entry, s) {
  const v = verdict(s, entry.target);
  return `<li class="sight">
    <div class="sight-head">
      <span class="sight-where">${escapeHtml(s.where || "Unknown venue")}</span>
      <span class="sight-date">${escapeHtml(s.date || "")}</span>
      ${s.price != null ? `<span class="sight-price">${money(s.price)}</span>` : `<span class="muted">no price</span>`}
      ${s.sold ? `<span class="badge">sold</span>` : `<span class="badge badge-ghost">asking</span>`}
    </div>
    ${v ? `<p class="deal ${v.cls}">${escapeHtml(v.text)}</p>` : ""}
    <div class="sight-meta">
      ${s.url ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">listing ↗</a>` : ""}
      ${s.note ? `<span class="muted">${escapeHtml(s.note)}</span>` : ""}
      <button type="button" class="btn btn-sm btn-ghost" data-del-sight="${escapeHtml(entry.id)}:${escapeHtml(s.id)}">Remove</button>
    </div>
  </li>`;
}

function entryCard(entry) {
  const li = document.createElement("li");
  li.className = "card hunt";
  li.style.padding = "var(--space-4)";
  const best = bestSighting(entry);
  const v = best ? verdict(best, entry.target) : null;
  const soldUrl = soldSearchUrl(`Marvel Legends ${entry.name}`);
  li.innerHTML = `
    <div class="entry-head">
      <span class="entry-name">${escapeHtml(entry.name)}</span>
      ${entry.wave ? `<span class="entry-wave">${escapeHtml(entry.wave)}</span>` : ""}
    </div>
    <div class="entry-meta">
      <span>Your max: <strong class="entry-price">${money(entry.target)}</strong></span>
      <span class="muted">${(entry.sightings || []).length} sighting${(entry.sightings || []).length === 1 ? "" : "s"}</span>
      ${v ? `<span class="deal ${v.cls} deal-inline">${escapeHtml(v.text.split("—")[0])}</span>` : ""}
    </div>
    ${entry.note ? `<p class="entry-note">${escapeHtml(entry.note)}</p>` : ""}
    <ul class="sight-list">${(entry.sightings || []).map((s) => sightingRow(entry, s)).join("")}</ul>
    <details class="sight-form-wrap">
      <summary>Log a sighting</summary>
      <form class="sight-form" data-entry="${escapeHtml(entry.id)}">
        <div class="form-row">
          <div class="field"><label>Where <input class="input" name="where" list="wl-where" placeholder="eBay" maxlength="80"></label></div>
          <div class="field"><label>Price (USD) <input class="input" name="price" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="35.00"></label></div>
          <div class="field"><label>Date <input class="input" name="date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label></div>
        </div>
        <div class="form-row">
          <div class="field"><label class="check"><input type="checkbox" name="sold"> Actually sold (not just asking)</label></div>
          <div class="field"><label>Listing URL <input class="input" name="url" type="url" inputmode="url" placeholder="https://…"></label></div>
        </div>
        <div class="field"><label>Note <input class="input" name="note" maxlength="140" placeholder="e.g. box crease, best offer accepted"></label></div>
        <p class="form-error" role="alert"></p>
        <div class="btn-row"><button type="submit" class="btn btn-sm btn-gold">Log sighting</button></div>
      </form>
    </details>
    <div class="entry-actions">
      <a class="btn btn-sm" href="${soldUrl}" target="_blank" rel="noopener noreferrer">eBay solds ↗</a>
      <button type="button" class="btn btn-sm btn-ghost" data-del-entry="${escapeHtml(entry.id)}">Stop hunting</button>
    </div>`;
  return li;
}

function render() {
  const list = getList().sort((a, b) => (b.created || "").localeCompare(a.created || ""));
  renderSummary(list);
  els.empty.hidden = list.length > 0;
  els.list.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const e of list) frag.appendChild(entryCard(e));
  els.list.appendChild(frag);
}

function exportJson() {
  const blob = new Blob([JSON.stringify(getList(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "mlc-watchlist.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      const clean = parsed.filter((e) => e && typeof e.name === "string" && Number(e.target) > 0).map((e) => ({
        id: typeof e.id === "string" ? e.id : uid(),
        figId: typeof e.figId === "string" ? e.figId : null,
        name: e.name.slice(0, 120),
        wave: typeof e.wave === "string" ? e.wave.slice(0, 120) : "",
        target: Math.round(Number(e.target) * 100) / 100,
        note: typeof e.note === "string" ? e.note.slice(0, 140) : "",
        created: typeof e.created === "string" ? e.created : new Date().toISOString(),
        sightings: cleanSightings(e.sightings),
      }));
      const seen = new Set(getList().map((e) => e.id));
      setList([...getList(), ...clean.filter((e) => !seen.has(e.id))]);
      render();
      els.error.textContent = "";
    } catch {
      els.error.textContent = "Import failed — that file isn't a valid watchlist export.";
    }
  };
  reader.readAsText(file);
}

async function main() {
  let figures = [];
  try {
    ({ figures } = await loadData());
  } catch {
    els.list.innerHTML = `<li class="empty-state"><p>Could not load the figure archive.</p></li>`;
    return;
  }

  // Figure datalist
  const frag = document.createDocumentFragment();
  labelToFig = new Map();
  for (const f of figures) {
    const label = `${f.name} — ${f.waveSeries} (${f.year})`;
    if (labelToFig.has(label)) continue;
    labelToFig.set(label, f);
    const opt = document.createElement("option");
    opt.value = label;
    frag.appendChild(opt);
  }
  els.figures.appendChild(frag);
  const whereList = document.getElementById("wl-where");
  for (const w of WHERE_SUGGESTIONS) {
    const opt = document.createElement("option");
    opt.value = w;
    whereList.appendChild(opt);
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const label = els.figure.value.trim();
    const target = parseFloat(els.target.value);
    if (!label) { els.error.textContent = "Pick a figure to hunt."; return; }
    if (!Number.isFinite(target) || target <= 0) { els.error.textContent = "Set a max price above $0 — that's the whole point of the hunt."; return; }
    const fig = labelToFig.get(label);
    const list = getList();
    if (fig && list.some((x) => x.figId === fig.id)) { els.error.textContent = "That figure is already on your watchlist."; return; }
    list.push({
      id: uid(),
      figId: fig ? fig.id : null,
      name: fig ? fig.name : label,
      wave: fig ? `${fig.waveSeries} (${fig.year})` : "",
      target: Math.round(target * 100) / 100,
      note: els.note.value.trim().slice(0, 140),
      created: new Date().toISOString(),
      sightings: [],
    });
    setList(list);
    els.form.reset();
    els.error.textContent = "";
    render();
  });

  els.list.addEventListener("submit", (e) => {
    const form = e.target.closest(".sight-form");
    if (!form) return;
    e.preventDefault();
    const entryId = form.dataset.entry;
    const err = form.querySelector(".form-error");
    const fd = new FormData(form);
    const price = parseFloat(fd.get("price"));
    const url = String(fd.get("url") || "").trim();
    if (fd.get("price") && (!Number.isFinite(price) || price <= 0)) { err.textContent = "Price must be above $0."; return; }
    if (url && !/^https?:\/\//i.test(url)) { err.textContent = "URL must start with http(s)://."; return; }
    const list = getList();
    const entry = list.find((x) => x.id === entryId);
    if (!entry) return;
    entry.sightings = entry.sightings || [];
    entry.sightings.push({
      id: uid(),
      date: String(fd.get("date") || new Date().toISOString().slice(0, 10)),
      where: String(fd.get("where") || "").trim().slice(0, 80),
      price: fd.get("price") ? Math.round(price * 100) / 100 : null,
      sold: fd.get("sold") === "on",
      url, note: String(fd.get("note") || "").trim().slice(0, 140),
    });
    setList(list);
    render();
  });

  els.list.addEventListener("click", (e) => {
    const delEntry = e.target.closest("[data-del-entry]");
    const delSight = e.target.closest("[data-del-sight]");
    if (delEntry) {
      const entry = getList().find((x) => x.id === delEntry.dataset.delEntry);
      if (entry && confirm(`Stop hunting "${entry.name}"? Its sightings go too.`)) {
        setList(getList().filter((x) => x.id !== entry.id));
        render();
      }
    } else if (delSight) {
      const [entryId, sightId] = delSight.dataset.delSight.split(":");
      const list = getList();
      const entry = list.find((x) => x.id === entryId);
      if (entry) {
        entry.sightings = (entry.sightings || []).filter((s) => s.id !== sightId);
        setList(list);
        render();
      }
    }
  });

  els.export.addEventListener("click", exportJson);
  els.import.addEventListener("change", (e) => {
    if (e.target.files[0]) importJson(e.target.files[0]);
    e.target.value = "";
  });

  render();
}

main();
