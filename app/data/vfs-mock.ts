// Deterministic mock VFS - hand-ported from sheru's mock-bridge seed
// (packages/webui/src/bridge/mock.ts) with FIXED display dates: sheru seeds
// mtimes relative to Date.now(), which would break byte-exact goldens, so
// the parity capture freezes the browser clock at CLOCK_EPOCH and these
// strings mirror what the webview renders at that instant.
//
// The M7 Mac bridge implements this same shape over the PSPLINK mailbox;
// the UI only ever sees VfsEntry lists.

export const CLOCK_EPOCH = "2026-07-12T08:00:00";

export interface VfsEntry {
  name: string;
  kind: "dir" | "file" | "app";
  /** Pre-formatted "Date Modified" cell (see CLOCK_EPOCH note). */
  date: string;
  /** "Size" cell as rendered by the reference ("--" for dirs/apps). */
  size: string;
  /** "Kind" cell as rendered by the reference. */
  kindLabel: string;
}

export interface SidebarSection {
  heading?: string;
  items: string[];
}

/** Sidebar sections mirror the sheru mock verbatim (labels clip at the
 *  96px pane, same as the reference; icons land with a later milestone). */
export const SIDEBAR: SidebarSection[] = [
  { items: ["Recents", "Chats"] },
  {
    heading: "Connectors",
    items: [
      "Object Storage - sheru-source",
      "GitHub - octocat",
      "Gmail - evan@sheru.app",
      "Calendar - evan@sheru.app",
      "Linear - SHERU",
      "Notion - SHERU",
      "Google Drive - evan@sheru.app",
      "dev-box - SSH",
    ],
  },
];

export const ROOT_PATH = "This Mac";

const d = (name: string, date: string): VfsEntry =>
  ({ name, kind: "dir", date, size: "--", kindLabel: "Folder" });
const f = (name: string, date: string, size: string, kindLabel: string): VfsEntry =>
  ({ name, kind: "file", date, size, kindLabel });
const a = (name: string, date: string): VfsEntry =>
  ({ name, kind: "app", date, size: "--", kindLabel: "Application" });

// Root + Applications mirror the sheru mock EXACTLY (names, order, dates as
// rendered under the frozen clock - dumped by tools/capture-sheru.ts);
// deeper folders are PocketShell-only navigation fixtures.
const TREE: Record<string, VfsEntry[]> = {
  [ROOT_PATH]: [
    d("Applications", "Jul 5, 2026, 8:00 AM"),
    d("code", "Jul 12, 2026, 3:12 AM"),
    d("Desktop", "Jul 10, 2026, 8:00 AM"),
    d("Documents", "Jul 6, 2026, 8:00 AM"),
    d("Downloads", "Jul 11, 2026, 8:00 AM"),
    d("Volumes", "Jul 9, 2026, 8:00 AM"),
    f("README.md", "Jul 12, 2026, 5:36 AM", "73 B", "Markdown"),
  ],
  [`${ROOT_PATH}/Applications`]: [
    a("Ghostty.app", "Jun 2, 2026, 8:00 AM"),
    a("Sheru.app", "Jul 5, 2026, 8:00 AM"),
  ],
  [`${ROOT_PATH}/code`]: [
    d("pocket-shell", "Jul 12, 2026, 12:00 AM"),
    d("pocketjs", "Jul 12, 2026, 12:00 AM"),
    d("sheru", "Jul 11, 2026, 4:00 PM"),
  ],
  [`${ROOT_PATH}/Desktop`]: [f("screenshot.png", "Jul 10, 2026, 4:00 PM", "214 KB", "PNG Image")],
  [`${ROOT_PATH}/Documents`]: [
    f("budget.xlsx", "Jun 20, 2026, 4:00 PM", "18 KB", "Spreadsheet"),
    f("notes.txt", "Jul 1, 2026, 4:00 PM", "2 KB", "Plain Text"),
    f("resume.pdf", "May 30, 2026, 4:00 PM", "96 KB", "PDF"),
  ],
  [`${ROOT_PATH}/Downloads`]: [
    f("firmware-6.61.pbp", "Jul 11, 2026, 4:00 PM", "24 MB", "Document"),
    f("wallpaper-4k.png", "Jul 8, 2026, 4:00 PM", "3 MB", "PNG Image"),
  ],
  [`${ROOT_PATH}/Volumes`]: [d("Memory Stick", "Jul 9, 2026, 4:00 PM")],
  [`${ROOT_PATH}/Volumes/Memory Stick`]: [d("PSP", "Jul 9, 2026, 4:00 PM")],
  [`${ROOT_PATH}/code/pocket-shell`]: [f("pocket.json", "Jul 12, 2026, 12:00 AM", "1 KB", "JSON")],
  [`${ROOT_PATH}/code/pocketjs`]: [f("DESIGN.md", "Jul 12, 2026, 12:00 AM", "4 KB", "Markdown")],
  [`${ROOT_PATH}/code/sheru`]: [f("README.md", "Jul 11, 2026, 4:00 PM", "73 B", "Markdown")],
};

export function list(path: string): VfsEntry[] | null {
  return TREE[path] ?? null;
}

export function parentOf(path: string): string | null {
  const i = path.lastIndexOf("/");
  return i < 0 ? null : path.slice(0, i);
}
