/* budget-core.js — pure Budget Tracker math. No DOM, no storage: callers
   supply the purchase list (mlc_buys_v1 rows: { price, date, ... }) and the
   budget object ({ monthly, annual } in dollars). A mirror, not a planner —
   no advice, just arithmetic. */

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/* "YYYY-MM" for a Date or a "YYYY-MM-DD" string; null when unparseable. */
export function monthKey(d) {
  let y, m;
  if (d instanceof Date) {
    if (Number.isNaN(d.getTime())) return null;
    y = d.getFullYear(); m = d.getMonth() + 1;
  } else if (typeof d === "string") {
    const mm = /^(\d{4})-(\d{2})(?:-\d{2})?/.exec(d.trim());
    if (!mm) return null;
    y = Number(mm[1]); m = Number(mm[2]);
    if (m < 1 || m > 12) return null;
  } else {
    return null;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function buysInMonth(buys, key) {
  if (!key) return [];
  return (Array.isArray(buys) ? buys : []).filter((b) => monthKey(b?.date) === key);
}

export function buysInYear(buys, year) {
  const y = String(year);
  return (Array.isArray(buys) ? buys : []).filter((b) => {
    const k = monthKey(b?.date);
    return k !== null && k.startsWith(`${y}-`);
  });
}

export function totalFor(buys) {
  return (Array.isArray(buys) ? buys : []).reduce((s, b) => s + num(b?.price), 0);
}

/* Spend vs one budget line. limit null/0 -> { set: false }. */
export function budgetStatus(spent, limit) {
  const l = num(limit);
  const s = num(spent);
  if (l <= 0) return { set: false, spent: s, limit: 0, pct: 0, over: false, remaining: 0 };
  return {
    set: true,
    spent: s,
    limit: l,
    pct: (s / l) * 100,
    over: s > l,
    remaining: Math.max(l - s, 0),
  };
}

/* All-time stats over the logged purchases. maxBuy is the purchase row. */
export function budgetStats(buys) {
  const list = Array.isArray(buys) ? buys : [];
  const priced = list.filter((b) => Number.isFinite(Number(b?.price)) && Number(b.price) > 0);
  const total = totalFor(priced);
  const maxBuy = priced.reduce((m, b) => (m === null || Number(b.price) > Number(m.price) ? b : m), null);
  return {
    count: list.length,
    pricedCount: priced.length,
    total,
    avg: priced.length ? total / priced.length : 0,
    max: maxBuy ? Number(maxBuy.price) : 0,
    maxBuy,
  };
}

/* Month + year keys for "today" (injectable for tests). */
export function todayKeys(now = new Date()) {
  const m = monthKey(now);
  return { month: m, year: m ? m.slice(0, 4) : null };
}
