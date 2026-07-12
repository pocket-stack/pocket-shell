// Bake the era UI font for win98: W95FA (Alina Sava / FontsArena, SIL OFL
// 1.1 — vendored WITH its license under assets/fonts/W95FA/), an OpenType
// recreation of the Windows 95 bitmap MS Sans Serif. Its outlines sit on an
// 80-units/px design grid (unitsPerEm 1000, native size 12.5 px, cap height
// 9 px) with a 50-unit x phase and float noise; snapped to the grid, every
// stem is exactly one pixel and coverage is bi-level by construction.
//
// This baker builds the FONT ATLAS blob (spec.ts format) DIRECTLY: the
// vendored bake-font's scanline rasterizer uses even-odd filling, and
// W95FA composes glyphs from rectangles that SHARE EDGES — post-snap those
// coincident edges land exactly on sample lines and even-odd cancels whole
// strokes (that's how "h" lost its ascender). @napi-rs/canvas fills with
// the nonzero winding rule, which unions touching rectangles correctly.
//
// Bold: W95FA ships regular only; slot 7 is the classic GDI synthetic bold —
// smear each row one pixel right and add 1 px to every advance, exactly how
// Windows 98 embellished bitmap fonts.
//
// Atlases land in slots 0 (12px nominal, regular) and 7 (bold) as custom
// shell:font.* pak entries (the pak container rejects duplicate ui:font.*
// keys) and swap in at runtime right after mount() — see app/main.tsx.
//
//   bun tools/bake-fonts.ts

import { createCanvas } from "@napi-rs/canvas";
import { existsSync, mkdirSync } from "node:fs";
import { parse, type Font, type Glyph } from "opentype.js";
import {
  FONT_CMAP_ENTRY_SIZE,
  FONT_HEADER_SIZE,
  FONT_MAGIC,
  FONT_VERSION,
} from "../vendor/pocketjs/spec/spec.ts";

const repo = new URL("..", import.meta.url).pathname;
const W95FA = `${repo}assets/fonts/W95FA/W95FA.otf`;

const NATIVE_PX = 12.5; //  1000 upm / 80 units-per-pixel
const GRID = 80;
const X_PHASE = 50;
const SCALE = NATIVE_PX / 1000; // px per font unit (= 1/GRID)
const TOFU_CODEPOINT = 0xfffd;

if (!existsSync(W95FA)) {
  console.error("bake-fonts: assets/fonts/W95FA/W95FA.otf missing");
  process.exit(1);
}

const font: Font = parse(await Bun.file(W95FA).arrayBuffer());

// ---------------------------------------------------------------------------
// Grid snap (in font units, y-up): quantize away the float noise + x phase.
// ---------------------------------------------------------------------------
for (let i = 0; i < font.glyphs.length; i++) {
  const glyph = font.glyphs.get(i);
  for (const cmd of glyph.path?.commands ?? []) {
    const c = cmd as unknown as Record<string, number | undefined>;
    for (const k of ["x", "x1", "x2"]) {
      if (c[k] !== undefined) c[k] = Math.round((c[k]! - X_PHASE) / GRID) * GRID;
    }
    for (const k of ["y", "y1", "y2"]) {
      if (c[k] !== undefined) c[k] = Math.round(c[k]! / GRID) * GRID;
    }
  }
}

// ---------------------------------------------------------------------------
// Collect glyphs + integer metrics
// ---------------------------------------------------------------------------
interface Baked {
  cp: number;
  glyph: Glyph;
  advance: number;
  top: number; // px above baseline (ymax)
  bottom: number; // px below baseline (positive)
  width: number; // px ink width
}

const chars: number[] = [];
for (let c = 32; c <= 126; c++) chars.push(c);

const baked: Baked[] = [];
let maxTop = 0;
let maxBottom = 0;
let maxW = 0;
for (const cp of chars) {
  const glyph = font.charToGlyph(String.fromCodePoint(cp));
  if (cp !== 32 && (!glyph || glyph.index === 0)) continue;
  const bb = glyph.path?.getBoundingBox();
  const empty = !bb || (bb.x1 === 0 && bb.x2 === 0 && bb.y1 === 0 && bb.y2 === 0);
  const top = empty ? 0 : Math.max(0, Math.round(bb.y2 * SCALE));
  const bottom = empty ? 0 : Math.max(0, Math.round(-bb.y1 * SCALE));
  const width = empty ? 0 : Math.max(0, Math.round((bb.x2 - Math.min(0, bb.x1)) * SCALE));
  const advance = Math.max(1, Math.round((glyph.advanceWidth ?? 0) * SCALE));
  baked.push({ cp, glyph, advance, top, bottom, width });
  maxTop = Math.max(maxTop, top);
  maxBottom = Math.max(maxBottom, bottom);
  maxW = Math.max(maxW, width);
}

const baseline = maxTop; //            px from cell top to baseline
const cellH = maxTop + maxBottom + 1;
const cellW = maxW + 2; //             +1 ink safety +1 GDI bold smear room
const lineHeight = Math.round((font.ascender - font.descender) * SCALE);

