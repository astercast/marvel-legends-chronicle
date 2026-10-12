/* Drop Week Command Center (wave 32) — the Oct 14 → Nov 1 drop sequence +
   Nov 20 made-to-order deadline, from data/drop-week.json (Oct 2026 research
   sweep, observed 2026-10-11 — no invented figures, dates, prices, retailers).
   Pure functions are exported for unit tests; init() hydrates drop-week.html.
   The user's battle plan lives in localStorage under STORE_KEYS.dropweek
   (mlc_dropweek_v1) — browser-local, never uploaded. */

import { STORE_KEYS } from "./config.js";

export const DAY_MS = 86400000;

/* ---- pure helpers ---- */

/** ms timestamp of a drop's moment: exact windowAt, else start of windowDate. */
export function dropTimeMs(drop) {
  if (drop && typeof drop.windowAt === "string" && drop.windowAt) {
    const t = Date.parse(drop.windowAt);
    return Number.isNaN(t) ? null : t;
  }
  if (drop && typeof drop.windowDate === "string" && drop.windowDate) {
    const t = Date.parse(`${drop.windowDate}T00:00:00`);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/** Split a non-negative ms span into days/hours/mins/secs. */
export function countdownParts(ms) {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return { days, hours, mins, secs };
}

/**
 * "3d 4h 12m" — short countdown text. When the parts carry a `secs` field
 * (everything produced by countdownParts/timeToDrop does), the seconds are
 * shown too: on drop morning the last minute is the whole game.
 */
export function formatCountdown(parts) {
  const bits = [];
  if (parts.days > 0) bits.push(`${parts.days}d`);
  if (parts.hours > 0 || parts.days > 0) bits.push(`${parts.hours}h`);
  bits.push(`${parts.mins}m`);
  if (typeof parts.secs === "number") bits.push(`${parts.secs}s`);
  return bits.join(" ");
}

/**
 * The window moment in the reader's own timezone, e.g. "Wed, Oct 14, 10:00 AM PDT".
 * 1 PM ET is not 1 PM everywhere, and drop day is the wrong day to do mental math.
 */
export function formatWindowLocal(iso, locale, timeZone) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const opts = {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  };
  if (timeZone) opts.timeZone = timeZone;
  try {
    return new Intl.DateTimeFormat(locale || undefined, opts).format(new Date(t));
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    }).format(new Date(t));
  }
}

/**
 * { past, days, hours, mins } to the drop's moment, or null for a dateless drop.
 * nowMs is injectable for tests.
 */
export function timeToDrop(drop, nowMs = Date.now()) {
  const t = dropTimeMs(drop);
  if (t == null) return null;
  const diff = t - nowMs;
  if (diff <= 0) return { past: true, days: 0, hours: 0, mins: 0, secs: 0 };
  const { days, hours, mins, secs } = countdownParts(diff);
  return { past: false, days, hours, mins, secs };
}

/**
 * upcoming (before the day) / drop-day (same local calendar day) / past.
 * Deadlines use the same states — a passed deadline reads "past".
 */
export function dropStatus(drop, nowMs = Date.now()) {
  const t = dropTimeMs(drop);
  if (t == null) return "upcoming";
  const d = new Date(t);
  const n = new Date(nowMs);
  const sameDay =
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate();
  if (sameDay) return "drop-day";
  return t > nowMs ? "upcoming" : "past";
}

/** Human status line for a card badge. */
export function statusLabel(status, kind) {
  if (status === "drop-day") return kind === "deadline" ? "Deadline day" : "Drop day";
  if (status === "upcoming") return kind === "deadline" ? "Deadline ahead" : "Upcoming";
  return kind === "deadline" ? "Window closed" : "Window opened";
}

/** Sort drops by their moment (dateless last). Pure. */
export function sortDrops(drops) {
  return [...drops].sort((a, b) => {
    const ta = dropTimeMs(a);
    const tb = dropTimeMs(b);
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return ta - tb;
  });
}

