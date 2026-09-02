<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Handoff: the iPod's cable path on x1nano

Written 2026-09-03 (x1nano local time, UTC+8) for an agent working **on
x1nano itself**. It records one live fault, what has been ruled out, and the
two steps left — both of which need root, which is why they were not taken
from the Mac.

Read `README.md` in this directory for what the app is and how the wire
works. This file is only about the cable.

## The fault

The iPod touch 4 stopped appearing to `idevice_id` after a suspend/resume,
and replugging did not bring it back.

**`usbmuxd` is wedged, and everything below and above it is healthy.**

```
$ ss -lx | grep usbmux
u_str LISTEN 6  5   /var/run/usbmuxd
```

`Recv-Q 6` against a backlog of `5` on a LISTEN socket means six clients are
queued and **nothing is accepting them** — which is exactly what every
`idevice_id -l` sees:

```
$ idevice_id -l
ERROR: Unable to retrieve device list!      # rc=255, socket present, daemon alive
```

The process is alive and has not logged since the moment it stopped
accepting:

```
$ ps -o pid,user,etime,args -C usbmuxd
3086828 usbmux  04:00  /usr/bin/usbmuxd --user usbmux --systemd

$ journalctl -u usbmuxd -n 3 -o cat
[07:37:34.934][3] Connecting to new device on location 0x30007 as ID 3
[07:37:34.935][3] Connected to v2.0 device 3 … serial b9d1bd5200d18d76a8ece811f95e0388a5eb9c31
[07:37:34.935][1] preflight_worker_handle_device_add: ERROR: Could not connect
                  to lockdownd on device b9d1bd52…, lockdown error -8
```

`lockdown error -8` is `LOCKDOWN_E_MUX_ERROR`: the preflight worker could not
reach lockdownd on the device. It went into that call and the daemon has
served nobody since.

## What is already ruled out

- **The kernel and the cable, now.** The device enumerates cleanly and stays:
  `usb 3-6: new high-speed USB device`, `idVendor=05ac, idProduct=129e`,
  `speed 480`, `bConfigurationValue 4`, steady across a 20-second sample.
  Earlier in the same session it did fail here — `new full-speed USB device`
  then `device not accepting address, error -71` and `unable to enumerate` —
  so the connector is not above suspicion, but it is not today's fault.
- **The Pocket Shell daemon.** `pocket-shell.service` is active and listening
  on 8622; it reconnects in about five seconds whenever usbmuxd can see the
  device, with no approval dialog (a cable connection is its own trust). It
  was verified end to end at 07:36:40 UTC, minutes before the wedge:
  `iPod touch 4 at usb:b9d1bd52: allowed`.
- **Pairing.** Pocket Shell never pairs and never speaks to lockdownd. It
  runs `iproxy -u <udid> 8630:8624` and talks to a listener the app itself
  holds open on the device (`hosts/iphone2g/svcwire.c`). Raw usbmux
  forwarding needs no pairing record and no trust dialog — **the preflight
  that hung is work this app does not need done.**

## The two steps left

Both need root. `evan`'s sudo asks for a password, so they were left for
whoever is at the machine.

**1. Unwedge it now.**

```sh
sudo systemctl restart usbmuxd
idevice_id -l          # expect b9d1bd5200d18d76a8ece811f95e0388a5eb9c31
```

If the unit will not restart cleanly, `sudo pkill -x usbmuxd` and replug the
iPod: udev starts it again (`/usr/lib/udev/rules.d/39-usbmuxd.rules`, which
matches `5ac/12[9a][0-9a-f]` and this device is `05ac:129e`).

**2. Stop the preflight that wedged it.**

