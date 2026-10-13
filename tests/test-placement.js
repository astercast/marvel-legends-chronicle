/* The Placement Pass (rotation 13) — tripwire.
   Guards the head block placed this rotation, on EVERY page:
   - the typographic OG card, referenced by absolute URL (og:image,
     twitter:image), with the packet's 1200x630 dimensions declared
   - og:title mirrors the page's own <title>; og:description mirrors
     its meta description (no invented copy)
   - theme-color is the site's own --bg token value (#0d0c10)
   - the favicon set is linked, and the files exist (the OG card's
     PNG header really is 1200x630)
   - rel="canonical" is absolute, self-referential, cleanUrls form —
     on every page except 404.html, which has no canonical URL
   - JSON-LD parses and stays honest: ItemList / CollectionPage /
     WebSite only, no ratings, no offers, no prices, no review counts
   If a future page ships without the block, this suite goes red.
*/
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const SITE = "https://marvel-legends-chronicle-live.vercel.app";
const OG = `${SITE}/assets/og-card.png`;

function allPages() {
  const out = [];
  for (const f of readdirSync(root).filter((f) => f.endsWith(".html"))) out.push(f);
  for (const d of ["waves", "characters"])
    for (const f of readdirSync(join(root, d)).filter((f) => f.endsWith(".html"))) out.push(`${d}/${f}`);
  return out.sort();
}

function expectedCanonical(rel) {
  let p = rel.replace(/\.html$/, "");
  if (p === "index") return `${SITE}/`;
  if (p.endsWith("/index")) p = p.slice(0, -"index".length);
  return `${SITE}/${p}`;
}

const pages = allPages();

suite("placement — the head block on every page", () => {
  test("page census", () => {
    assert.equal(pages.length, 289, `pages: ${pages.length}`);
  });

  test("og card, theme-color and favicon links on all 289 pages", () => {
    for (const rel of pages) {
      const html = read(rel);
      assert.equal((html.match(/property="og:image" content="([^"]+)"/g) || []).length, 1, `${rel}: one og:image`);
      assert(html.includes(`property="og:image" content="${OG}"`), `${rel}: absolute og:image`);
      assert(html.includes(`name="twitter:image" content="${OG}"`), `${rel}: absolute twitter:image`);
      assert(html.includes('property="og:image:width" content="1200"'), `${rel}: og width`);
      assert(html.includes('property="og:image:height" content="630"'), `${rel}: og height`);
      assert(html.includes('<meta name="theme-color" content="#0d0c10">'), `${rel}: theme-color is the --bg token`);
      assert(html.includes('<link rel="icon" href="/favicon.ico" sizes="48x48">'), `${rel}: favicon.ico`);
      assert(html.includes('<link rel="icon" href="/favicon.svg" type="image/svg+xml">'), `${rel}: favicon.svg`);
      assert(html.includes('<link rel="apple-touch-icon" href="/apple-touch-icon.png">'), `${rel}: apple-touch-icon`);
    }
  });

  test("og:title mirrors <title>, og:description mirrors the meta description", () => {
    for (const rel of pages) {
      const html = read(rel);
      const title = html.match(/<title>([^<]*)<\/title>/)[1];
      const desc = html.match(/<meta name="description" content="([^"]*)">/)[1];
      assert(html.includes(`property="og:title" content="${title}"`), `${rel}: og:title mirrors title`);
      assert(html.includes(`name="twitter:title" content="${title}"`), `${rel}: twitter:title mirrors title`);
      assert(html.includes(`property="og:description" content="${desc}"`), `${rel}: og:description mirrors description`);
    }
  });

  test("canonical is absolute and self-referential (404 excepted)", () => {
    for (const rel of pages) {
      const html = read(rel);
      const found = html.match(/<link rel="canonical" href="([^"]+)">/g) || [];
      if (rel === "404.html") {
        assert.equal(found.length, 0, "404.html carries no canonical");
        continue;
      }
      assert.equal(found.length, 1, `${rel}: one canonical`);
      assert(found[0].includes(`href="${expectedCanonical(rel)}"`), `${rel}: canonical is its own clean URL`);
    }
  });

  test("JSON-LD parses and stays honest (404 excepted)", () => {
    for (const rel of pages) {
      const html = read(rel);
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
      if (rel === "404.html") {
        assert.equal(blocks.length, 0, "404.html carries no JSON-LD");
        continue;
      }
      assert(blocks.length >= 1, `${rel}: at least one JSON-LD block`);
      for (const b of blocks) {
        const ld = JSON.parse(b);
        assert(["ItemList", "CollectionPage", "WebSite"].includes(ld["@type"]), `${rel}: honest type ${ld["@type"]}`);
        assert(!/aggregateRating|offers|reviewCount|"price"/.test(b), `${rel}: no invented ratings, offers or prices`);
        if (ld["@type"] === "ItemList")
          assert.equal(ld.numberOfItems, ld.itemListElement.length, `${rel}: ItemList count matches its items`);
      }
    }
  });

  test("the placed files exist and the OG card really is 1200x630", () => {
    for (const f of ["assets/og-card.png", "favicon.ico", "favicon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "robots.txt"])
      assert(existsSync(join(root, f)), `${f} exists`);
    const png = readFileSync(join(root, "assets/og-card.png"));
    assert.equal(png.readUInt32BE(16), 1200, "OG card width from its PNG header");
    assert.equal(png.readUInt32BE(20), 630, "OG card height from its PNG header");
    assert(read("robots.txt").includes("Allow: /"), "robots.txt allows all");
    assert(!read("robots.txt").includes("Sitemap:"), "no Sitemap pointer — this repo publishes no sitemap");
  });
});
