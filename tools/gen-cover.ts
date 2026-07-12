// XMB cover art: art/ICON0.png (144x80) + art/PIC1.png (480x272), drawn
// with @napi-rs/canvas (no external tools) and copied into the PSP crate's
// assets/ (Psp.toml resolves paths relative to the crate dir). Deterministic:
// pure vector drawing, no timestamps.
//
//   bun tools/gen-cover.ts

import { createCanvas } from "@napi-rs/canvas";
import { mkdirSync } from "node:fs";

const repo = new URL("..", import.meta.url).pathname;

const TEAL = "#008080";
const SILVER = "#c0c0c0";
const NAVY0 = "#000080";
const NAVY1 = "#1084d0";

interface Ctx2D {
  fillStyle: unknown;
  fillRect(x: number, y: number, w: number, h: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): {
    addColorStop(pos: number, color: string): void;
  };
  font: string;
  textBaseline: string;
  fillText(text: string, x: number, y: number): void;
}

/** A tiny beveled Win98 window: silver body, navy caption, edge highlights. */
function drawWindow(ctx: Ctx2D, x: number, y: number, w: number, h: number, caption: number) {
  // double-ring bevel: white/black outer, light/dark inner
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = "#000000";
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillStyle = "#dfdfdf";
  ctx.fillRect(x + 1, y + 1, w - 2, 1);
  ctx.fillRect(x + 1, y + 1, 1, h - 2);
  ctx.fillStyle = "#808080";
  ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
  ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
  ctx.fillStyle = SILVER;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, NAVY0);
  grad.addColorStop(1, NAVY1);
  ctx.fillStyle = grad;
  ctx.fillRect(x + 3, y + 3, w - 6, caption);
  // window controls
  ctx.fillStyle = SILVER;
  const cw = Math.max(6, Math.floor(caption * 0.7));
  ctx.fillRect(x + w - 3 - cw - 2, y + 3 + Math.floor((caption - cw * 0.8) / 2), cw, Math.floor(cw * 0.8));
}

function drawCover(w: number, h: number, title: boolean): Buffer {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d") as unknown as Ctx2D;
  ctx.fillStyle = TEAL;
  ctx.fillRect(0, 0, w, h);
  // cascading windows
  const win = { w: Math.floor(w * 0.52), h: Math.floor(h * 0.52) };
  drawWindow(ctx, Math.floor(w * 0.1), Math.floor(h * 0.12), win.w, win.h, Math.floor(h * 0.08));
  drawWindow(ctx, Math.floor(w * 0.34), Math.floor(h * 0.32), win.w, win.h, Math.floor(h * 0.08));
  if (title) {
    ctx.font = `bold ${Math.floor(h * 0.1)}px sans-serif`;
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("PocketShell", Math.floor(w * 0.05), h - Math.floor(h * 0.05));
  }
  return canvas.toBuffer("image/png");
}

mkdirSync(`${repo}art`, { recursive: true });
mkdirSync(`${repo}crates/pocket-shell-psp/assets`, { recursive: true });

const icon0 = drawCover(144, 80, false);
const pic1 = drawCover(480, 272, true);
await Bun.write(`${repo}art/ICON0.png`, icon0);
await Bun.write(`${repo}art/PIC1.png`, pic1);
await Bun.write(`${repo}crates/pocket-shell-psp/assets/ICON0.png`, icon0);
await Bun.write(`${repo}crates/pocket-shell-psp/assets/PIC1.png`, pic1);
console.log("wrote art/ICON0.png, art/PIC1.png (+ crate assets copies)");
