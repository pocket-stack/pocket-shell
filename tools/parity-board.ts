// The parity board: sheru reference | PocketShell frame | diff | RMSE,
// per (theme x scene). The instrument that keeps "webview feature parity"
// honest — RMSE per scene is recorded into docs/parity/history.json and is
// expected to fall as milestones land (fonts/AA differ by construction, so
// there is no hard threshold; regressions against the last run fail).
//
// Golden frames are cropped to the WINDOW rect (the PSP renders an inset
// window on a desktop; the reference IS the window). RMSE is computed over
// each scene's declared region (M1: the chrome strip — the body is empty
// until M2).
//
//   bun tools/parity-board.ts            # compare + regenerate board
//   ALLOW_REGRESS=1 bun tools/parity-board.ts   # record even if RMSE rose

import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { SCENES, WINDOW_RECT } from "../app/scenes.ts";

const repo = new URL("..", import.meta.url).pathname;
const THEME_IDS = ["win98", "winxp", "win7", "aqua", "xfce"] as const;
const PARITY = `${repo}docs/parity/`;

interface SceneResult {
  scene: string;
  ref: string;
  rmse: number;
  region: [number, number, number, number];
}

async function imageData(path: string, crop?: readonly [number, number, number, number]) {
  const img = await loadImage(path);
  const [x, y, w, h] = crop ?? [0, 0, img.width, img.height];
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
  return { ctx, canvas, data: ctx.getImageData(0, 0, w, h), w, h };
}

function rmseIn(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  w: number,
  region: [number, number, number, number],
): number {
  const [rx, ry, rw, rh] = region;
  let sum = 0;
  let n = 0;
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const d = a[i + c] - b[i + c];
        sum += d * d;
        n++;
      }
    }
  }
  return Math.sqrt(sum / n);
}

function diffImage(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  w: number,
  h: number,
  region: [number, number, number, number],
): Buffer {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d") as SKRSContext2D;
  const out = ctx.createImageData(w, h);
  const [rx, ry, rw, rh] = region;
  for (let i = 0; i < w * h; i++) {
    const px = i % w;
    const py = (i / w) | 0;
    const inRegion = px >= rx && px < rx + rw && py >= ry && py < ry + rh;
    const d = Math.min(
      255,
      (Math.abs(a[i * 4] - b[i * 4]) +
        Math.abs(a[i * 4 + 1] - b[i * 4 + 1]) +
        Math.abs(a[i * 4 + 2] - b[i * 4 + 2])) * 2,
    );
    out.data[i * 4] = d;
    out.data[i * 4 + 1] = inRegion ? 0 : Math.min(64, d);
    out.data[i * 4 + 2] = inRegion ? 0 : Math.min(64, d);
    out.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return canvas.toBuffer("image/png");
}

const results: Record<string, SceneResult[]> = {};
let failed = false;

for (const id of THEME_IDS) {
  await mkdir(`${PARITY}shots/${id}`, { recursive: true });
  await mkdir(`${PARITY}diff/${id}`, { recursive: true });
  results[id] = [];
}
{
  for (const scene of SCENES) {
    const id = scene.theme ?? "win98";
    const refPath = `${PARITY}ref/${id}/${scene.refName ?? scene.name}.png`;
    const goldenPath = `${repo}test/goldens/${scene.name}.png`;
    if (!existsSync(refPath) || !existsSync(goldenPath)) {
      console.error(`parity ${id}/${scene.name}: missing ${!existsSync(refPath) ? refPath : goldenPath}`);
      failed = true;
      continue;
    }
    const ref = await imageData(refPath);
    const shot = await imageData(goldenPath, WINDOW_RECT);
    if (ref.w !== shot.w || ref.h !== shot.h) {
      console.error(`parity ${id}/${scene.name}: size mismatch ref ${ref.w}x${ref.h} vs shot ${shot.w}x${shot.h}`);
      failed = true;
      continue;
    }
    await Bun.write(`${PARITY}shots/${id}/${scene.name}.png`, shot.canvas.toBuffer("image/png"));
    const rmse = rmseIn(ref.data.data, shot.data.data, ref.w, scene.region);
    await Bun.write(
      `${PARITY}diff/${id}/${scene.name}.png`,
      diffImage(ref.data.data, shot.data.data, ref.w, ref.h, scene.region),
    );
    results[id].push({ scene: scene.name, ref: scene.refName ?? scene.name, rmse: Math.round(rmse * 100) / 100, region: scene.region });
    console.log(`parity ${id}/${scene.name}: RMSE ${rmse.toFixed(2)} over [${scene.region.join(",")}]`);
  }
}

// ---- history: append + regression check -------------------------------------

interface HistoryEntry {
  date: string;
  milestone: string;
  results: Record<string, SceneResult[]>;
}

const historyPath = `${PARITY}history.json`;
const history: HistoryEntry[] = existsSync(historyPath) ? await Bun.file(historyPath).json() : [];
const last = history.at(-1);
if (last && !process.env.ALLOW_REGRESS) {
  for (const id of THEME_IDS) {
    for (const r of results[id] ?? []) {
      const prev = last.results[id]?.find((p) => p.scene === r.scene);
      if (prev && r.rmse > prev.rmse + 0.01) {
        console.error(`parity REGRESSION ${id}/${r.scene}: RMSE ${prev.rmse} -> ${r.rmse}`);
        failed = true;
      }
    }
  }
}
if (!failed) {
  history.push({
    date: new Date().toISOString().slice(0, 10),
    milestone: process.env.MILESTONE ?? "dev",
    results,
  });
  await Bun.write(historyPath, JSON.stringify(history, null, 2) + "\n");
}

// ---- board html --------------------------------------------------------------

const rows = THEME_IDS.flatMap((id) =>
  (results[id] ?? []).map(
    (r) => `
    <tr>
      <td><code>${id}</code></td>
      <td><code>${r.scene}</code></td>
      <td><img src="ref/${id}/${r.ref}.png" width="464"></td>
      <td><img src="shots/${id}/${r.scene}.png" width="464"></td>
      <td><img src="diff/${id}/${r.scene}.png" width="464"></td>
      <td class="rmse">${r.rmse.toFixed(2)}</td>
    </tr>`,
  ),
);

const html = `<!doctype html>
<meta charset="utf-8">
<title>PocketShell parity board</title>
<style>
  body { font: 13px ui-monospace, monospace; background: #101014; color: #ddd; margin: 24px; }
  table { border-collapse: collapse; }
  td, th { border: 1px solid #333; padding: 6px 8px; vertical-align: top; }
  img { display: block; image-rendering: pixelated; }
  .rmse { font-size: 18px; text-align: right; }
  caption { text-align: left; padding: 8px 0 12px; }
</style>
<table>
  <caption>sheru webview reference vs PocketShell (PSP engine frame, window crop) —
  RMSE over each scene's region (red channel in the diff = in-region error).
  History: <code>history.json</code>.</caption>
  <tr><th>theme</th><th>scene</th><th>sheru reference</th><th>PocketShell</th><th>diff</th><th>RMSE</th></tr>
  ${rows.join("\n")}
</table>
`;
await Bun.write(`${PARITY}index.html`, html);
console.log(`board: docs/parity/index.html${failed ? " (FAILED)" : ""}`);
process.exit(failed ? 1 : 0);
