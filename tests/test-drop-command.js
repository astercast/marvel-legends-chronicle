/* Wave 32 tests: Drop Week Command Center pure logic + real-data integrity.
   Pinned-fixture tests for countdown/status/plan math; real-data runs against
   data/drop-week.json and data/v1/drop-week.json (no invented figures, dates,
   or prices — every dollar amount must be a researched, allowed value). */
"use strict";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import {
  DAY_MS, dropTimeMs, countdownParts, formatCountdown, timeToDrop,
  dropStatus, statusLabel, sortDrops, nextDrop, newPlan, planState,
  cyclePlanState, planCounts, planTotals, buildPlanShareText, PLAN_KEY,
  formatWindowLocal, toggleCheck, checklistProgress, CHECKLIST_KEY,
  makeSighting, addSighting, removeSighting, priceLanes, priceVerdict,
  fmtMoney, PRICES_KEY, SIGHTING_KINDS,
  CAPTURE_KEY, CAPTURE_RETAILERS, CAPTURE_KINDS, newCaptureLog,
  makeCaptureEntry, addCaptureEntry, removeCaptureEntry, firstListing,
  captureSpread, selloutTimeline, thirtyClaimVerdict, buildWindowReport,
} from "../assets/js/drop-command.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(ROOT, "data/drop-week.json"), "utf8"));
const api = JSON.parse(readFileSync(join(ROOT, "data/v1/drop-week.json"), "utf8"));
const page = readFileSync(join(ROOT, "drop-week.html"), "utf8");
const configJs = readFileSync(join(ROOT, "assets/js/config.js"), "utf8");

const drop = (over = {}) => ({
  id: "d1", title: "Test Drop", kind: "preorder", kindLabel: "Pre-order window",
  windowAt: "2026-10-14T13:00:00-04:00", windowDate: null,
  windowLabel: "1 PM ET", retailers: ["Hasbro Pulse"], figures: [{ name: "Fig A" }],
  price: { kind: "msrp", text: "$27.99 each" }, shipWindow: "Fall 2026",
  notes: [], sources: [],
  ...over,
});
const T0 = dropTimeMs(drop()); // Oct 14, 2026 13:00 ET

suite("drop-command: countdown math", () => {
  test("countdownParts splits ms into d/h/m", () => {
    const p = countdownParts(2 * DAY_MS + 3 * 3600000 + 15 * 60000 + 45000);
    assert(p.days === 2 && p.hours === 3 && p.mins === 15, `got ${JSON.stringify(p)}`);
  });
  test("formatCountdown short form", () => {
    assert(formatCountdown({ days: 3, hours: 4, mins: 12 }) === "3d 4h 12m", "with days");
    assert(formatCountdown({ days: 0, hours: 0, mins: 5 }) === "5m", "minutes only");
  });
  test("timeToDrop counts down to the window", () => {
    const now = T0 - (2 * DAY_MS + 3 * 3600000 + 15 * 60000);
    const t = timeToDrop(drop(), now);
    assert(!t.past && t.days === 2 && t.hours === 3 && t.mins === 15, JSON.stringify(t));
  });
  test("timeToDrop flags past windows", () => {
    const t = timeToDrop(drop(), T0 + 60000);
    assert(t.past === true, "past flag set");
  });
  test("timeToDrop falls back to windowDate for sale-day drops", () => {
    const d = drop({ windowAt: null, windowDate: "2026-11-01" });
    const t = timeToDrop(d, Date.parse("2026-10-11T12:00:00-07:00"));
    assert(!t.past && t.days >= 20 && t.days <= 22, `days=${t.days}`);
  });
});

