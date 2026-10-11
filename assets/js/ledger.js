/* Collection Ledger — what you paid vs what it's worth.
   Storage: mlc_buys_v1 (purchases the user logs). Tracked values come from
   mlc_journal_v1 (sold-listing sightings). Every number shown here traces to
   a user-logged entry — no scraped data, no invented prices. */
import { STORE_KEYS } from "./config.js";
import { loadData } from "./data.js";
import { load, save } from "./store.js";
import { escapeHtml } from "./figure-dialog.js";

const CONDITIONS = {
  "loose-complete": "Loose — complete",
  "loose-incomplete": "Loose — incomplete",
  "mib": "Mint in box",
  "moc": "Mint on card",
  "graded": "Graded",
};

const els = {
  form: document.getElementById("ledger-form"),
  figure: document.getElementById("l-figure"),
  figures: document.getElementById("l-figures"),
  condition: document.getElementById("l-condition"),
  price: document.getElementById("l-price"),
  date: document.getElementById("l-date"),
  where: document.getElementById("l-where"),
  note: document.getElementById("l-note"),
  error: document.getElementById("l-error"),
  submit: document.getElementById("l-submit"),
  cancelEdit: document.getElementById("l-cancel-edit"),
  count: document.getElementById("l-count"),
  empty: document.getElementById("l-empty"),
  list: document.getElementById("l-list"),
  export: document.getElementById("ledger-export"),
  import: document.getElementById("ledger-import"),
  totPaid: document.getElementById("l-total-paid"),
  totValue: document.getElementById("l-total-value"),
  totGain: document.getElementById("l-total-gain"),
  ledgerNote: document.getElementById("l-ledger-note"),
  breakdown: document.querySelector("#l-breakdown tbody"),
  unvalued: document.getElementById("l-unvalued"),
};

let labelToFig = new Map();
let editingId = null;

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : `e${Date.now()}${Math.random().toString(16).slice(2)}`);
}

function getBuys() {
  const raw = load(STORE_KEYS.buys, []);
  return Array.isArray(raw) ? raw.filter((e) => e && typeof e === "object") : [];
}

function setBuys(buys) {
  save(STORE_KEYS.buys, buys);
}

function getSightings() {
  const raw = load(STORE_KEYS.journal, []);
  return Array.isArray(raw) ? raw.filter((e) => e && typeof e === "object") : [];
}

function money(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function signed(n) {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return sign + money(Math.abs(n));
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
  els.submit.textContent = "Log purchase";
  els.cancelEdit.hidden = true;
}

function validate() {
  const name = els.figure.value.trim();
  const price = parseFloat(els.price.value);
  const date = els.date.value;
  if (!name) return "Enter a figure name.";
  if (!Number.isFinite(price) || price <= 0) return "Enter a price paid above $0.";
  if (!date) return "Enter the purchase date.";
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
    where: els.where.value.trim(),
    note: els.note.value.trim(),
  };
}

/* ---------- list ---------- */

function renderList() {
  const buys = getBuys()
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.id || "").localeCompare(a.id || ""));
  els.count.textContent = buys.length ? `(${buys.length})` : "";
  els.empty.hidden = buys.length > 0;
  els.list.innerHTML = buys.map((e) => `
    <li class="card entry" style="padding:var(--space-4)">
      <div class="entry-head">
        <span class="entry-name">${escapeHtml(e.name)}</span>
        ${e.wave ? `<span class="entry-wave">${escapeHtml(e.wave)}</span>` : ""}
        ${condBadge(e.condition)}
      </div>
      <div class="entry-meta">
        <span class="entry-price">paid ${money(e.price)}</span>
        <span class="entry-date">${escapeHtml(e.date || "")}</span>
        ${e.where ? `<span class="muted">at ${escapeHtml(e.where)}</span>` : `<span class="muted">no source noted</span>`}
      </div>
      ${e.note ? `<p class="entry-note">${escapeHtml(e.note)}</p>` : ""}
      <div class="entry-actions">
        <button type="button" class="btn btn-sm" data-edit="${escapeHtml(e.id)}">Edit</button>
        <button type="button" class="btn btn-sm btn-ghost" data-del="${escapeHtml(e.id)}">Delete</button>
      </div>
    </li>`).join("");
}

/* ---------- ledger ---------- */

function matchesFigure(entry, figId, figName) {
  return entry.figId === figId || (!entry.figId && entry.name.toLowerCase() === figName.toLowerCase());
}

