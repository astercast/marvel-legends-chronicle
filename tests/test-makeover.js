/* EXTREME MAKEOVER (2026-10-12) — the atrium edition.
   Guards the first-impression redesign:
   - front-desk nav: six doors + the Index of Halls button on every page
   - the directory template carries all 46 pages, grouped in 6 halls
   - footer registry keeps aria-current on the current page
   - homepage: hero CTA, drop-week teaser mount, halls, era tabs, registrar note
   - vault room hero: no duplicated counts, find-a-drawer CTA wired
   - 404 page exists with the vault wiring
*/
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const FRONT_DESK = [
  "index.html",
  "vault-room.html",
  "drop-week.html",
  "preorders.html",
  "encyclopedia.html",
  "quest.html",
];

function rootPages() {
  return readdirSync(root)
    .filter((f) => f.endsWith(".html"))
    .map((f) => join(root, f));
}

suite("makeover — front-desk nav", () => {
  test("primary nav is six doors + the directory button", () => {
    const page = read("index.html");
    const nav = page.match(/<nav class="site-nav" aria-label="Primary">([\s\S]*?)<\/nav>/)[1];
    const links = [...nav.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(links, FRONT_DESK, `primary nav links: ${links.join(", ")}`);
    assert(nav.includes('id="directory-button"'), "directory button present");
    assert(nav.includes('aria-haspopup="dialog"'), "button declares dialog");
  });

  test("every root page carries the front-desk nav + directory button", () => {
    const bad = [];
    for (const f of rootPages()) {
      const t = readFileSync(f, "utf8");
      const m = t.match(/<nav class="site-nav" aria-label="Primary">([\s\S]*?)<\/nav>/);
      if (!m) { bad.push(f + ": no primary nav"); continue; }
      const links = [...m[1].matchAll(/<a href="([^"]+)"/g)].map((x) => x[1]);
      if (JSON.stringify(links) !== JSON.stringify(FRONT_DESK)) bad.push(f + ": nav mismatch");
      if (!m[1].includes('id="directory-button"')) bad.push(f + ": no directory button");
    }
    assert.equal(bad.length, 0, bad.slice(0, 5).join("\n"));
  });

  test("footer registry marks the current page", () => {
    for (const [file, href] of [["timeline.html", "timeline.html"], ["2026-review.html", "2026-review.html"], ["quest.html", "quest.html"]]) {
      const page = read(file);
      const footer = page.match(/<nav aria-label="Footer">([\s\S]*?)<\/nav>/)[1];
      assert(footer.includes(`href="${href}" aria-current="page"`), `${file}: footer marks current`);
    }
  });

  test("wave + character pages mark their section in the footer", () => {
    assert(read("waves/hasbro-2007-blob.html").includes('href="../waves/index.html" aria-current="page"'),
      "wave page marks Waves");
    assert(read("characters/spider-man.html").includes('href="../characters/index.html" aria-current="page"'),
      "character page marks Characters");
  });
});

suite("makeover — index of halls", () => {
  test("directory template holds all 46 pages in 6 halls", () => {
    const page = read("index.html");
    const tpl = page.match(/<template id="directory-panel">([\s\S]*?)<\/template>/);
    assert(tpl, "directory template present");
    const body = tpl[1];
    const halls = [...body.matchAll(/class="dir-hall-title">([^<]+)</g)].map((m) => m[1]);
    assert.equal(halls.length, 6, `halls: ${halls.join(", ")}`);
    const links = [...body.matchAll(/<li><a href="([^"]+)">/g)].map((m) => m[1]);
    assert.equal(links.length, 46, `directory links: ${links.length}`);
    assert.equal(new Set(links).size, 46, "no duplicate directory links");
  });

  test("vault.js wires the directory button to the shared modal", () => {
    const js = read("assets/js/vault.js");
    assert(js.includes('getElementById("directory-button")'), "button wired");
    assert(js.includes('getElementById("directory-panel")'), "template read");
    assert(js.includes('import(base + "modal.js")'), "shared modal reused");
  });

  test("directory CSS exists", () => {
    const css = read("assets/css/vault.css");
    for (const sel of [".directory-button", ".dir-halls", ".dir-pages", ".dir-blurb"]) {
      assert(css.includes(sel), `missing ${sel}`);
    }
  });
});

suite("makeover — homepage atrium", () => {
  const page = () => read("index.html");

  test("hero: one primary action + engraved stats + live counts in copy", () => {
    const p = page();
    assert(p.includes('class="btn btn-seal" href="vault-room.html">Enter the Vault Room'),
      "single primary CTA to the Vault Room");
    assert(p.includes('id="stat-strip"'), "stat mount present");
    assert(p.includes("1,939 figures across 167 waves"), "live archive totals in the lede");
    assert(p.includes('class="cabinet-note"'), "cabinet note mount present");
    assert(!p.includes("You own</div>"), "no dead owned/wanted tiles");
  });

  test("drop-week teaser: static fallback + JS mount", () => {
    const p = page();
    assert(p.includes('id="desk-drop"'), "teaser mount present");
    assert(p.includes('href="drop-week.html">Open the Drop Week Command Center'),
      "static fallback CTA present");
    assert(p.includes('src="assets/js/atrium.js"'), "atrium.js loaded");
    const js = read("assets/js/atrium.js");
    assert(js.includes("data/v1/drop-week.json"), "teaser reads the drop-week endpoint");
    assert(js.includes("setInterval"), "countdown ticks");
  });

  test("halls: six specimen drawers generated from the canonical data", () => {
    const p = page();
    const halls = [...p.matchAll(/<details class="hall" name="halls">/g)];
    assert.equal(halls.length, 6, `hall drawers: ${halls.length}`);
    for (const title of ["The Archive", "The Hunt", "Your Shelf", "The Market", "The Game", "The Desk"]) {
      assert(p.includes(`<span class="hall-title">${title}</span>`), `hall: ${title}`);
    }
    assert(p.includes("HALLS:BEGIN") && p.includes("HALLS:END"), "generator markers present");
  });

  test("register: era tabs mount + placard + noscript fallback", () => {
    const p = page();
    assert(p.includes('id="era-tabs"'), "era tablist mount");
    assert(p.includes('role="tablist"'), "tablist role");
    assert(p.includes('id="era-placard"'), "era placard mount");
    assert(p.includes("waves/index.html"), "noscript wave index link");
    const js = read("assets/js/timeline.js");
    assert(js.includes('role="tab"'), "tabs rendered with tab role");
    assert(js.includes("#era="), "era deep-linking");
    assert(js.includes("aria-selected"), "tab selection state");
  });

  test("registrar's note: human voice, wax seal, no AI filler", () => {
    const p = page();
    assert(p.includes("From the registrar's desk"), "registrar kicker");
    assert(p.includes("The Registrar"), "signed");
    assert(p.includes('class="wax-seal"'), "wax seal");
    for (const ism of ["delve", "game-changer", "unlock the power", "ever-evolving"]) {
      assert(!p.toLowerCase().includes(ism), `AI-ism leaked: ${ism}`);
    }
  });

  test("identity markers survive the redesign", () => {
    const p = page();
    assert(p.includes("rope-rule"), "rope-rule marker");
    assert(p.includes('<p class="accession"'), "accession marker");
    assert(p.includes('id="history-strip"'), "history strip kept");
  });
});

suite("makeover — vault room hero", () => {
  test("no duplicated drawer counts; find-a-drawer CTA wired", () => {
    const p = read("vault-room.html");
    assert(p.includes('id="find-drawer-cta"'), "CTA present");
    assert(p.includes('class="btn btn-seal" id="find-drawer-cta"'), "CTA is the sealed button");
    const js = read("assets/js/vault-room.js");
    assert(js.includes("initFindDrawerCta"), "CTA wired in the room script");
    // the accession line no longer repeats the JS-rendered coverage counts
    const acc = p.match(/<p class="accession">([\s\S]*?)<\/p>/)[1];
    assert(!acc.includes("1,939"), "accession line doesn't duplicate coverage counts");
  });
});

suite("makeover — the lost drawer (404)", () => {
  test("404.html exists with the vault wiring", () => {
    const p = read("404.html");
    assert(p.includes("vault.css"), "vault.css linked");
    assert(p.includes('src="assets/js/vault.js" defer'), "vault.js deferred");
    assert(p.includes("cinzel-latin-normal.woff2"), "Cinzel preloaded");
    assert(p.includes('class="motion-toggle"'), "motion toggle");
    assert(p.includes('id="directory-button"'), "directory button in nav");
    assert(p.includes('<span class="acc-no">404</span>'), "accession № 404");
    assert(p.includes('meta name="robots" content="noindex"'), "noindex");
  });
});
