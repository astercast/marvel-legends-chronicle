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
  test("entrance choreography is one-shot and motion-gated", () => {
    assert(/@keyframes vault-hero-in/.test(vaultCss), "vault-hero-in keyframes exist");
    assert(
      /html\.vault-motion \.hero \.hero-inner > \*/.test(vaultCss),
      "hero entrance runs only under html.vault-motion"
    );
    assert(/animation: vault-hero-in var\(--dur-3\) var\(--ease-emphasis\) backwards/.test(vaultCss),
      "Premium emphasis easing, backwards fill");
    // Staggered delays across the hero child order
    for (const d of ["0.05s", "0.14s", "0.23s", "0.32s", "0.41s"]) {
      assert(vaultCss.includes(`animation-delay: ${d}`), `stagger delay ${d} present`);
    }
    // Choreography covers every hero variant page type
    for (const sel of [".curve-hero > *", ".dw-hero > *", ".page-head > *"]) {
      assert(vaultCss.includes(sel), `entrance covers ${sel}`);
    }
  });

  test("hover physics is lift + brass, motion-gated, with an always-on color fallback", () => {
    assert(/html\.vault-motion \.card:hover/.test(vaultCss), "card lift gated on vault-motion");
    assert(vaultCss.includes("translateY(-3px)"), "lift amount is -3px");
    assert(/border-color: var\(--gold-deep\)/.test(vaultCss), "brass edge on hover");
    // Reduced-motion readers still get instant border feedback (no transform)
    const alwaysRule = vaultCss.match(/\.card:hover, [^{]*\{[^}]*\}/);
    assert(alwaysRule && !alwaysRule[0].includes("transform"),
      "always-on hover rule carries border-color, never transform");
  });

  test("wax-seal stamp entrance is one-shot and motion-gated", () => {
    assert(/@keyframes seal-press/.test(vaultCss), "seal-press keyframes exist");
    assert(/html\.vault-motion \.wax-seal/.test(vaultCss), "seal stamp gated on vault-motion");
    assert(/animation: seal-press 0\.5\d?s var\(--ease-emphasis\)/.test(vaultCss),
      "seal uses the emphasis easing");
  });

  test("motion still runs only when OS + manual toggle agree (unchanged contract)", () => {
    assert(vaultJs.includes('root.getAttribute("data-motion") !== "reduce"'),
      "manual reduce converges with the OS query");
    assert(vaultJs.includes("prefers-reduced-motion"), "OS query consulted");
  });

  test("no raw transition/animation shorthand outside the vault-motion gate for entrances", () => {
    // Every keyframes block added in wave 34 is referenced only under
    // html.vault-motion — the finished state stays the CSS default.
    for (const name of ["vault-hero-in", "seal-press"]) {
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

  test("quest achievements are wax-seal medals", () => {
    assert(/\.ach-card \.ach-icon/.test(vaultCss), "ach-icon identity override exists");
    assert(vaultCss.includes("var(--wax)"), "seal uses the wax token");
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
    assert(/\.curve-list \.curve-card svg/.test(vaultCss), "curve svg ledger treatment");
    assert(/repeating-linear-gradient/.test(vaultCss), "ledger ruling present");
    assert(/\.curve-card \{ border-top: 3px solid var\(--gold-deep\)/.test(vaultCss),
      "curve cards carry the brass edge");
  });

  test("market briefing cards carry the brass edge", () => {
    assert(/\.brief-card \{ border-top: 3px solid var\(--gold-deep\)/.test(vaultCss),
      "briefing cards carry the brass edge");
  });

  test("API/agents docs read as the registrar's desk", () => {
    assert(/\.card h3 code/.test(vaultCss), "endpoint code identity rule");
    assert(/pre, \.code-block \{[^}]*border-left: 3px solid var\(--gold-deep\)/.test(vaultCss),
      "code blocks carry the brass rule");
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
    assert(files.length === 167, `167 wave pages, got ${files.length}`);
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
