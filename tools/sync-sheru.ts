// Snapshot sheru theme data verbatim into themes-src/sheru/<id>.json.
//
// sheru themes are pure JSON-serializable data (tokens + chrome + glyph
// geometry + a scoped-CSS string); the theme modules import only TYPES from
// @sheru-app/ui, so Bun can import them straight from the sheru checkout
// without workspace resolution. The snapshot pins values + provenance; the
// per-part paint rules live in themes-src/paint/* (hand-translated from each
// theme's css.ts) and reference these tokens by name.
//
//   bun tools/sync-sheru.ts            # all themes below
//   SHERU_DIR=~/somewhere bun tools/sync-sheru.ts
//
// Re-run + `bun run cook` to pull upstream theme changes; the .json diff is
// the human-reviewable upstream delta.

import { $ } from "bun";
import { mkdirSync } from "node:fs";

const repo = new URL("..", import.meta.url).pathname;
const sheruDir = (process.env.SHERU_DIR ?? `${process.env.HOME}/code/sheru`).replace(/\/$/, "");

// M1: win98. Append ids as their paint specs land (xp, win7, aqua, xfce).
const THEME_IDS = ["win98", "winxp", "win7", "aqua", "xfce"] as const;

const commit = (await $`git -C ${sheruDir} rev-parse HEAD`.text()).trim();
const dirty = (await $`git -C ${sheruDir} status --porcelain`.text()).trim().length > 0;

mkdirSync(`${repo}themes-src/sheru`, { recursive: true });

for (const id of THEME_IDS) {
  const mod = await import(`${sheruDir}/packages/themes/src/${id}/index.ts`);
  const theme = mod[id];
  if (!theme || theme.id !== id) {
    throw new Error(`sheru theme module ${id} did not export const ${id}`);
  }
  const snapshot = {
    provenance: {
      repo: "https://github.com/doodlewind/sheru",
      commit,
      dirty,
      module: `packages/themes/src/${id}/index.ts`,
    },
    theme, // tokens, stylesheet (reference only), chrome, iconGlyphs — verbatim
  };
  const path = `${repo}themes-src/sheru/${id}.json`;
  await Bun.write(path, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`wrote themes-src/sheru/${id}.json (sheru ${commit.slice(0, 12)}${dirty ? " +dirty" : ""})`);
}
