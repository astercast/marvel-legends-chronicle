/* Wave 16 tests: holiday guide pure logic (price bands, status lines, pick
   rendering). All from researched data shapes — nothing invented. */
import { suite, test, assert } from "./assert.js";
import {
  priceBandText, formatPickDate, statusLine, renderPick, byId, PICKS,
  FINDER_LINKS, giftFinderUrl, renderFinderLinks,
} from "../assets/js/holiday.js";

const item = (over = {}) => ({
  id: "mini-comics-wave-3", name: "Mini Comics Wave 3", status: "preorder",
  preorderDate: "2026-10-06", releaseWindow: "Fall 2026", price: 27.99,
  query: "Marvel Legends Mini Comics Wave 3", retailers: ["amazon", "bbts"],
  details: null, venue: null, sources: [],
  ...over,
});

suite("holiday: price bands", () => {
  test("announced MSRP labeled honestly, never as market price", () => {
    const t = priceBandText(item());
    assert(t.includes("$27.99"), "shows the number");
    assert(/msrp/i.test(t), "says MSRP");
    assert(/announced/i.test(t) || /reveal/i.test(t), "ties it to the reveal");
  });

  test("unannounced price never invented", () => {
    assert(/not announced/i.test(priceBandText(item({ price: null }))));
    assert(/not announced/i.test(priceBandText(item({ price: undefined }))));
    assert(/ebay solds/i.test(priceBandText(item({ price: null }))));
  });
});

suite("holiday: status lines", () => {
  test("pre-order with researched date shows it", () => {
    const t = statusLine(item());
    assert(t.includes("Oct 6, 2026"), `date shown: ${t}`);
    assert(/pre-order/i.test(t));
  });

  test("pre-order without a date stays honest", () => {
    const t = statusLine(item({ preorderDate: null }));
    assert(/pre-order/i.test(t));
    assert(!/[A-Z][a-z]{2} \d{1,2}, \d{4}/.test(t), "no invented date");
  });

  test("available / revealed statuses read correctly", () => {
    assert(/available now/i.test(statusLine(item({ status: "available", preorderDate: null }))));
    assert(/revealed/i.test(statusLine(item({ status: "revealed", preorderDate: null }))));
    assert(/fall 2026/i.test(statusLine(item({ status: "revealed", preorderDate: null }))));
  });
});

suite("holiday: formatPickDate", () => {
  test("strict ISO only, no guessing", () => {
    assert.equal(formatPickDate("2026-10-06"), "Oct 6, 2026");
    assert.equal(formatPickDate("2026-09-29"), "Sep 29, 2026");
    assert.equal(formatPickDate(null), null);
    assert.equal(formatPickDate("soon"), null);
    assert.equal(formatPickDate("2026-02-30"), null);
  });
});

suite("holiday: renderPick", () => {
  const html = renderPick(item(), { why: "Test why line", avoid: "Test avoid note" });

  test("card carries name, why, avoid, solds link", () => {
    assert(html.includes("Mini Comics Wave 3"), "name");
    assert(html.includes("Test why line"), "why");
    assert(html.includes("Test avoid note"), "avoid");
    assert(html.includes("LH_Sold=1"), "eBay solds link");
    assert(html.includes("Pre-order"), "status badge");
  });

  test("retailer search links only for researched retailers", () => {
    assert(/amazon/i.test(html) && /bigbadtoystore/i.test(html), "amazon + bbts");
    assert(!/target\.com/.test(html), "no unresearched target");
  });

  test("no avoid note means no avoid block", () => {
    assert(!/pick-avoid/.test(renderPick(item(), { why: "x" })));
  });

  test("escapes hostile input", () => {
    const h = renderPick(item({ name: "<b>Bad</b>" }), { why: "<script>x</script>" });
    assert(!/<b>Bad<\/b>/.test(h) && !/<script>/.test(h), "escaped");
  });
});

suite("holiday: PICKS config", () => {
  test("four recipient profiles present", () => {
    for (const k of ["new", "kid", "completionist", "bargain"]) {
      assert(Array.isArray(PICKS[k]) && PICKS[k].length > 0, k);
    }
  });

  test("new-collector profile is five entry points", () => {
    assert.equal(PICKS.new.length, 5);
  });

  test("every pick has an itemId and a why line", () => {
    for (const [k, picks] of Object.entries(PICKS)) {
      for (const p of picks) {
        assert(p.itemId, `${k}: itemId`);
        assert(p.why && p.why.length > 20, `${k}/${p.itemId}: grounded why`);
      }
    }
  });

  test("byId lookup works", () => {
    const map = byId([item(), item({ id: "other" })]);
    assert.equal(map.get("mini-comics-wave-3").name, "Mini Comics Wave 3");
    assert.equal(map.get("missing"), undefined);
  });
});

suite("holiday: gift-finder deep links", () => {
  test("one prefilled link per recipient profile", () => {
    assert.equal(FINDER_LINKS.length, 4, "new, kid, completionist, bargain");
    const profiles = FINDER_LINKS.map((l) => l.profile).sort();
    assert.deepEqual(profiles, ["bargain", "completionist", "kid", "new"]);
  });

  test("links prefill the gift finder's real URL params", () => {
    assert.equal(giftFinderUrl("kid"), "gift.html?budget=under25&for=kid&character=Spider-Man");
    assert.equal(giftFinderUrl("completionist"), "gift.html?budget=splurge&for=collector&character=X-Men");
    assert.equal(giftFinderUrl("new"), "gift.html?budget=under25&for=casual");
    assert.equal(giftFinderUrl("bargain"), "gift.html?budget=under50&for=casual");
    assert.equal(giftFinderUrl("nobody"), "gift.html", "unknown profile → plain finder");
  });

  test("renderFinderLinks renders one link per profile", () => {
    const html = renderFinderLinks();
    for (const l of FINDER_LINKS) {
      /* hrefs are HTML-escaped in the markup (& → &amp;) */
      const escaped = l.href.replace(/&/g, "&amp;");
      assert(html.includes(escaped), `link for ${l.profile} present`);
      assert(html.includes(l.label), `label for ${l.profile} present`);
    }
  });
});
