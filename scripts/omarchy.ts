// SPDX-License-Identifier: GPL-3.0-or-later
// bun run omarchy <command> — the desktop half: operate the daemon on an
// Omarchy machine from this Mac, keep the device's copy of Omarchy's menu in
// step, and render the app's screens in the headless sim.
//
//   bun run omarchy deploy-host <ssh host>   copy the daemon, build the pointer helper, install the user unit
//   bun run omarchy logs <ssh host> [-n 80]  journal tail
//   bun run omarchy status <ssh host>        unit status + listener
//   bun run omarchy doctor <ssh host>        why the device is not connected, layer by layer
//   bun run omarchy relay <ssh host>         ssh -L tunnel (local 8623) + LAN beacon from this Mac
//   bun run omarchy client <host:port>       a scripted device, for checking a daemon
//   bun run omarchy menu <ssh host>          regenerate ipod/menu.ts from the machine's own menu
//   bun run omarchy shots <dir>              render every screen in the headless sim
//   bun run omarchy films <dir>              record every animation in the headless sim
//
// Why a relay: Omarchy ships ufw with incoming DROP (only ssh is open), so the
// iPod cannot reach tcp 8622 on the laptop directly. The relay forwards the
// wire over the ssh connection that IS allowed and answers the LAN beacon
// from the Mac, so the device connects to the Mac and the Mac to the laptop.
// Once `sudo ufw allow from <lan> to any port 8622 proto tcp` has been run on
// the laptop, start the daemon with --beacon instead and drop the relay.

import { createSocket } from "node:dgram";
import { connect } from "node:net";
import { hostname } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { normalizeMenu, parseMenuJsonc, type MenuEntry } from "../ipod/host/menu-source.ts";
import { SHELL_APP, SHELL_PROTO, type ClientLine, type HostLine, parseLines } from "../ipod/protocol.ts";
import {
  encodeBeacon,
  encodeCtrl,
  encodeFrame,
  FrameParser,
  WIRE_BEACON_PORT,
  WIRE_MAGIC,
  WIRE_MSG,
  WIRE_PORT,
  WIRE_VERSION,
} from "../ipod/host/wire.ts";

const REPOSITORY = fileURLToPath(new URL("..", import.meta.url));
const APP_DIR = join(REPOSITORY, "ipod");
/** Files the daemon needs on the Omarchy machine (no repository there). The
 *  licence travels with it: the copy on that machine is a distribution. */
const HOST_FILES = [
  "protocol.ts",
  "actions.ts",
  "host/wire.ts",
  "host/hypr.ts",
  "host/omarchy.ts",
  "host/keymap.ts",
  "host/menu-source.ts",
  "host/serve.ts",
  "host/pointer/pocket-pointer.c",
  "host/pointer/wlr-virtual-pointer-unstable-v1.xml",
];
const REMOTE_DIR = ".local/share/pocket-shell";
const UNIT = "pocket-shell.service";

