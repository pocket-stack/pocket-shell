//! Embeds the built app into the EBOOT: dist/main.js (NUL-terminated for
//! JS_Eval, which requires input[len] == '\0'; main.rs evals len - 1) and
//! dist/main.pak (styles.bin + font atlases + the baked theme assets).
//! Same include_str!/include_bytes! pattern as vendor/pocketjs/native/
//! build.rs, with the POCKETJS_APP env replaced by fixed paths into this
//! repo's dist/ — there is exactly one app here. Missing outputs fail the
//! build with the fix (scripts/psp.ts always builds them first).

use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    let out = PathBuf::from(env::var("OUT_DIR").unwrap());
    let dist = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("../../dist");

    let js_src = dist.join("main.js");
    println!("cargo:rerun-if-changed={}", js_src.display());
    let mut js = fs::read(&js_src)
        .unwrap_or_else(|e| panic!("could not read dist/main.js (run `bun run build` first): {e}"));
    js.push(0);
    fs::write(out.join("app.js"), js).unwrap();

    let pak_src = dist.join("main.pak");
    println!("cargo:rerun-if-changed={}", pak_src.display());
    let pak = fs::read(&pak_src)
        .unwrap_or_else(|e| panic!("could not read dist/main.pak (run `bun run build` first): {e}"));
    fs::write(out.join("app.pak"), pak).unwrap();
}
