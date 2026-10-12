/* Wave 33 — Collector's Vault identity tests.
   Static assertions over the identity layer (no DOM available in this
   harness): tokens, vault.css components, vault.js hooks, and that every
   page (hand + generated) wires the identity in. */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import { STORE_KEYS } from "../assets/js/config.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const tokens = read("assets/css/tokens.css");
const vaultCss = read("assets/css/vault.css");
const base = read("assets/css/base.css");
const vaultJs = read("assets/js/vault.js");

suite("vault identity — tokens", () => {
  test("self-hosts the Cinzel + Newsreader variable fonts (OFL)", () => {
    assert(tokens.includes("@font-face"), "@font-face blocks present");
    assert(!tokens.includes("fonts.googleapis.com"), "no remote font dependency");
    assert(/font-family:\s*"Cinzel"/.test(tokens), "Cinzel @font-face");
    assert(/font-weight:\s*400 900/.test(tokens), "Cinzel variable wght range");
    assert(/font-family:\s*"Newsreader"/.test(tokens), "Newsreader @font-face");
    assert(/font-display:\s*swap/.test(tokens), "font-display: swap");
    assert(/unicode-range:/.test(tokens), "unicode-range subsetting");
    for (const f of ["cinzel-latin-normal.woff2", "cinzel-latin-ext-normal.woff2",
                     "newsreader-latin-normal.woff2", "newsreader-latin-ext-normal.woff2",
                     "newsreader-latin-italic.woff2", "newsreader-latin-ext-italic.woff2"]) {
      assert(existsSync(join(root, "assets/fonts", f)), `ships ${f}`);
    }
  });

  test("type stacks resolve to the fleet-locked families", () => {
    assert(/--font-display:\s*"Cinzel"/.test(tokens), "--font-display is Cinzel");
    assert(/--font-body:\s*"Newsreader"/.test(tokens), "--font-body is Newsreader");
    assert(/--font-mono:/.test(tokens), "--font-mono token retained");
  });

  test("vault palette tokens exist", () => {
    for (const t of ["--paper:", "--paper-2:", "--ink-on-paper:", "--muted-on-paper:", "--wax:", "--wax-deep:"]) {
      assert(tokens.includes(t), `missing token ${t}`);
    }
    assert(tokens.includes("--gold:"), "--gold retained");
    assert(tokens.includes("--ink:"), "--ink retained");
    assert(tokens.includes("--ease:"), "--ease retained");
  });

  test("signature motion is one Premium easing", () => {
    assert(/--ease:\s*cubic-bezier\(0\.4,\s*0,\s*0\.2,\s*1\)/.test(tokens), "--ease is Premium 0.4,0,0.2,1");
    assert(/--dur-1:\s*0\.15s/.test(tokens), "dur-1 0.15s");
    assert(/--dur-2:\s*0\.25s/.test(tokens), "dur-2 0.25s");
    assert(/--dur-3:\s*0\.4s/.test(tokens), "dur-3 0.4s");
  });

  test("focus ring is the gold tactile signature", () => {
    assert(/--focus-ring:.*var\(--gold\)/.test(tokens), "gold focus ring");
  });
});

suite("vault identity — components", () => {
  test("vault.css ships the identity kit", () => {
    for (const sel of [".placard", ".wax-seal", ".accession", ".rope-rule", ".motion-toggle", ".btn-seal", ".fig-list > .fig", ".stat::before"]) {
      assert(vaultCss.includes(sel), `missing ${sel}`);
    }
    assert(vaultCss.includes("Vitrine sheen"), "vitrine sheen section present");
  });

  test("selection washes brass with a set text color (never background alone)", () => {
    const combined = base + vaultCss;
    const m = combined.match(/::selection\s*\{[^}]*\}/);
    assert(m, "::selection rule present");
    assert(/background:\s*var\(--gold\)/.test(m[0]), "brass wash");
    assert(/color:\s*#171204/.test(m[0]), "dark text color set");
  });

  test("scrollbar-gutter is stable (no layout jog on filter pages)", () => {
    assert(vaultCss.includes("scrollbar-gutter: stable"), "stable gutter");
  });

  test("hero sweep is a gated one-shot (no ambient loop to pause)", () => {
    const gated = vaultCss.match(/html\.vault-motion \.hero::before\s*\{[^}]*\}/);
    assert(gated, "sweep lives under the vault-motion gate");
    assert(/animation:\s*vault-sweep/.test(gated[0]), "sweep keyframes referenced in the gated block");
    assert(/1\.6s/.test(gated[0]) && / 1;/.test(gated[0]), "single iteration, no infinite loop");
  });
});

