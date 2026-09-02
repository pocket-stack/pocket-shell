// SPDX-License-Identifier: GPL-3.0-or-later
// bun run test — the checks that need no console, no emulator and no device:
// the window manager's rules, the headless replay of the film tape, and the
// iPod app's own unit and sim tests. Both guests are bundled first because
// the sim boots the built bundle, not the sources.

import { $ } from "bun";
import { passThrough } from "./run.ts";
import { ROOT, VENDOR } from "./paths.ts";

await passThrough($`bun ${import.meta.dir}/guest.ts`.cwd(ROOT));
await passThrough($`bun ${import.meta.dir}/ipod.ts guest`.cwd(ROOT));
// The sim resolves the framework through the submodule's own conditions, so
// its tests run with the browser condition the wasm host needs.
await passThrough(
  $`bun test --conditions=browser test/wm.test.ts test/sim.test.ts test/ipod.test.ts test/ipod-sim.test.ts`.cwd(ROOT),
);
console.log(`pocket-shell: unit + sim green for both apps (runtime ${VENDOR.replace(`${ROOT}/`, "")})`);
