// bun run probe [--host <ip>] [--out shot.png] — one round trip to a running
// console: runtime status, device stats, the mounted tree and a screenshot of
// both displays.
//
// The tree dump is the slow part and it can exceed the runtime's outgoing
// control budget on a deep UI, in which case probe waits and times out while
// the console is perfectly healthy. `bun run shot` asks for the screenshot
// alone and is the one to reach for then.

import { $ } from "bun";
import { passThrough, plantDeviceKeys } from "./run.ts";
import { ROOT, VENDOR } from "./paths.ts";

await plantDeviceKeys();
await passThrough($`bun ${VENDOR}/tools/3ds-dev.ts probe ${process.argv.slice(2)}`.cwd(ROOT));
