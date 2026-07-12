// Bake the era UI font for win98: TAHOMA — the exact family the parity
// reference renders (sheru's --font-ui stack resolves to Tahoma on macOS;
// "MS Sans Serif" doesn't exist here and Tahoma is its shipped metric
// match). Baked through the vendored PocketJS font baker into slot 0
// (12px regular) and slot 7 (12px bold) FONT ATLAS blobs, committed under
// app/fonts/ and spliced into main.pak via app/pak.json — pak.json raw
// entries load AFTER the build's Inter atlases and load_font_atlas
// registers by the slot in the header, so the era atlases win.
//
// Provenance/licensing: the Tahoma TTF is read from the SYSTEM at bake
// time and never committed — only the rendered bitmap atlas is (fixed-size
// coverage cells, no outlines/hinting/font program). Typeface bitmap
// renderings are the same class of artifact as the reference screenshots
// already committed next to them. If Tahoma is absent (non-mac bake), the
// baker falls back to the vendored Inter and says so loudly.
//
//   bun tools/bake-fonts.ts

import { existsSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { bakeAtlases } from "../vendor/pocketjs/compiler/bake-font.ts";
import { FONT_CMAP_ENTRY_SIZE, FONT_HEADER_SIZE } from "../vendor/pocketjs/spec/spec.ts";

const repo = new URL("..", import.meta.url).pathname;

const TAHOMA = "/System/Library/Fonts/Supplemental/Tahoma.ttf";
const TAHOMA_BOLD = "/System/Library/Fonts/Supplemental/Tahoma Bold.ttf";

// Non-ASCII characters used by app literals/mock data (ASCII 32..126 is
// always baked); keep in sync with what the UI renders.
const EXTRA_CHARS = "—…";

// Era crispness: Chromium renders 12px Tahoma with TrueType hinting —
// stems snap to the pixel grid, essentially bi-level. The PocketJS baker
// rasterizes unhinted 8-bit coverage; thresholding recovers the hard pixel
// look. NOTE the parity RMSE barely moves on font changes: unhinted
// advances drift ±1px per glyph vs hinted Chromium, and crisp-vs-crisp
// misalignment costs MORE squared error than blur — judge fonts by the
// magnified board images, not the number. Upstream follow-up: hinted
// advances/rasterization in compiler/bake-font.ts.
const COVERAGE_THRESHOLD = 100;

const haveTahoma = existsSync(TAHOMA) && existsSync(TAHOMA_BOLD);
if (!haveTahoma) {
  console.warn("bake-fonts: system Tahoma NOT found — falling back to vendored Inter (parity fonts off!)");
}

const atlases = await bakeAtlases({
  codepoints: [],
  slots: [0, 7], // 12px regular + 12px bold (every M2/M3 text is text-xs)
  extraChars: EXTRA_CHARS,
  ...(haveTahoma ? { regularTtf: TAHOMA, boldTtf: TAHOMA_BOLD } : {}),
});

mkdirSync(`${repo}app/fonts`, { recursive: true });
const manifestPath = `${repo}app/pak.json`;
const manifest: Array<{ key: string; file: string }> = existsSync(manifestPath)
  ? await Bun.file(manifestPath).json()
  : [];

for (const a of atlases) {
  if (haveTahoma) {
    // Bi-level the coverage region ((glyphCount+1) cells incl. tofu at gid 0).
    const coverageOff = FONT_HEADER_SIZE + a.glyphCount * FONT_CMAP_ENTRY_SIZE;
    for (let i = coverageOff; i < a.bytes.length; i++) {
      a.bytes[i] = a.bytes[i] >= COVERAGE_THRESHOLD ? 255 : 0;
    }
  }
  const file = `fonts/win98-font.${a.slot}.bin`;
  await Bun.write(`${repo}app/${file}`, a.bytes);
  const key = `shell:font.${a.slot}`;
  const existing = manifest.find((e) => e.key === key);
  if (existing) existing.file = file;
  else manifest.push({ key, file });
  console.log(
    `font: slot ${a.slot} (${a.px}px${a.bold ? " bold" : ""}) ${a.glyphCount} glyphs, cell ${a.cellW}x${a.cellH}, ${a.bytes.length} bytes -> app/${file}`,
  );
}

await Bun.write(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`pak manifest: app/pak.json (${manifest.length} entries)`);
