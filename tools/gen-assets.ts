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

// The ext badge renders in the vendored era font (W95FA, same source as
// tools/bake-fonts.ts).
const W95FA_PATH = new URL("../assets/fonts/W95FA/W95FA.otf", import.meta.url).pathname;
const BADGE_FONT = existsSync(W95FA_PATH) && GlobalFonts.registerFromPath(W95FA_PATH, "ShellW95FA")
  ? "ShellW95FA"
  : "sans-serif";

const CANVAS_W = 16;
const CANVAS_H = 16;

interface GlyphShape {
  kind: "rect" | "pixels" | "path" | "text" | "line";
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
  strokeLinecap?: string;
  // line
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
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
  defs?: GradientDef[];
}

interface GradientDef {
  id: string;
  kind: string;
  x1: number; y1: number; x2: number; y2: number;
  stops: Array<{ offset: number; color: string }>;
}

function resolveFill(
  fill: string | undefined,
  currentColor: string,
  ctx?: import("@napi-rs/canvas").SKRSContext2D,
  defs?: GradientDef[],
  bounds?: [number, number, number, number],
): string | CanvasGradient {
  if (!fill || fill === "currentColor") return currentColor;
  const rgba = /^rgba:([\d.]+),([\d.]+),([\d.]+),([\d.]+)$/.exec(fill);
  if (rgba) return `rgba(${rgba[1]},${rgba[2]},${rgba[3]},${rgba[4]})`;
  const url = /^url:#(.+)$/.exec(fill);
  if (url && ctx && defs && bounds) {
    const def = defs.find((d) => d.id === url[1]);
    if (def) {
      const [bx, by, bw, bh] = bounds;
      const lg = ctx.createLinearGradient(
        bx + def.x1 * bw, by + def.y1 * bh, bx + def.x2 * bw, by + def.y2 * bh,
      );
      for (const s of def.stops) lg.addColorStop(s.offset, s.color);
      return lg;
    }
  }
  if (url) return "#888888"; // unresolvable gradient ref: neutral fill
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
  defs?: GradientDef[],
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
      ctx.fillStyle = resolveFill(shape.fill, currentColor, ctx, defs ?? glyph.defs, [0, 0, vw, vh]) as string;
      ctx.font = `${shape.fontWeight === "bold" ? "bold " : ""}${shape.fontSize ?? 6}px ${BADGE_FONT}`;
      ctx.textAlign = shape.textAnchor === "middle" ? "center" : "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(stamp, shape.x ?? 0, shape.y ?? 0);
      continue;
    }
    ctx.fillStyle = resolveFill(shape.fill, currentColor, ctx, defs ?? glyph.defs, [0, 0, vw, vh]) as string;
    if (shape.kind === "rect") {
      ctx.fillRect(shape.x ?? 0, shape.y ?? 0, shape.width ?? 0, shape.height ?? 0);
    } else if (shape.kind === "pixels") {
      for (const [x, y] of shape.origins ?? []) {
        ctx.fillRect(x, y, shape.width ?? 1, shape.height ?? 1);
      }
    } else if (shape.kind === "path") {
      const path = new Path2D(shape.d ?? "");
      if (shape.fill !== "none" && (shape.fill || !shape.stroke)) {
        ctx.fill(path, shape.fillRule === "evenodd" ? "evenodd" : "nonzero");
      }
      if (shape.stroke) {
        ctx.strokeStyle = resolveFill(shape.stroke, currentColor, ctx, defs ?? glyph.defs, [0, 0, vw, vh]) as string;
        ctx.lineWidth = shape.strokeWidth ?? 1;
        ctx.lineCap = (shape.strokeLinecap as CanvasLineCap) ?? "butt";
        ctx.stroke(path);
      }
    } else if (shape.kind === "line") {
      ctx.strokeStyle = resolveFill(shape.stroke, currentColor, ctx, defs ?? glyph.defs, [0, 0, vw, vh]) as string;
      ctx.lineWidth = shape.strokeWidth ?? 1;
      ctx.beginPath();
      ctx.moveTo(shape.x1 ?? 0, shape.y1 ?? 0);
      ctx.lineTo(shape.x2 ?? 0, shape.y2 ?? 0);
      ctx.stroke();
    } else {
      throw new Error(`unsupported glyph shape kind ${(shape as { kind: string }).kind}`);
    }
  }
  return canvas.toBuffer("image/png");
}

