/* Budget Tracker — spend ledger, not a financial planner. Reads the
   purchases the user already logs (mlc_buys_v1, via the Ledger page),
   compares month/year spend against the user's own budget targets
   (mlc_budget_v1), and shows plain arithmetic stats. A mirror, not a
   planner: no advice, no recommendations, nothing leaves the browser. */
import { STORE_KEYS } from "./config.js";
import { load, save } from "./store.js";
import { money } from "./price-watch.js";
import {
  monthKey, buysInMonth, buysInYear, totalFor,
  budgetStatus, budgetStats, todayKeys,
} from "./budget-core.js";
import { escapeHtml } from "./figure-dialog.js";

const els = {
  form: document.getElementById("budget-form"),
  monthly: document.getElementById("b-monthly"),
  annual: document.getElementById("b-annual"),
  saveStatus: document.getElementById("b-save-status"),
  clear: document.getElementById("b-clear-budgets"),
  summary: document.getElementById("b-summary"),
  monthTitle: document.getElementById("b-month-title"),
  monthBar: document.getElementById("b-month-bar"),
  monthLine: document.getElementById("b-month-line"),
  yearTitle: document.getElementById("b-year-title"),
  yearBar: document.getElementById("b-year-bar"),
  yearLine: document.getElementById("b-year-line"),
  stats: document.getElementById("b-stats"),
  recent: document.getElementById("b-recent"),
  empty: document.getElementById("b-empty"),
};

function getBudget() {
  const raw = load(STORE_KEYS.budget, {});
  const monthly = Number(raw?.monthly);
  const annual = Number(raw?.annual);
  return {
    monthly: Number.isFinite(monthly) && monthly > 0 ? Math.round(monthly * 100) / 100 : null,
    annual: Number.isFinite(annual) && annual > 0 ? Math.round(annual * 100) / 100 : null,
  };
}

function setBudget(b) {
  save(STORE_KEYS.budget, b);
}

function getBuys() {
  const raw = load(STORE_KEYS.buys, []);
  return Array.isArray(raw) ? raw.filter((b) => b && typeof b === "object") : [];
}

function monthName(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function barHtml(status) {
  if (!status.set) {
    return `<p class="chart-sub">No budget set — pick a number in the budget box to track against.</p>`;
  }
  const pct = Math.min(status.pct, 100);
  const cls = status.over ? "over" : "";
  const note = status.over
    ? `<p class="budget-over" role="alert">Over budget by ${money(status.spent - status.limit)}.</p>`
    : `<p class="chart-sub">${money(status.remaining)} left of ${money(status.limit)}.</p>`;
  return `
    <div class="progress-bar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100"
         aria-valuenow="${Math.round(status.pct)}" aria-label="Budget used">
      <span style="width:${pct}%"></span>
    </div>
    <p class="budget-line"><strong>${money(status.spent)}</strong> of <strong>${money(status.limit)}</strong> — ${Math.round(status.pct)}% used.</p>
    ${note}`;
}

function render() {
  const budget = getBudget();
  const buys = getBuys();
  const { month, year } = todayKeys();

  els.monthly.value = budget.monthly ?? "";
  els.annual.value = budget.annual ?? "";

  const monthBuys = buysInMonth(buys, month);
  const yearBuys = buysInYear(buys, year);
  const mStatus = budgetStatus(totalFor(monthBuys), budget.monthly);
  const yStatus = budgetStatus(totalFor(yearBuys), budget.annual);

  els.monthTitle.textContent = month ? `This month — ${monthName(month)}` : "This month";
  els.monthBar.innerHTML = barHtml(mStatus);
  els.yearTitle.textContent = year ? `This year — ${year}` : "This year";
  els.yearBar.innerHTML = barHtml(yStatus);

  const stats = budgetStats(buys);
  els.summary.innerHTML =
    `<div class="stat"><div class="stat-value">${stats.count}</div><div class="stat-label">Purchases logged</div></div>` +
    `<div class="stat"><div class="stat-value">${money(stats.total)}</div><div class="stat-label">All-time spend</div></div>` +
    `<div class="stat"><div class="stat-value">${money(monthBuys.length ? totalFor(monthBuys) : 0)}</div><div class="stat-label">Spent this month</div></div>`;
  const maxLine = stats.maxBuy
    ? `${escapeHtml(stats.maxBuy.name ?? "Unknown figure")} — ${money(stats.max)}`
    : "—";
  els.stats.innerHTML =
    `<div class="stat"><div class="stat-value">${money(stats.avg)}</div><div class="stat-label">Average per figure</div></div>` +
    `<div class="stat"><div class="stat-value">${money(stats.max)}</div><div class="stat-label">Most expensive</div></div>` +
    `<div class="stat stat-wide"><div class="stat-value stat-small">${maxLine}</div><div class="stat-label">Biggest single purchase</div></div>`;

  const hasBuys = buys.length > 0;
  els.empty.hidden = hasBuys;
  els.recent.innerHTML = "";
  const recent = [...buys]
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .slice(0, 8);
  for (const b of recent) {
    const li = document.createElement("li");
    li.className = "buy-row";
    const price = Number(b.price);
    li.innerHTML = `
      <span class="buy-name">${escapeHtml(b.name ?? "Unknown figure")}</span>
      <span class="buy-date">${escapeHtml(b.date ?? "")}</span>
      <span class="buy-where">${escapeHtml(b.where ?? "")}</span>
      <span class="buy-price">${Number.isFinite(price) && price > 0 ? money(price) : "—"}</span>`;
    els.recent.appendChild(li);
  }
}

function main() {
  if (!els.form) return;
  render();

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const monthly = parseFloat(els.monthly.value);
    const annual = parseFloat(els.annual.value);
    if (els.monthly.value && (!Number.isFinite(monthly) || monthly <= 0)) {
      els.saveStatus.textContent = "Monthly budget must be above $0.";
      return;
    }
    if (els.annual.value && (!Number.isFinite(annual) || annual <= 0)) {
      els.saveStatus.textContent = "Annual budget must be above $0.";
      return;
    }
    setBudget({
      monthly: els.monthly.value ? Math.round(monthly * 100) / 100 : null,
      annual: els.annual.value ? Math.round(annual * 100) / 100 : null,
    });
    els.saveStatus.textContent = "Budget saved — this is your own number, change it anytime.";
    render();
  });

  els.clear.addEventListener("click", () => {
    setBudget({ monthly: null, annual: null });
    els.saveStatus.textContent = "Budgets cleared.";
    render();
  });
}

main();
