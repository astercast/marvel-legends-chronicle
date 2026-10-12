import { suite, test, assert } from "./assert.js";
import {
  parseYMD, todayStr, daysBetween, preorderCountdown, countdownText, itemStatus,
  monthKey, itemsByMonth, undatedItems, calendarMonths, monthMatrix, itemsOnDay,
  inWindow, isValidState, retailerById, giftReady,
} from "../assets/js/preorders.js";

const item = (over = {}) => ({
  id: "x", name: "Test Wave", status: "preorder", preorderDate: null,
  releaseWindow: "Fall 2026", price: 27.99, query: "test",
  venue: null, details: null, retailers: [], sources: [],
  ...over,
});

suite("preorders: dates", () => {
  test("parseYMD accepts valid dates and rejects junk", () => {
    assert.deepEqual(parseYMD("2026-10-21"), { y: 2026, m: 10, d: 21 });
    assert.equal(parseYMD("2026-02-30"), null, "Feb 30 is not a date");
    assert.equal(parseYMD("2026-13-01"), null);
    assert.equal(parseYMD("not-a-date"), null);
    assert.equal(parseYMD(null), null);
  });

  test("daysBetween counts whole calendar days", () => {
    assert.equal(daysBetween("2026-10-11", "2026-10-21"), 10);
    assert.equal(daysBetween("2026-10-21", "2026-10-11"), -10);
    assert.equal(daysBetween("2026-10-11", "2026-10-11"), 0);
    assert.equal(daysBetween("2026-09-29", "2026-10-06"), 7);
    assert.equal(daysBetween("bogus", "2026-10-11"), null);
  });

  test("todayStr returns local YYYY-MM-DD", () => {
    const s = todayStr();
    assert(/^\d{4}-\d{2}-\d{2}$/.test(s), `bad format: ${s}`);
    assert.deepEqual(todayStr(new Date(2026, 9, 11)), "2026-10-11");
  });
});

suite("preorders: countdown", () => {
  test("future pre-order reports remaining days", () => {
    const cd = preorderCountdown(item({ preorderDate: "2026-10-21" }), "2026-10-11");
    assert.deepEqual(cd, { kind: "future", days: 10 });
    assert.equal(countdownText(cd), "Pre-order opens in 10 days");
  });

  test("tomorrow / today are special-cased", () => {
    assert.equal(countdownText(preorderCountdown(item({ preorderDate: "2026-10-12" }), "2026-10-11")), "Pre-order opens in 1 day");
    assert.equal(countdownText(preorderCountdown(item({ preorderDate: "2026-10-11" }), "2026-10-11")), "Pre-order opens today");
  });

  test("past pre-order reports elapsed days", () => {
    const cd = preorderCountdown(item({ preorderDate: "2026-10-06" }), "2026-10-11");
    assert.deepEqual(cd, { kind: "past", days: 5 });
    assert.equal(countdownText(cd), "Pre-order opened 5 days ago");
  });

  test("missing date means no countdown", () => {
    const cd = preorderCountdown(item({ preorderDate: null }), "2026-10-11");
    assert.deepEqual(cd, { kind: "none", days: null });
    assert.equal(countdownText(cd), "");
  });
});

suite("preorders: status", () => {
  test("X-Men '97 wave on Oct 11 is preorder-soon with countdown", () => {
    const st = itemStatus(item({ preorderDate: "2026-10-21" }), "2026-10-11");
    assert.equal(st.key, "preorder-soon");
    assert(st.detail.includes("10 days"), `detail: ${st.detail}`);
  });

  test("Mini Comics Wave 3 on Oct 11 is already open", () => {
    const st = itemStatus(item({ preorderDate: "2026-10-06" }), "2026-10-11");
    assert.equal(st.key, "preorder-open");
    assert(st.detail.includes("5 days ago"), `detail: ${st.detail}`);
  });

  test("announced wave with no date says so plainly", () => {
    const st = itemStatus(item({ status: "revealed" }), "2026-10-11");
    assert.equal(st.key, "announced");
    assert(st.detail.includes("not reported yet"), `detail: ${st.detail}`);
    assert(st.detail.includes("Fall 2026"), `window carried: ${st.detail}`);
  });

  test("preorder status with no date is preordered-no-date", () => {
    const st = itemStatus(item({ status: "preorder" }), "2026-10-11");
    assert.equal(st.key, "preordered-no-date");
  });

  test("available item reports availability", () => {
    const st = itemStatus(item({ status: "available", releaseWindow: "Shipped Oct 2026" }), "2026-10-11");
    assert.equal(st.key, "available");
    assert.equal(st.detail, "Shipped Oct 2026");
  });
});

