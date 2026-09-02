// SPDX-License-Identifier: GPL-3.0-or-later
// A delegated command's own message is the useful one. Bun's `$` throws a
// ShellError whose stack trace buries it under this script's frames, so
// failures are passed through as an exit code instead.

export async function passThrough<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    const code = (error as { exitCode?: number }).exitCode;
    process.exit(typeof code === "number" && code !== 0 ? code : 1);
  }
}

/** Copy the per-checkout device keys into the place the vendored dev tool
 *  looks. They live here because a re-clone of the submodule loses them. */
export async function plantDeviceKeys(): Promise<void> {
  const { copyFileSync, existsSync, mkdirSync, readdirSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const { ROOT, VENDOR } = await import("./paths.ts");
  const keys = resolve(ROOT, ".pocket/devices");
  if (!existsSync(keys)) return;
  const vendorKeys = resolve(VENDOR, ".pocket/3ds/devices");
  mkdirSync(vendorKeys, { recursive: true });
  for (const name of readdirSync(keys).filter((entry) => entry.endsWith(".key"))) {
    copyFileSync(resolve(keys, name), resolve(vendorKeys, name));
  }
}