/** The next drop that hasn't passed yet (or null). */
export function nextDrop(drops, nowMs = Date.now()) {
  for (const d of sortDrops(drops)) {
    const t = timeToDrop(d, nowMs);
    if (t && !t.past) return d;
  }
  return null;
}

/* ---- battle plan (user state) ---- */

export const PLAN_KEY = STORE_KEYS.dropweek;

/** Empty plan: { [dropId]: { [figName]: "want"|"ordered" } } */
export function newPlan() {
  return {};
}

export function planState(plan, dropId, figName) {
  return (plan && plan[dropId] && plan[dropId][figName]) || null;
}

/** Toggle through want → ordered → cleared. Returns the new state. */
export function cyclePlanState(plan, dropId, figName) {
  const cur = planState(plan, dropId, figName);
  const next = cur === null ? "want" : cur === "want" ? "ordered" : null;
  if (!plan[dropId]) plan[dropId] = {};
  if (next === null) {
    delete plan[dropId][figName];
    if (Object.keys(plan[dropId]).length === 0) delete plan[dropId];
  } else {
    plan[dropId][figName] = next;
  }
  return next;
}

/** Per-drop { want, ordered } counts across all drops. */
export function planCounts(plan, drops) {
  const out = {};
  for (const d of drops) {
    const pd = (plan && plan[d.id]) || {};
    let want = 0;
    let ordered = 0;
    for (const v of Object.values(pd)) {
      if (v === "want") want++;
      else if (v === "ordered") ordered++;
    }
    out[d.id] = { want, ordered };
  }
  return out;
}

export function planTotals(plan, drops) {
  const counts = planCounts(plan, drops);
  let want = 0;
  let ordered = 0;
  for (const c of Object.values(counts)) {
    want += c.want;
    ordered += c.ordered;
  }
  return { want, ordered };
}

/** Plain-text battle plan for forums/Discord. */
export function buildPlanShareText(plan, drops, whenText) {
  const lines = ["DROP WEEK BATTLE PLAN"];
  if (whenText) lines.push(whenText);
  lines.push("");
  const counts = planCounts(plan, drops);
  let any = false;
  for (const d of sortDrops(drops)) {
    const pd = (plan && plan[d.id]) || {};
    const names = Object.keys(pd);
    if (!names.length) continue;
    any = true;
    lines.push(`${d.title} — ${d.windowLabel}`);
    for (const f of d.figures || []) {
      const s = pd[f.name];
      if (s === "want") lines.push(`  [ ] ${f.name} — going for it`);
      else if (s === "ordered") lines.push(`  [x] ${f.name} — ordered`);
    }
    const c = counts[d.id];
    lines.push(`  (${c.want} going for it · ${c.ordered} ordered)`);
    lines.push("");
  }
  if (!any) lines.push("No battle plan set yet — pick your targets on the Drop Week Command Center.");
  return lines.join("\n").trimEnd();
}

/* ---- buyer checklist (user state) ---- */

export const CHECKLIST_KEY = STORE_KEYS.dropweekChecklist;

/** Checklist tick state: { [itemId]: true }. Unchecked ids are absent. */
export function toggleCheck(state, itemId) {
  const next = { ...(state || {}) };
  if (next[itemId]) delete next[itemId];
  else next[itemId] = true;
  return next;
}

export function checklistProgress(state, items) {
  const list = items || [];
  const done = list.filter((i) => state && state[i.id]).length;
  return { done, total: list.length };
}

/* ---- price tracker (user sightings) ----
   The Chronicle's rule, enforced in code: asking prices and sold prices are
   separate lanes and are never averaged, ranged, or summarized together. */

export const PRICES_KEY = STORE_KEYS.dropweekPrices;

export const SIGHTING_KINDS = ["asking", "sold"];