suite("drop-command: status", () => {
  test("upcoming 48h out", () => {
    assert(dropStatus(drop(), T0 - 48 * 3600000) === "upcoming", "upcoming");
  });
  test("drop-day on the day (any TZ)", () => {
    assert(dropStatus(drop(), T0 + 2 * 3600000) === "drop-day", "drop-day");
  });
  test("past 26h later", () => {
    assert(dropStatus(drop(), T0 + 26 * 3600000) === "past", "past");
  });
  test("statusLabel wording", () => {
    assert(statusLabel("drop-day", "preorder") === "Drop day", "drop day");
    assert(statusLabel("drop-day", "deadline") === "Deadline day", "deadline day");
    assert(statusLabel("past", "deadline") === "Window closed", "closed");
    assert(statusLabel("upcoming", "preorder") === "Upcoming", "upcoming");
  });
  test("sortDrops chronological, nextDrop skips the past", () => {
    const a = drop({ id: "a", windowAt: "2026-10-21T13:00:00-04:00" });
    const b = drop({ id: "b", windowAt: "2026-10-14T13:00:00-04:00" });
    assert(sortDrops([a, b]).map((d) => d.id).join(",") === "b,a", "sorted");
    const nd = nextDrop([a, b], T0 - 3600000);
    assert(nd.id === "b", `next is b, got ${nd && nd.id}`);
    assert(nextDrop([a, b], T0 + 30 * DAY_MS) === null, "all past → null");
  });
});

suite("drop-command: battle plan", () => {
  test("cyclePlanState: want → ordered → cleared", () => {
    const p = newPlan();
    assert(cyclePlanState(p, "d1", "Fig A") === "want", "first → want");
    assert(planState(p, "d1", "Fig A") === "want", "state read");
    assert(cyclePlanState(p, "d1", "Fig A") === "ordered", "second → ordered");
    assert(cyclePlanState(p, "d1", "Fig A") === null, "third → cleared");
    assert(planState(p, "d1", "Fig A") === null, "cleared reads null");
  });
  test("planCounts / planTotals across drops", () => {
    const p = newPlan();
    cyclePlanState(p, "d1", "Fig A");
    cyclePlanState(p, "d1", "Fig B"); cyclePlanState(p, "d1", "Fig B");
    cyclePlanState(p, "d2", "Fig C");
    const ds = [drop({ id: "d1" }), drop({ id: "d2" })];
    const c = planCounts(p, ds);
    assert(c.d1.want === 1 && c.d1.ordered === 1, `d1 ${JSON.stringify(c.d1)}`);
    assert(c.d2.want === 1 && c.d2.ordered === 0, `d2 ${JSON.stringify(c.d2)}`);
    const t = planTotals(p, ds);
    assert(t.want === 2 && t.ordered === 1, `totals ${JSON.stringify(t)}`);
  });
  test("buildPlanShareText names real figures with [ ]/[x]", () => {
    const p = newPlan();
    cyclePlanState(p, "xmen97-wave", "Death Gambit");
    const drops = data.drops;
    const text = buildPlanShareText(p, drops, "Observed 2026-10-11");
    assert(text.includes("Death Gambit"), "figure named");
    assert(text.includes("[ ]"), "want marker");
    assert(text.includes("X-Men '97"), "drop title");
    assert(!text.includes("Fig A"), "no fixture leakage");
  });
  test("empty plan share text is honest", () => {
    const text = buildPlanShareText(newPlan(), data.drops);
    assert(text.includes("No battle plan set yet"), "honest empty state");
  });
});

