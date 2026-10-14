/* EXTREME MAKEOVER (2026-10-12) — the atrium edition.
   Guards the first-impression redesign:
   - front-desk nav (R21): four doors + the Index of Halls button on every page
   - the directory template carries all 56 pages, grouped in 6 halls
   - footer registry keeps aria-current on the current page
   - homepage: frontispiece (folio line, plate, Catalogue Note), contents roll call, era tabs, registrar note
   - vault room hero: no duplicated counts, find-a-drawer CTA wired
   - 404 page exists with the vault wiring
*/
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

/* R21 nav standard: <=5 visible primary items — four doors + the directory button. */
const FRONT_DESK = [
  "index.html",
  "vault-room.html",
  "encyclopedia.html",
  "radar.html",
];

function rootPages() {
  return readdirSync(root)
    .filter((f) => f.endsWith(".html"))
    .map((f) => join(root, f));
}

suite("makeover — front-desk nav", () => {
  test("primary nav is four doors + the directory button (R21)", () => {
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
  test("directory template holds all 56 pages in 6 halls", () => {
    const page = read("index.html");
    const tpl = page.match(/<template id="directory-panel">([\s\S]*?)<\/template>/);
    assert(tpl, "directory template present");
    const body = tpl[1];
    const halls = [...body.matchAll(/class="dir-hall-title">([^<]+)</g)].map((m) => m[1]);
    assert.equal(halls.length, 6, `halls: ${halls.join(", ")}`);
    const links = [...body.matchAll(/<li><a href="([^"]+)">/g)].map((m) => m[1]);
    assert.equal(links.length, 56, `directory links: ${links.length}`);
    assert.equal(new Set(links).size, 56, "no duplicate directory links");
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

  test("hero is a frontispiece: folio line, plate, Catalogue Note (MARVEL-LIGHT 3.2)", () => {
    const p = page();
    assert(p.includes('class="folio-line"'), "folio line under the masthead");
    assert(p.includes("31 of 1,939 pictured"), "the pictured census stands in the folio line");
    assert(p.includes('class="frontispiece"'), "frontispiece composition present");
    assert(p.includes("FRONTISPIECE"), "the frontispiece plate carries its mark");
    assert(p.includes("Catalogue Note"), "the Catalogue Note stands beside the plate");
    assert(p.includes('href="vault-room.html">enter the Vault Room'), "the way in is a quiet text link, no primary button");
    assert(!p.includes('class="btn btn-primary"'), "no primary CTA button on the home page");
    assert(p.includes("1,939 figures across 167 waves"), "live archive totals in the note");
    assert(p.includes('id="stat-strip"'), "census mount present (in the colophon)");
    assert(p.includes('class="cabinet-note"'), "cabinet note mount present");
    assert(!p.includes("You own</div>"), "no dead owned/wanted tiles");
  });

  test("the on-the-desk teaser is REMOVED from the home page (frontispiece discipline)", () => {
    const p = page();
    assert(!p.includes('id="desk-drop"'), "no desk teaser mount on the home page");
    assert(!p.includes("on-the-desk"), "the desk band is gone: three events only (plate, contents, census)");
    assert(!p.includes('src="assets/js/atrium.js"'), "atrium.js no longer loads on the home page");
    assert(!existsSync(join(root, "assets/js/atrium.js")), "atrium.js is removed with its band (Drop Week's own page carries the command center)");
  });

  test("contents: six ruled roll-call lines generated from the canonical data", () => {
    const p = page();
    const entries = [...p.matchAll(/<details class="contents-entry" name="halls">/g)];
    assert.equal(entries.length, 6, `contents entries: ${entries.length}`);
    for (const title of ["The Archive", "The Hunt", "Your Shelf", "The Market", "The Game", "The Desk"]) {
      assert(p.includes(`<span class="contents-name">${title}</span>`), `contents: ${title}`);
    }
    assert(!p.includes('class="hall"'), "the specimen-drawer hall cards are retired");
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

  test("registrar's note: human voice, ink seal, no AI filler", () => {
    const p = page();
    assert(p.includes("From the registrar's desk"), "registrar kicker");
    assert(p.includes("The Registrar"), "signed");
    assert(p.includes('class="seal-stamp"'), "the seal, stamped in red ink");
    for (const ism of ["delve", "game-changer", "unlock the power", "ever-evolving"]) {
      assert(!p.toLowerCase().includes(ism), `AI-ism leaked: ${ism}`);
    }
  });

  test("R21 markers: hero figures in, furniture out", () => {
    const p = page();
    assert(p.includes('class="hero-figures"'), "hero surfaces Visual Database embeds");
    assert(!p.includes("rope-rule"), "rope-rule furniture removed (R21)");
    assert(!p.includes('<p class="accession"'), "hero accession line removed (R21)");
    assert(!p.includes("mock-note"), "hero disclaimer moved to footer (R21)");
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
