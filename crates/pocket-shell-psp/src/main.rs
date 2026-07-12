#![no_std]
#![no_main]

//! PocketShell PSP host — the stock PocketJS 2D frame loop over the
//! pocketjs-psp library (vendor/pocketjs/native/src/main.rs with the
//! capture/bench/trace instrumentation stripped): boot QuickJS on a 2 MB
//! worker thread, feed the embedded pak to the Rust core, evaluate the
//! embedded bundle, then drive frame(buttons, analog) per vblank while the
//! core ticks animations/layout and the GE backend draws the DrawList.
//!
//! Frame order (pocketjs DESIGN.md): sceCtrlRead -> JS frame(buttons,
//! analog) -> drain jobs -> core.tick(1/60) -> pipelined present (sync the
//! PREVIOUS list, swap, then record + kick this frame's list).

use core::ffi::c_void;

use libquickjs_sys::*;
use psp::sys::{self, CtrlMode, GuContextType, GuSyncBehavior, GuSyncMode, SceCtrlData};

use pocketjs_psp::{dbg, ffi, ge, host, pak};

psp::module!("pocket-shell", 1, 1);

// The app bundle + asset pack, baked from dist/ by build.rs. APP_JS is
// NUL-terminated there for JS_Eval (which wants input[len] == '\0'). APP_PAK
// is fed to the core natively (pak.rs) BEFORE JS eval and also exposed
// read-only to JS as __pak — it aliases .rodata, JS must never write it.
static APP_JS: &str = include_str!(concat!(env!("OUT_DIR"), "/app.js"));
static APP_PAK: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/app.pak"));

// libquickjs-sys omits JS_NewArrayBuffer; the linked QuickJS C library
// provides it (local-extern pattern, same as vendor/pocketjs/native).
// size_t stays usize (MIPS o32).
extern "C" {
    fn JS_NewArrayBuffer(
        ctx: *mut JSContext,
        buf: *mut u8,
        len: usize,
        free_func: Option<unsafe extern "C" fn(*mut JSRuntime, *mut c_void, *mut c_void)>,
        opaque: *mut c_void,
        is_shared: i32,
    ) -> JSValue;
}

fn psp_main() {
    unsafe {
        host::reset_fpu_status();
        // QuickJS compiling the bundle overflows the 256 KB module-thread
        // stack; run on a 2 MB worker instead.
        host::run_on_worker(worker_main, run);
    }
}

unsafe extern "C" fn worker_main(_argc: usize, _argv: *mut c_void) -> i32 {
    host::reset_fpu_status();
    run();
    0
}

