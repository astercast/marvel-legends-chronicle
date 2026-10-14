/* Release calendar page (wave 13): 12-month forward view, Oct 2026 -> Sep 2027.
   Fed by data/preorders.json; only items with an exact pre-order date are plotted.
   Keyboard: arrow keys move the focused day within the month grid; Enter/Space opens
   the day's detail. Reduced motion: all transitions are opt-in via media query. */
import { PATHS } from "./config.js";
import {
  parseYMD, todayStr, calendarMonths, monthMatrix, itemsOnDay, undatedItems,
  countdownText, preorderCountdown, itemStatus, escapeAttr, money,
} from "./preorders.js";

const WINDOW_START = "2026-10";
const WINDOW_MONTHS = 12;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function friendlyDate(ymd) {
  const p = parseYMD(ymd);
  if (!p) return ymd;
  const names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${WEEKDAYS_LONG[new Date(p.y, p.m - 1, p.d).getDay()]}, ${names[p.m - 1]} ${p.d}, ${p.y}`;
}

function detailHtml(items, ymd, today) {
  if (!items.length) {
    return `<p>No pre-order dates reported for this day. Some releases are only dated to a season, see the list below.</p>`;
  }
  return items.map((it) => {
    const st = itemStatus(it, today);
    const price = money(it.price);
    return `<article class="cal-item">
      <h3>${escapeAttr(it.name)}</h3>
      <p class="cal-item-meta"><span class="status status-${st.key.startsWith("preorder") ? "preorder" : "revealed"}">${escapeAttr(st.label)}</span>${price ? ` <span class="price">${price}</span>` : ""}</p>
      <p>${escapeAttr(countdownText(preorderCountdown(it, today)) || st.detail)}</p>
    </article>`;
  }).join("");
}

function monthHtml(m, items, today) {
  const weeks = monthMatrix(m.year, m.month);
  const isCurrent = m.key === today.slice(0, 7);
  const rows = weeks.map((week) =>
    `<tr>${week.map((ymd) => {
      if (!ymd) return `<td class="cal-pad" aria-hidden="true"></td>`;
      const dayItems = itemsOnDay(items, ymd);
      const isToday = ymd === today;
      const mark = dayItems.length
        ? `<span class="cal-dots" aria-hidden="true">${"●".repeat(Math.min(dayItems.length, 3))}</span><span class="visually-hidden">: ${dayItems.length} release${dayItems.length === 1 ? "" : "s"}</span>`
        : "";
      return `<td class="${isToday ? "cal-today" : ""}"><button type="button" class="cal-day${dayItems.length ? " has-items" : ""}" data-date="${ymd}" aria-label="${friendlyDate(ymd)}${dayItems.length ? `, ${dayItems.length} release${dayItems.length === 1 ? "" : "s"}: ${dayItems.map((i) => i.name).join(", ")}` : ""}">${Number(ymd.slice(8))}${mark}</button></td>`;
    }).join("")}</tr>`
  ).join("");
  return `<section class="cal-month card" aria-labelledby="cal-${m.key}">
    <h2 id="cal-${m.key}" class="cal-month-title">${m.label}${isCurrent ? ' <span class="status status-preorder">This month</span>' : ""}</h2>
    <table class="cal-grid" role="grid" aria-label="${m.label}, arrow keys move between days">
      <thead><tr>${WEEKDAYS.map((w) => `<th scope="col">${w}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function undatedHtml(items) {
  if (!items.length) return `<p>Every tracked release carries an exact date.</p>`;
  const rows = items.map((it) => {
    const st = itemStatus(it, todayStr());
    return `<li><strong>${escapeAttr(it.name)}</strong>, ${escapeAttr(st.detail)} <span class="venue">(${escapeAttr(it.venue || "")})</span></li>`;
  }).join("");
  return `<p class="chart-sub">These carry only a season or year from the research, plotted nowhere above, listed here so nothing slips.</p>
    <ul>${rows}</ul>`;
}

function selectDetail(ymd, items, today) {
  const panel = document.getElementById("cal-detail");
  const title = document.getElementById("cal-detail-title");
  if (!panel || !title) return;
  title.textContent = friendlyDate(ymd);
  panel.querySelector(".cal-detail-body").innerHTML = detailHtml(itemsOnDay(items, ymd), ymd, today);
  panel.hidden = false;
}

export async function initCalendar() {
  const wrap = document.getElementById("cal-months");
  if (!wrap) return;
  let items = [];
  try {
    const res = await fetch(PATHS.preorders);
    if (res.ok) {
      const data = await res.json();
      items = Array.isArray(data.items) ? data.items : [];
    }
  } catch { /* empty state below */ }

  const today = todayStr();
  const months = calendarMonths(WINDOW_START, WINDOW_MONTHS);

  document.getElementById("cal-range").textContent = `${months[0].label}, ${months[months.length - 1].label}`;
  wrap.innerHTML = months.map((m) => monthHtml(m, items, today)).join("");

  const undated = document.getElementById("cal-undated-body");
  if (undated) undated.innerHTML = undatedHtml(undatedItems(items));

  // quick-jump: focus a date's day button
  const jumper = document.getElementById("cal-jump");
  if (jumper) {
    const dated = items.filter((it) => parseYMD(it.preorderDate));
    jumper.innerHTML = `<option value="">Jump to a dated release…</option>` +
      dated.map((it) => `<option value="${escapeAttr(it.preorderDate)}">${escapeAttr(it.preorderDate)}, ${escapeAttr(it.name)}</option>`).join("");
    jumper.addEventListener("change", () => {
      if (!jumper.value) return;
      const btn = wrap.querySelector(`button[data-date="${jumper.value}"]`);
      if (btn) { btn.focus(); btn.scrollIntoView({ block: "nearest" }); }
      jumper.value = "";
    });
  }

  // click / keyboard on day buttons (event delegation)
  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest("button.cal-day");
    if (btn) selectDetail(btn.dataset.date, items, today);
  });
  wrap.addEventListener("keydown", (e) => {
    const btn = e.target.closest("button.cal-day");
    if (!btn) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectDetail(btn.dataset.date, items, today);
      return;
    }
    const dir = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (!dir) return;
    e.preventDefault();
    const cell = btn.closest("td");
    const row = cell.closest("tr");
    const rows = [...row.closest("tbody").rows];
    const ri = rows.indexOf(row) + dir[0];
    const ci = cell.cellIndex + dir[1];
    if (ri < 0 || ri >= rows.length) return;
    const target = rows[ri].cells[ci];
    const next = target && target.querySelector("button.cal-day");
    if (next) next.focus();
  });
}

if (typeof document !== "undefined" && document.getElementById("cal-months")) {
  initCalendar();
}
