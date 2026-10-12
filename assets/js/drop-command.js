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

/** Split a non-negative ms span into days/hours/mins. */
export function countdownParts(ms) {
  const total = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  return { days, hours, mins };
}

/** "3d 4h 12m" — short countdown text. */
export function formatCountdown(parts) {
  const bits = [];
  if (parts.days > 0) bits.push(`${parts.days}d`);
  if (parts.hours > 0 || parts.days > 0) bits.push(`${parts.hours}h`);
  bits.push(`${parts.mins}m`);
  return bits.join(" ");
}

/**
 * { past, days, hours, mins } to the drop's moment, or null for a dateless drop.
 * nowMs is injectable for tests.
 */
export function timeToDrop(drop, nowMs = Date.now()) {
  const t = dropTimeMs(drop);
  if (t == null) return null;
  const diff = t - nowMs;
  if (diff <= 0) return { past: true, days: 0, hours: 0, mins: 0 };
  const { days, hours, mins } = countdownParts(diff);
  return { past: false, days, hours, mins };
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
  renderDrops(drops, plan);
  renderIntel(data.intel || {});
  const mbody = document.getElementById("dw-method-body");
  if (mbody) mbody.textContent = data.methodology || "";
  wirePlan(drops, plan);
  wireRail();
  tickCountdowns(drops);
  setInterval(() => tickCountdowns(drops), 30000);
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
    `<a class="dw-next-link" href="#drop-${nd.id}">Jump to this drop ↓</a>`;
  hero.querySelector(".dw-next-title").textContent = nd.title;
  hero.querySelector(".dw-next-when").textContent = nd.windowLabel;
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
      const bits = [];
      if (t.days) bits.push(`${t.days} day${t.days === 1 ? "" : "s"}`);
      if (t.hours) bits.push(`${t.hours} hour${t.hours === 1 ? "" : "s"}`);
      bits.push(`${t.mins} minute${t.mins === 1 ? "" : "s"}`);
      sr.textContent = `${d.title} opens in ${bits.join(", ")}.`;
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
      const text = buildPlanShareText(plan, drops, "Observed 2026-10-11 · times in ET");
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
