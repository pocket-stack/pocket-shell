# Runtime upgrade validation

Validated on 2026-09-06 against PocketJS main
`10aee589d95aca34802ea4f8c79023e929434a92`.

The runtime includes the current HBL icon assets, per-app recovery storage,
L+R+START exit, and the merged 3DS companion transport. Its shared socket
service also supports Pocket Doc's offload worker.

- `bun run check`: TypeScript plus 98 unit/simulator tests passed for both the 3DS and iPod apps (8,169 assertions).
- `bun run 3ds`: full ARM build passed using the pinned runtime and toolchain.
- Both embedded SMDH icons (24×24 and 48×48) match the already hardware-accepted Pocket Doc package byte for byte. Decoded RGB565 pixels were visually checked.
- The rebuilt `/3DS/pocketshell-main.3dsx` was uploaded over FTP and read back byte for byte. Its isolated runtime slot had no staged or active replacement packages, so the next launch uses the newly embedded guest.

| Artifact | Value |
| --- | --- |
| 3DSX bytes | 2865476 |
| 3DSX SHA-256 | `6bcf2c4af14fe3f14f51ed71d6fc42eddc875c438150d45e9d797776f36d27f4` |
| Combined SMDH icon SHA-256 | `d2f5674914634ba7b99ffe222fef9e7905692e59c22e125f4a18c946df479f07` |

**Fresh physical interaction with this Pocket Shell build is pending.** FTP
readback confirms the installed bytes; it does not confirm a new HBL launch
or input handling. The earlier Pocket Doc hardware acceptance is separate.
