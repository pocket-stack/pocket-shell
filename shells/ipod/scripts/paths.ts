// SPDX-License-Identifier: GPL-3.0-or-later
import { resolve } from "node:path";
import { ROOT as REPOSITORY, VENDOR } from "../../../scripts/paths.ts";

export { VENDOR };
export const ROOT = resolve(import.meta.dir, "..");
export const PLAN_DIR = resolve(REPOSITORY, ".pocket/plans/ipod");
