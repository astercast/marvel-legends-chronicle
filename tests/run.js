/* Test entry point: installs stubs, imports every test module, runs. */
import "./stubs.js";
import { runAll } from "./assert.js";

await import("./test-config.js");
await import("./test-store.js");
await import("./test-data.js");
await import("./test-data-integrity.js");
await import("./test-price-trends.js");
await import("./test-explore.js");
await import("./test-showcase.js");
await import("./test-baf.js");
await import("./test-listings.js");
await import("./test-preorders.js");

const failures = await runAll();
process.exit(failures ? 1 : 0);
