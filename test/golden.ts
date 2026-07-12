// Deterministic PocketShell application goldens.
//
// Boots the real app bundle + pak against PocketJS's wasm core, drives the
// same button-mask/analog frame contract as the native hosts, and
// byte-compares the 480x272 logical framebuffer (the PSP presents it 1:1,
// so goldens are encoded at the logical size — no Vita 2x here).
//
//   bun run golden          # compare committed goldens
//   bun run golden:update   # regenerate, then inspect every PNG
//
// Scenes are button scripts shared with humans: each spec's input can be
// replayed by hand on desktop/hardware to see the same state.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createWasmUi } from "../vendor/pocketjs/host-web/wasm-ops.js";
import { BTN, SCREEN_H, SCREEN_W } from "../vendor/pocketjs/spec/spec.ts";
import { encodePNG } from "../vendor/pocketjs/test/png.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = `${ROOT}dist/`;
const WASM = `${ROOT}vendor/pocketjs/host-web/pocketjs.wasm`;
const GOLDENS = `${ROOT}test/goldens/`;
const UPDATE = process.env.UPDATE === "1";

const ANALOG_CENTER = 0x8080;

interface FrameInput {
  buttons?: number;
  analog?: number;
}

interface GoldenSpec {
  name: string;
  frames: number;
  input?: (frame: number) => FrameInput;
}

// M0: a single boot scene (the window is inert until M1's themed chrome +
// focusables land — the journey-differs cross-check below activates when a
// second, input-driven spec exists).
const SPECS: GoldenSpec[] = [
  {
    name: "boot",
    frames: 8,
  },
];

// Journeys that must produce different framebuffers (input-contract guard).
const JOURNEY_PAIRS: ReadonlyArray<readonly [string, string]> = [];

void BTN; // referenced by input scripts from M1 on

function run(command: string[]): void {
  const child = Bun.spawnSync(command, {
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (child.exitCode !== 0) {
    throw new Error(`command failed (${child.exitCode}): ${command.join(" ")}`);
  }
}

function ensureArtifacts(): void {
  // Always rebuild the application: silently testing a stale bundle is worse
  // than the few seconds this deterministic build costs.
  run(["bun", "run", "build"]);
  run(["bun", "vendor/pocketjs/scripts/wasm.ts"]);
}

function distinctPixels(rgba: Uint8Array): number {
  const seen = new Set<number>();
  const pixels = new Uint32Array(rgba.buffer, rgba.byteOffset, rgba.byteLength / 4);
  for (const pixel of pixels) {
    seen.add(pixel);
    if (seen.size > 16) break;
  }
  return seen.size;
}

async function render(
  spec: GoldenSpec,
  wasmBytes: ArrayBuffer,
  js: string,
  pak: ArrayBuffer,
): Promise<Uint8Array> {
  const wasm = await createWasmUi(wasmBytes);
  const globals = globalThis as Record<string, unknown>;
  globals.ui = wasm.ops;
  globals.__pak = pak;
  globals.frame = undefined;

  try {
    (0, eval)(js);
    const frame = globals.frame as ((buttons: number, analog?: number) => void) | undefined;
    if (typeof frame !== "function") {
      throw new Error("bundle did not install globalThis.frame");
    }
    for (let index = 0; index < spec.frames; index++) {
      const input = spec.input?.(index) ?? {};
      frame(input.buttons ?? 0, input.analog ?? ANALOG_CENTER);
      wasm.tick();
    }
    return wasm.render().slice();
  } finally {
    delete globals.ui;
    delete globals.__pak;
    globals.frame = undefined;
  }
}

ensureArtifacts();
mkdirSync(GOLDENS, { recursive: true });

const wasmBytes = await Bun.file(WASM).arrayBuffer();
const js = await Bun.file(`${DIST}main.js`).text();
const pak = await Bun.file(`${DIST}main.pak`).arrayBuffer();

let passed = 0;
let failed = 0;
const frames = new Map<string, Uint8Array>();

for (const spec of SPECS) {
  try {
    const rgba = await render(spec, wasmBytes, js, pak);
    frames.set(spec.name, rgba);
    const distinct = distinctPixels(rgba);
    if (distinct < 3) {
      throw new Error(`degenerate framebuffer (${distinct} distinct pixel values)`);
    }

    const png = encodePNG(rgba, SCREEN_W, SCREEN_H);
    const golden = `${GOLDENS}${spec.name}.png`;
    if (UPDATE) {
      writeFileSync(golden, png);
      console.log(`WROTE ${spec.name} (${SCREEN_W}x${SCREEN_H})`);
      passed++;
      continue;
    }
    if (!existsSync(golden)) {
      throw new Error("golden missing; run `bun run golden:update`");
    }
    const expected = readFileSync(golden);
    if (!expected.equals(png)) {
      writeFileSync(`${GOLDENS}${spec.name}.actual.png`, png);
      throw new Error(`PNG bytes differ (wrote ${spec.name}.actual.png)`);
    }
    console.log(`PASS  ${spec.name} (${SCREEN_W}x${SCREEN_H}, byte-exact)`);
    passed++;
  } catch (error) {
    console.error(`FAIL  ${spec.name}:`, error);
    failed++;
  }
}

for (const [baselineName, name] of JOURNEY_PAIRS) {
  const baseline = frames.get(baselineName);
  const candidate = frames.get(name);
  if (baseline && candidate && Buffer.from(baseline).equals(candidate)) {
    console.error(`FAIL  ${name}: controller journey did not change the ${baselineName} framebuffer`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
