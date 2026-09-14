// SPDX-License-Identifier: GPL-3.0-or-later
import { resolve } from "node:path";
import { ROOT, VENDOR } from "../../../scripts/paths.ts";

export { ROOT, VENDOR };
export const PROJECT_ROOT = resolve(import.meta.dir, "..");
// Keep existing console outputs and pairing keys at the repository root.
export const DIST_3DS = resolve(ROOT, "dist/3ds");
export const DIST_FILM = resolve(ROOT, "dist/film/3ds");
export const PLAN_DIR = resolve(ROOT, ".pocket/plans/3ds");
export const MEDIA = resolve(PROJECT_ROOT, "media");
export const GOLDENS = resolve(PROJECT_ROOT, "test/goldens/3ds");
