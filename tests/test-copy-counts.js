/* Copy-count guard: the site's prose must never drift from the archive again.
   Every "N figures" / "N waves" archive-total mention in the copy corpus must
   equal the live counts derived from api/v1 (never invented, never pinned
   to a stale snapshot). Small per-wave/per-year counts are exempt; only
   4-digit figure totals and 3-digit wave totals are treated as archive totals.

   Historical logs are exempt by design (WAVELOG.md, docs/PERFORMANCE.md §1
   describe what was true on a past date); everything else must be current. */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Derive from api/v1 (the live surface), cross-check against the source data.
const apiFigures = JSON.parse(readFileSync(join(root, "api", "v1", "figures.json"), "utf8"));
const apiWaves = JSON.parse(readFileSync(join(root, "api", "v1", "waves.json"), "utf8"));
const dataRaw = JSON.parse(readFileSync(join(root, "data", "figures.json"), "utf8"));
const liveFigures = apiFigures.length;
const liveWaves = apiWaves.length;
const dataFigures = dataRaw.waves.reduce((n, w) => n + (w.figures ?? []).length, 0);

function* walk(dir, exts) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "__pycache__") continue;
      yield* walk(p, exts);
    } else if (exts.some((x) => e.name.endsWith(x))) {
      yield p;
    }
  }
}

function copyCorpus() {
  const out = [];
  for (const p of walk(root, [".html", ".md", ".txt"])) {
    if (p.includes("tests")) continue; // tests pin data, not copy
    if (p.endsWith("WAVELOG.md")) continue; // historical log, exempt by design
    if (p.endsWith(join("docs", "PERFORMANCE.md"))) continue; // §1 is dated history
    out.push(p);
  }
  return out;
}

suite("copy counts track the live archive", () => {
  test("api/v1 counts match the source data", () => {
    assert.equal(liveFigures, dataFigures, "api/v1 figures.json != data/figures.json");
    assert.equal(liveWaves, dataRaw.waves.length, "api/v1 waves.json != data waves");
  });

  test("no 4-digit figure total drifts from the live count", () => {
    const re = /(\d{1,3}(?:,\d{3})|\d{4})\s*(?:figures?|-\s*figures?)/gi;
    // Character-name numbers ("Spider-Man 2099 figures", "Iron Man 2020")
    // are name positions, never archive totals.
    const nameTokens = new Set(["2099", "2020"]);
    const bad = [];
    for (const f of copyCorpus()) {
      const text = readFileSync(f, "utf8");
      let m;
      while ((m = re.exec(text))) {
        const n = Number(m[1].replace(/,/g, ""));
        // A 4-digit number in the line's year range is a year reference
        // ("no 2026 figure has reported-price data"), not an archive total.
        if (n >= 2002 && n <= 2026) continue;
        const prefix = text.slice(Math.max(0, m.index - 40), m.index).replace(/\s+$/, "");
        if (nameTokens.has(m[1].replace(/,/g, "")) && /[A-Za-z]$/.test(prefix)) continue;
        if (n !== liveFigures) bad.push(`${f}: "${m[0].trim()}" (live: ${liveFigures})`);
      }
    }
    assert.equal(bad.length, 0, `stale figure totals:\n${bad.join("\n")}`);
  });

  test("no 3-digit wave total drifts from the live count", () => {
    // 3-digit only: 2-digit numbers are per-wave/per-year mentions, 4-digit
    // are years. Wave-name contexts ("X-Men '97 Wave 3", "Wave 12") never
    // produce a 3-digit match.
    const re = /(?<![\d.,'])(\d{3})(?![\d.,])\s*waves?\b/gi;
    const bad = [];
    for (const f of copyCorpus()) {
      const text = readFileSync(f, "utf8");
      let m;
      while ((m = re.exec(text))) {
        const n = Number(m[1]);
        if (n !== liveWaves) bad.push(`${f}: "${m[0].trim()}" (live: ${liveWaves})`);
      }
    }
    assert.equal(bad.length, 0, `stale wave totals:\n${bad.join("\n")}`);
  });

  test("copy contains at least one current figure and wave total", () => {
    // A corpus with zero mentions is suspicious (the totals are part of the
    // site's identity copy) — make sure the guard is actually watching.
    const figRe = new RegExp(
      liveFigures.toLocaleString("en-US").replace(/,/g, ",?") + "\\s*(?:figures?|-\\s*figures?)",
      "i"
    );
    let figHits = 0;
    let waveHits = 0;
    for (const f of copyCorpus()) {
      const text = readFileSync(f, "utf8");
      if (figRe.test(text)) figHits++;
      if (new RegExp(`\\b${liveWaves}\\s*waves?\\b`).test(text)) waveHits++;
    }
    assert(figHits > 0, "no current figure total found in copy");
    assert(waveHits > 0, "no current wave total found in copy");
  });
});