/** Validate + normalize a sighting. Returns null when the entry is unusable. */
export function makeSighting(raw) {
  if (!raw || typeof raw !== "object") return null;
  const price = Number(raw.price);
  if (!raw.figure || !SIGHTING_KINDS.includes(raw.kind)) return null;
  if (!Number.isFinite(price) || price <= 0 || price > 100000) return null;
  return {
    id: String(raw.id || ""),
    figure: String(raw.figure),
    kind: raw.kind,
    price: Math.round(price * 100) / 100,
    where: String(raw.where || "").slice(0, 80),
    date: /^\d{4}-\d{2}-\d{2}$/.test(raw.date || "") ? raw.date : "",
    note: String(raw.note || "").slice(0, 140),
  };
}

export function addSighting(list, raw) {
  const s = makeSighting(raw);
  if (!s) return list;
  return [...(list || []), s];
}

export function removeSighting(list, id) {
  return (list || []).filter((s) => s.id !== id);
}

/**
 * Per-figure price lanes. `asking` summarizes ONLY asking sightings, `sold`
 * ONLY sold sightings — the two never touch. Empty lane = { count: 0, low: null, high: null }.
 */
export function priceLanes(sightings, figureName) {
  const lane = (kind) => {
    const ps = (sightings || [])
      .filter((s) => s.figure === figureName && s.kind === kind)
      .map((s) => s.price);
    return ps.length
      ? { count: ps.length, low: Math.min(...ps), high: Math.max(...ps) }
      : { count: 0, low: null, high: null };
  };
  return { asking: lane("asking"), sold: lane("sold") };
}

export function fmtMoney(n) {
  return n == null ? "—" : `$${Number(n).toFixed(2)}`;
}

/** One honest sentence about a figure's lanes vs its announced MSRP. */
export function priceVerdict(lanes, msrp) {
  if (lanes.sold.count > 0 && lanes.sold.low <= msrp) {
    return `Reported solds start at ${fmtMoney(lanes.sold.low)} — at or under the ${fmtMoney(msrp)} MSRP.`;
  }
  if (lanes.sold.count > 0) {
    return `Reported solds start at ${fmtMoney(lanes.sold.low)} — above MSRP. Wave 1's solds cooled within weeks; patience has a track record here.`;
  }
  if (lanes.asking.count > 0 && lanes.asking.low > msrp) {
    return `The cheapest asking price logged is ${fmtMoney(lanes.asking.low)} — ${fmtMoney(lanes.asking.low - msrp)} over MSRP. An asking price is a hope, not a sale.`;
  }
  if (lanes.asking.count > 0) {
    return `Asking prices logged start at ${fmtMoney(lanes.asking.low)} — at MSRP. No solds logged yet.`;
  }
  return "Nothing logged yet — this lane fills in from your own sightings.";
}

/* ---- page wiring ---- */

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function loadPlan() {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return newPlan();
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? p : newPlan();
  } catch {
    return newPlan();
  }
}

function savePlan(plan) {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  } catch {
    /* quota or privacy mode — the plan just doesn't persist */
  }
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or privacy mode — the state just doesn't persist */
  }
}

export async function init() {
  const root = document.getElementById("drop-root");
  if (!root) return;
  let data;
  try {
    const res = await fetch("data/drop-week.json");
    data = await res.json();
  } catch {
    root.innerHTML = "";
    root.appendChild(el("p", "dw-error", "Couldn't load the drop data. Check your connection and reload."));
    return;
  }
  const drops = sortDrops(data.drops || []);
  const plan = loadPlan();

  renderHero(data, drops);
  renderChecklist(data.checklist || []);
  renderDrops(drops, plan);
  renderPriceWatch(data.priceWatch || null);
  renderRadarPoll(data.radarPoll || null);
  renderIntel(data.intel || {});
  const mbody = document.getElementById("dw-method-body");
  if (mbody) mbody.textContent = data.methodology || "";
  wirePlan(drops, plan);
  wireRail();
  tickCountdowns(drops);
  setInterval(() => tickCountdowns(drops), 1000);
}

