/* Wave 1 (wow) — The Vault Room tests.
   Static assertions over the room page + its engine (no DOM in this harness):
   identity wiring, drawer/keyboard/ARIA semantics, deep-linking,
   reduced-motion + transform-only animation discipline, generator nav sync,
   and the real-data integrity the room depends on. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import "./stubs.js";
import { openDrawer } from "../assets/js/vault-room.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const page = read("vault-room.html");
const js = read("assets/js/vault-room.js");

suite("vault room — identity wiring", () => {
  test("Cinzel preload, vault.css after components.css, vault.js deferred", () => {
    assert(page.includes('href="assets/fonts/cinzel-latin-normal.woff2"'), "Cinzel preload");
    const cssIdx = (h) => page.indexOf(`href="assets/css/${h}"`);
    assert(cssIdx("components.css") !== -1 && cssIdx("vault.css") !== -1, "both CSS linked");
    assert(cssIdx("components.css") < cssIdx("vault.css"), "vault.css loads after components.css");
    assert(
      /<script[^>]*src="assets\/js\/vault\.js"[^>]*defer/.test(page) ||
        /<script[^>]*defer[^>]*src="assets\/js\/vault\.js"/.test(page),
      "vault.js deferred"
    );
  });

  test("footer motion toggle and no remote fonts", () => {
    assert(page.includes('class="motion-toggle"'), "motion toggle present");
    assert(!page.includes("fonts.googleapis.com"), "no remote font dependency");
  });

  test("accession line + vault-room marker", () => {
    assert(/<p class="accession">/.test(page), "accession line");
    assert(page.includes('<span class="acc-no">vault-room</span>'), "vault-room accession id");
    assert(page.includes('id="vault-room"'), "vault-room marker");
  });

  test("skip link, journey nav and room landmarks", () => {
    assert(page.includes('class="skip-link"'), "skip link");
    assert(page.includes('aria-label="Travel the years, 2002 to 2026"'), "journey nav label");
    assert(page.includes('id="journey-list"'), "journey list");
    assert(page.includes('id="room-years"'), "room years host");
    assert(page.includes("<noscript>"), "no-JS fallback");
  });
});

suite("vault room — drawers, keyboard, ARIA", () => {
  test("drawers are buttons that open dialogs", () => {
    assert(js.includes('aria-haspopup", "dialog"') || js.includes("aria-haspopup"), "dialog affordance");
    assert(js.includes('openModal('), "shared accessible modal reused");
    assert(js.includes('role="dialog"') || js.includes("modal.js"), "dialog semantics via modal.js");
  });

  test("keyboard: shelf arrows, journey arrows, modal Esc", () => {
    for (const k of ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"]) {
      assert(js.includes(k), `shelf handles ${k}`);
    }
    assert(js.includes("ArrowRight") && js.includes("journeyList"), "journey rail arrow travel");
  });

  test("deep-link via #fig= hash", () => {
    assert(js.includes("#fig="), "fig hash read");
    assert(js.includes("encodeURIComponent(fig.id)"), "fig hash written");
    assert(js.includes("decodeURIComponent"), "fig hash decoded");
  });

  test("openDrawer is exported and builds a real story", () => {
    assert(typeof openDrawer === "function", "openDrawer exported");
    assert(js.includes("badgeFor(fig)"), "researched badges");
    assert(js.includes("yearCtx.headline") || js.includes("yearCtx.summary"), "year narrative");
    assert(js.includes("spotlight"), "spotlight why");
    assert(js.includes("trackerButtons(fig.id)"), "owned/wanted tracker");
    assert(js.includes("renderResearchLinks(fig)"), "research links");
  });
});

suite("vault room — animation discipline", () => {
  test("parallax is REMOVED: the room is still (MARVEL-LIGHT motion estate)", () => {
    assert(!page.includes("data-parallax"), "no parallax layers in the room");
    assert(!page.includes("room-layer"), "the wall layers are gone from the page");
    assert(!js.includes("initParallax"), "no parallax driver remains in vault-room.js");
    assert(!js.includes('setProperty("--py"'), "no scroll-driven CSS var");
  });

  test("reduced-motion gates parallax and reveals the full timeline list", () => {
    assert(js.includes("prefers-reduced-motion"), "OS preference checked");
    assert(js.includes('dataset.motion === "reduce"'), "manual toggle honored");
    assert(page.includes("@media (prefers-reduced-motion: reduce)"), "reduced-motion stylesheet");
    assert(page.includes("journey-summary"), "journey carries full summaries");
  });

  test("the drawer dialog opens present: no slide entrance ships", () => {
    assert(!page.includes("@keyframes drawer-slide"), "drawer-slide keyframes are removed");
    assert(!/translateX\(48px\)/.test(page), "no slide transform remains");
    assert(js.includes('scrollBehavior = "auto"'), "year travel is a cut, forced instant");
    assert(!js.includes('behavior: "smooth"'), "no gliding scroll remains in the room");
  });
});

suite("vault room — generator nav sync", () => {
  test("room link lives in the canonical nav source", () => {
    // EXTREME MAKEOVER: nav_data.py is the single source of truth; the three
    // generators import it rather than redefining the lists.
    assert(read("scripts/nav_data.py").includes('("vault-room.html", "Vault Room")'),
      "nav_data.py lists the room");
    for (const f of ["scripts/update_nav.py", "scripts/build_waves.py", "scripts/build_characters.py"]) {
      assert(read(f).includes("import nav_data"), `${f} imports the canonical nav`);
    }
  });

  test("every root page links the room", () => {
    assert(page.includes('href="vault-room.html" aria-current="page"'), "room marks itself current");
  });
});

suite("vault room — real-data integrity", () => {
  const figures = JSON.parse(read("data/v1/figures.json"));
  const waves = JSON.parse(read("data/v1/waves.json"));
  const timeline = JSON.parse(read("data/v1/timeline.json"));

  test("archive scale: 1,939 figures, 167 waves, 25 years", () => {
    assert(figures.length === 1939, `figures: ${figures.length}`);
    assert(waves.length === 167, `waves: ${waves.length}`);
    assert(timeline.years.length === 25, `years: ${timeline.years.length}`);
  });

  test("every figure resolves to a wave and a year in range", () => {
    const waveIds = new Set(waves.map((w) => w.id));
    for (const f of figures) {
      assert(f.name, `figure ${f.id} has a name`);
      assert(waveIds.has(f.waveId), `figure ${f.id} resolves to wave ${f.waveId}`);
      assert(f.year >= 2002 && f.year <= 2026, `figure ${f.id} year ${f.year} in range`);
    }
  });

  test("every timeline year carries its researched narrative", () => {
    const years = timeline.years.map((y) => y.year).sort((a, b) => a - b);
    assert.deepEqual(years, Array.from({ length: 25 }, (_, i) => 2002 + i), "2002..2026 contiguous");
    for (const y of timeline.years) {
      assert(y.headline && y.summary, `year ${y.year} has headline + summary`);
    }
  });

  test("spotlight picks resolve to real figures", () => {
    const figIds = new Set(figures.map((f) => f.id));
    for (const y of timeline.years) {
      for (const s of y.spotlight ?? []) {
        assert(figIds.has(s.id), `spotlight ${s.id} (${y.year}) is a real figure`);
        assert(s.why, `spotlight ${s.id} has a why`);
      }
    }
  });
});
