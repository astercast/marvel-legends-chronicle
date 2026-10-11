/* Pre-order tracker + release calendar logic (wave 13).
   Pure functions are exported for unit tests; page wiring runs from init().
   Data: data/preorders.json (wave-12 researched items only — no invented releases).
   Storage: mlc_preorders_v1 = { <itemId>: "watching"|"ordered"|"skipped" }.
   All dates are ISO "YYYY-MM-DD". Countdowns use whole calendar days (local tz). */
import { PATHS, STORE_KEYS, MARKETPLACES } from "./config.js";
import { load, save } from "./store.js";

/* Extra retailer search patterns for retailers the research explicitly names.
   Same shape as config.MARKETPLACES: generic search pages, never product URLs. */
export const EXTRA_RETAILERS = [
  { id: "target", label: "Target", url: (q) => `https://www.target.com/s?searchTerm=${encodeURIComponent(q)}` },
  { id: "walmart", label: "Walmart", url: (q) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}` },
];

export function retailerById(id) {
  return [...MARKETPLACES, ...EXTRA_RETAILERS].find((r) => r.id === id) || null;
}

/* ---- dates (pure) ---- */

/** Strict ISO date -> { y, m, d } or null. */
export function parseYMD(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return { y, m, d };
}

/** Local "YYYY-MM-DD" for a Date (defaults to now). */
export function todayStr(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Whole-day difference: dateB - dateA. Null if either is invalid. */
export function daysBetween(a, b) {
  const pa = parseYMD(a), pb = parseYMD(b);
  if (!pa || !pb) return null;
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}

/** Pre-order countdown relative to today. kind: future|today|past|none. */
export function preorderCountdown(item, today) {
  const days = item && item.preorderDate ? daysBetween(today, item.preorderDate) : null;
  if (days === null || days === undefined) return { kind: "none", days: null };
  if (days > 0) return { kind: "future", days };
  if (days === 0) return { kind: "today", days: 0 };
  return { kind: "past", days: -days };
}

/** One-line countdown text, e.g. "Pre-order opens in 10 days". */
export function countdownText(cd) {
  if (cd.kind === "future") return `Pre-order opens in ${cd.days} day${cd.days === 1 ? "" : "s"}`;
  if (cd.kind === "today") return "Pre-order opens today";
  if (cd.kind === "past") return cd.days === 0 ? "Pre-order opened today" : `Pre-order opened ${cd.days} day${cd.days === 1 ? "" : "s"} ago`;
  return "";
}

/**
 * Display status for an item relative to today.
 * Returns { key, label, detail } where key is a stable machine value:
 * announced | preorder-soon | preorder-today | preorder-open | preordered-no-date | available.
 */
export function itemStatus(item, today) {
  const win = item.releaseWindow ? ` — ${item.releaseWindow}` : "";
  if (item.status === "available") {
    return { key: "available", label: "Available", detail: item.releaseWindow || "in stores" };
  }
  if (item.status === "preorder") {
    const cd = preorderCountdown(item, today);
    if (cd.kind === "future") {
      return { key: "preorder-soon", label: "Pre-order upcoming", detail: `${countdownText(cd)}${win}` };
    }
    if (cd.kind === "today") {
      return { key: "preorder-today", label: "Pre-order opens today", detail: item.releaseWindow || "" };
    }
    if (cd.kind === "past") {
      return { key: "preorder-open", label: "Pre-order open", detail: `${countdownText(cd)}${win}` };
    }
    return { key: "preordered-no-date", label: "Pre-order announced", detail: `date not reported yet${win}` };
  }
  // revealed
  return { key: "announced", label: "Announced", detail: `pre-order date not reported yet${win}` };
}

/** "YYYY-MM" key for an ISO date, or null. */
export function monthKey(ymd) {
  const p = parseYMD(ymd);
  if (!p) return null;
  return `${p.y}-${String(p.m).padStart(2, "0")}`;
}

/** Group items by preorder month: Map "YYYY-MM" -> [item]. Items without an exact date are excluded. */
export function itemsByMonth(items) {
  const map = new Map();
  for (const it of items || []) {
    const k = it && it.preorderDate ? monthKey(it.preorderDate) : null;
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  return map;
}

/** Items that carry a release window but no exact pre-order date. */
export function undatedItems(items) {
  return (items || []).filter((it) => it && !it.preorderDate && it.releaseWindow);
}

/* ---- calendar (pure) ---- */

/** 12-month forward list starting at "YYYY-MM". Returns [{ year, month, key, label }]. */
export function calendarMonths(startYM, count) {
  const m = /^(\d{4})-(\d{2})$/.exec(startYM || "");
  if (!m) return [];
  let y = Number(m[1]), mo = Number(m[2]);
  if (mo < 1 || mo > 12) return [];
  const names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const out = [];
  for (let i = 0; i < count; i++) {
    const key = `${y}-${String(mo).padStart(2, "0")}`;
    out.push({ year: y, month: mo, key, label: `${names[mo - 1]} ${y}` });
    mo++; if (mo > 12) { mo = 1; y++; }
  }
  return out;
}

/**
 * Month grid: array of weeks; each week is 7 entries of "YYYY-MM-DD" or null (padding).
 * Weeks start Sunday.
 */
export function monthMatrix(year, month) {
  if (!Number.isInteger(year) || month < 1 || month > 12) return [];
  const first = new Date(year, month - 1, 1);
  const daysIn = new Date(year, month, 0).getDate();
  const weeks = [];
  let day = 1;
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      if ((w === 0 && d < first.getDay()) || day > daysIn) {
        week.push(null);
      } else {
        week.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
        day++;
      }
    }
    weeks.push(week);
    if (day > daysIn) break;
  }
  return weeks;
}

/** Items whose preorderDate is exactly this ISO day. */
export function itemsOnDay(items, ymd) {
  return (items || []).filter((it) => it && it.preorderDate === ymd);
}

/** True if ymd is within [startYM, startYM + count months). */
export function inWindow(ymd, startYM, count) {
  const k = monthKey(ymd);
  if (!k) return false;
  const keys = new Set(calendarMonths(startYM, count).map((m) => m.key));
  return keys.has(k);
}

/* ---- personal state (pure helpers + store) ---- */

export const PERSONAL_STATES = ["watching", "ordered", "skipped"];

export function isValidState(s) {
  return PERSONAL_STATES.includes(s);
}

export function getPersonalStates() {
  const raw = load(STORE_KEYS.preorders, {});
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const clean = {};
  for (const [k, v] of Object.entries(raw)) {
    if (isValidState(v)) clean[k] = v;
  }
  return clean;
}

export function setPersonalState(id, state) {
  const states = getPersonalStates();
  if (state === null || state === undefined) {
    delete states[id];
  } else if (isValidState(state)) {
    states[id] = state;
  } else {
    return false;
  }
  return save(STORE_KEYS.preorders, states);
}

export function money(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function escapeAttr(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/* ---- tracker page wiring ---- */

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "announced", label: "Announced" },
  { id: "preorder", label: "Pre-order" },
  { id: "available", label: "Available" },
];

const PERSONAL_FILTERS = [
  { id: "all", label: "Any" },
  { id: "watching", label: "Watching" },
  { id: "ordered", label: "Ordered" },
  { id: "skipped", label: "Skipped" },
];

function statusGroup(key) {
  if (key === "announced" || key === "preordered-no-date") return "announced";
  if (key.startsWith("preorder")) return "preorder";
  return "available";
}

function cardHtml(item, today, states) {
  const st = itemStatus(item, today);
  const price = money(item.price);
  const personal = states[item.id] || "watching";
  const retailLinks = (item.retailers || [])
    .map((id) => retailerById(id))
    .filter(Boolean)
    .map((r) => `<a class="btn btn-sm" href="${r.url(item.query || item.name)}" target="_blank" rel="noopener">${r.label}</a>`)
    .join(" ");
  const srcLinks = (item.sources || [])
    .map((s) => `<a class="src" href="${escapeAttr(s.url)}" target="_blank" rel="noopener">${escapeAttr(s.label)}</a>`)
    .join("<br>");
  const stateRadios = PERSONAL_STATES.map((s) =>
    `<label class="state-opt"><input type="radio" name="st-${escapeAttr(item.id)}" value="${s}"${personal === s ? " checked" : ""}> ${s[0].toUpperCase() + s.slice(1)}</label>`
  ).join("");
  return `<article class="card po-card" data-id="${escapeAttr(item.id)}" data-group="${statusGroup(st.key)}" data-personal="${personal}">
    <h2>${escapeAttr(item.name)}</h2>
    <div class="radar-meta">
      <span class="status status-${st.key === "available" ? "available" : st.key.startsWith("preorder") ? "preorder" : "revealed"}">${escapeAttr(st.label)}</span>
      ${price ? `<span class="price">${price}</span>` : ""}
    </div>
    <p class="po-detail">${escapeAttr(st.detail)}</p>
    ${item.details ? `<p>${escapeAttr(item.details)}</p>` : ""}
    <div class="po-retailers" role="group" aria-label="Retailer search links">${retailLinks || '<span class="venue">No retailer confirmed by research yet.</span>'}</div>
    <fieldset class="po-state">
      <legend>Your call</legend>
      ${stateRadios}
    </fieldset>
    <div class="po-sources">${srcLinks}</div>
  </article>`;
}

async function loadItems() {
  try {
    const res = await fetch(PATHS.preorders);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

function applyFilters(list, statusF, personalF) {
  const cards = list.querySelectorAll(".po-card");
  let shown = 0;
  for (const c of cards) {
    const okS = statusF === "all" || c.dataset.group === statusF;
    const okP = personalF === "all" || c.dataset.personal === personalF;
    const show = okS && okP;
    c.hidden = !show;
    if (show) shown++;
  }
  return shown;
}

export async function initTracker() {
  const listEl = document.getElementById("po-list");
  const errEl = document.getElementById("po-error");
  if (!listEl) return;
  const items = await loadItems();
  if (!items.length) {
    if (errEl) errEl.hidden = false;
    return;
  }
  const today = todayStr();
  const states = getPersonalStates();

  // sort: upcoming pre-order dates first, then revealed, then available
  const rank = (it) => {
    const cd = preorderCountdown(it, today);
    if (cd.kind === "future" || cd.kind === "today") return [0, cd.days || 0];
    if (it.status === "preorder") return [1, 0];
    if (it.status === "revealed") return [2, 0];
    return [3, 0];
  };
  items.sort((a, b) => rank(a)[0] - rank(b)[0] || rank(a)[1] - rank(b)[1]);

  listEl.innerHTML = items.map((it) => cardHtml(it, today, states)).join("");

  // personal state radios
  listEl.addEventListener("change", (e) => {
    const input = e.target.closest('input[type="radio"]');
    if (!input) return;
    const card = input.closest(".po-card");
    if (!card) return;
    const id = card.dataset.id;
    setPersonalState(id, input.value);
    card.dataset.personal = input.value;
    applyFilters(listEl, currentStatus(), currentPersonal());
    renderSummary();
  });

  // filters
  const statusBar = document.getElementById("po-status-filter");
  const personalBar = document.getElementById("po-personal-filter");
  const currentStatus = () => (statusBar.querySelector("[aria-pressed='true']") || {}).dataset?.value || "all";
  const currentPersonal = () => (personalBar.querySelector("[aria-pressed='true']") || {}).dataset?.value || "all";

  const chipBar = (bar, filters, onPick) => {
    bar.innerHTML = filters.map((f) =>
      `<button type="button" class="chip" data-value="${f.id}" aria-pressed="${f.id === "all" ? "true" : "false"}">${f.label}</button>`
    ).join("");
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      for (const x of bar.querySelectorAll("button")) x.setAttribute("aria-pressed", x === b ? "true" : "false");
      onPick();
    });
  };
  const rerender = () => {
    applyFilters(listEl, currentStatus(), currentPersonal());
    renderSummary();
  };
  chipBar(statusBar, STATUS_FILTERS, rerender);
  chipBar(personalBar, PERSONAL_FILTERS, rerender);

  function renderSummary() {
    const el = document.getElementById("po-summary");
    if (!el) return;
    const s = getPersonalStates();
    const counts = { watching: 0, ordered: 0, skipped: 0 };
    for (const it of items) counts[s[it.id] || "watching"]++;
    const soon = items.filter((it) => preorderCountdown(it, today).kind === "future").length;
    el.innerHTML = `Tracking <strong>${items.length}</strong> releases · ` +
      `<strong>${soon}</strong> pre-order${soon === 1 ? "" : "s"} opening soon · ` +
      `ordered <strong>${counts.ordered}</strong> · watching <strong>${counts.watching}</strong> · skipped <strong>${counts.skipped}</strong>`;
  }

  rerender();
}

/* auto-init: page-specific script is only loaded by its own page */
if (typeof document !== "undefined" && document.getElementById("po-list")) {
  initTracker();
}
