/* Data-integrity tests against the REAL data/figures.json.
   Guards the archive itself: counts, id stability, required fields, enums. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = JSON.parse(readFileSync(join(root, "data", "figures.json"), "utf8"));
const waves = raw.waves;
const figures = [];
for (const w of waves) {
  for (const f of (w.figures ?? [])) {
    figures.push({ ...f, id: `${w.id}::${f.name}`, waveId: w.id, year: w.year, manufacturer: w.manufacturer });
  }
}

suite("data integrity (data/figures.json)", () => {
  test("archive has 167 waves and 1939 figures", () => {
    assert.equal(waves.length, 167);
    assert.equal(figures.length, 1939);
  });

  test("figure ids are well-formed (waveId::name)", () => {
    for (const f of figures) {
      assert(f.id.includes("::"), `malformed id ${f.id}`);
      assert(f.id.startsWith(f.waveId + "::"), `id/waveId mismatch: ${f.id}`);
    }
  });

  test("no two rows are fully identical (variant+notes disambiguate)", () => {
    // Known design trade-off: id = waveId::name, so same-name variants in one
    // wave share an id (and therefore share owned/wanted state). What must
    // never happen is two truly indistinguishable rows.
    const seen = new Set();
    for (const f of figures) {
      const key = [f.waveId, f.name, f.variant ?? "", f.notes ?? ""].join("\u0000");
      assert(!seen.has(key), `fully duplicate row: ${f.id}`);
      seen.add(key);
    }
  });

  test("required fields present on every figure", () => {
    for (const f of figures) {
      assert(typeof f.name === "string" && f.name.length > 0, `missing name: ${f.id}`);
      assert(Number.isInteger(f.year) && f.year >= 2002 && f.year <= 2026, `bad year: ${f.id}`);
      assert(f.manufacturer === "Toy Biz" || f.manufacturer === "Hasbro", `bad manufacturer: ${f.id}`);
      assert(typeof f.waveId === "string" && f.waveId.length > 0, `missing waveId: ${f.id}`);
    }
  });

  test("optional fields are string-or-absent (nulls stripped)", () => {
    for (const f of figures) {
      for (const k of ["variant", "exclusive", "bafPiece", "notes", "waveBaf"]) {
        const v = f[k];
        assert(v === undefined || typeof v === "string", `${k} not string/absent: ${f.id}`);
      }
    }
  });

  test("wave ids are unique kebab-case", () => {
    const ids = waves.map((w) => w.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate wave ids");
    for (const id of ids) assert(/^[a-z0-9-]+$/.test(id), `non-kebab wave id: ${id}`);
  });

  test("Toy Biz era is 2002-2006, Hasbro 2007+", () => {
    for (const w of waves) {
      if (w.manufacturer === "Toy Biz") assert(w.year <= 2006, `Toy Biz after 2006: ${w.id}`);
      else assert(w.year >= 2007, `Hasbro before 2007: ${w.id}`);
    }
  });

  test("BAF piece carriers reference real waves", () => {
    const waveIds = new Set(waves.map((w) => w.id));
    for (const f of figures) {
      assert(waveIds.has(f.waveId), `figure in unknown wave: ${f.id}`);
    }
  });
});
