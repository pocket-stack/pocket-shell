// SPDX-License-Identifier: GPL-3.0-or-later
// bun run film — the frame recorder: run a tape in the emulator, keep every
// frame of it, and turn named ranges into the animations the README shows.
//
//   bun run film                     # both tapes: stills + animations
//   bun run film --tape=pocket-shell # one tape
//   bun run film --only=layout       # one cut
//   bun run film --check             # byte-compare the pinned frames instead
//   bun run film --update            # rewrite those pinned frames
//
// Why this exists rather than a phone pointed at the console: the console's
// capture build dumps the PICA200 render target itself, one file per frame,
// indexed by the same counter that indexes the input tape. So a recording is
// a pure function of its tape — no capture card, no dropped frames, no rolling
// shutter, and the exact frames the tests compare are the frames the animation
// is made of.
//
// Requires Azahar and ffmpeg. The console binary is built first, which needs
// Docker for the devkitARM half of the toolchain.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodePNG } from "../vendor/pocketjs/tests/png.ts";
import { assertOneGesture, CUTS, STILLS, TAPES, type Cut } from "../film/tape.ts";
import {
  AUX_H,
  AUX_W,
  buildCapture,
  buildStamp,
  preflight,
  readFrame,
  runTape,
  STACK_H,
  STACK_W,
  stackFrame,
  TOP_H,
  TOP_W,
} from "./azahar.ts";
import { DIST_FILM, GOLDENS, MEDIA } from "./paths.ts";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const found = args.find((argument) => argument.startsWith(`--${name}=`));
  return found?.slice(name.length + 3);
};
const check = args.includes("--check");
const update = args.includes("--update");
const onlyTape = flag("tape");
const onlyCut = flag("only");

if (!Bun.which("ffmpeg") && !check) {
  console.error("ffmpeg not found (brew install ffmpeg) — it encodes the animations");
  process.exit(2);
}
preflight();

const tapes = TAPES.filter((tape) => !onlyTape || tape.name === onlyTape);
if (tapes.length === 0) {
  console.error(`no tape named ${JSON.stringify(onlyTape)}`);
  process.exit(2);
}

mkdirSync(MEDIA, { recursive: true });
mkdirSync(DIST_FILM, { recursive: true });

/** ffmpeg twice over one raw stream: a palette from the whole cut, then the
 *  GIF. One shared palette is what keeps a UI animation from banding, and
 *  `bayer` dithering keeps flat panels flat instead of speckled. */
async function encodeGif(stream: string, frameCount: number, cut: Cut, output: string): Promise<void> {
  const palette = resolve(DIST_FILM, `${cut.name}.palette.png`);
  const input = ["-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${STACK_W}x${STACK_H}`, "-r", String(cut.fps), "-i", stream];
  const runFfmpeg = async (argv: string[]): Promise<void> => {
    const result = Bun.spawnSync(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", ...argv], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode !== 0) throw new Error(`ffmpeg failed: ${result.stderr.toString().trim()}`);
  };
  await runFfmpeg([...input, "-vf", "palettegen=max_colors=128:stats_mode=full", palette]);
  await runFfmpeg([
    ...input,
    "-i", palette,
    "-lavfi", "paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle",
    "-loop", "0",
    output,
  ]);
  rmSync(palette, { force: true });
  const bytes = readFileSync(output).byteLength;
  console.log(`  ${cut.name}.gif  ${frameCount} frames, ${(bytes / 1024).toFixed(0)} KiB`);
}

let failures = 0;
let compared = 0;

for (const tape of tapes) {
  const frames = tape.frames;
  console.log(`\n## ${tape.name} — ${frames} frames`);
  const rom = await buildCapture(tape, frames);
  const dump = await runTape(rom);

  if (check || update) {
    // The pinned frames: what the tests compare, per surface, exactly as the
    // console read them back.
    mkdirSync(GOLDENS, { recursive: true });
    for (const frame of tape.capture) {
      const decoded = readFrame(dump, frame);
      for (const surface of [
        { name: "top", rgba: decoded.top, width: TOP_W, height: TOP_H },
        { name: "auxiliary", rgba: decoded.auxiliary, width: AUX_W, height: AUX_H },
      ] as const) {
        const label = surface.name === "top" ? `${tape.name}.${frame}` : `${tape.name}.${frame}.auxiliary`;
        const actual = encodePNG(Buffer.from(surface.rgba), surface.width, surface.height);
        const golden = resolve(GOLDENS, `${label}.png`);
        if (update) {
          writeFileSync(golden, actual);
          console.log(`  WROTE ${label}`);
          continue;
        }
        compared++;
        if (!existsSync(golden)) {
          console.error(`  FAIL ${label}: no golden (run with --update after review)`);
          failures++;
          continue;
        }
        if (!actual.equals(readFileSync(golden))) {
          const actualPath = resolve(DIST_FILM, `${label}.actual.png`);
          writeFileSync(actualPath, actual);
          const stamp = existsSync(resolve(GOLDENS, "AZAHAR-BUILD.txt"))
            ? readFileSync(resolve(GOLDENS, "AZAHAR-BUILD.txt"), "utf8").trim()
            : null;
          const drift = stamp && stamp !== buildStamp() ? ` — goldens came from ${stamp}, this run is ${buildStamp()}` : "";
          console.error(`  FAIL ${label}: bytes differ (see ${actualPath})${drift}`);
          failures++;
          continue;
        }
        console.log(`  PASS ${label}`);
      }
    }
    if (update) writeFileSync(resolve(GOLDENS, "AZAHAR-BUILD.txt"), `${buildStamp()}\n`);
    continue;
  }

  // Stills first: they are single frames of the same dump.
  for (const still of STILLS.filter((candidate) => candidate.tape === tape.name)) {
    const stacked = stackFrame(readFrame(dump, still.frame));
    writeFileSync(resolve(MEDIA, `${still.name}.png`), encodePNG(Buffer.from(stacked), STACK_W, STACK_H));
    console.log(`  ${still.name}.png  frame ${still.frame}`);
  }

  // Then the animations. Each cut becomes one raw stream of stacked frames
  // piped through ffmpeg; nothing is written as PNG in between.
  for (const cut of CUTS.filter((candidate) => candidate.tape === tape.name)) {
    if (onlyCut && cut.name !== onlyCut) continue;
    // One cut, one gesture — checked here as well as in test/tape.test.ts, so
    // a range that reaches into the next chord fails before it is recorded.
    assertOneGesture(cut, tape);
    const stream = resolve(DIST_FILM, `${cut.name}.rgba`);
    const file = Bun.file(stream).writer();
    let kept = 0;
    for (let index = cut.from; index <= cut.to; index += cut.step) {
      file.write(stackFrame(readFrame(dump, index)));
      kept++;
    }
    await file.end();
    await encodeGif(stream, kept, cut, resolve(MEDIA, `${cut.name}.gif`));
    if (!args.includes("--keep")) rmSync(stream, { force: true });
  }
}

if (check) {
  console.log(`\nfilm --check: ${compared - failures} passed, ${failures} failed (${buildStamp()})`);
  process.exit(failures ? 1 : 0);
}
console.log(`\nfilm: media/ written from ${tapes.map((tape) => tape.name).join(", ")} (${buildStamp()})`);
