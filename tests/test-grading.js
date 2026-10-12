/* Wave 17 tests: grading scale pure logic (GRADES shape, gradeBand,
   renderGradeRows). Established collector shorthand — nothing invented,
   nothing a market source could contradict. */
import { suite, test, assert } from "./assert.js";
import { GRADES, gradeBand, renderGradeRows } from "../assets/js/grading.js";

suite("grading: GRADES shape", () => {
  test("exactly 10 entries, C-10 down to C-1 in order", () => {
    assert(GRADES.length === 10, `expected 10, got ${GRADES.length}`);
    const codes = GRADES.map((g) => g.code);
    assert(JSON.stringify(codes) === JSON.stringify(["C-10","C-9","C-8","C-7","C-6","C-5","C-4","C-3","C-2","C-1"]),
      `codes wrong: ${codes.join(",")}`);
  });

  test("every entry has code, label, carded, and loose text", () => {
    for (const g of GRADES) {
      assert(typeof g.code === "string" && g.code.length > 0, "code missing");
      assert(typeof g.label === "string" && g.label.length > 0, `label missing for ${g.code}`);
      assert(typeof g.carded === "string" && g.carded.length > 0, `carded text missing for ${g.code}`);
      assert(typeof g.loose === "string" && g.loose.length > 0, `loose text missing for ${g.code}`);
    }
  });

  test("labels are distinct", () => {
    const labels = GRADES.map((g) => g.label);
    assert(new Set(labels).size === 10, `labels not distinct: ${labels.join(",")}`);
  });
});

suite("grading: gradeBand", () => {
  test("mint band covers C-10 and C-9", () => {
    assert(gradeBand("C-10") === "mint band");
    assert(gradeBand("C-9") === "mint band");
  });

  test("band ladder descends correctly", () => {
    assert(gradeBand("C-8") === "near mint");
    assert(gradeBand("C-7") === "player/collector");
    assert(gradeBand("C-6") === "player/collector");
    assert(gradeBand("C-5") === "well loved");
    assert(gradeBand("C-4") === "well loved");
    assert(gradeBand("C-3") === "parts only");
    assert(gradeBand("C-2") === "parts only");
    assert(gradeBand("C-1") === "parts only");
  });

  test("case-insensitive, rejects junk", () => {
    assert(gradeBand("c-10") === "mint band");
    assert(gradeBand("  C-8 ") === "near mint");
    assert(gradeBand("C-11") === null);
    assert(gradeBand("C-0") === null);
    assert(gradeBand("mint") === null);
    assert(gradeBand("") === null);
  });
});

suite("grading: renderGradeRows", () => {
  test("renders one row per grade with both columns", () => {
    const html = renderGradeRows();
    const rows = html.split("</tr>").filter((r) => r.trim().length > 0);
    assert(rows.length === 10, `expected 10 rows, got ${rows.length}`);
    for (const g of GRADES) {
      assert(html.includes(g.code), `missing code ${g.code}`);
      assert(html.includes(g.label), `missing label ${g.label}`);
    }
  });

  test("includes band for each grade", () => {
    const html = renderGradeRows();
    for (const g of GRADES) {
      assert(html.includes(gradeBand(g.code)), `missing band for ${g.code}`);
    }
  });

  test("uses scope=row on grade headers", () => {
    const html = renderGradeRows();
    const heads = (html.match(/<th scope="row">/g) || []).length;
    assert(heads === 10, `expected 10 row headers, got ${heads}`);
  });
});
