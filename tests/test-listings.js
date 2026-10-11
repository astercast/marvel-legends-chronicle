import { suite, test, assert } from "./assert.js";
import {
  marketplaceQuery, marketplaceLinks, soldSearchUrl,
} from "../assets/js/listings.js";

suite("listings", () => {
  test("marketplaceQuery builds a search string", () => {
    assert.equal(
      marketplaceQuery({ name: "Spider-Man", variant: "Black suit" }),
      "Marvel Legends Spider-Man Black suit"
    );
    assert.equal(marketplaceQuery({ name: "Hulk" }), "Marvel Legends Hulk");
  });

  test("marketplaceLinks returns one link per marketplace", () => {
    const links = marketplaceLinks({ name: "Hulk" });
    assert.equal(links.length, 4);
    for (const l of links) {
      assert(typeof l.href === "string" && l.href.startsWith("https://"), `bad href for ${l.id}`);
      assert(l.href.includes(encodeURIComponent("Marvel Legends Hulk")), "query not encoded in href");
    }
  });

  test("soldSearchUrl targets completed sold listings", () => {
    const url = soldSearchUrl("Marvel Legends Hulk");
    assert(url.includes("LH_Sold=1"), "missing LH_Sold");
    assert(url.includes("LH_Complete=1"), "missing LH_Complete");
    assert(url.includes(encodeURIComponent("Marvel Legends Hulk")));
  });
});