function renderHero(data, drops) {
  const hero = document.getElementById("dw-hero-next");
  if (!hero) return;
  const nd = nextDrop(drops);
  hero.innerHTML = "";
  if (!nd) {
    hero.appendChild(el("p", "dw-hero-note", "Every tracked window has passed — check the pre-order tracker for what's next."));
    return;
  }
  /* ids as string literals so the validate.sh id cross-check sees them */
  hero.dataset.dropId = nd.id;
  hero.innerHTML =
    '<p class="dw-kicker">Next up</p>' +
    '<h2 class="dw-next-title"></h2>' +
    '<p class="dw-next-when"></p>' +
    '<p class="dw-next-count" id="dw-next-count" aria-hidden="true"></p>' +
    '<p class="sr-only" id="dw-next-count-sr" aria-live="polite"></p>' +
    '<p class="dw-next-local" id="dw-next-local"></p>' +
    `<a class="dw-next-link" href="#drop-${nd.id}">Jump to this drop ↓</a>` +
    ' <a class="dw-next-link" href="#dw-section-checklist">Open the buyer checklist ↓</a>';
  hero.querySelector(".dw-next-title").textContent = nd.title;
  hero.querySelector(".dw-next-when").textContent = nd.windowLabel;
  const local = hero.querySelector(".dw-next-local");
  if (local && nd.windowAt) {
    const here = formatWindowLocal(nd.windowAt);
    if (here) local.textContent = `That is ${here} where you are — set the alarm for your clock, not ET's.`;
  }
}

function tickCountdowns(drops) {
  const now = Date.now();
  for (const d of drops) {
    const t = timeToDrop(d, now);
    const badge = document.querySelector(`[data-countdown="${d.id}"]`);
    if (badge) {
      badge.textContent = t && !t.past ? formatCountdown(t) : t && t.past ? "—" : "";
      badge.classList.toggle("is-past", !!(t && t.past));
    }
  }
  const heroNext = document.getElementById("dw-hero-next");
  if (heroNext && heroNext.dataset.dropId) {
    const d = drops.find((x) => x.id === heroNext.dataset.dropId);
    const t = d && timeToDrop(d, now);
    const cd = document.getElementById("dw-next-count");
    const sr = document.getElementById("dw-next-count-sr");
    if (cd && t) {
      cd.textContent = t.past ? "Window time has passed" : formatCountdown(t);
      cd.setAttribute("aria-hidden", "true");
    }
    if (sr && t && !t.past) {
      /* The visual clock ticks every second; the spoken summary only changes
         when the minute does, so screen readers aren't spammed. */
      const bits = [];
      if (t.days) bits.push(`${t.days} day${t.days === 1 ? "" : "s"}`);
      if (t.hours) bits.push(`${t.hours} hour${t.hours === 1 ? "" : "s"}`);
      bits.push(`${t.mins} minute${t.mins === 1 ? "" : "s"}`);
      const msg = `${d.title} opens in ${bits.join(", ")}.`;
      if (sr.textContent !== msg) sr.textContent = msg;
    }
  }
}

