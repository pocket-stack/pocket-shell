// SPDX-License-Identifier: GPL-3.0-or-later
// Where everything is. PocketJS enters as a submodule, so every path into the
// runtime — the toolchain, the golden harness, the spec — is relative to
// vendor/pocketjs and never to a globally installed package.

import { resolve } from "node:path";

export const ROOT = resolve(import.meta.dir, "..");
export const VENDOR = resolve(ROOT, "vendor/pocketjs");
export const DIST = resolve(ROOT, "dist");
/** The .3dsx, the .pocket guest package and the resolved plans land here. */
export const DIST_3DS = resolve(DIST, "3ds");
/** Frame dumps, the film's intermediate stream and its animations. */
export const DIST_FILM = resolve(DIST, "film");
export const PLAN_DIR = resolve(ROOT, ".pocket/plans");
/** Committed media the README points at. */
export const MEDIA = resolve(ROOT, "media");
export const GOLDENS = resolve(ROOT, "test/goldens/3ds");
