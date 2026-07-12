// PSP density overrides: sheru's metrics assume a desktop webview; at
// 480x272 the same chrome needs tighter rows. Applied by the cooker OVER
// the snapshot tokens (values must stay parseable by the same resolvers),
// and injected as CSS custom-property overrides by tools/capture-sheru.ts
// so the parity reference renders the same geometry.

export const DENSITY: Record<string, Record<string, string>> = {
  win98: {
    "--titlebar-h": "18px", // 22 → 18
    "--toolbar-h": "26px", //  30 → 26
    "--sidebar-w": "96px", //  180 → 96
    "--row-h": "17px", //      20 → 17
  },
};
