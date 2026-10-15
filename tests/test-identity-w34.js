/* Wave 34 — Collector's Vault identity wave 2 tests.
   Static assertions over the identity layer (no DOM available in this
   harness): entrance choreography + hover physics (reduced-motion gated),
   per-page-type identity coverage, and the consistency-audit script. */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const vaultCss = read("assets/css/vault.css");
const vaultJs = read("assets/js/vault.js");
const encyclopediaJs = read("assets/js/encyclopedia.js");
const dropJs = read("assets/js/drop-command.js");

suite("identity wave 2 — signature motion (reduced-motion-first)", () => {
  test("entrance choreography is REMOVED (R21 motion census: stillness)", () => {
    // Round 4 census + the R21 identity pass: the hero entered twice over
    // (this block's fade-rise and the base rise-in in layout.css). Marvel's
    // signature is stillness with one plinth light, so both entrances are
    // removed at source and this test now guards their absence.
    assert(!/@keyframes vault-hero-in/.test(vaultCss), "vault-hero-in keyframes are gone");
    assert(!/animation:\s*vault-hero-in/.test(vaultCss), "vault-hero-in is never used");
    assert(!/vault-sweep/.test(vaultCss), "the hero light sweep is gone with it");
    const layoutCss = read("assets/css/layout.css");
    assert(!/animation:\s*rise-in/.test(layoutCss), "layout.css hero furniture carries no rise-in");
    const museumCss = read("assets/css/museum.css");
    assert(!/\.plinth-light/.test(museumCss), "the plinth light is RETIRED (MARVEL-LIGHT 3.4: a plate is printed, not lit)");
    assert(!/plinth-warm/.test(museumCss), "no plinth keyframes survive");
    assert(/\.plate-mark/.test(museumCss), "the printed plate, with its red plate mark, lives in museum.css");
  });

  test("hover physics is a border darkening only: nothing lifts under light", () => {
    assert(!vaultCss.includes("translateY(-3px)"), "the card lift is removed");
    assert(!/html\.vault-motion \.card:hover[^}]*transform/.test(vaultCss), "no motion-gated lift remains");
    const alwaysRule = vaultCss.match(/\.card:hover, [^{]*\{[^}]*\}/);
    assert(alwaysRule && alwaysRule[0].includes("border-color: var(--line-bright)"),
      "always-on hover rule darkens the rule to Pencil");
    assert(alwaysRule && !alwaysRule[0].includes("transform"),
      "always-on hover rule carries border-color, never transform");
  });

  test("the seal is a printer's stamp, present on arrival; the press is an interaction", () => {
    assert(/@keyframes seal-press/.test(vaultCss), "seal-press keyframes exist");
    assert(/\.seal-stamp\s*\{/.test(vaultCss), "the seal is drawn as .seal-stamp (double ring, Plate Red)");
    assert(!/\.wax-seal/.test(vaultCss), "the wax seal is retired");
    assert(!/html\.vault-motion \.seal-stamp \{ animation/.test(vaultCss),
      "NO on-load seal animation: the seal is present in residence (M5 residence clause)");
    assert(/\.seal-stamp:active/.test(vaultCss), "the press survives as an interaction");
    assert(/animation: seal-press 0\.5\d?s var\(--ease-emphasis\)/.test(vaultCss),
      "the unlock flourish uses the emphasis easing");
  });

  test("motion still runs only when OS + manual toggle agree (unchanged contract)", () => {
    assert(vaultJs.includes('root.getAttribute("data-motion") !== "reduce"'),
      "manual reduce converges with the OS query");
    assert(vaultJs.includes("prefers-reduced-motion"), "OS query consulted");
  });

  test("no raw transition/animation shorthand outside the vault-motion gate for entrances", () => {
    // Every keyframes block added in wave 34 is referenced only under
    // html.vault-motion — the finished state stays the CSS default.
    // (vault-hero-in was removed entirely by the R21 census fix; the
    // entrance test above guards its absence.)
    for (const name of ["seal-press"]) {
      const uses = vaultCss.match(new RegExp(`animation:[^;]*${name}[^;]*;`, "g")) || [];
      assert(uses.length > 0, `${name} is used`);
      for (const u of uses) {
        const idx = vaultCss.indexOf(u);
        const ctx = vaultCss.slice(Math.max(0, idx - 400), idx);
        assert(ctx.includes("html.vault-motion"), `${name} use is vault-motion gated`);
      }
    }
  });
});

suite("identity wave 2 — per-page-type coverage", () => {
  const pages = {};
  for (const f of readdirSync(root)) {
    if (f.endsWith(".html")) pages[f] = read(f);
  }

  test("signature pages carry accession lines", () => {
    const expected = {
      "quest.html": "grail-quest",
      "drop-week.html": "drop-week",
      "launch-curve.html": "launch-curves",
      "market-briefing.html": "market-briefing",
      "api.html": "api-v1",
      "agents.html": "agents",
      "encyclopedia.html": "encyclopedia",
    };
    for (const [f, no] of Object.entries(expected)) {
      assert(pages[f].includes(`<span class="acc-no">${no}</span>`),
        `${f} accession № ${no}`);
    }
  });

  test("index hero surfaces the Visual Database, no rope-rule (R21)", () => {
    assert(pages["index.html"].includes('class="hero-figures"'), "hero figures on index");
    assert(!pages["index.html"].includes('class="rope-rule"'), "rope-rule removed from index (R21)");
  });

  test("quest achievements are stamp medallions in red ink", () => {
    assert(/\.ach-card \.ach-icon/.test(vaultCss), "ach-icon identity override exists");
    assert(vaultCss.includes("var(--plate-red)"), "the medallion is stamped in Plate Red");
    assert(!vaultCss.includes("var(--wax)"), "the wax token no longer styles anything in the identity layer");
    assert(/\.ach-card\.ach-locked \.ach-icon/.test(vaultCss), "locked state stays dimmed");
    assert(/\.ach-card\.ach-unlocked \.ach-icon[^}]*seal-press/.test(vaultCss),
      "unlock replays the seal press under motion");
  });

  test("encyclopedia hall of fame renders audio-guide stop numbers", () => {
    assert(encyclopediaJs.includes('class="stop-no"'), "stop-no element rendered");
    assert(encyclopediaJs.includes("Audio-guide stop №"), "audio-guide stop label");
    assert(encyclopediaJs.includes(".padStart(2,"), "stop numbers zero-padded");
    assert(/\.stop-no/.test(vaultCss), "stop-no identity style exists");
    assert(/\.hof-card/.test(vaultCss), "hof-card identity style exists");
  });

  test("drop-week cards carry dispatch registry numbers", () => {
    assert(dropJs.includes("dw-dispatch accession"), "dispatch accession element");
    assert(dropJs.includes("Dispatch №"), "dispatch label");
    assert(/\.dw-card/.test(vaultCss), "dw-card identity style exists");
  });

  test("launch curve reads as the ledger page", () => {
    assert(/\.curve-list \.curve-card svg/.test(vaultCss), "curve svg treatment");
    assert(!/repeating-linear-gradient/.test(vaultCss), "the faked graph-paper ruling is REMOVED (flat grounds)");
    assert(/\.curve-card \{ border-top: 3px solid var\(--line-bright\)/.test(vaultCss),
      "curve cards carry the Pencil edge");
  });

  test("market briefing cards carry the Pencil edge", () => {
    assert(/\.brief-card \{ border-top: 3px solid var\(--line-bright\)/.test(vaultCss),
      "briefing cards carry the Pencil edge");
  });

  test("API/agents docs read as the registrar's desk", () => {
    assert(/\.card h3 code/.test(vaultCss), "endpoint code identity rule");
    assert(/pre, \.code-block \{[^}]*border-left: 3px solid var\(--line-bright\)/.test(vaultCss),
      "code blocks carry the Pencil rule");
  });
});

suite("identity wave 2 — generated pages stay consistent", () => {
  test("every character page carries its slug accession", () => {
    const dir = join(root, "characters");
    const files = readdirSync(dir).filter((f) => f.endsWith(".html") && f !== "index.html");
    assert(files.length === 66, `66 character pages, got ${files.length}`);
    for (const f of files) {
      const t = read(`characters/${f}`);
      assert(t.includes(`<span class="acc-no">${f.replace(".html", "")}</span>`),
        `${f} slug accession`);
    }
  });

  test("every wave page carries its wave-id accession", () => {
    const dir = join(root, "waves");
    const files = readdirSync(dir).filter((f) => f.endsWith(".html") && f !== "index.html");
    assert(files.length === 170, `170 wave pages, got ${files.length}`);
    for (const f of files) {
      const t = read(`waves/${f}`);
      assert(t.includes(`<span class="acc-no">${f.replace(".html", "")}</span>`),
        `${f} wave accession`);
    }
  });

  test("consistency audit script exists and passes on the current tree", () => {
    assert(existsSync(join(root, "scripts/audit_identity.py")), "audit script present");
    const src = read("scripts/audit_identity.py");
    assert(src.includes("vault.css"), "audits the identity wiring");
    assert(src.includes("motion-toggle"), "audits the motion toggle");
    assert(src.includes("fonts.googleapis.com"), "audits the no-remote-font rule");
  });
});