suite("drop-command: real data integrity", () => {
  test("exactly 5 researched drops, unique ids, chronological", () => {
    assert(data.drops.length === 5, `5 drops, got ${data.drops.length}`);
    const ids = data.drops.map((d) => d.id);
    assert(new Set(ids).size === 5, "unique ids");
    const expect = ["doomsday-wave-2", "xmen97-wave", "astonishing-2pack", "yfns-rhino", "trask-bastion-mto"];
    assert(ids.join(",") === expect.join(","), `order ${ids.join(",")}`);
  });
  test("every drop has a parseable moment, kind, retailers, figures, sources", () => {
    for (const d of data.drops) {
      assert(dropTimeMs(d) != null, `${d.id}: parseable time`);
      assert(["preorder", "sale-day", "deadline"].includes(d.kind), `${d.id}: kind`);
      assert(d.retailers.length > 0, `${d.id}: retailers`);
      assert(d.figures.length > 0 && d.figures.every((f) => f.name), `${d.id}: figures`);
      assert(d.sources.length > 0, `${d.id}: sources`);
      for (const s of d.sources) {
        assert(/^https?:\/\/\S+$/.test(s.url), `${d.id}: bad url ${s.url}`);
        assert(s.label && s.label.length > 3, `${d.id}: source label`);
      }
      assert(["msrp", "unannounced"].includes(d.price.kind), `${d.id}: price kind`);
    }
  });
  test("no invented prices: every $N is a researched, allowed amount", () => {
    const allowed = new Set(["27.99", "74.99", "39.97", "55", "69.95", "46.99", "47.99", "64.99", "39.99",
                             "83.97", "79.99", "25.99", "40.99", "52.99", "30"]);
    const blob = JSON.stringify(data);
    for (const m of blob.matchAll(/\$(\d[\d,]*(?:\.\d{2})?)/g)) {
      assert(allowed.has(m[1].replace(/,/g, "")), `unlisted amount $${m[1]}`);
    }
  });
  test("pinned researched facts", () => {
    const byId = Object.fromEntries(data.drops.map((d) => [d.id, d]));
    assert(byId["doomsday-wave-2"].windowAt === "2026-10-14T13:00:00-04:00", "Oct 14 1PM ET");
    assert(byId["xmen97-wave"].figures.length === 6, "6 '97 figures");
    assert(byId["astonishing-2pack"].price.kind === "unannounced", "2-pack price unannounced");
    assert(byId["yfns-rhino"].kind === "sale-day", "Nov 1 is a sale day");
    assert(byId["trask-bastion-mto"].windowAt === "2026-11-20T23:59:00-05:00", "MTO deadline");
    assert(byId["trask-bastion-mto"].price.text.includes("$74.99"), "$74.99 MTO price");
  });
  test("api payload mirrors the data file", () => {
    assert(api.count === data.drops.length, "count matches");
    assert(JSON.stringify(api.drops) === JSON.stringify(data.drops), "drops deep-equal");
    assert(api.observed === "2026-10-12", "observed date (Oct 12 radar poll refresh)");
    assert(JSON.stringify(api.checklist) === JSON.stringify(data.checklist), "checklist deep-equal");
    assert(JSON.stringify(api.priceWatch) === JSON.stringify(data.priceWatch), "priceWatch deep-equal");
    assert(JSON.stringify(api.radarPoll) === JSON.stringify(data.radarPoll), "radarPoll deep-equal");
  });
  test("rumor watch is flagged uncertain, never presented as confirmed", () => {
    const rw = data.intel.rumorWatch;
    assert(rw.note.toLowerCase().includes("uncertain"), "uncertain flag in note");
    assert(rw.items.length >= 8, "rumor items present");
  });
});

suite("drop-command: flagship refresh — countdown precision", () => {
  test("the Oct 14 window is exactly 17:00 UTC (1 PM ET)", () => {
    const d2 = data.drops.find((d) => d.id === "doomsday-wave-2");
    assert(dropTimeMs(d2) === Date.UTC(2026, 9, 14, 17, 0, 0),
      `got ${new Date(dropTimeMs(d2)).toISOString()}`);
  });
  test("countdown carries seconds and formats them", () => {
    const p = countdownParts(3600000 + 14 * 60000 + 9000);
    assert(p.hours === 1 && p.mins === 14 && p.secs === 9, JSON.stringify(p));
    assert(formatCountdown(p) === "1h 14m 9s", formatCountdown(p));
    const t = timeToDrop(drop(), T0 - 90000);
    assert(!t.past && t.mins === 1 && t.secs === 30, JSON.stringify(t));
  });
  test("formatCountdown without a secs field stays the short form (back-compat)", () => {
    assert(formatCountdown({ days: 3, hours: 4, mins: 12 }) === "3d 4h 12m", "pinned form");
  });
  test("formatWindowLocal converts the window to the reader's clock", () => {
    const la = formatWindowLocal("2026-10-14T13:00:00-04:00", "en-US", "America/Los_Angeles");
    assert(la.includes("Oct 14") && la.includes("10:00 AM"), `LA: ${la}`);
    const lon = formatWindowLocal("2026-10-14T13:00:00-04:00", "en-GB", "Europe/London");
    assert(lon.includes("18:00") || lon.includes("6:00"), `London: ${lon}`);
    assert(formatWindowLocal("not-a-date") === "", "bad input → empty");
  });
});

