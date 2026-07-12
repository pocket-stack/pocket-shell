// @title PocketShell
import { mount } from "@pocketjs/framework/solid";
import Shell from "./app.tsx";

mount(() => <Shell />);

// Era fonts: swap the build's Inter atlases for the baked Tahoma ones
// (tools/bake-fonts.ts, custom shell:font.* pak keys). Runs right after
// mount() — the host is installed by then, and the first frame() has not
// painted yet, so the first visible frame is already Tahoma.
// load_font_atlas registers by the slot in the blob header: last load wins.
if (hasPack()) {
  for (const key of ["shell:font.0", "shell:font.7"]) {
    try {
      getOps().loadFontAtlas?.(get(key));
    } catch (e) {
      console.log(`era font ${key} not loaded: ${e}`);
    }
  }
}
