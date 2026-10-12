/* Guards the seven agent-playbook skills (skills/agents/): index entries,
   file existence, frontmatter, the "API references" section (agents
   category uses it instead of "Data references"), and count consistency
   with api/v1/index.json. */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const AGENTS = [
  "preorder-hunter",
  "market-brief-reader",
  "ko-spotter",
  "grail-evaluator",
  "baf-strategist",
  "collection-auditor",
  "api-client",
];

const idx = JSON.parse(readFileSync(join(root, "skills", "index.json"), "utf8"));
const apiIndex = JSON.parse(readFileSync(join(root, "api", "v1", "index.json"), "utf8"));

suite("agent skills (skills/agents/)", () => {
  test("index lists exactly the seven agent skills", () => {
    const ids = idx.skills
      .filter((s) => s.path.startsWith("skills/agents/"))
      .map((s) => s.id);
    assert.deepEqual(ids, AGENTS);
  });

  test("each agent skill file exists with name/description frontmatter", () => {
    for (const id of AGENTS) {
      const p = join(root, "skills", "agents", `${id}.md`);
      assert(existsSync(p), `${id}.md missing`);
      const text = readFileSync(p, "utf8");
      assert(text.startsWith(`---\nname: ${id}\n`), `${id}: bad frontmatter name`);
      assert(/^description: .+/m.test(text), `${id}: missing description frontmatter`);
    }
  });

  test("agent skills use the API references section, not Data references", () => {
    for (const id of AGENTS) {
      const text = readFileSync(join(root, "skills", "agents", `${id}.md`), "utf8");
      assert(text.includes("## API references"), `${id}: missing ## API references`);
      assert(!text.includes("## Data references"), `${id}: should not use Data references`);
    }
  });

  test("agent skills reference only api/v1 endpoints", () => {
    const refRe = /## API references\n\n((?:- .+\n)+)/;
    for (const id of AGENTS) {
      const text = readFileSync(join(root, "skills", "agents", `${id}.md`), "utf8");
      const m = text.match(refRe);
      assert(m, `${id}: no API references list`);
      for (const line of m[1].trim().split("\n")) {
        assert(line.includes("`api/v1/") || line.includes("`skills/"),
          `${id}: non-API ref ${line}`);
      }
    }
  });

  test("agent skills carry all playbook sections", () => {
    const sections = ["## Use when", "## Inputs", "## Procedure", "## Worked example", "## Pitfalls"];
    for (const id of AGENTS) {
      const text = readFileSync(join(root, "skills", "agents", `${id}.md`), "utf8");
      for (const s of sections) {
        assert(text.includes(s), `${id}: missing section ${s}`);
      }
    }
  });

  test("api/v1/index.json skill count matches skills/index.json", () => {
    assert.equal(apiIndex.skills.count, idx.skills.length);
    assert.equal(idx.skills.length, idx.count);
  });

  test("agents.html links all agent skills and the three surface docs", () => {
    const text = readFileSync(join(root, "agents.html"), "utf8");
    for (const id of AGENTS) {
      assert(text.includes(`skills/agents/${id}.md`), `agents.html: missing link to ${id}`);
    }
    for (const ref of ["api/v1/index.json", "skills/index.json", "llms.txt"]) {
      assert(text.includes(ref), `agents.html: missing reference to ${ref}`);
    }
  });
});
