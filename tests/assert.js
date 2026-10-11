/* Tiny assertion library + test registry. No dependencies. */
"use strict";

const suites = [];
let current = null;

export function suite(name, fn) {
  current = { name, tests: [] };
  suites.push(current);
  fn();
  current = null;
}

export function test(name, fn) {
  if (!current) throw new Error("test() outside suite()");
  current.tests.push({ name, fn });
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

assert.equal = (a, b, msg) => {
  if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};

assert.deepEqual = (a, b, msg) => {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(msg || `expected ${sb}, got ${sa}`);
};

assert.throws = (fn, msg) => {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(msg || "expected function to throw");
};

assert.approx = (a, b, eps, msg) => {
  if (Math.abs(a - b) > eps) throw new Error(msg || `expected ${a} ≈ ${b} (±${eps})`);
};

export async function runAll() {
  let pass = 0, fail = 0;
  const failures = [];
  for (const s of suites) {
    console.log(`\n## ${s.name}`);
    for (const t of s.tests) {
      try {
        await t.fn();
        pass++;
        console.log(`  ✓ ${t.name}`);
      } catch (err) {
        fail++;
        failures.push(`${s.name} > ${t.name}: ${err.message}`);
        console.log(`  ✗ ${t.name}\n    ${err.message}`);
      }
    }
  }
  console.log(`\n${pass} passed, ${fail} failed (${suites.length} suites)`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  return fail;
}
