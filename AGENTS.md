# Working in this repository

Pocket Shell is a product built on PocketJS, which arrives as the
`vendor/pocketjs` submodule. Nothing in `vendor/` is edited here: a runtime
change lands in [pocket-stack/pocketjs](https://github.com/pocket-stack/pocketjs)
first, and this repository moves its pin.

The repository holds **two independent applications**, and a change belongs
to one of them:

- `app/` — the 3DS shell. **Its only platform is the Nintendo 3DS**: two
  screens of fixed size, a resistive panel with one contact, a d-pad and
  shoulder buttons. Nothing there is a portability layer, and a change that
  only makes sense on some other machine does not belong in it.
- `ipod/` — Pocket Shell on the iPod touch 4, an Omarchy companion (a guest
  app plus the daemon it talks to). Its own README carries the design, and
  `ipod/HANDOFF.md` any live fault on the Omarchy machine — read it first if
  you are working **on** that machine.

They share this repository, the runtime submodule and the licence. They share
no code, and for now that is deliberate: how the two become one product is a
question for later, not a refactor to anticipate.

Everything here is **GPL-3.0-or-later** (`LICENSE`); PocketJS itself is MIT.
New source files carry the SPDX line.

## Conventions

- Publish a change as a **draft pull request** before treating it as ready,
  and name it with Conventional Commits — `feat(deck): …`, `fix(wm): …`.
- Import PocketJS runtime, host component, lifecycle, input and animation APIs
  from `@pocketjs/framework/*`; import Solid primitives and control flow from
  `solid-js`.
- Prose states the mechanism and the reason. No slogans, no imported
  architecture jargon, no empty intensifiers.
- `app/wm.ts`, `app/chords.ts` and `app/shell.ts` are pure and tested. Keep
  them that way: signals, input dispatch and animation live in `app/store.ts`,
  and drawing lives in the `.tsx` files.

## The loop

```sh
bun run check                        # typecheck + both apps' unit and sim tests
bun run push --host <console-ip>     # rebuild the guest, hot-push it (~20 s)
bun run shot --host <console-ip>     # a screenshot of both screens
bun run 3ds                          # the full .3dsx — needed for a reflash
bun run film                         # re-record media/ from the tapes
bun run goldens                      # byte-compare the pinned frames
```

The iPod app has its own loop:

```sh
bun run ipod guest                        # bundle it (what the sim boots)
POCKETJS_IPODTOUCH4_VIA=x1nano bun run ipod deploy   # build, link, install over usbmuxd
bun run omarchy deploy-host x1nano        # the daemon and its pointer helper
bun run omarchy logs x1nano               # what the daemon saw
bun run omarchy menu x1nano               # regenerate ipod/menu.ts from the machine
bun run omarchy shots media/ipod          # re-render its screens in the sim
```

`app/` changes are hot pushes. A change under `vendor/pocketjs/hosts/3ds` is
native: rebuild the `.3dsx`, copy it to the SD card, relaunch. **ftpd cannot
run while Pocket Runtime does** — one homebrew at a time — so pairing happens
with ftpd up and pushing happens with the shell up.

## What the tapes are for

`film/tape.ts` holds the scripted runs. One tape feeds three things: the
animations in `media/`, the byte-exact frames in `test/goldens/3ds/`, and the
headless replay in `test/sim.test.ts`. Add a behaviour worth showing to a tape
rather than filming by hand, and it becomes documentation and a test at once.

**A guest crash on a shared SD card looks like the wrong app booting.** The
runtime's recovery chain falls back to the last-good package, which on a card
that also holds another Pocket product is that other product. Read
`/pocketjs/runtime/status.txt` before believing a packaging problem.
