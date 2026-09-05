// SPDX-License-Identifier: GPL-3.0-or-later
// bun run ipod <command> — the iPod touch app, through the runtime's own
// device pipeline.
//
//   bun run ipod build          bundle the guest and link the app bundle
//   bun run ipod deploy         build, then install over usbmuxd
//   bun run ipod uninstall      remove the app and its data container
//   bun run ipod launch         open it on the device
//   bun run ipod status         the device's acceptance record
//   bun run ipod doctor         what the toolchain is missing
//   bun run ipod guest          bundle the guest alone (what the sim boots)
//
// Everything but `guest` hands over to vendor/pocketjs/tools/ipodtouch4.ts,
// which owns the toolchain, the sysroot, the linker and the deployment
// transaction. This app lives outside that repository, so it is passed as an
// EXTERNAL app: POCKETJS_IPODTOUCH4_APP_FILE names ipod/ipodtouch4.json and
// the guest builds with `--project-root` here — the same out-of-tree shape
// scripts/3ds.ts uses for the console.
//
// The iPod is usually plugged into the Omarchy machine rather than this Mac,
// so POCKETJS_IPODTOUCH4_VIA is passed through: device discovery and the
// iproxy tunnel run there over ssh, and every ssh/scp to the device jumps
// through it.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { $ } from "bun";
import { resolveIPodTouch4BuildPlan } from "../vendor/pocketjs/tools/ipodtouch4-profile.ts";
import { passThrough } from "./run.ts";
import { PLAN_DIR, ROOT, VENDOR } from "./paths.ts";

const DESCRIPTOR = resolve(ROOT, "ipod/ipodtouch4.json");
const MANIFEST = resolve(ROOT, "ipod/pocket.json");

/** Bundle the guest alone into the submodule's dist, under the manifest's
 *  output name: that is where the headless sim looks for a bundle it did not
 *  build itself, so this is what test/ipod-sim.test.ts needs. */
async function guest(): Promise<void> {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const plan = resolveIPodTouch4BuildPlan(manifest);
  mkdirSync(PLAN_DIR, { recursive: true });
  const planPath = resolve(PLAN_DIR, `${plan.app.output}.ipod.plan.json`);
  writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  await passThrough(
    $`bun tools/build.ts --plan=${planPath} --project-root=${ROOT} --outdir=${resolve(VENDOR, "dist")}`.cwd(VENDOR),
  );
  console.log(`pocket-shell: vendor/pocketjs/dist/${plan.app.output}.js`);
}

const argv = process.argv.slice(2);
const command = argv[0] ?? "help";

if (command === "guest") {
  await guest();
} else {
  await passThrough(
    $`bun tools/ipodtouch4.ts ${argv}`.cwd(VENDOR).env({
      ...process.env,
      POCKETJS_IPODTOUCH4_APP_FILE: DESCRIPTOR,
    }),
  );
}
