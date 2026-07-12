# Repository Instructions

- After completing and validating a code or documentation change, publish it as a draft pull request before treating the work as ready for review or merge.
- Name pull requests (and the branch's primary commit) using the Conventional Commits format — `type(scope): summary`, e.g. `feat(theme): …`, `fix: …`, `docs: …`.
- Never write `.sh` shell scripts in this repo; command wrappers are Bun TypeScript using Bun's `$` shell, run as `bun script.ts`.
- Import PocketJS runtime, host components, lifecycle, input, and animation APIs from `@pocketjs/framework/*`; import Solid primitives and control flow directly from `solid-js`.
- Class strings must be single static string literals — the PocketJS compiler bakes every literal at build time; template interpolation produces classes that resolve to nothing at runtime.
- Never hand-edit generated theme output under `app/theme/cooked/` — edit `themes-src/paint/*` (rules) or re-run `bun run sync` (sheru values), then `bun run cook`.
- Goldens (`test/goldens/`) are byte-exact; regenerate with `bun run golden:update` and eyeball every changed PNG before committing.
- sheru (`~/code/sheru`, override with `SHERU_DIR`) is the read-only visual reference; PocketShell never modifies it.