suite("vault identity — motion behavior (static)", () => {
  test("vault.js keys motion state to the registered store key", () => {
    assert(vaultJs.includes(`"${STORE_KEYS.motion}"`), "uses registered mlc_motion_v1 literal");
    assert.equal(STORE_KEYS.motion, "mlc_motion_v1");
  });

  test("vault.js honors OS preference + manual reduce toggle", () => {
    assert(vaultJs.includes("prefers-reduced-motion: reduce"), "reads OS preference");
    assert(vaultJs.includes('data-motion", "reduce"') || vaultJs.includes("data-motion"), "manual reduce sets data-motion");
    assert(vaultJs.includes(".motion-toggle"), "binds footer toggle buttons");
    assert(vaultJs.includes("aria-pressed"), "syncs aria-pressed");
  });

  test("vault.js is reduced-motion-first (reveal + sheen only when allowed)", () => {
    assert(vaultJs.includes("IntersectionObserver"), "IO-gated reveals");
    assert(vaultJs.includes("vault-motion"), "vault-motion class gate");
    assert(vaultJs.includes("pointer: fine"), "sheen skips touch pointers");
    assert(vaultJs.includes("requestAnimationFrame"), "sheen is rAF-throttled");
  });

  test("base.css authors still-state as default, motion as opt-in", () => {
    assert(base.includes("@media (prefers-reduced-motion: no-preference)"), "additive motion block");
    assert(/no-preference\)\s*\{[^}]*\.rise/.test(base), ".rise animation inside no-preference only");
    assert(base.includes("font-optical-sizing: auto"), "optical sizing for Newsreader opsz axis");
  });
});

suite("vault identity — wired into every page", () => {
  const rootPages = readdirSync(root).filter((f) => f.endsWith(".html"));

  test("every root page preloads the primary display font", () => {
    for (const f of rootPages) {
      const html = read(f);
      assert(html.includes('<link rel="preload" href="assets/fonts/cinzel-latin-normal.woff2" as="font" type="font/woff2" crossorigin>'), `${f}: font preload`);
    }
  });

  test("every root page links vault.css after components.css", () => {
    for (const f of rootPages) {
      const html = read(f);
      const cssIdx = html.indexOf('href="assets/css/components.css"');
      const vaultIdx = html.indexOf('href="assets/css/vault.css"');
      assert(cssIdx !== -1 && vaultIdx > cssIdx, `${f}: vault.css after components.css`);
    }
  });

  test("every root page loads vault.js (defer) before </body>", () => {
    for (const f of rootPages) {
      const html = read(f);
      assert(html.includes('<script src="assets/js/vault.js" defer></script>'), `${f}: vault.js`);
    }
  });

  test("every root page carries the footer motion toggle", () => {
    for (const f of rootPages) {
      const html = read(f);
      assert(html.includes('class="motion-toggle"'), `${f}: motion toggle`);
      assert(html.includes('aria-pressed="false"'), `${f}: aria-pressed initial`);
    }
  });

  test("generated wave pages: identity wired + accession line present", () => {
    const waves = readdirSync(join(root, "waves")).filter((f) => f.endsWith(".html"));
    assert(waves.length > 150, "wave corpus intact");
    for (const f of waves) {
      const html = read(`waves/${f}`);
      assert(html.includes('href="../assets/css/vault.css"'), `waves/${f}: vault.css`);
      assert(html.includes('<link rel="preload" href="../assets/fonts/cinzel-latin-normal.woff2" as="font" type="font/woff2" crossorigin>'), `waves/${f}: font preload`);
      assert(html.includes('<script src="../assets/js/vault.js" defer></script>'), `waves/${f}: vault.js`);
      assert(html.includes('class="motion-toggle"'), `waves/${f}: toggle`);
    }
    const sample = read("waves/hasbro-2007-blob.html");
    assert(sample.includes('<p class="accession">'), "wave hero carries Archive № accession line");
    assert(sample.includes("hasbro-2007-blob"), "accession derives from the stable wave id");
  });

  test("generated character pages: identity wired", () => {
    const chars = readdirSync(join(root, "characters")).filter((f) => f.endsWith(".html"));
    assert(chars.length > 60, "character corpus intact");
    for (const f of chars) {
      const html = read(`characters/${f}`);
      assert(html.includes('href="../assets/css/vault.css"'), `characters/${f}: vault.css`);
      assert(html.includes('<link rel="preload" href="../assets/fonts/cinzel-latin-normal.woff2" as="font" type="font/woff2" crossorigin>'), `characters/${f}: font preload`);
      assert(html.includes('<script src="../assets/js/vault.js" defer></script>'), `characters/${f}: vault.js`);
      assert(html.includes('class="motion-toggle"'), `characters/${f}: toggle`);
    }
  });

  test("identity assets exist on disk", () => {
    assert(existsSync(join(root, "assets/css/vault.css")), "vault.css");
    assert(existsSync(join(root, "assets/js/vault.js")), "vault.js");
  });
});
