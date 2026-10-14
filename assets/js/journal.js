/* Price Journal, personal sold-price log.
   Storage: mlc_journal_v1 (array of entries). Every value shown on this page
   is computed from the user's own logged entries, no scraped data, no
   invented prices. */
import { PATHS, STORE_KEYS } from "./config.js";
import { loadData } from "./data.js";
import { load, save } from "./store.js";
import { escapeHtml } from "./figure-dialog.js";
import { soldSearchUrl } from "./listings.js";
import { entriesForFigure, trendStats, sparklineSVG, directionBadge } from "./price-trends.js";

const CONDITIONS = {
  "loose-complete": "Loose, complete",
  "loose-incomplete": "Loose, incomplete",
  "mib": "Mint in box",
  "moc": "Mint on card",
  "graded": "Graded",
};

const els = {
  form: document.getElementById("journal-form"),
  figure: document.getElementById("j-figure"),
  figures: document.getElementById("j-figures"),
  condition: document.getElementById("j-condition"),
  price: document.getElementById("j-price"),
  date: document.getElementById("j-date"),
  url: document.getElementById("j-url"),
  note: document.getElementById("j-note"),
  error: document.getElementById("j-error"),
  submit: document.getElementById("j-submit"),
  cancelEdit: document.getElementById("j-cancel-edit"),
  soldSearch: document.getElementById("j-sold-search"),
  count: document.getElementById("j-count"),
  empty: document.getElementById("j-empty"),
  list: document.getElementById("j-list"),
  export: document.getElementById("journal-export"),
  import: document.getElementById("journal-import"),
  condFilter: document.getElementById("j-cond-filter"),
  total: document.getElementById("j-total"),
  valueNote: document.getElementById("j-value-note"),
  breakdown: document.querySelector("#j-breakdown tbody"),
  unpriced: document.getElementById("j-unpriced"),
  trends: document.getElementById("j-trends"),
};

let labelToFig = new Map(); // datalist label -> figure
let editingId = null;

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : `e${Date.now()}${Math.random().toString(16).slice(2)}`);
}

function getEntries() {
  const raw = load(STORE_KEYS.journal, []);
  return Array.isArray(raw) ? raw.filter((e) => e && typeof e === "object") : [];
}

function setEntries(entries) {
  save(STORE_KEYS.journal, entries);
}

function money(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function condBadge(cond) {
  return `<span class="badge">${escapeHtml(CONDITIONS[cond] ?? cond)}</span>`;
}

/* ---------- form ---------- */

function resetForm() {
  els.form.reset();
  els.date.value = new Date().toISOString().slice(0, 10);
  els.error.textContent = "";
  editingId = null;
  els.submit.textContent = "Log entry";
  els.cancelEdit.hidden = true;
}

function validate() {
  const name = els.figure.value.trim();
  const price = parseFloat(els.price.value);
  const date = els.date.value;
  if (!name) return "Enter a figure name.";
  if (!Number.isFinite(price) || price <= 0) return "Enter a sold price above $0.";
  if (!date) return "Enter the sold date.";
  const url = els.url.value.trim();
  if (url && !/^https?:\/\//i.test(url)) return "Listing URL must start with http(s)://.";
  return null;
}

function readForm() {
  const label = els.figure.value.trim();
  const fig = labelToFig.get(label) ?? null;
  return {
    id: editingId ?? uid(),
    figId: fig ? fig.id : null,
    name: fig ? fig.name : label,
    wave: fig ? `${fig.waveSeries} (${fig.year})` : "",
    condition: els.condition.value,
    price: Math.round(parseFloat(els.price.value) * 100) / 100,
    date: els.date.value,
    url: els.url.value.trim(),
    note: els.note.value.trim(),
  };
}

/* ---------- list ---------- */

function renderList() {
  const entries = getEntries()
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.id || "").localeCompare(a.id || ""));
  els.count.textContent = entries.length ? `(${entries.length})` : "";
  els.empty.hidden = entries.length > 0;
  els.list.innerHTML = entries.map((e) => `
    <li class="card entry" style="padding:var(--space-4)">
      <div class="entry-head">
        <span class="entry-name">${escapeHtml(e.name)}</span>
        ${e.wave ? `<span class="entry-wave">${escapeHtml(e.wave)}</span>` : ""}
        ${condBadge(e.condition)}
      </div>
      <div class="entry-meta">
        <span class="entry-price">${money(e.price)}</span>
        <span class="entry-date">${escapeHtml(e.date || "")}</span>
        ${e.url ? `<a href="${escapeHtml(e.url)}" target="_blank" rel="noopener noreferrer">sold listing ↗</a>` : `<span class="muted">no listing link</span>`}
      </div>
      ${e.note ? `<p class="entry-note">${escapeHtml(e.note)}</p>` : ""}
      <div class="entry-actions">
        <button type="button" class="btn btn-sm" data-edit="${escapeHtml(e.id)}">Edit</button>
        <button type="button" class="btn btn-sm btn-ghost" data-del="${escapeHtml(e.id)}">Delete</button>
      </div>
    </li>`).join("");
}

