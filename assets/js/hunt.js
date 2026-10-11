/* Hunt planner — toy-show trip planner.
   Targets: watchlist hunts (with their targets) + tracker wanted figures.
   Deal math: median of the user's own journal sold entries per figure.
   State persists to mlc_hunt_v1 (selected ids + max prices). */
import { PATHS, STORE_KEYS } from "./config.js";
import { loadData, figureById } from "./data.js";
import { load, save } from "./store.js";
import { escapeHtml } from "./figure-dialog.js";
import { wanted } from "./tracker.js";
import { soldSearchUrl, marketplaceQuery } from "./listings.js";

const HUNT_KEY = "mlc_hunt_v1";

const els = {
  search: document.getElementById("hunt-search"),
  selectAll: document.getElementById("hunt-select-all"),
  selectNone: document.getElementById("hunt-select-none"),
  tbody: document.querySelector("#hunt-table tbody"),
  empty: document.getElementById("hunt-empty"),
  count: document.getElementById("target-count"),
  sheet: document.getElementById("hunt-sheet"),
  sheetDate: document.getElementById("sheet-date"),
  sheetRows: document.getElementById("sheet-rows"),
  print: document.getElementById("hunt-print"),
};

function money(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function getHunts() {
  const raw = load(STORE_KEYS.watchlist, []);
  return Array.isArray(raw) ? raw.filter((h) => h && typeof h === "object") : [];
}

function getEntries() {
  const raw = load(STORE_KEYS.journal, []);
  return Array.isArray(raw) ? raw.filter((e) => e && typeof e === "object") : [];
}

function getHuntState() {
  const raw = load(HUNT_KEY, null);
  if (raw && typeof raw === "object") {
    return {
      selected: Array.isArray(raw.selected) ? raw.selected.filter((x) => typeof x === "string") : [],
      maxPrices: raw.maxPrices && typeof raw.maxPrices === "object" ? raw.maxPrices : {},
    };
  }
  return { selected: [], maxPrices: {} };
}

function setHuntState(state) {
  save(HUNT_KEY, state);
}

function entriesFor(fig, entries) {
  return entries.filter(
    (e) =>
      (e.figId === fig.id ||
        (!e.figId && typeof e.name === "string" && e.name.toLowerCase() === fig.name.toLowerCase())) &&
      Number.isFinite(Number(e.price)) &&
      Number(e.price) > 0
  );
}

/* Build the target list: watchlist hunts first, then wanted figures not on the watchlist. */
function buildTargets(figures, hunts) {
  const byId = new Map(figures.map((f) => [f.id, f]));
  const targets = [];
  const seen = new Set();
  for (const h of hunts) {
    const fig = h.figId ? byId.get(h.figId) : null;
    const key = h.figId ?? `name:${(h.name ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({
      key,
      fig,
      name: fig ? fig.name : h.name ?? "Unknown figure",
      wave: fig ? `${fig.waveSeries} (${fig.year})` : h.wave ?? "",
      target: Number.isFinite(Number(h.target)) && Number(h.target) > 0 ? Number(h.target) : null,
      source: "Watchlist",
    });
  }
  for (const id of wanted) {
    if (seen.has(id)) continue;
    const fig = byId.get(id);
    if (!fig) continue;
    seen.add(id);
    targets.push({
      key: id,
      fig,
      name: fig.name,
      wave: `${fig.waveSeries} (${fig.year})`,
      target: null,
      source: "Wanted",
    });
  }
  return targets;
}

let targets = [];
let state = getHuntState();

function matches(t, q) {
  if (!q) return true;
  q = q.toLowerCase();
  return t.name.toLowerCase().includes(q) || t.wave.toLowerCase().includes(q);
}

function renderTargets(entries) {
  const q = els.search.value.trim();
  const visible = targets.filter((t) => matches(t, q));
  els.empty.hidden = targets.length > 0;
  els.count.textContent = targets.length ? `(${targets.length})` : "";
  els.tbody.innerHTML = visible
    .map((t) => {
      const med = t.fig ? median(entriesFor(t.fig, entries).map((e) => Number(e.price))) : null;
      const max = state.maxPrices[t.key] ?? t.target ?? "";
      const checked = state.selected.includes(t.key) ? " checked" : "";
      const solds = t.fig ? `<a href="${soldSearchUrl(marketplaceQuery(t.fig))}" target="_blank" rel="noopener noreferrer">solds ↗</a>` : "";
      return `
      <tr data-key="${escapeHtml(t.key)}">
        <td><input type="checkbox" class="row-check" data-select aria-label="Include ${escapeHtml(t.name)} in hunt sheet"${checked}></td>
        <td><strong>${escapeHtml(t.name)}</strong></td>
        <td>${escapeHtml(t.wave)}</td>
        <td><input type="number" class="input max-input" data-max min="0.01" step="0.01" inputmode="decimal" placeholder="—" value="${max === "" ? "" : max}" aria-label="Max price for ${escapeHtml(t.name)}"></td>
        <td class="num">${med !== null ? `${money(med)} ${solds}` : `<span style="color:var(--muted)">no data</span> ${solds}`}</td>
        <td><span class="badge">${escapeHtml(t.source)}</span></td>
      </tr>`;
    })
    .join("");
  renderSheet(entries);
}

function renderSheet(entries) {
  const selected = targets.filter((t) => state.selected.includes(t.key));
  els.sheet.hidden = selected.length === 0;
  if (!selected.length) return;
  els.sheetDate.textContent = `— ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`;
  els.sheetRows.innerHTML = selected
    .map((t) => {
      const med = t.fig ? median(entriesFor(t.fig, entries).map((e) => Number(e.price))) : null;
      const max = state.maxPrices[t.key] ?? t.target ?? null;
      return `
      <div class="sheet-row">
        <span class="sheet-check" aria-hidden="true"></span>
        <div>
          <div class="sheet-name">${escapeHtml(t.name)}</div>
          <div class="sheet-wave">${escapeHtml(t.wave)}</div>
          <div class="sheet-note-line" aria-hidden="true"></div>
        </div>
        <div class="sheet-prices">
          <div class="sheet-max">${max !== null && max !== "" ? money(Number(max)) : "—"}</div>
          <div class="sheet-ref">max</div>
          <div class="sheet-ref" style="margin-top:var(--space-2)">${med !== null ? `sold med ${money(med)}` : "no sold data"}</div>
        </div>
      </div>`;
    })
    .join("");
}

async function init() {
  try {
    const { figures } = await loadData();
    const entries = getEntries();
    targets = buildTargets(figures, getHunts());
    if (!state.selected.length) {
      // Default: preselect everything the first time.
      state.selected = targets.map((t) => t.key);
      setHuntState(state);
    }

    const persist = () => setHuntState(state);

    els.tbody.addEventListener("change", (e) => {
      const row = e.target.closest("tr[data-key]");
      if (!row) return;
      const key = row.dataset.key;
      if (e.target.matches("[data-select]")) {
        if (e.target.checked && !state.selected.includes(key)) state.selected.push(key);
        if (!e.target.checked) state.selected = state.selected.filter((k) => k !== key);
        persist();
        renderSheet(entries);
      } else if (e.target.matches("[data-max]")) {
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v) && v > 0) state.maxPrices[key] = Math.round(v * 100) / 100;
        else delete state.maxPrices[key];
        persist();
        renderSheet(entries);
      }
    });

    let debounce;
    els.search.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => renderTargets(entries), 160);
    });
    els.selectAll.addEventListener("click", () => {
      state.selected = targets.map((t) => t.key);
      persist();
      renderTargets(entries);
    });
    els.selectNone.addEventListener("click", () => {
      state.selected = [];
      persist();
      renderTargets(entries);
    });
    els.print.addEventListener("click", () => window.print());

    renderTargets(entries);
  } catch (err) {
    console.error(err);
    els.tbody.innerHTML = `<tr><td colspan="6">Could not load the figure database. Check your connection and reload.</td></tr>`;
  }
}

init();
