# Recording the console

Everything shown in the README is a recording of the shell running, made two
ways: **screenshots come off the real console**, and **animations come off the
emulator, one frame at a time**. Neither is a phone pointed at the screen.

## Screenshots: the dev wire

Pocket Runtime keeps a control channel open on the console (TCP 8131). Ask it
for a screenshot and it sends back both framebuffers, which
`scripts/shot.ts` writes as one PNG — the top screen with the touch screen
centred underneath, the way the console is held.

```sh
bun run pair --host 192.168.1.20   # once, with ftpd running on the console
bun run shot --host 192.168.1.20 --out media/hw/tiled.png
```

The same channel evaluates an expression in the guest before the shot, and
the app publishes its store as `globalThis.__pocketShell`, so a state worth
photographing can be arranged without pressing anything:

```sh
bun run shot --host 192.168.1.20 \
  --eval "const s=globalThis.__pocketShell; s.open('term'); s.open('notes'); s.open('clock')" \
  --out media/hw/tiled.png
```

That is how `media/hw/` was made. It is honest about what it is: those are
photographs of the machine, at the panel's own 400×240 and 320×240, with the
console's own RTC in the bar.

## Animations: the frame recorder

A 60 Hz shell cannot be filmed over a network — the wire delivers a few
screenshots a second, and a video capture of the panel would fight the
console's own refresh. So the animations are not filmed at all. They are
**assembled from a deterministic run**:

1. `bun run 3ds --capture` builds a console binary with an input tape baked
   in (`film/tape.ts`) and a dump window. Nothing is read from the
   filesystem at runtime: the tape is part of the binary.
2. That binary boots in Azahar against a throwaway emulator user directory
   with the settings a reproducible frame depends on pinned — the software
   rasterizer, no upscale, no vsync, and the emulated clock fixed at
   2000-01-01 so the bar's `HH:MM` is the same on every run.
3. Each frame, the guest transfers the PICA200 render target of **both**
   screens to the emulated SD card as raw RGBA, named by the frame counter
   that also indexes the tape. A 245-frame tape leaves 490 files.
4. `scripts/film.ts` reads them back, stacks the two screens into one
   400×480 image, and pipes named ranges of frames straight into ffmpeg as a
   raw stream — one shared palette per animation, so a flat UI stays flat
   instead of banding. Every frame is kept and played at 30 fps, half the
   console's rate: eased geometry is the thing being shown, and GIF's
   centisecond delays cannot express 60 fps anyway.

**One cut, one gesture.** The deck's whole body swaps when a shoulder goes
down — the minimap gives way to that layer's chord map — so a range that
reaches even one frame into the next chord puts two of those swaps in a
two-second animation, and it reads as flicker rather than as an interaction.
The first cuts of `chords`, `swap`, `layout` and `workspace` all did exactly
that. `assertOneGesture` in `film/tape.ts` now refuses a range whose
modifiers are still held at either end or move more than twice inside it;
the recorder calls it before recording and `test/tape.test.ts` calls it
without an emulator.

```sh
bun run film                      # both tapes: stills into media/, animations
bun run film --only=layout        # re-cut one animation
bun run film --tape=pocket-shell  # one tape
```

**A frame is a pure function of its index.** The core steps a fixed dt, the
tape is indexed by the same counter that names the files, and the renderer is
pinned, so two runs of the same tape produce the same bytes. That is what
makes the next part possible.

## The same frames are the tests

`test/goldens/3ds/` holds a handful of frames from those runs as PNGs.

```sh
bun run goldens        # re-run the tapes and byte-compare those frames
bun run film --update  # rewrite them, after looking at what changed
```

So an animation in the README and a golden in the test suite are cut from the
same dump of the same tape. An animation cannot show behaviour the tests do
not pin, and a test cannot pass on a picture nobody has looked at.

Byte-exactness belongs to one emulator build and one renderer;
`test/goldens/3ds/AZAHAR-BUILD.txt` records which, and a mismatch is reported
as a note rather than pretending the frames are comparable.

## What the recorder needs

- macOS with [Azahar](https://azahar-emu.org) installed and launched once (the
  driver clones your settings rather than inventing them)
- `ffmpeg` for the animations
- Docker, for the devkitARM half of the console toolchain

The recorder is GUI-bound: Azahar has no headless mode, only advances the
guest when it owns a window, ignores `SIGTERM`, and does not exit when the
guest finishes — so the driver owns its lifetime and kills it on every path.
Keep it out of CI.