const THEME_IDS = ["win98", "winxp", "win7", "aqua", "xfce"] as const;
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
  const icons = snap.theme.iconGlyphs as Record<string, Glyph> & { defs?: GradientDef[] };
  const iconDefs = (icons as { defs?: GradientDef[] }).defs;
  const EXTS = ["md", "png", "pbp", "xlsx", "txt", "pdf", "json"];
  for (const [name, entry] of Object.entries(icons)) {
    if (!entry || !Array.isArray((entry as Glyph).viewBox)) continue; // defs etc.
    const glyph = entry as Glyph;
    const png = rasterize(glyph, tokens["--fg"] ?? "#000000", 16, 16, undefined, iconDefs);
    const path = `${repo}app/glyphs/${id}-icon-${name}.png`;
    await Bun.write(path, png);
    console.log(`glyph: app/glyphs/${id}-icon-${name}.png (${glyph.viewBox[2]}x${glyph.viewBox[3]} -> 16x16)`);
    if (name === "file") {
      for (const ext of EXTS) {
        const badged = rasterize(glyph, tokens["--fg"] ?? "#000000", 16, 16, ext, iconDefs);
        await Bun.write(`${repo}app/glyphs/${id}-icon-file-${ext}.png`, badged);
      }
      console.log(`glyph: app/glyphs/${id}-icon-file-{${EXTS.join(",")}}.png (ext badges)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Gradient strips (themes-src/strips.json, written by the cooker): bake each
// multi-stop / alpha / non-axis gradient into a 1xS (vertical) or Sx1
// (horizontal) RGBA PNG, S = pow2 >= extent, rendered by <Strip> as an
// absolute underlay. Angles other than 0/90/180/270 approximate to vertical
// (paint specs cite each case).
// ---------------------------------------------------------------------------

interface GradStop {
  rgba: [number, number, number, number];
  /** 0..1 or null (distribute per CSS rules). */
  pos: number | null;
}

function parseColor(c: string): [number, number, number, number] {
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(c);
  if (rgba) return [+rgba[1], +rgba[2], +rgba[3], Math.round(+(rgba[4] ?? 1) * 255)];
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(c);
  if (!m) throw new Error(`strip: bad color "${c}"`);
  let h = m[1];
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255,
  ];
}

function parseStrip(css: string, extent: number): { stops: GradStop[]; horizontal: boolean; reverse: boolean } {
  const m = /^linear-gradient\(\s*(?:(\d+(?:\.\d+)?)deg\s*,|to\s+(top|bottom|left|right)\s*,)?([^]*)\)$/.exec(css.trim());
  if (!m) throw new Error(`strip: unsupported gradient "${css}"`);
  const KEYWORD: Record<string, number> = { top: 0, bottom: 180, left: 270, right: 90 };
  const angle = m[1] !== undefined ? Number(m[1]) % 360 : m[2] !== undefined ? KEYWORD[m[2]] : 180;
  const horizontal = angle === 90 || angle === 270;
  const reverse = angle === 0 || angle === 270;
  const stops: GradStop[] = m[3]
    .split(/,(?![^(]*\))/)
    .map((s) => s.trim())
    .map((s) => {
      const parts = s.split(/\s+(?![^(]*\))/);
      const rgba = parseColor(parts[0]);
      let pos: number | null = null;
      if (parts[1]) {
        const pct = /^([\d.]+)%$/.exec(parts[1]);
        const pxv = /^([\d.]+)px$/.exec(parts[1]);
        pos = pct ? Number(pct[1]) / 100 : pxv ? Number(pxv[1]) / extent : null;
      }
      return { rgba, pos };
    });
  if (stops.length < 2) throw new Error(`strip: needs >= 2 stops "${css}"`);
  if (stops[0].pos === null) stops[0].pos = 0;
  if (stops[stops.length - 1].pos === null) stops[stops.length - 1].pos = 1;
  // distribute unpositioned stops between positioned neighbors
  for (let i = 1; i < stops.length - 1; i++) {
    if (stops[i].pos !== null) continue;
    let j = i;
    while (stops[j].pos === null) j++;
    const from = stops[i - 1].pos!;
    const to = stops[j].pos!;
    const span = j - (i - 1);
    for (let k = i; k < j; k++) stops[k].pos = from + ((to - from) * (k - (i - 1))) / span;
  }
  return { stops, horizontal, reverse };
}

function sampleGradient(stops: GradStop[], t: number): [number, number, number, number] {
  if (t <= stops[0].pos!) return stops[0].rgba;
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i].pos!) {
      const a = stops[i - 1];
      const b = stops[i];
      const span = b.pos! - a.pos!;
      const f = span <= 0 ? 1 : (t - a.pos!) / span;
      return [0, 1, 2, 3].map((c) => Math.round(a.rgba[c] + (b.rgba[c] - a.rgba[c]) * f)) as [number, number, number, number];
    }
  }
  return stops[stops.length - 1].rgba;
}

const pow2 = (n: number) => { let p = 1; while (p < n) p *= 2; return p; };
const stripManifestPath = `${repo}themes-src/strips.json`;
if (existsSync(stripManifestPath)) {
  const requests = (await Bun.file(stripManifestPath).json()) as Array<{ file: string; css: string; extent: number }>;
  mkdirSync(`${repo}app/strips`, { recursive: true });
  for (const req of requests) {
    const { stops, horizontal, reverse } = parseStrip(req.css, req.extent);
    const S = Math.min(512, pow2(Math.max(8, req.extent)));
    // REAL-GE CONSTRAINT: texture rows must span >= 16 bytes (4 px @8888) —
    // 1px-wide strips render on every emulator and BLANK on hardware.
    const THIN = 4;
    const w = horizontal ? S : THIN;
    const h = horizontal ? THIN : S;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < S; i++) {
      let t = i / (S - 1);
      if (reverse) t = 1 - t;
      const [r, g2, b, a] = sampleGradient(stops, t);
      for (let k = 0; k < THIN; k++) {
        const o = horizontal ? (k * S + i) * 4 : (i * THIN + k) * 4;
        img.data[o] = r;
        img.data[o + 1] = g2;
        img.data[o + 2] = b;
        img.data[o + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    await Bun.write(`${repo}app/${req.file}`, canvas.toBuffer("image/png"));
  }
  console.log(`strips: ${requests.length} baked -> app/strips/`);
}

// ---------------------------------------------------------------------------
// Gel control faces: aqua traffic lights + winxp Luna caption buttons are
// layered radial/linear CSS the strip pipeline can't express — canvas CAN
// (createRadialGradient), so bake full-fidelity faces and overlay the theme's
// symbol glyph where the reference shows one (winxp white glyphs; aqua shows
// bare gels at rest). Values quoted from the theme tokens (see snapshots).
// ---------------------------------------------------------------------------
{
  const gelCircle = (base: [string, string], glowRGB: string) => {
    const c = createCanvas(16, 16);
    const ctx = c.getContext("2d");
    const cx = 8, cy = 8, r = 6.5;
    // base linear
    const lg = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    lg.addColorStop(0, base[0]);
    lg.addColorStop(1, base[1]);
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // bottom glow
    const bg = ctx.createRadialGradient(cx, cy + r, 0, cx, cy + r, r * 1.2);
    bg.addColorStop(0, glowRGB);
    bg.addColorStop(0.6, "rgba(255,255,255,0)");
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 16, 16);
    // top highlight
    const hl = ctx.createRadialGradient(cx, cy - r * 0.64, 0, cx, cy - r * 0.64, r);
    hl.addColorStop(0, "rgba(255,255,255,0.95)");
    hl.addColorStop(0.3, "rgba(255,255,255,0.3)");
    hl.addColorStop(0.48, "rgba(255,255,255,0)");
    ctx.fillStyle = hl;
    ctx.fillRect(0, 0, 16, 16);
    ctx.restore();
    // rim
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    return c.toBuffer("image/png");
  };
  // --x-aqua-gel-* tokens (see themes-src/sheru/aqua.json)
  await Bun.write(`${repo}app/glyphs/aqua-close.png`, gelCircle(["#e8584b", "#b8241a"], "rgba(255,158,143,0.9)"));
  await Bun.write(`${repo}app/glyphs/aqua-minimize.png`, gelCircle(["#f6b620", "#cf8d12"], "rgba(255,235,160,0.9)"));
  await Bun.write(`${repo}app/glyphs/aqua-zoom.png`, gelCircle(["#4fc94f", "#1da522"], "rgba(190,245,170,0.9)"));
  console.log("glyph: aqua traffic-light gel faces (16x16)");

  // winxp Luna caption buttons: rounded-square gel + the theme's white
  // symbol glyph overlaid (--x-winxp-ctl-glass / -close linear layers +
  // the 30%/25% radial highlight + 1px --x-winxp-ctl-edge rim).
  const snap = await Bun.file(`${repo}themes-src/sheru/winxp.json`).json();
  const glyphs = snap.theme.chrome.controlGlyphs.glyphs as Record<string, Glyph>;
  const gelSquare = (stops: Array<[number, string]>, name: string) => {
    const c = createCanvas(16, 16);
    const ctx = c.getContext("2d");
    const r = 3;
    const path = new Path2D(`M${1 + r} 1 h${14 - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} v${14 - 2 * r} a${r} ${r} 0 0 1 -${r} ${r} h-${14 - 2 * r} a${r} ${r} 0 0 1 -${r} -${r} v-${14 - 2 * r} a${r} ${r} 0 0 1 ${r} -${r} Z`);
    const lg = ctx.createLinearGradient(0, 1, 0, 15);
    for (const [off, col] of stops) lg.addColorStop(off, col);
    ctx.fillStyle = lg;
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    const hl = ctx.createRadialGradient(16 * 0.3, 16 * 0.25, 0, 16 * 0.3, 16 * 0.25, 8);
    hl.addColorStop(0, "rgba(255,255,255,0.6)");
    hl.addColorStop(0.45, "rgba(255,255,255,0)");
    ctx.fillStyle = hl;
    ctx.fillRect(0, 0, 16, 16);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 1;
    ctx.stroke(path);
    // overlay the symbol glyph (white, crispEdges) centered
    const glyph = glyphs[name];
    if (glyph) {
      const [, , vw, vh] = glyph.viewBox;
      ctx.translate(Math.floor((16 - vw) / 2), Math.floor((16 - vh) / 2));
      for (const shape of glyph.shapes) {
        ctx.fillStyle = "#ffffff";
        if (shape.kind === "rect") ctx.fillRect(shape.x ?? 0, shape.y ?? 0, shape.width ?? 0, shape.height ?? 0);
        else if (shape.kind === "pixels") for (const [x, y] of shape.origins ?? []) ctx.fillRect(x, y, shape.width ?? 1, shape.height ?? 1);
        else if (shape.kind === "path") {
          const p = new Path2D(shape.d ?? "");
          if (shape.fill !== "none") ctx.fill(p, shape.fillRule === "evenodd" ? "evenodd" : "nonzero");
          if (shape.stroke) { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = shape.strokeWidth ?? 1; ctx.stroke(p); }
        } else if (shape.kind === "line") {
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = shape.strokeWidth ?? 1;
          ctx.beginPath(); ctx.moveTo(shape.x1 ?? 0, shape.y1 ?? 0); ctx.lineTo(shape.x2 ?? 0, shape.y2 ?? 0); ctx.stroke();
        }
      }
    }
    return c.toBuffer("image/png");
  };
  const GLASS: Array<[number, string]> = [[0, "#8db5f0"], [0.3, "#3f72dd"], [0.6, "#2152c5"], [0.85, "#2a5fd3"], [1, "#6390e0"]];
  const CLOSE: Array<[number, string]> = [[0, "#f0a08e"], [0.35, "#e35451"], [0.65, "#c93a35"], [0.85, "#b02822"], [1, "#d6705e"]];
  await Bun.write(`${repo}app/glyphs/winxp-minimize.png`, gelSquare(GLASS, "minimize"));
  await Bun.write(`${repo}app/glyphs/winxp-zoom.png`, gelSquare(GLASS, "zoom"));
  await Bun.write(`${repo}app/glyphs/winxp-close.png`, gelSquare(CLOSE, "close"));
  console.log("glyph: winxp Luna gel caption buttons (16x16)");
}
