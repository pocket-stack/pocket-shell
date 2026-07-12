// Capture sheru webview reference frames for the parity board.
//
// Serves the PREBUILT sheru webui bundle (mock bridge in a plain browser,
// `?theme=<id>` deep link) over localhost, opens a headless Chromium at the
// PocketShell WINDOW size (464x256 — the PSP frame minus the 8px desktop
// reveal), injects the density token overrides from themes-src/density.ts
// (so both sides render the same geometry), drives each scene through
// [data-part] DOM state, and screenshots to docs/parity/ref/<theme>/.
//
// Prereq: `bun run webui` in the sheru checkout (build artifacts are read
// from apps/macos/Sources/Sheru/Resources/WebUI). Browser: playwright-core's
// bundled Chromium if registered, else system Chrome (sheru icon-bake
// pattern).
//
//   bun tools/capture-sheru.ts

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { DENSITY } from "../themes-src/density.ts";

const repo = new URL("..", import.meta.url).pathname;
const sheruDir = (process.env.SHERU_DIR ?? `${process.env.HOME}/code/sheru`).replace(/\/$/, "");
const webuiDir = join(sheruDir, "apps/macos/Sources/Sheru/Resources/WebUI");

const THEME_IDS = ["win98"] as const;
const VIEW_W = 464;
const VIEW_H = 256;

interface RefScene {
  name: string;
  /** Applied after first paint, before the screenshot. */
  prepare?: (page: import("playwright-core").Page) => Promise<void>;
}

const REF_SCENES: RefScene[] = [
  { name: "chrome-focused" },
  {
    name: "chrome-unfocused",
    prepare: async (page) => {
      await page.evaluate(() => {
        document.querySelector('[data-part="window"]')?.setAttribute("data-focused", "false");
      });
    },
  },
  {
    name: "control-pressed",
    prepare: async (page) => {
      // Hold the pointer down on the close control: :active applies while
      // held, matching the PSP scene's held CIRCLE.
      const box = await page.locator('[data-part="control"][data-action="close"]').boundingBox();
      if (!box) throw new Error("close control not found");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
    },
  },
];

function browserExecutable(): string | undefined {
  try {
    const bundled = chromium.executablePath();
    if (bundled && existsSync(bundled)) return bundled;
  } catch {
    // no registered browser; fall through
  }
  const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return existsSync(systemChrome) ? systemChrome : undefined;
}

if (!existsSync(join(webuiDir, "index.html"))) {
  console.error(`sheru webui bundle missing at ${webuiDir} — run \`bun run webui\` in ${sheruDir}`);
  process.exit(1);
}

const server = Bun.serve({
  port: 0,
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    const file = Bun.file(join(webuiDir, pathname === "/" ? "index.html" : pathname.slice(1)));
    return (await file.exists())
      ? new Response(file)
      : new Response("not found", { status: 404 });
  },
});

const executablePath = browserExecutable();
if (!executablePath) {
  console.error("no Chromium/Chrome found (playwright bundled or /Applications/Google Chrome.app)");
  process.exit(1);
}
const browser = await chromium.launch({ executablePath });

try {
  for (const id of THEME_IDS) {
    const outDir = `${repo}docs/parity/ref/${id}`;
    await mkdir(outDir, { recursive: true });
    const density = DENSITY[id] ?? {};
    const densityCss = Object.entries(density)
      .map(([k, v]) => `${k}: ${v} !important;`)
      .join(" ");

    for (const scene of REF_SCENES) {
      const page = await browser.newPage({
        viewport: { width: VIEW_W, height: VIEW_H },
        deviceScaleFactor: 1,
      });
      await page.goto(`http://127.0.0.1:${server.port}/?theme=${id}`, { waitUntil: "networkidle" });
      await page.waitForSelector('[data-part="window"]');
      await page.addStyleTag({
        content:
          (densityCss ? `:root { ${densityCss} }\n` : "") +
          // Normalization: at 256px the webview's flex column squeezes the
          // caption; a PSP window never shrinks its chrome.
          `[data-part="titlebar"] { flex-shrink: 0 !important; }`,
      });
      // settle fonts/layout deterministically
      await page.evaluate(() => document.fonts.ready);
      await scene.prepare?.(page);
      await page.waitForTimeout(120);
      await page.screenshot({ path: `${outDir}/${scene.name}.png` });
      await page.close();
      console.log(`ref: docs/parity/ref/${id}/${scene.name}.png`);
    }
  }
} finally {
  await browser.close();
  server.stop();
}
