# PocketShell

The [sheru](https://github.com/doodlewind/sheru) file-manager themes — Windows 98, XP Luna, Win7 Aero, Aqua, XFCE — rendered by the [PocketJS](https://github.com/pocket-stack/pocketjs) style engine on a Sony PSP at 480×272.

sheru paints its era chrome with webview CSS: inset box-shadow bevel stacks, multi-stop caption gradients, conic-gradient dither. PocketShell re-renders the same themes through PocketJS's compiled style records and an 8-op DrawList on the PSP's Graphics Engine, with **webview feature parity as the yardstick** — every gap the port hits (bevel rings, multi-stop gradients, per-corner radii, pattern fills, scrollbars) becomes a PocketJS engine extension, landed upstream one PR at a time. A per-scene parity board (sheru reference capture | PocketShell frame | diff | RMSE) keeps the score honest.

Planned on top of the theming core: full d-pad/button interaction over a mock VFS, and a USB-tethered Mac bridge (PSPLINK mailbox) that browses real folders — `/Applications` with real app icons — and launches a Mac app from the PSP with ○.

**Status: M0** — repo scaffold; a bare window shell boots on desktop (wgpu), in the wasm golden harness, and as a PSP EBOOT. Win98 chrome + the parity board land with M1.

## Build

```sh
bun run setup      # submodules + vendored install + node_modules symlinks
bun run build      # dist/main.js + dist/main.pak
bun run desktop    # native wgpu window (2x); --screenshot out.png for headless
bun run psp        # dist/EBOOT.PBP (PPSSPP runs it as-is; CFW for real hardware)
bun run golden     # byte-exact wasm goldens (test/goldens/)
bun run cover      # regenerate art/ICON0.png + art/PIC1.png
```

The PSP build needs the toolchain from the pocketjs contract: Rust `nightly-2026-05-28`, Homebrew LLVM, and the PSP SDK at `$PSP_SDK` (or the dreamcart sibling checkout).

## Layout

```
pocket.json              the Pocket app manifest (see pocket-figma/docs/manifest.md)
app/                     the PocketShell app (Solid + @pocketjs/framework)
themes-src/              (M1) sheru theme snapshots + hand-written paint specs
tools/                   Bun cookers: covers; (M1) sync-sheru, cook-themes, glyphs
test/golden.ts           byte-exact wasm goldens
scripts/                 Bun drivers: psp, desktop
crates/pocket-shell-psp/ the PSP EBOOT crate (cargo-psp, lone bin)
vendor/                  submodules: pocketjs, rust-psp, quickjs-rs
```

## Credits

Theme design, tokens and glyph geometry come from sheru's theme system (MIT), snapshotted with commit provenance. Built on PocketJS. Windows, Aqua and XFCE are trademarks of their respective owners; all era artwork here is hand-authored data, not extracted assets.

MIT
