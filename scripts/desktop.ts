// SPDX-License-Identifier: GPL-3.0-or-later
import { resolve } from "node:path";
import { ROOT } from "./paths.ts";

const directory = resolve(ROOT, "shells/desktop");
const manifest = await Bun.file(resolve(directory, "package.json")).json();
const [command, ...args] = process.argv.slice(2);
if (!command || command === "--help" || command === "help") {
  console.log("Usage: bun run desktop <command> [arguments]");
  console.log(Object.keys(manifest.scripts).join("  "));
} else if (!Object.hasOwn(manifest.scripts, command)) {
  console.error(`Unknown desktop command: ${command}`);
  process.exitCode = 1;
} else {
  const child = Bun.spawn([process.execPath, "run", command, ...args], {
    cwd: directory,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exitCode = await child.exited;
}