function renderLedger() {
  const buys = getBuys();
  const sightings = getSightings();

  // Group buys by figure
  const groups = new Map();
  for (const b of buys) {
    const key = b.figId ?? `name:${b.name.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { name: b.name, wave: b.wave || "", buys: [] });
    groups.get(key).buys.push(b);
  }

  const rows = [];
  const unvalued = [];
  for (const g of groups.values()) {
    const paid = g.buys.reduce((s, b) => s + (Number.isFinite(b.price) ? b.price : 0), 0);
    const first = g.buys[0];
    const soldPrices = sightings
      .filter((s) => matchesFigure(s, first.figId, first.name))
      .map((s) => s.price)
      .filter((p) => Number.isFinite(p));
    if (!soldPrices.length) { unvalued.push({ name: g.name, paid }); continue; }
    const tracked = median(soldPrices);
    rows.push({ name: g.name, wave: g.wave, n: g.buys.length, paid, tracked, gain: tracked - paid, sightings: soldPrices.length });
  }
  rows.sort((a, b) => b.gain - a.gain);

  const totalPaid = rows.reduce((s, r) => s + r.paid, 0) + unvalued.reduce((s, u) => s + u.paid, 0);
  const totalValue = rows.reduce((s, r) => s + r.tracked, 0);
  const totalGain = totalValue - totalPaid;

  els.totPaid.textContent = money(totalPaid);
  els.totValue.textContent = money(totalValue);
  els.totGain.textContent = signed(totalGain);
  els.totGain.style.color = totalGain > 0 ? "var(--gold)" : totalGain < 0 ? "#ff8a8a" : "";
  els.ledgerNote.textContent = rows.length || unvalued.length
    ? `Cost basis from ${buys.length} logged ${buys.length === 1 ? "purchase" : "purchases"}. Tracked value from ${sightings.length} sold-listing ${sightings.length === 1 ? "sighting" : "sightings"} in your price journal (median per figure, all conditions). Gain/loss = tracked value − what you paid.`
    : "Log purchases above — and sold sightings in the price journal — and your ledger appears here.";
  els.breakdown.innerHTML = rows.map((r) => `
    <tr>
      <td>${escapeHtml(r.name)}<br><span class="muted" style="font-size:0.78rem">${escapeHtml(r.wave)}${r.n > 1 ? ` · ${r.n} purchases` : ""}</span></td>
      <td class="num">${money(r.paid)}</td>
      <td class="num"><strong>${money(r.tracked)}</strong><br><span class="muted" style="font-size:0.75rem">${r.sightings} ${r.sightings === 1 ? "sighting" : "sightings"}</span></td>
      <td class="num" style="color:${r.gain > 0 ? "var(--gold)" : r.gain < 0 ? "#ff8a8a" : ""}">${signed(r.gain)}</td>
    </tr>`).join("");
  els.unvalued.textContent = unvalued.length
    ? `No sold sightings yet (${unvalued.length} ${unvalued.length === 1 ? "figure" : "figures"}, ${money(unvalued.reduce((s, u) => s + u.paid, 0))} paid): ${unvalued.slice(0, 12).map((u) => u.name).join(", ")}${unvalued.length > 12 ? `, +${unvalued.length - 12} more` : ""} — log eBay solds in the price journal to value them.`
    : "";
}

/* ---------- import / export ---------- */

function exportJson() {
  const blob = new Blob([JSON.stringify(getBuys(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "mlc-purchase-log.json";
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
          where: typeof e.where === "string" ? e.where.slice(0, 80) : "",
          note: typeof e.note === "string" ? e.note.slice(0, 140) : "",
        }));
      const seen = new Set(getBuys().map((e) => e.id));
      const merged = [...getBuys(), ...clean.filter((e) => !seen.has(e.id))];
      setBuys(merged);
      renderList();
      renderLedger();
      els.error.textContent = "";
    } catch {
      els.error.textContent = "Import failed — that file isn't a valid purchase-log export.";
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
  resetForm();

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { els.error.textContent = err; return; }
    const entry = readForm();
    const buys = getBuys();
    const i = buys.findIndex((x) => x.id === entry.id);
    if (i >= 0) buys[i] = entry; else buys.push(entry);
    setBuys(buys);
    resetForm();
    renderList();
    renderLedger();
  });

  els.cancelEdit.addEventListener("click", resetForm);

  els.list.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-edit]");
    const delBtn = e.target.closest("[data-del]");
    if (editBtn) {
      const entry = getBuys().find((x) => x.id === editBtn.dataset.edit);
      if (!entry) return;
      editingId = entry.id;
      els.figure.value = entry.figId
        ? [...labelToFig.entries()].find(([, f]) => f.id === entry.figId)?.[0] ?? entry.name
        : entry.name;
      els.condition.value = CONDITIONS[entry.condition] ? entry.condition : "loose-complete";
      els.price.value = entry.price;
      els.date.value = entry.date;
      els.where.value = entry.where || "";
      els.note.value = entry.note || "";
      els.submit.textContent = "Save changes";
      els.cancelEdit.hidden = false;
      els.error.textContent = "";
      els.figure.focus();
      document.getElementById("buy-heading").scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (delBtn) {
      const entry = getBuys().find((x) => x.id === delBtn.dataset.del);
      if (entry && confirm(`Delete this purchase?\n${entry.name} — $${entry.price} (${entry.date})`)) {
        setBuys(getBuys().filter((x) => x.id !== entry.id));
        renderList();
        renderLedger();
      }
    }
  });

  els.export.addEventListener("click", exportJson);
  els.import.addEventListener("change", (e) => {
    if (e.target.files[0]) importJson(e.target.files[0]);
    e.target.value = "";
  });

  renderList();
  renderLedger();
}

main();
