// Run PocketShell in a native window via the vendored uihost (the pocket3d
// workspace's wgpu shell): same bundle + pak as the PSP EBOOT, QuickJS guest,
// pocketjs-core, wgpu renderer.
//
//   bun scripts/desktop.ts                       # window, 2x scale
//   bun scripts/desktop.ts --screenshot out.png  # headless PNG (+ --frames N)
//
// uihost resolves dist/<app>.{js,pak} relative to the POCKETJS checkout by
// default, which is vendor/pocketjs here — so instead of copying artifacts
// in, this script passes our dist/main.js + dist/main.pak EXPLICITLY via
// uihost's --js/--pak flags (--app then only names the window title and the
// eval source label). Extra args are forwarded to uihost verbatim.
//
// Input map (from uihost): arrows = D-pad, Z/Enter = CROSS, A = SQUARE,
// S = TRIANGLE, Q/W = L/R triggers; analog nub I/K/J/L.

import { $ } from "bun";

const repo = new URL("..", import.meta.url).pathname;
const pocket3d = `${repo}vendor/pocketjs/pocket3d/`;

console.log("pocket-shell desktop: building the JS bundle");
await $`bun vendor/pocketjs/scripts/build.ts app/main.tsx --outdir=dist`.cwd(repo);

// uihost runs with pocket3d as cwd — resolve a relative --screenshot path
// against THIS repo so captures land here, not inside the submodule.
const extra = Bun.argv.slice(2);
const shotIdx = extra.indexOf("--screenshot");
if (shotIdx >= 0 && extra[shotIdx + 1] && !extra[shotIdx + 1].startsWith("/")) {
  extra[shotIdx + 1] = `${repo}${extra[shotIdx + 1]}`;
}
console.log("pocket-shell desktop: cargo run -p uihost");
await $`cargo run --release -p uihost -- --app pocket-shell --js ${repo}dist/main.js --pak ${repo}dist/main.pak ${extra}`.cwd(
  pocket3d,
);