suite("drop-command: buyer checklist", () => {
  test("toggleCheck flips and clears, progress counts", () => {
    let s = {};
    s = toggleCheck(s, "alarm");
    assert(s.alarm === true, "ticked");
    const items = [{ id: "alarm" }, { id: "tabs" }];
    assert(checklistProgress(s, items).done === 1, "1 of 2");
    s = toggleCheck(s, "alarm");
    assert(!("alarm" in s), "untick removes the key");
    assert(checklistProgress(s, items).done === 0, "0 of 2");
  });
  test("real checklist: 10 items, unique ids, phases cover the whole window arc", () => {
    const ck = data.checklist;
    assert(ck.length === 10, `10 items, got ${ck.length}`);
    assert(new Set(ck.map((i) => i.id)).size === 10, "unique ids");
    const phases = new Set(ck.map((i) => i.phase));
    for (const p of ["before", "morning", "at-open", "after"]) {
      assert(phases.has(p), `phase ${p} present`);
    }
    for (const i of ck) assert(i.label.length > 10 && i.detail.length > 20, `${i.id} has real copy`);
  });
  test("window copy names the date, never a relative day (Oct 14 is not 'tomorrow' on Oct 12)", () => {
    // Verified 2026-10-12: Oct 14, 2026 is a Wednesday, two days out — copy
    // written as "tomorrow" sent readers to Oct 13. Every reader-facing
    // string in the checklist, price tracker, and radar poll must carry the
    // explicit date instead.
    const blob = JSON.stringify([data.checklist, data.priceWatch, data.radarPoll]);
    assert(!/tomorrow/i.test(blob), "no 'tomorrow' in window-facing copy");
    const alarm = data.checklist.find((i) => i.id === "alarm");
    assert(alarm.label.includes("Oct 14"), "alarm names the date");
    const tabs = data.checklist.find((i) => i.id === "tabs");
    assert(tabs.label.includes("Oct 14"), "tabs label names the date");
  });
  test("checklist ceiling math is honest: 3 x $27.99 = $83.97", () => {
    const ceiling = data.checklist.find((i) => i.id === "ceiling");
    assert(ceiling.label.includes("$83.97"), "label carries the total");
    assert(Math.abs(3 * 27.99 - 83.97) < 0.001, "math checks");
  });
});

suite("drop-command: price tracker lanes never mix", () => {
  const sight = (over = {}) => makeSighting({
    id: "s1", figure: "Nightcrawler", kind: "asking", price: 45, where: "eBay", date: "2026-10-14", ...over,
  });
  test("makeSighting validates kind/price/figure", () => {
    assert(sight() !== null, "valid sighting passes");
    assert(makeSighting({ figure: "X", kind: "asking", price: 0 }) === null, "zero price rejected");
    assert(makeSighting({ figure: "X", kind: "mixed", price: 10 }) === null, "no third lane exists");
    assert(makeSighting({ figure: "", kind: "sold", price: 10 }) === null, "figure required");
    assert(SIGHTING_KINDS.join(",") === "asking,sold", "exactly two lanes");
  });
  test("priceLanes summarizes asking and sold strictly separately", () => {
    let list = [];
    list = addSighting(list, { id: "a", figure: "Nightcrawler", kind: "asking", price: 45, date: "2026-10-14" });
    list = addSighting(list, { id: "b", figure: "Nightcrawler", kind: "asking", price: 39.5, date: "2026-10-14" });
    list = addSighting(list, { id: "c", figure: "Nightcrawler", kind: "sold", price: 60, date: "2026-10-15" });
    list = addSighting(list, { id: "d", figure: "Marvel's Beast", kind: "sold", price: 20, date: "2026-10-15" });
    const lanes = priceLanes(list, "Nightcrawler");
    assert(lanes.asking.count === 2 && lanes.asking.low === 39.5 && lanes.asking.high === 45,
      `asking ${JSON.stringify(lanes.asking)}`);
    assert(lanes.sold.count === 1 && lanes.sold.low === 60 && lanes.sold.high === 60,
      `sold ${JSON.stringify(lanes.sold)} — the $60 sold must NOT leak into asking`);
    const empty = priceLanes(list, "Lord Doom (Concept Series)");
    assert(empty.asking.count === 0 && empty.sold.low === null, "empty lanes are null, not zero");
    list = removeSighting(list, "c");
    assert(priceLanes(list, "Nightcrawler").sold.count === 0, "removal works");
  });
  test("priceVerdict never calls an asking price a sale", () => {
    const markup = priceVerdict({ asking: { count: 1, low: 45, high: 45 }, sold: { count: 0, low: null, high: null } }, 27.99);
    assert(markup.includes("over MSRP") && markup.includes("not a sale"), markup);
    const soldLow = priceVerdict({ asking: { count: 0, low: null, high: null }, sold: { count: 1, low: 25, high: 25 } }, 27.99);
    assert(soldLow.includes("Reported solds"), soldLow);
    assert(fmtMoney(27.99) === "$27.99" && fmtMoney(null) === "—", "money formatting");
  });
  test("real priceWatch: figures match the drop, MSRPs pinned, context is Wave 1 solds", () => {
    const pw = data.priceWatch;
    const dropFigs = data.drops.find((d) => d.id === pw.dropId).figures.map((f) => f.name);
    assert(pw.figures.map((f) => f.name).join("|") === dropFigs.join("|"), "same figures, same order");
    assert(pw.figures.every((f) => f.msrp === 27.99), "all $27.99 announced");
    assert(pw.note.includes("never blended"), "lane rule stated in the data");
    assert(pw.context.length === 2 && pw.context.every((c) => c.text.includes("sold") || c.text.includes("presale")),
      "context cites reported solds/presales only");
  });
});