function renderDrops(drops, plan) {
  const wrap = document.getElementById("dw-drops");
  if (!wrap) return;
  wrap.innerHTML = "";
  const now = Date.now();
  for (const d of drops) {
    const card = el("article", "dw-card");
    card.id = `drop-${d.id}`;
    card.setAttribute("aria-labelledby", `drop-${d.id}-h`);

    const status = dropStatus(d, now);
    const badge = el("p", `dw-badge dw-badge-${status}`);
    const cd = el("span", "dw-countdown");
    cd.dataset.countdown = d.id;
    badge.append(el("span", null, `${statusLabel(status, d.kind)} · `), cd);

    const h = el("h3", "dw-card-title", d.title);
    h.id = `drop-${d.id}-h`;
    const dispatch = el("p", "dw-dispatch accession");
    dispatch.append(el("span", "acc-label", "Dispatch №"), document.createTextNode(" "), el("span", "acc-no", d.id));
    const when = el("p", "dw-when");
    const timeEl = document.createElement("time");
    if (d.windowAt) timeEl.dateTime = d.windowAt;
    timeEl.textContent = d.windowLabel;
    when.appendChild(timeEl);

    const rets = el("p", "dw-retailers", `Where: ${(d.retailers || []).join(" · ")}`);
    const price = el("p", "dw-price", d.price && d.price.text ? d.price.text : "");
    const ship = el("p", "dw-ship", d.shipWindow ? `Ships: ${d.shipWindow}` : "");

    const figList = el("ul", "dw-figs");
    for (const f of d.figures || []) {
      const li = el("li", "dw-fig");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dw-plan-btn";
      btn.dataset.drop = d.id;
      btn.dataset.fig = f.name;
      const state = planState(plan, d.id, f.name);
      btn.dataset.state = state || "none";
      btn.setAttribute("aria-pressed", state === "want" || state === "ordered" ? "true" : "false");
      btn.setAttribute("aria-label", `${f.name}: ${state === "ordered" ? "ordered — activate to clear" : state === "want" ? "going for it — activate to mark ordered" : "not targeted — activate to target"}`);
      const name = el("span", "dw-fig-name", f.name);
      const tag = el("span", "dw-fig-tag", state === "ordered" ? "✓ ordered" : state === "want" ? "→ going for it" : "+ target");
      btn.append(name, tag);
      li.appendChild(btn);
      if (f.note) li.appendChild(el("p", "dw-fig-note", f.note));
      figList.appendChild(li);
    }

    const notes = el("ul", "dw-notes");
    for (const n of d.notes || []) notes.appendChild(el("li", null, n));

    const srcs = el("p", "dw-sources", "Sources: ");
    (d.sources || []).forEach((s, i) => {
      if (i > 0) srcs.appendChild(document.createTextNode(" · "));
      const a = document.createElement("a");
      a.href = s.url;
      a.rel = "noopener";
      a.textContent = s.label + (s.flag ? ` [${s.flag}]` : "");
      srcs.appendChild(a);
    });

    card.append(badge, h, dispatch, when, rets, price, ship, figList, notes, srcs);
    wrap.appendChild(card);
  }
}

function intelList(items) {
  const ul = el("ul", "dw-intel-list");
  for (const t of items || []) ul.appendChild(el("li", null, t));
  return ul;
}

function renderIntel(intel) {
  const mount = (id, nodes) => {
    const m = document.getElementById(id);
    if (!m) return;
    m.innerHTML = "";
    for (const n of nodes) m.appendChild(n);
  };
  const scarcity = (intel.scarcity || []).map((s) => {
    const li = el("li", null, s.text + " ");
    const small = el("small", "dw-src", `(${(s.sources || []).map((x) => x.label).join("; ")})`);
    li.appendChild(small);
    return li;
  });
  const sUl = el("ul", "dw-intel-list");
  for (const li of scarcity) sUl.appendChild(li);
  mount("dw-scarcity", [sUl]);
  mount("dw-prices", [intelList(intel.price || [])]);
  mount("dw-ko", [intelList(intel.koWatch || [])]);
  const rw = intel.rumorWatch || {};
  const rwNodes = [el("p", "dw-note", rw.note || "")];
  const rwUl = el("ul", "dw-intel-list");
  for (const item of rw.items || []) rwUl.appendChild(el("li", "dw-rumor", item));
  rwNodes.push(rwUl);
  const rwSrc = el("p", "dw-sources", "Sources: ");
  (rw.sources || []).forEach((s, i) => {
    if (i > 0) rwSrc.appendChild(document.createTextNode(" · "));
    const a = document.createElement("a");
    a.href = s.url;
    a.rel = "noopener";
    a.textContent = s.label;
    rwSrc.appendChild(a);
  });
  rwNodes.push(rwSrc);
  mount("dw-rumors", rwNodes);
}