/* ---------- value ---------- */

function renderValue(figures) {
  const byId = new Map(figures.map((f) => [f.id, f]));
  const ownedIds = new Set(load(STORE_KEYS.owned, []).filter((id) => byId.has(id)));
  const entries = getEntries();
  const cond = els.condFilter.value;

  const rows = [];
  const unpriced = [];
  for (const id of ownedIds) {
    const fig = byId.get(id);
    const matched = entries.filter((e) =>
      (e.figId === id || (!e.figId && e.name.toLowerCase() === fig.name.toLowerCase())) &&
      (cond === "all" || e.condition === cond));
    if (!matched.length) { unpriced.push(fig); continue; }
    const prices = matched.map((e) => e.price).filter((p) => Number.isFinite(p));
    rows.push({
      fig,
      n: matched.length,
      med: median(prices),
      lo: Math.min(...prices),
      hi: Math.max(...prices),
      urls: matched.map((e) => e.url).filter(Boolean).slice(0, 4),
      more: Math.max(0, matched.filter((e) => e.url).length - 4),
    });
  }
  rows.sort((a, b) => b.med - a.med);
  const total = rows.reduce((s, r) => s + r.med, 0);

  els.total.textContent = money(total);
  els.valueNote.textContent = rows.length
    ? `Based on ${entries.length} logged ${entries.length === 1 ? "entry" : "entries"} across ${rows.length} of your ${ownedIds.size} owned figures · median per figure${cond === "all" ? "" : ` · ${CONDITIONS[cond]}`}.`
    : "Log sold listings above and mark figures Owned on the timeline, your tracked value appears here.";
  els.breakdown.innerHTML = rows.map((r) => `
    <tr>
      <td>${escapeHtml(r.fig.name)}<br><span class="muted" style="font-size:0.78rem">${escapeHtml(r.fig.waveSeries)} (${r.fig.year})</span></td>
      <td class="num">${r.n}</td>
      <td class="num"><strong>${money(r.med)}</strong></td>
      <td class="num">${money(r.lo)}–${money(r.hi)}</td>
      <td><span class="src-links">${r.urls.map((u, i) => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">sale ${i + 1} ↗</a>`).join("")}${r.more ? `<span class="muted">+${r.more}</span>` : ""}</span></td>
    </tr>`).join("");
  els.unpriced.textContent = unpriced.length
    ? `Unpriced owned figures (${unpriced.length}): ${unpriced.slice(0, 12).map((f) => f.name).join(", ")}${unpriced.length > 12 ? `, +${unpriced.length - 12} more` : ""}, valued at $0 until you log a sale.`
    : "";
}

/* ---------- price trends ----------
   Figures with 3+ logged sales, ranked by absolute movement. Every number
   comes from the user's own entries, labeled as such, never a market index. */
function renderTrends(figures) {
  const entries = getEntries();
  // Group entries per figure: matched archive figures by id, free-text names by name.
  const groups = new Map();
  for (const f of figures) {
    const matched = entriesForFigure(entries, f.id, f.name);
    if (matched.length >= 3) groups.set(f.id, { fig: f, entries: matched });
  }
  const seenFree = new Set();
  for (const e of entries) {
    if (e.figId) continue;
    const nm = String(e.name ?? "").trim().toLowerCase();
    if (!nm || seenFree.has(nm)) continue;
    seenFree.add(nm);
    const matched = entries.filter((x) => !x.figId && String(x.name ?? "").trim().toLowerCase() === nm);
    const alreadyCovered = [...groups.values()].some((g) =>
      String(g.fig.name ?? "").trim().toLowerCase() === nm);
    if (matched.length >= 3 && !alreadyCovered) {
      groups.set(`name:${nm}`, {
        fig: { id: `name:${nm}`, name: e.name, waveSeries: e.wave || "", year: "" },
        entries: matched,
      });
    }
  }
  const rows = [...groups.values()]
    .map((v) => ({ ...v, trend: trendStats(v.entries) }))
    .filter((r) => r.trend)
    .sort((a, b) => Math.abs(b.trend.changePct) - Math.abs(a.trend.changePct));
  if (!rows.length) {
    els.trends.innerHTML = `<p class="chart-sub">No figure has 3+ logged sales yet. Log a few sales per figure and the movers will show up here.</p>`;
    return;
  }
  els.trends.innerHTML = `<ul class="entry-list">` + rows.map((r) => `
    <li class="card entry" style="padding:var(--space-4)">
      <div class="entry-head">
        <span class="entry-name">${escapeHtml(r.fig.name)}</span>
        ${r.fig.waveSeries ? `<span class="entry-wave">${escapeHtml(r.fig.waveSeries)}${r.fig.year ? ` (${r.fig.year})` : ""}</span>` : ""}
        ${directionBadge(r.trend.direction)}
      </div>
      <div class="entry-meta">
        ${sparklineSVG(r.entries, { width: 200, height: 52 })}
        <span class="entry-date">${r.trend.n} logged sales · ${escapeHtml(r.trend.from)} → ${escapeHtml(r.trend.to)}</span>
        <span class="entry-price">${r.trend.changePct >= 0 ? "+" : ""}${r.trend.changePct.toFixed(0)}%</span>
      </div>
      <p class="link-note" style="margin:0">From your ${r.trend.n} logged sales, not a market index.</p>
    </li>`).join("") + `</ul>`;
}

/* ---------- import / export ---------- */

function exportJson() {
  const blob = new Blob([JSON.stringify(getEntries(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "mlc-price-journal.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      const clean = parsed.filter((e) =>
        e && typeof e.name === "string" && Number.isFinite(Number(e.price)) && Number(e.price) > 0)
        .map((e) => ({
          id: typeof e.id === "string" ? e.id : uid(),
          figId: typeof e.figId === "string" ? e.figId : null,
          name: e.name, wave: typeof e.wave === "string" ? e.wave : "",
          condition: CONDITIONS[e.condition] ? e.condition : "loose-complete",
          price: Math.round(Number(e.price) * 100) / 100,
          date: typeof e.date === "string" ? e.date : new Date().toISOString().slice(0, 10),
          url: typeof e.url === "string" ? e.url : "",
          note: typeof e.note === "string" ? e.note.slice(0, 140) : "",
        }));
      const seen = new Set(getEntries().map((e) => e.id));
      const merged = [...getEntries(), ...clean.filter((e) => !seen.has(e.id))];
      setEntries(merged);
      renderList();
      renderValue(window.__figures);
      renderTrends(window.__figures);
      els.error.textContent = "";
    } catch {
      els.error.textContent = "Import failed, that file isn't a valid journal export.";
    }
  };
  reader.readAsText(file);
}

/* ---------- init ---------- */

async function main() {
  let figures = [];
  try {
    ({ figures } = await loadData());
  } catch {
    els.list.innerHTML = `<li class="empty-state"><p>Could not load the figure archive.</p></li>`;
    return;
  }
  window.__figures = figures;

  // Datalist for figure matching: "Name, Series (Year)"
  const frag = document.createDocumentFragment();
  labelToFig = new Map();
  for (const f of figures) {
    const label = `${f.name}, ${f.waveSeries} (${f.year})`;
    if (labelToFig.has(label)) continue;
    labelToFig.set(label, f);
    const opt = document.createElement("option");
    opt.value = label;
    frag.appendChild(opt);
  }
  els.figures.appendChild(frag);
  resetForm();

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { els.error.textContent = err; return; }
    const entry = readForm();
    const entries = getEntries();
    const i = entries.findIndex((x) => x.id === entry.id);
    if (i >= 0) entries[i] = entry; else entries.push(entry);
    setEntries(entries);
    resetForm();
    renderList();
    renderValue(figures);
    renderTrends(figures);
  });

  els.cancelEdit.addEventListener("click", resetForm);

  els.list.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-edit]");
    const delBtn = e.target.closest("[data-del]");
    if (editBtn) {
      const entry = getEntries().find((x) => x.id === editBtn.dataset.edit);
      if (!entry) return;
      editingId = entry.id;
      els.figure.value = entry.figId
        ? [...labelToFig.entries()].find(([, f]) => f.id === entry.figId)?.[0] ?? entry.name
        : entry.name;
      els.condition.value = CONDITIONS[entry.condition] ? entry.condition : "loose-complete";
      els.price.value = entry.price;
      els.date.value = entry.date;
      els.url.value = entry.url || "";
      els.note.value = entry.note || "";
      els.submit.textContent = "Save changes";
      els.cancelEdit.hidden = false;
      els.error.textContent = "";
      els.figure.focus();
      document.getElementById("log-heading").scrollIntoView({ block: "center" });
    } else if (delBtn) {
      const entry = getEntries().find((x) => x.id === delBtn.dataset.del);
      if (entry && confirm(`Delete this entry?\n${entry.name}, $${entry.price} (${entry.date})`)) {
        setEntries(getEntries().filter((x) => x.id !== entry.id));
        renderList();
        renderValue(figures);
      }
    }
  });

  els.soldSearch.addEventListener("click", (e) => {
    e.preventDefault();
    const label = els.figure.value.trim();
    const fig = labelToFig.get(label);
    const q = fig ? `Marvel Legends ${fig.name}${fig.variant ? " " + fig.variant : ""}` : `Marvel Legends ${label}`;
    window.open(soldSearchUrl(q || "Marvel Legends"), "_blank", "noopener");
  });

  els.export.addEventListener("click", exportJson);
  els.import.addEventListener("change", (e) => {
    if (e.target.files[0]) importJson(e.target.files[0]);
    e.target.value = "";
  });
  els.condFilter.addEventListener("change", () => renderValue(figures));

  renderList();
  renderValue(figures);
  renderTrends(figures);
}

main();
