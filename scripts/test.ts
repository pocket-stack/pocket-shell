// bun run test — the checks that need no console and no emulator: the window
// manager's rules and the headless replay of the film tape. The guest is
// bundled first because the sim boots the built bundle, not the sources.

import { $ } from "bun";
import { passThrough } from "./run.ts";
import { ROOT, VENDOR } from "./paths.ts";

await passThrough($`bun ${import.meta.dir}/guest.ts`.cwd(ROOT));
// The sim resolves the framework through the submodule's own conditions, so
// its tests run with the browser condition the wasm host needs.
await passThrough($`bun test --conditions=browser test/wm.test.ts test/sim.test.ts`.cwd(ROOT));
console.log(`pocket-shell: unit + sim green (runtime ${VENDOR.replace(`${ROOT}/`, "")})`);