const CHECKLIST_PHASES = [
  ["before", "Before the window"],
  ["morning", "Window morning"],
  ["at-open", "At 1 PM ET"],
  ["after", "After you order"],
];

function renderChecklist(items) {
  const wrap = document.getElementById("dw-checklist");
  if (!wrap || !items.length) return;
  let state = loadJson(CHECKLIST_KEY, {});
  if (!state || typeof state !== "object" || Array.isArray(state)) state = {};
  const progress = document.getElementById("dw-check-progress");
  const update = () => {
    const { done, total } = checklistProgress(state, items);
    if (progress) {
      progress.textContent =
        done === total
          ? `All ${total} done. You are ready for the window — the rest is clicking.`
          : `${done} of ${total} done.`;
    }
  };
  wrap.innerHTML = "";
  for (const [phase, label] of CHECKLIST_PHASES) {
    const group = items.filter((i) => i.phase === phase);
    if (!group.length) continue;
    const h = el("h3", "dw-check-phase", label);
    const ul = el("ul", "dw-check-list");
    for (const item of group) {
      const li = el("li", "dw-check-item");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.className = "dw-check-box";
      box.id = `dw-check-${item.id}`;
      box.checked = !!state[item.id];
      box.addEventListener("change", () => {
        state = toggleCheck(state, item.id);
        saveJson(CHECKLIST_KEY, state);
        update();
      });
      const lab = document.createElement("label");
      lab.htmlFor = box.id;
      const strong = el("span", "dw-check-label", item.label);
      lab.appendChild(strong);
      if (item.detail) lab.appendChild(el("span", "dw-check-detail", item.detail));
      li.append(box, lab);
      ul.appendChild(li);
    }
    wrap.append(h, ul);
  }
  const reset = document.getElementById("dw-check-reset");
  if (reset) {
    reset.addEventListener("click", () => {
      state = {};
      saveJson(CHECKLIST_KEY, state);
      wrap.querySelectorAll(".dw-check-box").forEach((b) => { b.checked = false; });
      update();
    });
  }
  update();
}

