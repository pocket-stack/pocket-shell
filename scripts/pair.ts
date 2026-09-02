// bun run pair --host <ip> — pair with a console once, while ftpd is running
// on it. The vendored tool uploads a key to the SD card and keeps its copy
// inside the submodule; this brings that copy back into .pocket/devices/,
// where it survives a re-clone of vendor/pocketjs.

import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { $ } from "bun";
import { passThrough } from "./run.ts";
import { ROOT, VENDOR } from "./paths.ts";

await passThrough($`bun ${VENDOR}/tools/3ds-dev.ts pair ${process.argv.slice(2)}`.cwd(ROOT));

const vendorKeys = resolve(VENDOR, ".pocket/3ds/devices");
if (existsSync(vendorKeys)) {
  const keys = resolve(ROOT, ".pocket/devices");
  mkdirSync(keys, { recursive: true });
  for (const name of readdirSync(vendorKeys).filter((entry) => entry.endsWith(".key"))) {
    copyFileSync(resolve(vendorKeys, name), resolve(keys, name));
    console.log(`pocket-shell: kept .pocket/devices/${name}`);
  }
}
