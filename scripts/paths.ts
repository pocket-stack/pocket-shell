// SPDX-License-Identifier: GPL-3.0-or-later
// Where everything is. PocketJS enters as a submodule, so every path into the
// runtime — the toolchain, the golden harness, the spec — is relative to
// vendor/pocketjs and never to a globally installed package.

import { resolve } from "node:path";

export const ROOT = resolve(import.meta.dir, "..");
export const VENDOR = resolve(ROOT, "vendor/pocketjs");