function renderPriceWatch(pw) {
  const body = document.getElementById("dw-price-rows");
  if (!body || !pw || !Array.isArray(pw.figures)) return;
  let sightings = loadJson(PRICES_KEY, []);
  if (!Array.isArray(sightings)) sightings = [];
  sightings = sightings.map(makeSighting).filter(Boolean);

  const note = document.getElementById("dw-price-note");
  if (note && pw.note) note.textContent = pw.note;
  const msrpNote = document.getElementById("dw-price-msrp-note");
  if (msrpNote && pw.msrpNote) msrpNote.textContent = pw.msrpNote;
  const ctx = document.getElementById("dw-price-context");
  if (ctx) {
    ctx.innerHTML = "";
    const ul = el("ul", "dw-intel-list");
    for (const c of pw.context || []) {
      const li = el("li", null, "");
      li.appendChild(el("strong", null, `${c.figure}: `));
      li.appendChild(document.createTextNode(c.text));
      ul.appendChild(li);
    }
    ctx.appendChild(ul);
    if (pw.contextSource) {
      const p = el("p", "dw-sources", "Source: ");
      const a = document.createElement("a");
      a.href = pw.contextSource.url;
      a.textContent = pw.contextSource.label;
      p.appendChild(a);
      ctx.appendChild(p);
    }
  }

  const figSelect = document.getElementById("dw-price-fig");
  if (figSelect) {
    figSelect.innerHTML = "";
    for (const f of pw.figures) {
      const opt = document.createElement("option");
      opt.value = f.name;
      opt.textContent = f.name;
      figSelect.appendChild(opt);
    }
  }
  const dateInput = document.getElementById("dw-price-date");
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }

  const render = () => {
    body.innerHTML = "";
    for (const f of pw.figures) {
      const lanes = priceLanes(sightings, f.name);
      const tr = document.createElement("tr");
      const name = el("th", "dw-price-fig-name", f.name);
      name.scope = "row";
      const msrp = el("td", "dw-price-msrp", fmtMoney(f.msrp));
      const asking = el("td", "dw-price-lane",
        lanes.asking.count
          ? `${fmtMoney(lanes.asking.low)}${lanes.asking.high > lanes.asking.low ? ` – ${fmtMoney(lanes.asking.high)}` : ""} (${lanes.asking.count} logged)`
          : "No listings logged yet");
      const sold = el("td", "dw-price-lane",
        lanes.sold.count
          ? `${fmtMoney(lanes.sold.low)}${lanes.sold.high > lanes.sold.low ? ` – ${fmtMoney(lanes.sold.high)}` : ""} (${lanes.sold.count} logged)`
          : "No solds yet — the wave ships Spring 2027");
      const verdict = el("td", "dw-price-verdict", priceVerdict(lanes, f.msrp));
      tr.append(name, msrp, asking, sold, verdict);
      body.appendChild(tr);
    }
    const list = document.getElementById("dw-price-list");
    if (list) {
      list.innerHTML = "";
      if (!sightings.length) {
        list.appendChild(el("li", "dw-note", "No sightings logged yet. When a listing catches your eye tomorrow, put it here — asking or sold, never both at once."));
      }
      for (const s of [...sightings].reverse()) {
        const li = el("li", "dw-sighting");
        const kindLabel = s.kind === "sold" ? "SOLD" : "ASKING";
        li.appendChild(el("span", "dw-sighting-text",
          `${kindLabel} · ${s.figure} · ${fmtMoney(s.price)}${s.where ? ` at ${s.where}` : ""}${s.date ? ` · ${s.date}` : ""}`));
        const del = document.createElement("button");
        del.type = "button";
        del.className = "dw-btn dw-btn-ghost dw-sighting-del";
        del.textContent = "Remove";
        del.setAttribute("aria-label", `Remove sighting: ${s.figure} ${kindLabel.toLowerCase()} at ${fmtMoney(s.price)}`);
        del.addEventListener("click", () => {
          sightings = removeSighting(sightings, s.id);
          saveJson(PRICES_KEY, sightings);
          render();
        });
        li.appendChild(del);
        list.appendChild(li);
      }
    }
  };

  const addBtn = document.getElementById("dw-price-add");
  const status = document.getElementById("dw-price-status");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const kind = document.getElementById("dw-price-kind");
      const amount = document.getElementById("dw-price-amount");
      const where = document.getElementById("dw-price-where");
      const s = makeSighting({
        id: `s-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
        figure: figSelect ? figSelect.value : "",
        kind: kind ? kind.value : "",
        price: amount ? amount.value : "",
        where: where ? where.value : "",
        date: dateInput ? dateInput.value : "",
      });
      if (!s) {
        if (status) status.textContent = "That entry needs a figure, a lane (asking or sold), and a price above zero.";
        return;
      }
      sightings = addSighting(sightings, s);
      saveJson(PRICES_KEY, sightings);
      if (amount) amount.value = "";
      if (status) status.textContent = `Logged: ${s.figure}, ${s.kind} at ${fmtMoney(s.price)}. It stays in the ${s.kind} lane.`;
      render();
    });
  }
  render();
}

const POLL_FLAG_LABELS = {
  "confirmed": "Confirmed",
  "reported": "Reported",
  "single-source": "Single source",
  "uncertain": "Uncertain — not confirmed",
};

function renderRadarPoll(poll) {
  const wrap = document.getElementById("dw-radar-poll");
  if (!wrap || !poll || !Array.isArray(poll.findings)) return;
  wrap.innerHTML = "";
  if (poll.polledNote) wrap.appendChild(el("p", "dw-note", poll.polledNote));
  const list = el("div", "dw-poll-list");
  for (const f of poll.findings) {
    const card = el("article", "dw-poll-card");
    const flag = el("p", `dw-poll-flag dw-poll-flag-${f.flag}`, POLL_FLAG_LABELS[f.flag] || f.flag);
    card.appendChild(flag);
    card.appendChild(el("h3", "dw-poll-head", f.headline));
    card.appendChild(el("p", "dw-poll-detail", f.detail));
    const srcs = el("p", "dw-sources", "Sources: ");
    (f.sources || []).forEach((s, i) => {
      if (i > 0) srcs.appendChild(document.createTextNode(" · "));
      const a = document.createElement("a");
      a.href = s.url;
      a.rel = "noopener";
      a.textContent = s.label;
      srcs.appendChild(a);
    });
    card.appendChild(srcs);
    list.appendChild(card);
  }
  wrap.appendChild(list);
  const more = el("p", "dw-note", "");
  more.appendChild(document.createTextNode("The full scanner output lives on the "));
  const a = document.createElement("a");
  a.href = "radar.html";
  a.textContent = "Reveal Radar";
  more.appendChild(a);
  more.appendChild(document.createTextNode(" — candidates stay candidates until a second source or Hasbro confirms them."));
  wrap.appendChild(more);
}

function wirePlan(drops, plan) {
  const wrap = document.getElementById("dw-drops");
  const countLine = document.getElementById("dw-plan-count");
  const update = () => {
    const { want, ordered } = planTotals(plan, drops);
    if (countLine) {
      countLine.textContent =
        want + ordered === 0
          ? "No targets set yet — tap a figure to add it to your battle plan."
          : `${want} going for it · ${ordered} ordered across ${drops.length} drops.`;
    }
  };
  if (wrap) {
    wrap.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".dw-plan-btn");
      if (!btn) return;
      const state = cyclePlanState(plan, btn.dataset.drop, btn.dataset.fig);
      savePlan(plan);
      btn.dataset.state = state || "none";
      btn.setAttribute("aria-pressed", state ? "true" : "false");
      btn.querySelector(".dw-fig-tag").textContent =
        state === "ordered" ? "✓ ordered" : state === "want" ? "→ going for it" : "+ target";
      btn.setAttribute(
        "aria-label",
        `${btn.dataset.fig}: ${state === "ordered" ? "ordered — activate to clear" : state === "want" ? "going for it — activate to mark ordered" : "not targeted — activate to target"}`
      );
      update();
    });
  }
  const copyBtn = document.getElementById("dw-copy-plan");
  const status = document.getElementById("dw-copy-status");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const text = buildPlanShareText(plan, drops, "Observed 2026-10-12 · times in ET");
      try {
        await navigator.clipboard.writeText(text);
        if (status) status.textContent = "Battle plan copied — paste it anywhere.";
      } catch {
        if (status) status.textContent = "Copy failed — your browser blocked clipboard access.";
      }
    });
  }
  const clearBtn = document.getElementById("dw-clear-plan");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      for (const k of Object.keys(plan)) delete plan[k];
      savePlan(plan);
      document.querySelectorAll(".dw-plan-btn").forEach((b) => {
        b.dataset.state = "none";
        b.setAttribute("aria-pressed", "false");
        b.querySelector(".dw-fig-tag").textContent = "+ target";
      });
      update();
      if (status) status.textContent = "Battle plan cleared.";
    });
  }
  update();
}

/* Sticky in-page rail: highlight the section in view (no smooth-scroll
   animation — native anchors + scroll-margin only, reduced-motion safe). */
function wireRail() {
  const links = [...document.querySelectorAll(".dw-rail a")];
  if (!links.length || !("IntersectionObserver" in window)) return;
  const map = new Map();
  for (const a of links) {
    const sec = document.querySelector(a.getAttribute("href"));
    if (sec) map.set(sec, a);
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        for (const a of links) a.removeAttribute("aria-current");
        const a = map.get(e.target);
        if (a) a.setAttribute("aria-current", "true");
      }
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  for (const sec of map.keys()) io.observe(sec);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
