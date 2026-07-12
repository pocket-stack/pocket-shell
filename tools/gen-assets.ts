// Bake theme glyphs: declarative glyph JSON from the sheru snapshot →
// committed PNGs under app/glyphs/, picked up by the vendored build's
// normal image pipeline (pak textures must be pow2, so every glyph is
// drawn centered on a fixed 16x8 canvas; the transparent overflow is
// invisible over the control face).
//
// Supported shape kinds (the win98 set): rect, pixels, path (Path2D,
// evenodd honored). crispEdges glyphs are integer-grid rect/path fills, so
// canvas AA never fires. `currentColor` resolves to the part's fg.
//
//   bun tools/gen-assets.ts

import { createCanvas, Path2D } from "@napi-rs/canvas";
import { mkdirSync } from "node:fs";

const repo = new URL("..", import.meta.url).pathname;

const CANVAS_W = 16;
const CANVAS_H = 8;

interface GlyphShape {
  kind: "rect" | "pixels" | "path";
  fill?: string;
  // rect
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // pixels
  origins?: [number, number][];
  // path
  d?: string;
  fillRule?: "evenodd" | "nonzero";
}

interface Glyph {
  viewBox: [number, number, number, number];
  shapes: GlyphShape[];
}

function resolveFill(fill: string | undefined, currentColor: string): string {
  if (!fill || fill === "currentColor") return currentColor;
  return fill;
}

function rasterize(glyph: Glyph, currentColor: string): Buffer {
  const [, , vw, vh] = glyph.viewBox;
  if (vw > CANVAS_W || vh > CANVAS_H) {
    throw new Error(`glyph viewBox ${vw}x${vh} exceeds the ${CANVAS_W}x${CANVAS_H} canvas`);
  }
  const ox = Math.floor((CANVAS_W - vw) / 2);
  const oy = Math.floor((CANVAS_H - vh) / 2);
  const canvas = createCanvas(CANVAS_W, CANVAS_H);
  const ctx = canvas.getContext("2d");
  ctx.translate(ox, oy);
  for (const shape of glyph.shapes) {
    ctx.fillStyle = resolveFill(shape.fill, currentColor);
    if (shape.kind === "rect") {
      ctx.fillRect(shape.x ?? 0, shape.y ?? 0, shape.width ?? 0, shape.height ?? 0);
    } else if (shape.kind === "pixels") {
      for (const [x, y] of shape.origins ?? []) {
        ctx.fillRect(x, y, shape.width ?? 1, shape.height ?? 1);
      }
    } else if (shape.kind === "path") {
      ctx.fill(new Path2D(shape.d ?? ""), shape.fillRule === "evenodd" ? "evenodd" : "nonzero");
    } else {
      throw new Error(`unsupported glyph shape kind ${(shape as { kind: string }).kind}`);
    }
  }
  return canvas.toBuffer("image/png");
}

const THEME_IDS = ["win98"] as const;
mkdirSync(`${repo}app/glyphs`, { recursive: true });

for (const id of THEME_IDS) {
  const snap = await Bun.file(`${repo}themes-src/sheru/${id}.json`).json();
  const tokens: Record<string, string> = snap.theme.tokens;
  const controlFg = tokens["--control-fg"]?.startsWith("var(")
    ? tokens[tokens["--control-fg"].slice(4, -1)]
    : (tokens["--control-fg"] ?? "#000000");
  const glyphs = snap.theme.chrome.controlGlyphs.glyphs as Record<string, Glyph>;
  for (const [name, glyph] of Object.entries(glyphs)) {
    const png = rasterize(glyph, controlFg);
    const path = `${repo}app/glyphs/${id}-${name}.png`;
    await Bun.write(path, png);
    console.log(`glyph: app/glyphs/${id}-${name}.png (${glyph.viewBox[2]}x${glyph.viewBox[3]} in ${CANVAS_W}x${CANVAS_H})`);
  }
}