// ---------------------------------------------------------------------------
// Rasterize each glyph cell via canvas (nonzero winding), threshold to
// bi-level. Path commands are emitted y-down by glyph.getPath().
// ---------------------------------------------------------------------------
function cellFor(glyph: Glyph): Uint8Array {
  const canvas = createCanvas(cellW, cellH);
  const ctx = canvas.getContext("2d");
  const path = glyph.getPath(0, baseline, NATIVE_PX);
  ctx.beginPath();
  for (const cmd of path.commands) {
    if (cmd.type === "M") ctx.moveTo(cmd.x, cmd.y);
    else if (cmd.type === "L") ctx.lineTo(cmd.x, cmd.y);
    else if (cmd.type === "C") ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
    else if (cmd.type === "Q") ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
    else if (cmd.type === "Z") ctx.closePath();
  }
  ctx.fillStyle = "#ffffff";
  ctx.fill("nonzero");
  const img = ctx.getImageData(0, 0, cellW, cellH).data;
  const out = new Uint8Array(cellW * cellH);
  for (let i = 0; i < out.length; i++) out[i] = img[i * 4 + 3] >= 128 ? 255 : 0;
  return out;
}

/** Hollow tofu box (spec: gid 0 MUST be the tofu). */
function tofuCell(): { cell: Uint8Array; advance: number } {
  const w = Math.max(4, Math.round(cellW * 0.6));
  const h = Math.max(5, baseline - 1);
  const cell = new Uint8Array(cellW * cellH);
  const y0 = baseline - h;
  for (let x = 0; x < w; x++) {
    cell[y0 * cellW + x] = 255;
    cell[(baseline - 1) * cellW + x] = 255;
  }
  for (let y = y0; y < baseline; y++) {
    cell[y * cellW] = 255;
    cell[y * cellW + w - 1] = 255;
  }
  return { cell, advance: w + 1 };
}

// ---------------------------------------------------------------------------
// Assemble the FONT ATLAS blob per spec.ts (header, sorted cmap, cells)
// ---------------------------------------------------------------------------
function assemble(slot: number, bold: boolean): Uint8Array {
  const glyphCount = baked.length + 1; // + tofu gid 0
  const cellBytes = cellW * cellH;
  const out = new Uint8Array(FONT_HEADER_SIZE + glyphCount * FONT_CMAP_ENTRY_SIZE + glyphCount * cellBytes);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, FONT_MAGIC, true);
  dv.setUint16(4, FONT_VERSION, true);
  dv.setUint16(6, glyphCount, true);
  out[8] = cellW;
  out[9] = cellH;
  out[10] = baseline;
  out[11] = lineHeight;
  out[12] = slot;
  out[13] = bold ? 1 : 0;

  const tofu = tofuCell();
  const entries = baked.map((b, i) => ({ cp: b.cp, gid: i + 1, advance: b.advance }));
  entries.push({ cp: TOFU_CODEPOINT, gid: 0, advance: tofu.advance });
  entries.sort((a, b) => a.cp - b.cp);

  const coverageOff = FONT_HEADER_SIZE + glyphCount * FONT_CMAP_ENTRY_SIZE;
  out.set(tofu.cell, coverageOff);
  baked.forEach((b, i) => out.set(cellFor(b.glyph), coverageOff + (i + 1) * cellBytes));

  if (bold) {
    // GDI synthetic bold: 1px horizontal smear per row, advance + 1.
    for (let g = 0; g < glyphCount; g++) {
      const base = coverageOff + g * cellBytes;
      for (let y = 0; y < cellH; y++) {
        const row = base + y * cellW;
        for (let x = cellW - 1; x >= 1; x--) {
          out[row + x] = Math.max(out[row + x], out[row + x - 1]);
        }
      }
    }
    for (const e of entries) e.advance = Math.min(255, e.advance + 1);
  }

  let o = FONT_HEADER_SIZE;
  for (const e of entries) {
    dv.setUint32(o, e.cp, true);
    dv.setUint16(o + 4, e.gid, true);
    out[o + 6] = e.advance;
    out[o + 7] = 0; // xoff: snapped outlines start at x >= 0
    o += FONT_CMAP_ENTRY_SIZE;
  }
  return out;
}

mkdirSync(`${repo}app/fonts`, { recursive: true });
const manifestPath = `${repo}app/pak.json`;
const manifest: Array<{ key: string; file: string }> = existsSync(manifestPath)
  ? await Bun.file(manifestPath).json()
  : [];

for (const slot of [0, 7]) {
  const bytes = assemble(slot, slot === 7);
  const file = `fonts/win98-font.${slot}.bin`;
  await Bun.write(`${repo}app/${file}`, bytes);
  const key = `shell:font.${slot}`;
  const existing = manifest.find((e) => e.key === key);
  if (existing) existing.file = file;
  else manifest.push({ key, file });
  console.log(
    `font: slot ${slot} W95FA@${NATIVE_PX}px${slot === 7 ? " +gdi-bold" : ""} ${baked.length + 1} glyphs, cell ${cellW}x${cellH}, baseline ${baseline}, ${bytes.length} bytes -> app/${file}`,
  );
}

await Bun.write(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`pak manifest: app/pak.json (${manifest.length} entries)`);
