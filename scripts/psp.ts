// Build the PocketShell EBOOT: JS bundle + pak -> cargo psp -> dist/EBOOT.PBP.
//
//   bun scripts/psp.ts        # debug profile (opt-level 3 override below)
//   bun scripts/psp.ts -r     # release
//
// The cross env is the exact block from vendor/pocketjs/scripts/psp.ts (the
// dreamcart contract): Homebrew LLVM first on PATH, TARGET_CFLAGS for the
// MIPS clang C builds, llvm-ar/ranlib for MIPS archives (Apple ar drops
// them), RUST_PSP_TARGET at the vendored target json, RUST_PSP_ABORT_ONLY=1.
// The PSP SDK comes from PSP_SDK or the dreamcart sibling checkout; PSPDEV
// is exported for libquickjs-sys's own include resolution (its default
// fallback path assumes the pocketjs sibling layout, not vendor/).

import { $ } from "bun";
import { existsSync } from "node:fs";

const repo = new URL("..", import.meta.url).pathname;
const home = process.env.HOME ?? "";
const crateDir = `${repo}crates/pocket-shell-psp/`;

const argv = Bun.argv.slice(2);
const release = argv.includes("-r") || argv.includes("--release");

// ---- 1. app bundle + pak -> dist/main.js + dist/main.pak ------------------
console.log("pocket-shell psp: building the JS bundle");
await $`bun vendor/pocketjs/scripts/build.ts app/main.tsx --outdir=dist`.cwd(repo);

// ---- 2. cargo psp ----------------------------------------------------------
const sdkCandidates = [
  process.env.PSP_SDK,
  `${home}/code/dreamcart/mipsel-sony-psp`,
].filter((p): p is string => !!p);
const sdk = sdkCandidates.find((p) => existsSync(`${p}/psp/lib/libc.a`));
if (!sdk) {
  console.error(`pocket-shell psp: PSP SDK not found (looked in ${sdkCandidates.join(", ")}) — set PSP_SDK`);
  process.exit(1);
}
const llvm = existsSync("/opt/homebrew/opt/llvm/bin")
  ? "/opt/homebrew/opt/llvm/bin"
  : "/usr/local/opt/llvm/bin";
if (!existsSync(`${llvm}/clang`)) {
  console.error(`pocket-shell psp: Homebrew LLVM missing at ${llvm} (brew install llvm)`);
  process.exit(1);
}
const TOOLCHAIN = "nightly-2026-05-28";
const rustup = Bun.which("rustup") ?? `${home}/.cargo/bin/rustup`;

const env = {
  ...process.env,
  PATH: `${llvm}:${home}/.cargo/bin:${process.env.PATH}`,
  // Benign +abicalls(newlib) vs +noabicalls(rust-psp) linker warnings stay
  // suppressed, matching vendor/pocketjs/scripts/psp.ts.
  RUSTFLAGS: "-A linker-messages -A unexpected-cfgs -A unstable-name-collisions",
  CRATE_CC_NO_DEFAULTS: "1",
  TARGET_CC: "clang",
  TARGET_AR: `${llvm}/llvm-ar`,
  // Match the Rust PSP target's +noabicalls mode. -G0 avoids clang's MIPS
  // backend selecting unsupported GP-relative accesses for large C sources.
  TARGET_CFLAGS:
    `-target mipsel-sony-psp -mcpu=mips2 -msingle-float -mlittle-endian -mno-abicalls -fno-pic -G0 -mno-check-zero-division ` +
    `-fno-stack-protector -I${sdk}/psp/include -I${sdk}/psp/sdk/include`,
  // CRITICAL: archive MIPS objects with llvm-ar (Apple ar drops them -> undefined JS_*).
  AR_mipsel_sony_psp: `${llvm}/llvm-ar`,
  RANLIB_mipsel_sony_psp: `${llvm}/llvm-ranlib`,
  PSPDEV: sdk,
  RUST_PSP_TARGET: `${repo}vendor/pocketjs/native/targets/mipsel-sony-psp.json`,
  // panic-abort EBOOTs: no panic_unwind/libunwind in build-std.
  RUST_PSP_ABORT_ONLY: "1",
  // Keep PSP dev builds fast (opt-level 0 is unusably slow on hardware).
  CARGO_PROFILE_DEV_OPT_LEVEL: process.env.CARGO_PROFILE_DEV_OPT_LEVEL ?? "3",
};

const cargoArgs: string[] = release ? ["--release"] : [];
console.log("pocket-shell psp: cargo psp");
await $`${rustup} run ${TOOLCHAIN} cargo psp ${cargoArgs}`.cwd(crateDir).env(env);

// ---- 3. dist/EBOOT.PBP -----------------------------------------------------
// A lone crate gets a plain EBOOT.PBP; keep the bin-named fallback in case
// the crate ever lands in a workspace (cargo-psp then names per-executable).
const profile = release ? "release" : "debug";
const ebootDir = `${crateDir}target/mipsel-sony-psp/${profile}`;
const built = [`${ebootDir}/EBOOT.PBP`, `${ebootDir}/pocket-shell-psp.EBOOT.PBP`].find(existsSync);
if (!built) {
  console.error(`pocket-shell psp: no EBOOT.PBP under ${ebootDir}`);
  process.exit(1);
}
await Bun.write(`${repo}dist/EBOOT.PBP`, Bun.file(built));
console.log(`output: ${repo}dist/EBOOT.PBP  (copy to ms0:/PSP/GAME/PocketShell/)`);