unsafe fn run() {
    psp::enable_home_button();
    host::init_graphics(host::GfxConfig::default());

    // ---- Controller (analog mode: the nub pans the DeepZoom viewport) ----
    sys::sceCtrlSetSamplingCycle(0);
    sys::sceCtrlSetSamplingMode(CtrlMode::Analog);
    let mut pad = SceCtrlData::default();

    // ---- Rust UI core (first allocation initializes the arena) ----
    let ui = ffi::init_ui();
    // Feed styles.bin + font atlases + tiles straight from .rodata to the
    // core BEFORE any JS runs, then keep the pak reachable for the streaming
    // ops (loadTileTexture pulls tile blobs straight from .rodata).
    let (textures, sprites) = pak::feed(ui, APP_PAK);
    pak::install(APP_PAK);

    // ---- QuickJS ----
    let rt = pocketjs_psp::qjs_alloc::new_runtime();
    if rt.is_null() {
        host::halt("JS_NewRuntime returned null");
    }
    let ctx = JS_NewContext(rt);
    if ctx.is_null() {
        host::halt("JS_NewContext returned null");
    }
    let global = JS_GetGlobalObject(ctx);

    // DevTools mailbox (pocketjs DEVTOOLS.md): active only if pocketjs-dbg/
    // enable exists on host0: (PSPLINK) or ms0: (PPSSPP) — else two failed
    // opens here and never again. The JS shim polls through the ffi ops.
    dbg::init();

    // globalThis.ui — the full HostOps surface + the __textures table.
    ffi::register(ctx, global, &textures, &sprites);

    // Expose the pak read-only as globalThis.__pak (zero-copy over .rodata;
    // free_func = None) for ops that resolve entries JS-side.
    let ab = JS_NewArrayBuffer(
        ctx,
        APP_PAK.as_ptr() as *mut u8,
        APP_PAK.len(),
        None,
        core::ptr::null_mut(),
        0,
    );
    JS_SetPropertyStr(ctx, global, b"__pak\0".as_ptr() as *const _, ab);

    let res = JS_Eval(
        ctx,
        APP_JS.as_ptr() as *const _,
        APP_JS.len() - 1, // exclude the trailing NUL
        b"app.js\0".as_ptr() as *const _,
        JS_EVAL_TYPE_GLOBAL as i32,
    );
    if JS_ValueGetTag(res) == JS_TAG_EXCEPTION {
        log_exception(ctx);
        host::halt("JS_Eval threw");
    }
    JS_FreeValue(ctx, res);

    let frame_fn = JS_GetPropertyStr(ctx, global, b"frame\0".as_ptr() as *const _);
    if JS_IsUndefined(frame_fn) {
        host::halt("globalThis.frame is undefined");
    }

    // ---- Fixed-timestep frame loop (~60 Hz via vblank) ----
    loop {
        sys::sceCtrlReadBufferPositive(&mut pad, 1);
        let mask = pad.buttons.bits() as i32;
        // Analog nub packed (x << 8) | y, each axis 0..255 with 128 = center
        // (spec.ts "frame(buttons, analog)"; SceCtrlData names the axes lx/ly).
        let analog = (((pad.lx as u32) << 8) | pad.ly as u32) as i32;

        let mut args = [JS_NewInt32(ctx, mask), JS_NewInt32(ctx, analog)];
        let r = JS_Call(ctx, frame_fn, global, 2, args.as_mut_ptr());
        if JS_ValueGetTag(r) == JS_TAG_EXCEPTION {
            log_exception(ctx);
        }
        JS_FreeValue(ctx, r); // leak guard: free the return value every frame

        host::drain_jobs(rt);

        // Core frame: animations at fixed dt = 1/60, relayout if dirty, then
        // the DrawList. The raw-slice dance keeps borrowck happy about the
        // single static-mut Ui (one thread; render only reads atlases/
        // textures, never the DrawList's owner mutably).
        let ui = ffi::ui();
        ui.tick();
        let (words_ptr, words_len) = {
            let dl = ui.draw();
            (dl.words.as_ptr(), dl.words.len())
        };

        // ---- PIPELINED PRESENT: the GE has been executing frame N-1's list
        // while the JS/tick/draw above ran. Only NOW wait for it, present it,
        // then kick frame N's list and loop straight into frame N+1's CPU
        // work. Wall time ~= max(CPU, GE) instead of CPU + GE; one frame of
        // latency, the standard PSP double-buffered-list pattern.
        sys::sceGuSync(GuSyncMode::Finish, GuSyncBehavior::Wait);
        sys::sceDisplayWaitVblankStart();
        sys::sceGuSwapBuffers();
        // GE idle (sceGuSync above): rewind the per-frame bump vertex arena
        // and open frame N's list.
        ge::reset_pool();
        sys::sceGuStart(GuContextType::Direct, host::list_ptr());
        ge::render(ffi::ui(), core::slice::from_raw_parts(words_ptr, words_len));
        sys::sceGuFinish(); // kick list N — the GE draws while frame N+1's CPU runs
    }
}

/// Print the pending JS exception via the debug screen.
unsafe fn log_exception(ctx: *mut JSContext) {
    host::log_exception_with(ctx, |_| {});
}