function run(cmd: string[], input?: string): string {
  const result = Bun.spawnSync({ cmd, stdin: input === undefined ? "inherit" : Buffer.from(input), stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} failed (${result.exitCode}):\n${result.stderr.toString().trim()}`);
  }
  return result.stdout.toString();
}

function ssh(host: string, command: string, input?: string): string {
  return run(["ssh", "-o", "BatchMode=yes", host, command], input);
}

async function deployHost(host: string): Promise<void> {
  // One tar over ssh: the six daemon files and the unit, into the user's home.
  const tar = Bun.spawnSync({
    cmd: [
      "tar",
      "-cf",
      "-",
      "-C",
      REPOSITORY,
      "LICENSE",
      "-C",
      APP_DIR,
      ...HOST_FILES,
      "host/pocket-shell.service",
    ],
    stdout: "pipe",
    stderr: "pipe",
  });
  if (tar.exitCode !== 0) throw new Error(tar.stderr.toString());
  const archive = Buffer.from(tar.stdout);
  // The pointer helper is built on the machine: wayland-scanner turns the
  // vendored protocol XML into a header and a stub, cc links them against
  // libwayland-client. Both ship with Omarchy (base-devel, wayland).
  const buildPointer =
    `cd ~/${REMOTE_DIR}/host/pointer && ` +
    "wayland-scanner client-header wlr-virtual-pointer-unstable-v1.xml wlr-virtual-pointer-unstable-v1-client-protocol.h && " +
    "wayland-scanner private-code wlr-virtual-pointer-unstable-v1.xml wlr-virtual-pointer-unstable-v1-protocol.c && " +
    "cc -O2 -o pocket-pointer pocket-pointer.c wlr-virtual-pointer-unstable-v1-protocol.c $(pkg-config --cflags --libs wayland-client) && cd ~";
  const install =
    `set -eu; mkdir -p ~/${REMOTE_DIR} ~/.config/systemd/user; ` +
    `tar -xf - -C ~/${REMOTE_DIR}; ` +
    `cp ~/${REMOTE_DIR}/host/${UNIT} ~/.config/systemd/user/${UNIT}; ` +
    `test -x ~/.local/share/mise/shims/node || { echo "node (mise) is missing on the host" >&2; exit 2; }; ` +
    `if command -v wayland-scanner >/dev/null && command -v cc >/dev/null; then ${buildPointer}; else echo "no wayland-scanner/cc: the trackpad's pointer helper was not built" >&2; fi; ` +
    `systemctl --user daemon-reload; systemctl --user enable ${UNIT} >/dev/null 2>&1 || true; systemctl --user reset-failed ${UNIT} >/dev/null 2>&1 || true; ` +
    `systemctl --user restart ${UNIT}; sleep 1; systemctl --user is-active ${UNIT}`;
  const result = Bun.spawnSync({ cmd: ["ssh", "-o", "BatchMode=yes", host, install], stdin: archive, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`deploy failed (${result.exitCode}):\n${result.stderr.toString().trim()}`);
  console.log(`deployed to ${host}:~/${REMOTE_DIR}; ${UNIT} ${result.stdout.toString().trim()}`);
  console.log(ssh(host, `journalctl --user -u ${UNIT} -n 5 --no-pager -o cat`));
}

function logs(host: string, lines: number): void {
  console.log(ssh(host, `journalctl --user -u ${UNIT} -n ${lines} --no-pager -o cat`));
}

function status(host: string): void {
  console.log(ssh(host, `systemctl --user status ${UNIT} --no-pager 2>&1 | head -12; ss -ltn | grep -E ':${WIRE_PORT} ' || echo 'no listener on ${WIRE_PORT}'`));
}

/**
 * Why the device is not connected. The cable path has three layers and each
 * one fails differently, so this asks them in order and names the layer:
 *
 *   1. the kernel     did the iPod enumerate on the bus at all?
 *   2. usbmuxd        does it list the device? (udev starts it on attach)
 *   3. the daemon     is the unit up, listening, and has it dialled?
 *
 * A failure at layer 1 is not something software here can repair — it is a
 * cable, a connector or a port that did not come back — and the daemon's own
 * "is usbmuxd running?" line is a symptom of it, not the cause.
 */
function doctor(host: string): void {
  const probe = [
    "echo '#bus'",
    // Apple's vendor id on the bus, whatever the product.
    `for f in /sys/bus/usb/devices/*/idVendor; do [ "$(cat $f 2>/dev/null)" = "05ac" ] && echo "$(dirname $f | xargs basename) $(cat $(dirname $f)/product 2>/dev/null)"; done`,
    "echo '#kernel'",
    // The last enumeration attempt on any port, good or bad.
    `journalctl -k --no-pager --since '-6h' 2>/dev/null | grep -E 'usb [0-9]+-[0-9]+:|usb usb[0-9]+-port[0-9]+:' | tail -6`,
    "echo '#muxd'",
    "idevice_id -l 2>&1 | head -4",
    "echo '#unit'",
    "systemctl --user is-active pocket-shell.service",
    `ss -ltn 2>/dev/null | grep -c ':${WIRE_PORT} '`,
    "echo '#log'",
    "journalctl --user -u pocket-shell.service -n 6 --no-pager -o cat 2>/dev/null | grep -E 'usb|connection|allowed|listening' | tail -4",
  ].join("; ");
  const out = ssh(host, probe);
  const part = (name: string): string[] => {
    const from = out.indexOf(`#${name}`);
    if (from < 0) return [];
    const rest = out.slice(from + name.length + 1);
    const to = rest.indexOf("\n#");
    return (to < 0 ? rest : rest.slice(0, to)).split("\n").map((line) => line.trim()).filter(Boolean);
  };

  const bus = part("bus");
  const kernel = part("kernel");
  const muxd = part("muxd").filter((line) => /^[0-9a-f-]{20,}$/i.test(line));
  const muxdError = part("muxd").filter((line) => !/^[0-9a-f-]{20,}$/i.test(line));
  const unit = part("unit");
  const active = unit[0] === "active";
  const listening = (unit[1] ?? "0") !== "0";

  console.log(`bus      ${bus.length ? bus.join(", ") : "no Apple device enumerated"}`);
  console.log(`usbmuxd  ${muxd.length ? muxd.join(", ") : muxdError.join(" ") || "no devices"}`);
  console.log(`daemon   ${active ? "active" : unit[0] ?? "?"}, ${listening ? `listening on ${WIRE_PORT}` : `NOT listening on ${WIRE_PORT}`}`);
  for (const line of part("log")) console.log(`         ${line}`);

  console.log("");
  if (!active || !listening) {
    console.log("The daemon is down. `systemctl --user restart pocket-shell` on the machine,");
    console.log("or redeploy it: bun run omarchy deploy-host " + host);
    return;
  }
  if (bus.length === 0) {
    const failed = kernel.filter((line) => /error -\d+|not accepting address|unable to enumerate|not responding/.test(line));
    if (failed.length) {
      console.log("The KERNEL never enumerated the iPod, so usbmuxd was never started and the");
      console.log("daemon has nothing to dial. The port saw it and could not talk to it:");
      for (const line of failed.slice(-3)) console.log(`  ${line.replace(/^.*kernel: /, "")}`);
      console.log("");
      console.log("That is the cable, the 30-pin connector or a port that did not come back");
      console.log("from suspend — nothing on this side can repair it. In order:");
      console.log("  1. unplug, wake the iPod (Home), reseat it firmly; try the other port");
      console.log("  2. another cable — `full-speed` in those lines means the data pair is");
      console.log("     not handshaking, which a worn 30-pin contact does");
      console.log("  3. hard-reset the iPod: Home + Power for ~10 s");
      console.log("  4. if a port stays dead only after resume, rebind the controller:");
      console.log("     sudo sh -c 'echo 0000:00:14.0 > /sys/bus/pci/drivers/xhci_hcd/unbind'");
      console.log("     sudo sh -c 'echo 0000:00:14.0 > /sys/bus/pci/drivers/xhci_hcd/bind'");
      console.log("     (that also blinks the camera, fingerprint reader, Bluetooth and WWAN)");
    } else {
      console.log("Nothing is on the bus and the kernel saw no attach at all: the iPod is not");
      console.log("plugged in, is powered off, or the cable carries power only.");
    }
    console.log("");
    console.log("Once the kernel enumerates it, nothing else is needed: the daemon rescans");
    console.log("every 3 s and the cable is its own trust, so the device is back in ~5 s.");
    return;
  }
  if (muxd.length === 0) {
    console.log("On the bus but usbmuxd does not list it. udev starts usbmuxd on attach");
    console.log("(39-usbmuxd.rules); replug, or start it: sudo systemctl start usbmuxd");
    return;
  }
  console.log("Bus, usbmuxd and daemon are all fine. If the device still shows the connect");
  console.log("screen, the app is not running on it: launch it with");
  console.log(`  POCKETJS_IPODTOUCH4_VIA=${host} bun run ipod launch`);
}

/** The relay's local port: 8622 is often taken on a developer Mac (the
 *  pocket-youtube companion holds it), and the beacon carries the port. */
const RELAY_PORT = 8623;

/** ssh -L tunnel to the daemon + a beacon from this Mac naming this Mac. */
async function relay(host: string, name: string, localPort: number): Promise<void> {
  const tunnel = Bun.spawn({
    cmd: ["ssh", "-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes", "-o", "ServerAliveInterval=15", "-N", "-L", `0.0.0.0:${localPort}:127.0.0.1:${WIRE_PORT}`, host],
    stdout: "inherit",
    stderr: "inherit",
  });
  const udp = createSocket("udp4");
  const payload = encodeBeacon(SHELL_APP, name, localPort);
  udp.bind(() => {
    udp.setBroadcast(true);
    setInterval(() => udp.send(payload, WIRE_BEACON_PORT, "255.255.255.255", () => {}), 1000);
    console.log(`relay: tcp ${localPort} on this Mac -> ${host}:${WIRE_PORT} over ssh; beacon "${name}" on udp ${WIRE_BEACON_PORT}`);
  });
  const stop = () => {
    tunnel.kill();
    udp.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  const code = await tunnel.exited;
  console.error(`relay: ssh tunnel exited (${code})`);
  udp.close();
  process.exit(code === 0 ? 0 : 1);
}

/**
 * A scripted device: connect, hello, print what the daemon mirrors, run the
 * lines given after `--` (JSON), then hang up. Verifies a daemon end to end
 * without an iPod in hand.
 */
async function client(target: string, lines: string[], seconds: number): Promise<void> {
  const [hostName, portText] = target.split(":");
  const port = Number(portText ?? WIRE_PORT);
  await new Promise<void>((resolve, reject) => {
    const socket = connect({ host: hostName, port });
    const parser = new FrameParser();
    let acked = false;
    socket.on("connect", () => {
      const app = new TextEncoder().encode(SHELL_APP);
      const hello = new Uint8Array(7 + app.length);
      new DataView(hello.buffer).setUint32(0, WIRE_MAGIC, true);
      hello[4] = WIRE_VERSION;
      hello[6] = app.length;
      hello.set(app, 7);
      socket.write(hello);
    });
    socket.on("data", (chunk: Buffer) => {
      let bytes = new Uint8Array(chunk);
      if (!acked) {
        if (bytes.length < 8) return;
        acked = true;
        bytes = bytes.slice(8);
        const helloLine: ClientLine = { t: "hello", proto: SHELL_PROTO, device: `client on ${hostname()}` };
        socket.write(encodeCtrl(JSON.stringify(helloLine)));
        setTimeout(() => {
          for (const line of lines) socket.write(encodeCtrl(line));
        }, 400);
        setTimeout(() => {
          socket.end();
          resolve();
        }, seconds * 1000);
      }
      for (const frame of parser.push(bytes)) {
        if (frame.type === WIRE_MSG.ping) {
          socket.write(encodeFrame(WIRE_MSG.pong, frame.payload));
          continue;
        }
        if (frame.type !== WIRE_MSG.ctrl) continue;
        for (const line of parseLines<HostLine>(new TextDecoder().decode(frame.payload))) {
          const text = JSON.stringify(line);
          console.log(text.length > 400 ? `${text.slice(0, 400)}… (${text.length} bytes)` : text);
        }
      }
    });
    socket.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// menu: bake Omarchy's menu tree into the device
// ---------------------------------------------------------------------------

const MENU_DEFAULT_PATH = "/usr/share/omarchy/default/omarchy/omarchy-menu.jsonc";
const MENU_OUT = join(APP_DIR, "menu.ts");

/** Glyphs for rows whose icon lives in Omarchy's private logo font, which
 *  the remote cannot carry: AI agents get the robot, the updater the update
 *  arrows, anything else a dot. */
const ROBOT = "\u{F06A9}";
const UPDATE = "\u{F06B0}";
const DOT = "\u{F0765}";

function deviceIcon(entry: MenuEntry): string {
  if (entry.iconFont === "omarchy") {
    if (entry.id === "update.omarchy") return UPDATE;
    if (entry.id.startsWith("setup.default.agent.") || entry.id.startsWith("install.ai.")) return ROBOT;
    return DOT;
  }
  return entry.icon;
}

/**
 * Read omarchy-menu.jsonc from an Omarchy machine (or a local copy) and write
 * ipod/menu.ts: every row's id, parent, kind, icon, label and
 * title in the shell's own order, plus whether it carries a `when` or a
 * `checked` condition (the daemon evaluates those live). The device shows
 * this table; the daemon runs actions from its own live parse by id, so a row
 * the device names has to exist on the machine as well.
 */
function bakeMenu(source: string, omarchyVersion: string | undefined): void {
  let text: string;
  let version = omarchyVersion ?? "";
  if (existsSync(source)) {
    text = readFileSync(source, "utf8");
  } else {
    text = ssh(source, `cat ${MENU_DEFAULT_PATH}`);
    if (!version) version = ssh(source, "omarchy-version").trim();
  }
  const entries = normalizeMenu([parseMenuJsonc(text)]);
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(text);
  const digest = hasher.digest("hex").slice(0, 12);
  const rows = entries.map((entry) => {
    const fields = [
      `id: ${JSON.stringify(entry.id)}`,
      `parent: ${JSON.stringify(entry.parent)}`,
      `kind: ${JSON.stringify(entry.kind)}`,
      `icon: ${JSON.stringify(deviceIcon(entry))}`,
      `label: ${JSON.stringify(entry.label)}`,
    ];
    if (entry.title) fields.push(`title: ${JSON.stringify(entry.title)}`);
    if (entry.when) fields.push("when: true");
    if (entry.checked) fields.push("checked: true");
    return `  { ${fields.join(", ")} },`;
  });
  const out = `// SPDX-License-Identifier: GPL-3.0-or-later
// ipod/menu.ts — GENERATED by \`bun run omarchy menu\`
// from Omarchy ${version || "?"}'s omarchy-menu.jsonc (sha256 ${digest}). Do not edit;
// regenerate against the machine after an Omarchy update.
//
// The device's copy of Omarchy's menu tree: every row's id, parent, kind,
// icon, label and title, in the shell's own order. Icons are the Nerd Font
// glyphs the file spells (written literally so the build's codepoint scan
// bakes them); rows whose icon lives in Omarchy's private logo font carry a
// Material stand-in. \`when\` and \`checked\` mark rows the daemon evaluates
// live — it sends the hidden and the checked ids, the table stays static.

export type MenuKind = "action" | "menu" | "link" | "provider";

export interface MenuItem {
  id: string;
  /** "root" for a top-level row. */
  parent: string;
  kind: MenuKind;
  icon: string;
  label: string;
  /** Header when the submenu is open; defaults to label. */
  title?: string;
  /** Visibility depends on a condition the daemon reports. */
  when?: true;
  /** A tick depends on a condition the daemon reports. */
  checked?: true;
}

export const MENU_OMARCHY_VERSION = ${JSON.stringify(version)};
export const MENU_SOURCE_DIGEST = ${JSON.stringify(digest)};

export const MENU: readonly MenuItem[] = [
${rows.join("\n")}
];
`;
  writeFileSync(MENU_OUT, out);
  const kinds = new Map<string, number>();
  for (const entry of entries) kinds.set(entry.kind, (kinds.get(entry.kind) ?? 0) + 1);
  console.log(
    `wrote ${MENU_OUT}: ${entries.length} rows from Omarchy ${version || "?"} (${[...kinds].map(([k, n]) => `${n} ${k}`).join(", ")})`,
  );
}

// ---------------------------------------------------------------------------
// the headless panel: every picture of the iPod app is rendered, not filmed
// ---------------------------------------------------------------------------
//
// The app is a guest, so the sim runs the same bundle the device runs and the
// daemon's half is a handful of JSON lines fed straight into the store. That
// makes a screen or an animation a pure function of this script — and it does
// not need the Omarchy machine to be awake, or the iPod to be on a cable.

type Store = import("../ipod/store.ts").CompanionStore;

const PANEL_W = 480;
const PANEL_H = 320;

/** The applications the daemon pages over from the machine's XDG entries. */
const MOCK_APPS = [
  "Chromium", "Files", "Foot", "GIMP", "Ghostty", "Localsend", "Neovim", "Nautilus",
  "Signal", "Spotify", "Steam", "Text Editor", "Thunderbird", "Zed",
].map((name) => ({ i: name.toLowerCase().replace(/ /g, "-"), n: name }));

/**
 * The desktop every picture is made from: one 1440x900 monitor, five windows
 * over three workspaces with the player floating, Wi-Fi up and something
 * playing. Exactly the shape of a live daemon's lines, with none of its
 * variance — no clock on this panel, so a render is reproducible.
 */
function applyMock(store: Store): void {
  store.applyLine({ t: "hello", proto: SHELL_PROTO, name: "x1nano-omarchy", omarchy: "4.0.1-1", auth: "ok" });
  store.applyLine({ t: "levels", vol: 0.55, bri: 0.7 });
  store.applyLine({
    t: "cc",
    wifi: { on: 1, ssid: "Petite Auberge", sig: 54 },
    media: { st: "playing", title: "Blue in Green", artist: "Miles Davis" },
  });
  store.applyLine({ t: "menu", hide: ["system.hibernate", "trigger.capture.screenrecord.stop"], check: ["setup.default.terminal.foot", "update.channel.stable"] });
  store.applyLine({ t: "apps", seq: 0, a: MOCK_APPS });
  store.applyLine({
    t: "state",
    mon: { w: 1440, h: 900 },
    ws: [{ id: 1, n: 3 }, { id: 2, n: 1 }, { id: 3, n: 0 }],
    active: 1,
    focus: "0x1",
    layout: "dwindle",
    win: [
      { a: "0x1", c: "foot", ti: "evan@x1nano-omarchy:~", ws: 1, x: 12, y: 38, w: 701, h: 850 },
      { a: "0x2", c: "chromium", ti: "Omarchy Manual", ws: 1, x: 725, y: 38, w: 703, h: 420 },
      { a: "0x3", c: "nautilus", ti: "Downloads", ws: 1, x: 725, y: 470, w: 703, h: 418 },
      { a: "0x4", c: "mpv", ti: "Blue in Green", ws: 1, x: 900, y: 500, w: 420, h: 260, f: 1 },
      { a: "0x5", c: "nvim", ti: "layout.ts", ws: 2, x: 12, y: 38, w: 1416, h: 850 },
    ],
  });
}

interface Panel {
  store: Store;
  render(): Uint8Array;
  pack(x: number, y: number, id?: number): number;
  frames(n: number, touches?: number[]): void;
  tap(x: number, y: number): void;
  hold(x: number, y: number, n?: number): void;
  /** Keep a copy of every frame advanced inside `body`. */
  record(sink: Uint8Array[], body: () => void): void;
}

/** The built bundle in the sim at the panel's own size, nothing applied. */
async function simPanel(): Promise<Panel> {
  const { bootWorld } = await import("../vendor/pocketjs/hosts/sim/sim.ts");
  const world = await bootWorld("pocketshell-ipod", 60, undefined, undefined, { width: PANEL_W, height: PANEL_H });
  const store = (globalThis as { __pocketShellIpod?: Store }).__pocketShellIpod;
  if (!store) throw new Error("the bundle did not publish its store");
  let sink: Uint8Array[] | null = null;
  const pack = (x: number, y: number, id = 0): number => (id << 18) | (y << 9) | x;
  const frames = (n: number, touches: number[] = []) => {
    for (let i = 0; i < n; i += 1) {
      world.frame(0, undefined, touches);
      // render() hands back the framebuffer it reuses, so a recording has to
      // take a copy of each frame.
      if (sink) sink.push(Uint8Array.from(world.render()));
    }
  };
  return {
    store,
    render: () => world.render(),
    pack,
    frames,
    tap: (x, y) => {
      frames(2, [pack(x, y)]);
      frames(1);
    },
    hold: (x, y, n = 30) => frames(n, [pack(x, y)]),
    record: (into, body) => {
      sink = into;
      try {
        body();
      } finally {
        sink = null;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// shots: the screens, rendered in the headless sim
// ---------------------------------------------------------------------------

/**
 * Walk the app through its states and write each as a PNG. What the READMEs
 * show, and what a change is checked against by eye before it is flashed.
 */
async function shots(outDir: string): Promise<void> {
  const { encodePNG } = await import("../vendor/pocketjs/tests/png.ts");
  const { STAGE, TAB_W, CC_BUTTON, MODE, MODE_HALF_W, SHEET_LIST, sheetRowRect, BALL_HOME } = await import("../ipod/layout.ts");
  const { keyboardKeys } = await import("../ipod/keyboard-layout.ts");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(outDir, { recursive: true });

  const panel = await simPanel();
  const { store, pack, frames, tap, hold } = panel;
  const shot = (name: string) => {
    writeFileSync(join(outDir, `${name}.png`), encodePNG(Buffer.from(panel.render()), PANEL_W, PANEL_H));
    console.log(`  ${name}.png`);
  };

  frames(1);
  shot("connect");
  applyMock(store);
  frames(40);
  shot("stage");

  // hold the floating tile: the popup
  const fit = store.fit()!;
  const px = Math.round(fit.ox + (900 + 180) * fit.s);
  const py = Math.round(fit.oy + (500 + 100) * fit.s);
  hold(px, py, 30);
  frames(12, [pack(px, py)]);
  shot("popup");
  frames(1);
  tap(px, STAGE.y + 8);
  frames(10);

  // the control centre, sticky
  tap(CC_BUTTON.x + CC_BUTTON.w / 2, CC_BUTTON.y + CC_BUTTON.h / 2);
  frames(20);
  shot("control-centre");
  tap(40, 300);
  frames(10);

  // the menu sheet: root, a submenu, the applications list
  const tapRow = (id: string) => {
    const at = store.sheetRows().findIndex((row) => row.id === id);
    if (at < 0) throw new Error(`no sheet row ${id} (have ${store.sheetRows().map((r) => r.id).join(", ")})`);
    const r = sheetRowRect(at);
    tap(SHEET_LIST.x + r.x + 60, SHEET_LIST.y + r.y + 20 - store.sheetScroller.offset());
  };
  tap(BALL_HOME.x + 22, BALL_HOME.y + 22);
  frames(20);
  shot("menu-root");
  tapRow("trigger");
  frames(20);
  shot("menu-trigger");
  tapRow("trigger.toggle");
  frames(20);
  shot("menu-toggle");
  store.sheetBack();
  store.sheetBack();
  frames(20);
  tapRow("apps");
  frames(20);
  shot("menu-apps");
  tap(10, 300);
  frames(10);

  // the deck, with a key held
  tap(MODE.x + MODE_HALF_W + 17, MODE.y + 11);
  frames(15);
  shot("deck");
  const f = keyboardKeys("lower").find((k) => k.def.label === "f")!;
  hold(f.x + f.w / 2, f.y + f.h / 2, 30);
  frames(12, [pack(f.x + f.w / 2, f.y + f.h / 2)]);
  shot("deck-variants");
  frames(1);
  frames(10);
  // the band: the click key held while a finger drags on the pad
  const { CLICK_KEY, DPAD_ARMS, TRACKPAD: PAD } = await import("../ipod/keyboard-layout.ts");
  frames(6, [pack(CLICK_KEY.x + 30, CLICK_KEY.y + 20)]);
  for (let i = 1; i <= 6; i += 1) {
    frames(2, [pack(CLICK_KEY.x + 30, CLICK_KEY.y + 20), pack(PAD.x + 60 + i * 10, PAD.y + 50, 1)]);
  }
  shot("deck-drag");
  frames(1);
  frames(8);
  // a d-pad key held
  frames(6, [pack(DPAD_ARMS.l.x + 16, DPAD_ARMS.l.y + 14)]);
  shot("deck-dpad");
  frames(1);
  frames(8);

  // back to the stage, then an empty workspace: the launch bar is fixed, so
  // there is nothing on the stage but the hint.
  tap(MODE.x + 17, MODE.y + 11);
  frames(10);
  tap(6 + TAB_W * 4 + TAB_W / 2, 14);
  frames(30);
  shot("empty");
  console.log(`wrote ${outDir}`);
}

// ---------------------------------------------------------------------------
// films: the same panel, kept frame by frame and encoded as GIFs
// ---------------------------------------------------------------------------

/** Every frame is kept and played at half the sim's rate: GIF's centisecond
 *  delays cannot express 60 fps, and eased geometry is the thing being
 *  shown. */
const FILM_FPS = 30;

interface Cut {
  name: string;
  /** Printed with the file, and the line the README's caption is built on. */
  note: string;
  /** Everything before the recording: settle the panel into its start. */
  before?(panel: Panel, at: PanelParts): void;
  run(panel: Panel, at: PanelParts): void;
}

/** The geometry a cut needs, resolved once against the app's own layout. */
interface PanelParts {
  layout: typeof import("../ipod/layout.ts");
  keys: typeof import("../ipod/keyboard-layout.ts");
}

const CUTS: Cut[] = [
  {
    name: "mirror",
    note: "the strip switches workspace and the tiles ease to their new places",
    before: (panel) => panel.frames(40),
    run: (panel, { layout }) => {
      const tab = (i: number) => 6 + layout.TAB_W * i + layout.TAB_W / 2;
      panel.frames(6);
      panel.tap(tab(1), 14);
      panel.frames(28);
      panel.tap(tab(0), 14);
      panel.frames(30);
    },
  },
  {
    name: "tile",
    note: "a held tile opens its popup and the same finger picks a row",
    before: (panel) => panel.frames(40),
    run: (panel, { layout }) => {
      const fit = panel.store.fit()!;
      const from = {
        x: Math.round(fit.ox + (900 + 210) * fit.s),
        y: Math.round(fit.oy + (500 + 130) * fit.s),
      };
      panel.frames(34, [panel.pack(from.x, from.y)]);
      const place = panel.store.popup()!.place;
      const row = { x: place.x + 40, y: place.y + layout.POPUP_PAD + layout.POPUP_ROW_H / 2 };
      for (let i = 1; i <= 8; i += 1) {
        panel.frames(1, [panel.pack(
          Math.round(from.x + ((row.x - from.x) * i) / 8),
          Math.round(from.y + ((row.y - from.y) * i) / 8),
        )]);
      }
      panel.frames(4, [panel.pack(row.x, row.y)]);
      panel.frames(8);
      // What the daemon echoes back a moment later: the player is no longer
      // floating, so the right column is a three-way split and every tile
      // eases to where it now belongs.
      panel.store.applyLine({
        t: "state",
        mon: { w: 1440, h: 900 },
        ws: [{ id: 1, n: 4 }, { id: 2, n: 1 }, { id: 3, n: 0 }],
        active: 1,
        focus: "0x4",
        layout: "dwindle",
        win: [
          { a: "0x1", c: "foot", ti: "evan@x1nano-omarchy:~", ws: 1, x: 12, y: 38, w: 701, h: 850 },
          { a: "0x2", c: "chromium", ti: "Omarchy Manual", ws: 1, x: 725, y: 38, w: 703, h: 278 },
          { a: "0x3", c: "nautilus", ti: "Downloads", ws: 1, x: 725, y: 324, w: 703, h: 278 },
          { a: "0x4", c: "mpv", ti: "Blue in Green", ws: 1, x: 725, y: 610, w: 703, h: 278 },
          { a: "0x5", c: "nvim", ti: "layout.ts", ws: 2, x: 12, y: 38, w: 1416, h: 850 },
        ],
      });
      panel.frames(34);
    },
  },
  {
    name: "menu",
    note: "the ball opens Omarchy's own menu as a sheet, and a submenu opens in place",
    before: (panel) => panel.frames(40),
    run: (panel, { layout }) => {
      panel.frames(4);
      panel.tap(layout.BALL_HOME.x + 22, layout.BALL_HOME.y + 22);
      panel.frames(22);
      // A fling: the list carries on under its own kinetics.
      const x = layout.SHEET_LIST.x + 120;
      panel.frames(3, [panel.pack(x, layout.SHEET_LIST.y + 150)]);
      for (let i = 1; i <= 8; i += 1) {
        panel.frames(1, [panel.pack(x, layout.SHEET_LIST.y + 150 - i * 11)]);
      }
      panel.frames(1);
      panel.frames(26);
      // A row the fling left on screen: off the list, the tap would be a tap
      // outside the sheet, which dismisses it.
      const at = panel.store.sheetRows().findIndex((row) => row.id === "setup");
      const r = layout.sheetRowRect(at);
      const y = layout.SHEET_LIST.y + r.y + 20 - panel.store.sheetScroller.offset();
      if (y < layout.SHEET_LIST.y || y > layout.SHEET_LIST.y + layout.SHEET_LIST.h) {
        throw new Error(`the sheet scrolled the row out of view (y=${y})`);
      }
      panel.tap(layout.SHEET_LIST.x + r.x + 60, y);
      panel.frames(28);
    },
  },
  {
    name: "deck",
    note: "the mode switch turns the panel into a laptop's C surface, and the keys go straight to the desktop",
    before: (panel) => panel.frames(40),
    run: (panel, { layout, keys }) => {
      panel.frames(4);
      panel.tap(layout.MODE.x + layout.MODE_HALF_W + 17, layout.MODE.y + 11);
      panel.frames(18);
      for (const label of ["h", "i"]) {
        const key = keys.keyboardKeys("lower").find((k) => k.def.label === label)!;
        panel.frames(4, [panel.pack(key.x + key.w / 2, key.y + key.h / 2)]);
        panel.frames(8);
      }
      // Held, the variants fan out of the key; the slide picks one and the
      // release sends it (^F here, not an f).
      const f = keys.keyboardKeys("lower").find((k) => k.def.label === "f")!;
      const from = { x: f.x + f.w / 2, y: f.y + f.h / 2 };
      panel.frames(46, [panel.pack(from.x, from.y)]);
      const chip = keys.chipRects(f, 2)[0]!;
      const to = { x: chip.x + chip.w / 2, y: chip.y + chip.h / 2 };
      for (let i = 1; i <= 6; i += 1) {
        panel.frames(1, [panel.pack(
          Math.round(from.x + ((to.x - from.x) * i) / 6),
          Math.round(from.y + ((to.y - from.y) * i) / 6),
        )]);
      }
      panel.frames(6, [panel.pack(to.x, to.y)]);
      panel.frames(1);
      panel.frames(14);
      // The d-pad answers by direction, over its whole square.
      panel.frames(10, [panel.pack(keys.DPAD_ARMS.r.x + 16, keys.DPAD_ARMS.r.y + 14)]);
      panel.frames(1);
      panel.frames(10);
    },
  },
];

/**
 * ffmpeg twice over one raw stream: a palette from the whole cut, then the
 * GIF. One shared palette is what keeps a flat UI from banding, and `bayer`
 * dithering keeps flat panels flat instead of speckled — the same recipe the
 * console's recorder uses (scripts/film.ts).
 */
function encodeGif(frames: Uint8Array[], name: string, dir: string, work: string): void {
  const stream = join(work, `${name}.rgba`);
  const palette = join(work, `${name}.palette.png`);
  const output = join(dir, `${name}.gif`);
  writeFileSync(stream, Buffer.concat(frames.map((frame) => Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength))));
  const input = ["-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${PANEL_W}x${PANEL_H}`, "-r", String(FILM_FPS), "-i", stream];
  const run = (argv: string[]): void => {
    const result = Bun.spawnSync(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", ...argv], { stdout: "pipe", stderr: "pipe" });
    if (result.exitCode !== 0) throw new Error(`ffmpeg failed: ${result.stderr.toString().trim()}`);
  };
  run([...input, "-vf", "palettegen=max_colors=128:stats_mode=full", palette]);
  run([...input, "-i", palette, "-lavfi", "paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle", "-loop", "0", output]);
  rmSync(stream, { force: true });
  rmSync(palette, { force: true });
  const bytes = readFileSync(output).byteLength;
  console.log(`  ${name}.gif  ${frames.length} frames, ${(bytes / 1024).toFixed(0)} KiB — ${CUTS.find((cut) => cut.name === name)!.note}`);
}

/** One world per cut, so a recording cannot inherit another one's state. */
async function films(outDir: string, only?: string): Promise<void> {
  if (!Bun.which("ffmpeg")) throw new Error("ffmpeg not found (brew install ffmpeg) — it encodes the animations");
  const parts: PanelParts = {
    layout: await import("../ipod/layout.ts"),
    keys: await import("../ipod/keyboard-layout.ts"),
  };
  const work = join(REPOSITORY, "dist/film/ipod");
  mkdirSync(outDir, { recursive: true });
  mkdirSync(work, { recursive: true });
  for (const cut of CUTS) {
    if (only && cut.name !== only) continue;
    const panel = await simPanel();
    panel.frames(1);
    applyMock(panel.store);
    cut.before?.(panel, parts);
    const frames: Uint8Array[] = [];
    panel.record(frames, () => cut.run(panel, parts));
    encodeGif(frames, cut.name, outDir, work);
  }
  console.log(`wrote ${outDir}`);
}

function usage(): void {
  console.log(`Pocket Shell — the Omarchy side

  bun run omarchy deploy-host <ssh host>
  bun run omarchy logs <ssh host> [-n N]
  bun run omarchy status <ssh host>
  bun run omarchy doctor <ssh host>                   why the device is not connected, layer by layer
  bun run omarchy relay <ssh host> [--name <beacon name>] [--local-port 8623]
  bun run omarchy client <host[:port]> [--for seconds] [-- <json line>...]
  bun run omarchy menu <ssh host | omarchy-menu.jsonc> [--omarchy <version>]
  bun run omarchy shots <out dir>                     render the screens in the headless sim
  bun run omarchy films <out dir> [--only <cut>]      record the animations in the headless sim`);
}

async function main(args: string[]): Promise<void> {
  const [command, target] = args;
  switch (command) {
    case "deploy-host":
      if (!target) throw new Error("deploy-host needs an ssh host");
      await deployHost(target);
      break;
    case "doctor":
      if (!target) throw new Error("doctor needs an ssh host");
      doctor(target);
      break;
    case "logs": {
      if (!target) throw new Error("logs needs an ssh host");
      const at = args.indexOf("-n");
      logs(target, at >= 0 ? Number(args[at + 1]) : 40);
      break;
    }
    case "status":
      if (!target) throw new Error("status needs an ssh host");
      status(target);
      break;
    case "relay": {
      if (!target) throw new Error("relay needs an ssh host");
      const at = args.indexOf("--name");
      const portAt = args.indexOf("--local-port");
      await relay(
        target,
        at >= 0 ? (args[at + 1] ?? hostname()) : `${target} via ${hostname().replace(/\.local$/, "")}`,
        portAt >= 0 ? Number(args[portAt + 1]) : RELAY_PORT,
      );
      break;
    }
    case "films": {
      if (!target) throw new Error("films needs an output directory");
      const at = args.indexOf("--only");
      await films(target, at >= 0 ? args[at + 1] : undefined);
      break;
    }
    case "shots":
      if (!target) throw new Error("shots needs an output directory");
      await shots(target);
      break;
    case "menu": {
      if (!target) throw new Error("menu needs an ssh host or a path to omarchy-menu.jsonc");
      const at = args.indexOf("--omarchy");
      bakeMenu(target, at >= 0 ? args[at + 1] : undefined);
      break;
    }
    case "client": {
      if (!target) throw new Error("client needs host[:port]");
      const dash = args.indexOf("--");
      const forAt = args.indexOf("--for");
      const seconds = forAt >= 0 ? Number(args[forAt + 1]) : 3;
      await client(target, dash >= 0 ? args.slice(dash + 1) : [], seconds);
      break;
    }
    default:
      usage();
      if (command && command !== "help" && command !== "--help") throw new Error(`unknown command ${command}`);
  }
}

if (import.meta.main) {
  main(Bun.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