suite("preorders: calendar helpers", () => {
  const items = [
    item({ id: "a", preorderDate: "2026-10-06" }),
    item({ id: "b", preorderDate: "2026-10-21" }),
    item({ id: "c", preorderDate: "2026-09-29" }),
    item({ id: "d", preorderDate: null }),
    item({ id: "e", preorderDate: null, releaseWindow: null }),
  ];

  test("monthKey groups by year-month", () => {
    assert.equal(monthKey("2026-10-21"), "2026-10");
    assert.equal(monthKey(null), null);
    assert.equal(monthKey("2026-13-40"), null);
  });

  test("itemsByMonth only plots exact dates", () => {
    const by = itemsByMonth(items);
    assert.deepEqual(by.get("2026-10").map((i) => i.id), ["a", "b"]);
    assert.deepEqual(by.get("2026-09").map((i) => i.id), ["c"]);
    assert.equal(by.has("2026-11"), false);
  });

  test("undatedItems lists window-only items", () => {
    assert.deepEqual(undatedItems(items).map((i) => i.id), ["d"]);
  });

  test("itemsOnDay matches exact ISO days", () => {
    assert.deepEqual(itemsOnDay(items, "2026-10-21").map((i) => i.id), ["b"]);
    assert.deepEqual(itemsOnDay(items, "2026-10-22"), []);
  });

  test("calendarMonths spans Oct 2026 to Sep 2027", () => {
    const months = calendarMonths("2026-10", 12);
    assert.equal(months.length, 12);
    assert.equal(months[0].key, "2026-10");
    assert.equal(months[0].label, "October 2026");
    assert.equal(months[11].key, "2027-09");
    assert.equal(months[11].label, "September 2027");
    assert.equal(calendarMonths("bogus", 12).length, 0);
  });

  test("monthMatrix: October 2026 starts on Thursday, 5 weeks", () => {
    const weeks = monthMatrix(2026, 10);
    assert.equal(weeks.length, 5);
    assert.equal(weeks[0][4], "2026-10-01", "Oct 1 2026 is a Thursday");
    assert.deepEqual(weeks[0].slice(0, 4), [null, null, null, null]);
    const flat = weeks.flat().filter(Boolean);
    assert.equal(flat.length, 31);
    assert.equal(flat[30], "2026-10-31");
  });

  test("monthMatrix: September 2027 ends on Thursday", () => {
    const weeks = monthMatrix(2027, 9);
    const flat = weeks.flat().filter(Boolean);
    assert.equal(flat.length, 30);
    assert.equal(flat[29], "2027-09-30");
  });

  test("inWindow bounds the 12-month window", () => {
    assert.equal(inWindow("2026-10-06", "2026-10", 12), true);
    assert.equal(inWindow("2027-09-30", "2026-10", 12), true);
    assert.equal(inWindow("2027-10-01", "2026-10", 12), false);
    assert.equal(inWindow("2026-09-29", "2026-10", 12), false);
    assert.equal(inWindow(null, "2026-10", 12), false);
  });
});

suite("preorders: states and retailers", () => {
  test("isValidState accepts only the three states", () => {
    assert(isValidState("watching"));
    assert(isValidState("ordered"));
    assert(isValidState("skipped"));
    assert(!isValidState("maybe"));
    assert(!isValidState(""));
  });

  test("retailerById resolves research-named retailers only", () => {
    assert.equal(retailerById("pulse").label, "Hasbro Pulse");
    assert.equal(retailerById("amazon").label, "Amazon");
    assert.equal(retailerById("target").label, "Target");
    assert.equal(retailerById("walmart").label, "Walmart");
    assert.equal(retailerById("nope"), null);
    assert(retailerById("pulse").url("x-men 97").includes("x-men%2097"), "search URL encodes the query");
  });
});

suite("preorders: gift-ready flags", () => {
  test("pre-orderable at standard MSRP flags as a gift pick", () => {
    assert(giftReady(item()), "preorder at $27.99 → gift-ready");
    assert(giftReady(item({ status: "available", price: 35 })), "available at $35 → gift-ready");
  });

  test("revealed-only, unpriced, or over-budget items never flag", () => {
    assert(!giftReady(item({ status: "revealed" })), "revealed is not buyable yet");
    assert(!giftReady(item({ price: null })), "no invented MSRP — unpriced never flags");
    assert(!giftReady(item({ price: 54.99 })), "over $35 is not a budget gift");
    assert(!giftReady(item({ price: "27.99" })), "string prices never flag");
    assert(!giftReady(null), "null-safe");
  });
});
