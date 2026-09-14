// SPDX-License-Identifier: GPL-3.0-only
import { resolve } from "node:path";
import { ROOT } from "./system-plan.ts";

/** Rebuild from source on every invocation so stale local files cannot mask
 * missing assets or generator changes. Both densities are produced together. */
export async function prepareAssets(): Promise<void> {
  for (const generator of ["gen-icons.ts", "gen-assets.ts"]) {
    const child = Bun.spawn([
      process.execPath,
      resolve(ROOT, "src/system-ui", generator),
    ], { cwd: ROOT, stdout: "inherit", stderr: "inherit" });
    const code = await child.exited;
    if (code !== 0) throw new Error(`${generator} failed (${code})`);
  }
}

if (import.meta.main) await prepareAssets();
