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

import { createCanvas, GlobalFonts, Path2D } from "@napi-rs/canvas";
import { existsSync, mkdirSync } from "node:fs";

const repo = new URL("..", import.meta.url).pathname;

// The ext badge renders in the era font (sheru's text shape asks for the
// Tahoma stack); registered from the system like tools/bake-fonts.ts.
const TAHOMA_BOLD = "/System/Library/Fonts/Supplemental/Tahoma Bold.ttf";
const BADGE_FONT = existsSync(TAHOMA_BOLD) && GlobalFonts.registerFromPath(TAHOMA_BOLD, "ShellTahomaBold")
  ? "ShellTahomaBold"
  : "sans-serif";

const CANVAS_W = 16;
const CANVAS_H = 8;

interface GlyphShape {
  kind: "rect" | "pixels" | "path" | "text";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
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
  // text (the ext badge): sheru renders source:"ext-upper" via the theme
  // font stack; maxChars caps the stamp.
  source?: string;
  maxChars?: number;
  fontSize?: number;
  fontWeight?: string;
  textAnchor?: string;
}

interface Glyph {
  viewBox: [number, number, number, number];
  shapes: GlyphShape[];
}

function resolveFill(fill: string | undefined, currentColor: string): string {
  if (!fill || fill === "currentColor") return currentColor;
  return fill;
}

/** Draw a glyph onto a wOut x hOut canvas, scaling the viewBox to fit
 *  (centered, floor offsets). crispEdges control glyphs draw 1:1 on the
 *  integer grid; file icons downscale 32→16 with canvas AA, matching how
 *  the webview scales the same SVG. `text` shapes (ext badges) are an M3
 *  item and skipped. */
function rasterize(
  glyph: Glyph,
  currentColor: string,
  wOut: number,
  hOut: number,
  ext?: string,
): Buffer {
  const [, , vw, vh] = glyph.viewBox;
  const scale = Math.min(wOut / vw, hOut / vh, 1);
  const ox = Math.floor((wOut - vw * scale) / 2);
  const oy = Math.floor((hOut - vh * scale) / 2);
  const canvas = createCanvas(wOut, hOut);
  const ctx = canvas.getContext("2d");
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  for (const shape of glyph.shapes) {
    if (shape.kind === "text") {
      if (shape.source !== "ext-upper" || !ext) continue;
      const stamp = ext.toUpperCase().slice(0, shape.maxChars ?? 4);
      ctx.fillStyle = resolveFill(shape.fill, currentColor);
      ctx.font = `${shape.fontWeight === "bold" ? "bold " : ""}${shape.fontSize ?? 6}px ${BADGE_FONT}`;
      ctx.textAlign = shape.textAnchor === "middle" ? "center" : "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(stamp, shape.x ?? 0, shape.y ?? 0);
      continue;
    }
    ctx.fillStyle = resolveFill(shape.fill, currentColor);
    if (shape.kind === "rect") {
      ctx.fillRect(shape.x ?? 0, shape.y ?? 0, shape.width ?? 0, shape.height ?? 0);
    } else if (shape.kind === "pixels") {
      for (const [x, y] of shape.origins ?? []) {
        ctx.fillRect(x, y, shape.width ?? 1, shape.height ?? 1);
      }
    } else if (shape.kind === "path") {
      const path = new Path2D(shape.d ?? "");
      if (shape.fill !== "none") {
        ctx.fill(path, shape.fillRule === "evenodd" ? "evenodd" : "nonzero");
      }
      if (shape.stroke) {
        ctx.strokeStyle = resolveFill(shape.stroke, currentColor);
        ctx.lineWidth = shape.strokeWidth ?? 1;
        ctx.stroke(path);
      }
    } else {
      throw new Error(`unsupported glyph shape kind ${(shape as { kind: string }).kind}`);
    }
  }
  return canvas.toBuffer("image/png");
}

const THEME_IDS = ["win98"] as const;
mkdirSync(`${repo}app/glyphs`, { recursive: true });

// Sort-order arrow for the pressed header column (macOS Tahoma has no
// U+25B2, so the header composes "Name" + this baked triangle instead).
{
  const c = createCanvas(8, 8);
  const x = c.getContext("2d");
  x.fillStyle = "#000000";
  const tri = new Path2D("M1 6 L7 6 L4 2 Z");
  x.fill(tri);
  await Bun.write(`${repo}app/glyphs/sort-asc.png`, c.toBuffer("image/png"));
  console.log("glyph: app/glyphs/sort-asc.png (8x8)");
}

for (const id of THEME_IDS) {
  const snap = await Bun.file(`${repo}themes-src/sheru/${id}.json`).json();
  const tokens: Record<string, string> = snap.theme.tokens;
  const controlFg = tokens["--control-fg"]?.startsWith("var(")
    ? tokens[tokens["--control-fg"].slice(4, -1)]
    : (tokens["--control-fg"] ?? "#000000");
  const glyphs = snap.theme.chrome.controlGlyphs.glyphs as Record<string, Glyph>;
  for (const [name, glyph] of Object.entries(glyphs)) {
    const png = rasterize(glyph, controlFg, CANVAS_W, CANVAS_H);
    const path = `${repo}app/glyphs/${id}-${name}.png`;
    await Bun.write(path, png);
    console.log(`glyph: app/glyphs/${id}-${name}.png (${glyph.viewBox[2]}x${glyph.viewBox[3]} in ${CANVAS_W}x${CANVAS_H})`);
  }
  // File-manager artwork: the theme's folder/file icons at list size (16x16
  // pow2 — the webview renders the same 32x32 SVGs at 16px). The file icon
  // additionally bakes one variant per KNOWN extension so the ext-upper
  // badge (sheru's `text` glyph shape) renders in the era font; unknown
  // extensions fall back to the plain file icon.
  const icons = snap.theme.iconGlyphs as Record<string, Glyph>;
  const EXTS = ["md", "png", "pbp", "xlsx", "txt", "pdf", "json"];
  for (const [name, glyph] of Object.entries(icons)) {
    const png = rasterize(glyph, tokens["--fg"] ?? "#000000", 16, 16);
    const path = `${repo}app/glyphs/${id}-icon-${name}.png`;
    await Bun.write(path, png);
    console.log(`glyph: app/glyphs/${id}-icon-${name}.png (${glyph.viewBox[2]}x${glyph.viewBox[3]} -> 16x16)`);
    if (name === "file") {
      for (const ext of EXTS) {
        const badged = rasterize(glyph, tokens["--fg"] ?? "#000000", 16, 16, ext);
        await Bun.write(`${repo}app/glyphs/${id}-icon-file-${ext}.png`, badged);
      }
      console.log(`glyph: app/glyphs/${id}-icon-file-{${EXTS.join(",")}}.png (ext badges)`);
    }
  }
}