`usbmuxd` supports `-p, --no-preflight` ("Disable lockdownd preflight on new
device"). Nothing on this machine needs the preflight, and it is what hung:

```sh
sudo mkdir -p /etc/systemd/system/usbmuxd.service.d
sudo tee /etc/systemd/system/usbmuxd.service.d/no-preflight.conf >/dev/null <<'EOF'
# Pocket Shell forwards a raw usbmux port to the app's own listener and never
# speaks to lockdownd, so the preflight is work with no benefit here — and it
# hung the daemon on 2026-09-03 (lockdown error -8), leaving its accept queue
# full and every idevice_id client blocked.
[Service]
ExecStart=
ExecStart=/usr/bin/usbmuxd --user usbmux --systemd --no-preflight
EOF
sudo systemctl daemon-reload
sudo systemctl restart usbmuxd
```

This changes nothing for other tools that do need pairing: they pair on
demand; only the automatic probe at attach time goes away.

## How to know it worked

```sh
idevice_id -l                                     # the udid, once
journalctl --user -u pocket-shell -f              # then plug the iPod in
```

Expect, within about five seconds of the cable:

```
usb: device b9d1bd52 on the cable
usb b9d1bd52: dialled the device's listener on 8624
connection from usb:b9d1bd52
iPod touch 4 at usb:b9d1bd52: allowed
```

If the daemon says `allowed` the wire is up and the device is mirroring. If
it says nothing at all, the app is not running on the iPod — tap its icon, or
from the Mac `POCKETJS_IPODTOUCH4_VIA=x1nano bun run ipod launch`.

If instead the kernel starts failing again (`error -71`, `full-speed`,
`unable to enumerate`), that is the connector, not this: reseat it, try the
other port, try another cable, hard-reset the iPod with Home + Power for ten
seconds. Only if a port stays dead purely after a resume is the controller
worth rebinding — bus 3 belongs to `0000:00:14.0`, and rebinding it also
blinks the camera, fingerprint reader, Bluetooth and WWAN modem.

## What lives where on this machine

| | |
|---|---|
| daemon copy | `~/.local/share/pocket-shell/` (`host/serve.ts` + `protocol.ts`, `actions.ts`, `LICENSE`) |
| unit | `~/.config/systemd/user/pocket-shell.service`, `PartOf=graphical-session.target` |
| runtime | `~/.local/share/mise/shims/node` (the unit's `ExecStart`) |
| trust list | `~/.local/state/pocket-shell/allowed.json` (cable connections are not in it — they never need to be) |
| logs | `journalctl --user -u pocket-shell -f` |
| pointer helper | `~/.local/share/pocket-shell/host/pointer/pocket-pointer`, built here at deploy time |

**The copy under `~/.local/share` is deployed, not edited.** It is
overwritten by `bun run omarchy deploy-host x1nano` from the Mac, which also
rebuilds the pointer helper and restarts the unit. Edit the repository, not
that copy.

## Working in this clone

`git`, `node` and `codex` are here; **`bun` is not**, and the repo's own
scripts (`bun run omarchy doctor`, `bun run check`) need it — install it with
`mise use -g bun@latest` if you want them, or use the shell equivalents:

```sh
# layer 1: is the iPod on the bus at all?
for f in /sys/bus/usb/devices/*/idVendor; do
  [ "$(cat $f)" = 05ac ] && echo "$(basename $(dirname $f)) $(cat $(dirname $f)/product)"
done
journalctl -k --since -30min | grep -E 'usb [0-9]+-[0-9]+:|port[0-9]+:' | tail
# layer 2: does usbmuxd list it, and is it accepting?
idevice_id -l; ss -lx | grep usbmux
# layer 3: the daemon
systemctl --user is-active pocket-shell; journalctl --user -u pocket-shell -n 20 -o cat
```

`vendor/pocketjs` (the runtime submodule) is **not checked out here** — guest
builds and device deploys run from the Mac. `git submodule update --init
--depth 1 vendor/pocketjs` if you need to read runtime source.

Two traps that have cost time:

- **Never `pkill -f "<pattern>"` over ssh when the pattern appears in your
  own command line.** It matches the remote shell running it and kills the
  session (exit 255). Use `pkill -x <name>`.
- **The daemon logs in UTC** (`new Date().toISOString()`), while
  `journalctl` prints local time. A daemon line at `23:37` and a kernel line
  at `07:37` are the same moment.
