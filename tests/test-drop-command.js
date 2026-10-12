/* Wave 32 tests: Drop Week Command Center pure logic + real-data integrity.
   Pinned-fixture tests for countdown/status/plan math; real-data runs against
   data/drop-week.json and api/v1/drop-week.json (no invented figures, dates,
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
} from "../assets/js/drop-command.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(ROOT, "data/drop-week.json"), "utf8"));
const api = JSON.parse(readFileSync(join(ROOT, "api/v1/drop-week.json"), "utf8"));
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
    const allowed = new Set(["27.99", "74.99", "39.97", "55", "69.95", "46.99", "47.99", "64.99", "39.99"]);
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
    assert(api.observed === "2026-10-11", "observed date");
  });
  test("rumor watch is flagged uncertain, never presented as confirmed", () => {
    const rw = data.intel.rumorWatch;
    assert(rw.note.toLowerCase().includes("uncertain"), "uncertain flag in note");
    assert(rw.items.length >= 8, "rumor items present");
  });
});

suite("drop-command: page + storage", () => {
  test("page has breadcrumb, rail, sections, and plan controls", () => {
    for (const id of ["dw-section-drops", "dw-section-intel", "dw-section-plan",
                      "dw-section-rumors", "dw-section-method", "dw-drops",
                      "dw-plan-count", "dw-copy-plan", "dw-clear-plan",
                      "dw-copy-status", "dw-method-body", "drop-root"]) {
      assert(page.includes(`id="${id}"`), `page has #${id}`);
    }
    assert(page.includes('aria-label="Breadcrumb"'), "breadcrumb nav");
    assert(page.includes('aria-label="On this page"'), "wayfinding rail");
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
  });
});