suite("drop-command: reveal radar poll (Oct 12)", () => {
  test("poll findings are flagged and sourced, newest first-class", () => {
    const poll = data.radarPoll;
    assert(poll.polledAt === "2026-10-12", "poll date");
    assert(poll.findings.length === 5, `5 findings, got ${poll.findings.length}`);
    for (const f of poll.findings) {
      assert(["confirmed", "reported", "single-source", "uncertain"].includes(f.flag), `flag ${f.flag}`);
      assert(f.sources.length > 0 && f.sources.every((s) => /^https?:\/\//.test(s.url)), `${f.headline}: sources`);
    }
  });
  test("the window reconfirmation leads, the Venom Spider-Man reveal is single-source", () => {
    const poll = data.radarPoll;
    assert(poll.findings[0].flag === "confirmed" && poll.findings[0].headline.includes("Oct 14"), "lead finding");
    const venom = poll.findings.find((f) => f.headline.includes("Venom Spider-Man"));
    assert(venom && venom.flag === "single-source", "Venom filed as candidate, not fact");
  });
  test("the $30 price-rise chatter is flagged uncertain, never adopted", () => {
    const f = data.radarPoll.findings.find((x) => x.flag === "uncertain");
    assert(f && f.detail.includes("$30") && f.detail.includes("$27.99"), "rumor vs announced price both named");
    const d2 = data.drops.find((d) => d.id === "doomsday-wave-2");
    assert(d2.price.text.includes("$27.99"), "the drop keeps the announced price");
  });
});

suite("drop-command: drop-day capture protocol + log", () => {
  const cap = (over = {}) => makeCaptureEntry({
    id: "c1", figure: "Nightcrawler", retailer: "Hasbro Pulse", kind: "listing",
    price: 27.99, observedAt: "2026-10-14T17:03:00Z", ...over,
  });
  test("protocol names the capture doors in worked order", () => {
    const proto = data.captureProtocol;
    assert(proto.dropId === "doomsday-wave-2", "protocol is for the Oct 14 drop");
    const names = proto.retailers.map((r) => r.name);
    for (const named of ["Hasbro Pulse", "BigBadToyStore", "Entertainment Earth"]) {
      assert(names.includes(named), `door ${named} present`);
    }
    assert(proto.retailers[0].name === "Hasbro Pulse", "Pulse is worked first");
    assert(proto.retailers.map((r) => r.order).join(",") === proto.retailers.map((_, i) => i + 1).join(","), "orders run 1..n");
    assert(JSON.stringify(CAPTURE_RETAILERS) === JSON.stringify(names), "JS door list mirrors the protocol data");
  });
  test("protocol steps cover the whole capture arc, rules keep the lanes apart", () => {
    const phases = new Set(data.captureProtocol.steps.map((s) => s.phase));
    for (const p of ["before", "at-open", "first-hour", "close"]) assert(phases.has(p), `phase ${p}`);
    const rules = data.captureProtocol.rules.join(" ").toLowerCase();
    assert(rules.includes("asking") && rules.includes("sold lane"), "lane discipline stated in the rules");
    assert(data.captureProtocol.steps.some((s) => s.id === "sellouts-are-events"), "sellout-event step present");
  });
  test("published capture log is empty before the window — the honest state", () => {
    assert(data.captureLog.status === "awaiting-window", "awaiting the window");
    assert(Array.isArray(data.captureLog.listings) && data.captureLog.listings.length === 0, "no listings invented");
    assert(Array.isArray(data.captureLog.sellouts) && data.captureLog.sellouts.length === 0, "no sellouts invented");
  });
  test("makeCaptureEntry validates door, kind, price, and a real timestamp", () => {
    assert(cap() !== null, "valid listing passes");
    assert(makeCaptureEntry({ figure: "Nightcrawler", retailer: "A Stall", kind: "listing", price: 27.99, observedAt: "2026-10-14T17:03:00Z" }) === null, "non-capture door rejected");
    assert(makeCaptureEntry({ figure: "Nightcrawler", retailer: "Hasbro Pulse", kind: "listing", price: 27.99, observedAt: "tomorrow-ish" }) === null, "fake timestamp rejected");
    assert(makeCaptureEntry({ figure: "Nightcrawler", retailer: "Hasbro Pulse", kind: "listing", observedAt: "2026-10-14T17:03:00Z" }) === null, "listing without a price rejected");
    assert(makeCaptureEntry({ figure: "Nightcrawler", retailer: "Hasbro Pulse", kind: "sold", price: 27.99, observedAt: "2026-10-14T17:03:00Z" }) === null, "no sold lane exists in the capture log");
    assert(CAPTURE_KINDS.join(",") === "listing,sellout", "exactly two capture entry kinds");
  });
  test("a sellout entry can never carry a price", () => {
    const s = makeCaptureEntry({ id: "c9", figure: "Lord Doom (Concept Series)", retailer: "Amazon", kind: "sellout", price: 99, observedAt: "2026-10-14T17:41:00Z" });
    assert(s !== null && s.price === null, "price forced to null — a sellout is an event");
    let log = newCaptureLog();
    log = addCaptureEntry(log, { id: "c9", figure: "Lord Doom (Concept Series)", retailer: "Amazon", kind: "sellout", price: 99, observedAt: "2026-10-14T17:41:00Z" });
    assert(log.sellouts.length === 1 && log.listings.length === 0, "sellout lands in its own lane only");
    log = removeCaptureEntry(log, "c9");
    assert(log.sellouts.length === 0, "removal works");
  });
  test("captureSpread reads the listing lane only, ends named by door", () => {
    let log = newCaptureLog();
    log = addCaptureEntry(log, { id: "a", figure: "Nightcrawler", retailer: "Hasbro Pulse", kind: "listing", price: 27.99, observedAt: "2026-10-14T17:01:00Z" });
    log = addCaptureEntry(log, { id: "b", figure: "Nightcrawler", retailer: "BigBadToyStore", kind: "listing", price: 29.99, observedAt: "2026-10-14T17:09:00Z" });
    log = addCaptureEntry(log, { id: "c", figure: "Nightcrawler", retailer: "Hasbro Pulse", kind: "sellout", observedAt: "2026-10-14T18:02:00Z" });
    const s = captureSpread(log, "Nightcrawler", 27.99);
    assert(s.count === 2 && s.low === 27.99 && s.high === 29.99, `spread ${JSON.stringify(s)}`);
    assert(s.lowDoor === "Hasbro Pulse" && s.highDoor === "BigBadToyStore", "doors at each end");
    assert(s.lowDelta === 0 && Math.abs(s.highDelta - 2) < 0.001, "deltas against MSRP");
    const empty = captureSpread(log, "Marvel's Beast", 27.99);
    assert(empty.count === 0 && empty.low === null && empty.highDoor === null, "empty lane is nulls, not zeroes");
  });
  test("firstListing is earliest by timestamp, not by entry order", () => {
    let log = newCaptureLog();
    log = addCaptureEntry(log, { id: "late", figure: "Marvel's Beast", retailer: "Amazon", kind: "listing", price: 27.99, observedAt: "2026-10-14T17:12:00Z" });
    log = addCaptureEntry(log, { id: "early", figure: "Marvel's Beast", retailer: "Hasbro Pulse", kind: "listing", price: 27.99, observedAt: "2026-10-14T17:02:00Z" });
    assert(firstListing(log, "Marvel's Beast").id === "early", "the 17:02 listing is first");
    assert(firstListing(log, "Nightcrawler") === null, "no listing → null");
  });
  test("selloutTimeline orders events as they happened", () => {
    let log = newCaptureLog();
    log = addCaptureEntry(log, { id: "s2", figure: "Nightcrawler", retailer: "Amazon", kind: "sellout", observedAt: "2026-10-14T18:20:00Z" });
    log = addCaptureEntry(log, { id: "s1", figure: "Lord Doom (Concept Series)", retailer: "Hasbro Pulse", kind: "sellout", observedAt: "2026-10-14T17:41:00Z" });
    assert(selloutTimeline(log).map((e) => e.id).join(",") === "s1,s2", "chronological");
  });
});

suite("drop-command: post-window report scaffold", () => {
  test("scaffold sections name their lanes and the MSRP matches the tracker", () => {
    const rep = data.windowReport;
    assert(rep.status === "awaiting-window", "scaffold awaits the window");
    assert(rep.announcedMsrp === 27.99, "announced MSRP pinned");
    const ids = rep.sections.map((s) => s.id);
    for (const id of ["sellouts", "first-spread", "thirty-claim", "sold-lane"]) {
      assert(ids.includes(id), `section ${id} present`);
    }
    const fills = Object.fromEntries(rep.sections.map((s) => [s.id, s.fillsFrom]));
    assert(fills["sellouts"] === "captureLog.sellouts", "sellouts fill from sellout events");
    assert(fills["first-spread"] === "captureLog.listings", "spread fills from the listing lane");
    assert(fills["thirty-claim"] === "captureLog.listings", "the claim settles from listings");
    assert(rep.verdicts.thirtyClaim === "pending", "no verdict before listings exist");
  });
  test("thirtyClaimVerdict: pending, settled at MSRP, standing, and mixed", () => {
    assert(thirtyClaimVerdict(newCaptureLog()).status === "pending", "empty log → pending");
    let atMsrp = newCaptureLog();
    atMsrp = addCaptureEntry(atMsrp, { id: "a", figure: "Nightcrawler", retailer: "Hasbro Pulse", kind: "listing", price: 27.99, observedAt: "2026-10-14T17:01:00Z" });
    atMsrp = addCaptureEntry(atMsrp, { id: "b", figure: "Nightcrawler", retailer: "Amazon", kind: "listing", price: 34.99, observedAt: "2026-10-14T17:05:00Z", note: "third-party marketplace seller" });
    const v = thirtyClaimVerdict(atMsrp);
    assert(v.status === "at-msrp" && v.text.includes("$27.99"), `Pulse decides: ${v.text}`);
    let above = newCaptureLog();
    above = addCaptureEntry(above, { id: "a", figure: "Nightcrawler", retailer: "Hasbro Pulse", kind: "listing", price: 31.5, observedAt: "2026-10-14T17:01:00Z" });
    assert(thirtyClaimVerdict(above).status === "above-msrp", "Pulse above $30 → the claim stands");
    let mixed = newCaptureLog();
    mixed = addCaptureEntry(mixed, { id: "a", figure: "Nightcrawler", retailer: "Hasbro Pulse", kind: "listing", price: 28.99, observedAt: "2026-10-14T17:01:00Z" });
    assert(thirtyClaimVerdict(mixed).status === "mixed", "above MSRP but under $30 → mixed");
  });
  test("buildWindowReport fills from the log alone and stays honest when empty", () => {
    const figs = data.priceWatch.figures;
    const empty = buildWindowReport(newCaptureLog(), figs, 27.99);
    assert(empty.listingCount === 0 && empty.firstSellout === null, "empty report is empty");
    assert(empty.thirtyClaim.status === "pending", "empty report has no verdict");
    let log = newCaptureLog();
    log = addCaptureEntry(log, { id: "a", figure: "Lord Doom (Concept Series)", retailer: "Hasbro Pulse", kind: "listing", price: 27.99, observedAt: "2026-10-14T17:00:00Z" });
    log = addCaptureEntry(log, { id: "s", figure: "Lord Doom (Concept Series)", retailer: "Hasbro Pulse", kind: "sellout", observedAt: "2026-10-14T17:41:00Z" });
    const built = buildWindowReport(log, figs, 27.99);
    assert(built.firstSellout.retailer === "Hasbro Pulse", "first sellout surfaced");
    assert(built.spreads["Lord Doom (Concept Series)"].low === 27.99, "spread filled for Doom");
    assert(built.spreads["Nightcrawler"].count === 0, "other figures stay empty");
  });
  test("api payload mirrors the capture payloads", () => {
    assert(JSON.stringify(api.captureProtocol) === JSON.stringify(data.captureProtocol), "captureProtocol deep-equal");
    assert(JSON.stringify(api.captureLog) === JSON.stringify(data.captureLog), "captureLog deep-equal");
    assert(JSON.stringify(api.windowReport) === JSON.stringify(data.windowReport), "windowReport deep-equal");
  });
});

suite("drop-command: page + storage", () => {
  test("page has breadcrumb, rail, sections, and plan controls", () => {
    for (const id of ["dw-section-drops", "dw-section-intel", "dw-section-plan",
                      "dw-section-rumors", "dw-section-method", "dw-drops",
                      "dw-plan-count", "dw-copy-plan", "dw-clear-plan",
                      "dw-copy-status", "dw-method-body", "drop-root",
                      "dw-section-checklist", "dw-checklist", "dw-check-progress", "dw-check-reset",
                      "dw-section-prices", "dw-price-rows", "dw-price-note", "dw-price-msrp-note",
                      "dw-price-context", "dw-price-fig", "dw-price-kind", "dw-price-amount",
                      "dw-price-where", "dw-price-date", "dw-price-add", "dw-price-status",
                      "dw-price-list", "dw-section-radar", "dw-radar-poll",
                      "dw-section-capture", "dw-capture-doors", "dw-capture-steps",
                      "dw-capture-rules", "dw-capture-published", "dw-cap-fig",
                      "dw-cap-retailer", "dw-cap-kind", "dw-cap-amount", "dw-cap-when",
                      "dw-cap-note", "dw-cap-add", "dw-cap-status", "dw-cap-list",
                      "dw-section-report", "dw-report-sections", "dw-report-summary"]) {
      assert(page.includes(`id="${id}"`), `page has #${id}`);
    }
    assert(page.includes('aria-label="Breadcrumb"'), "breadcrumb nav");
    assert(page.includes('aria-label="On this page"'), "wayfinding rail");
    assert(page.includes("17:00 UTC"), "hero states the window in UTC");
  });
  test("rail links all resolve to real section anchors", () => {
    const rail = page.split('aria-label="On this page"')[1].split("</nav>")[0];
    const hrefs = [...rail.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    assert(hrefs.length >= 5, `${hrefs.length} rail links`);
    for (const h of hrefs) assert(page.includes(`id="${h}"`), `rail #${h} resolves`);
  });
  test("noscript fallback lists all five drops", () => {
    const ns = page.split("DROPS:NOSCRIPT-BEGIN")[1].split("DROPS:NOSCRIPT-END")[0];
    assert((ns.match(/<li>/g) || []).length === 5, "5 noscript items");
    for (const d of data.drops) assert(ns.includes(d.title), `noscript: ${d.title}`);
  });
  test("cross-links point at real pages", () => {
    for (const p of ["preorders.html", "calendar.html", "market-briefing.html",
                     "watchlist.html", "quest.html", "radar.html", "holiday.html",
                     "auth-wizard.html"]) {
      assert(page.includes(`href="${p}"`), `links ${p}`);
    }
  });
  test("storage key registered in config.js", () => {
    assert(PLAN_KEY === "mlc_dropweek_v1", `PLAN_KEY is ${PLAN_KEY}`);
    assert(configJs.includes('"mlc_dropweek_v1"'), "registered in config.js");
    assert(CHECKLIST_KEY === "mlc_dropweek_checklist_v1", `CHECKLIST_KEY is ${CHECKLIST_KEY}`);
    assert(PRICES_KEY === "mlc_dropweek_prices_v1", `PRICES_KEY is ${PRICES_KEY}`);
    assert(configJs.includes('"mlc_dropweek_checklist_v1"'), "checklist key registered");
    assert(configJs.includes('"mlc_dropweek_prices_v1"'), "prices key registered");
    assert(CAPTURE_KEY === "mlc_dropweek_capture_v1", `CAPTURE_KEY is ${CAPTURE_KEY}`);
    assert(configJs.includes('"mlc_dropweek_capture_v1"'), "capture key registered");
  });
});
