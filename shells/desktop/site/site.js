/* SPDX-License-Identifier: GPL-3.0-only */
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!reduceMotion && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("shown");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll(".reveal").forEach((node) => observer.observe(node));
} else {
  document.querySelectorAll(".reveal").forEach((node) => node.classList.add("shown"));
}

const screenshot = document.querySelector("#theme-screenshot");
const caption = document.querySelector("#theme-caption");
document.querySelectorAll("[data-theme-shot]").forEach((button) => {
  button.addEventListener("click", () => {
    const theme = button.dataset.themeShot;
    document.querySelectorAll("[data-theme-shot]").forEach((item) =>
      item.classList.toggle("active", item === button)
    );
    if (!(screenshot instanceof HTMLImageElement) || !caption) return;
    screenshot.src = "/assets/" + theme + "-theme.png";
    screenshot.alt = "Pocket Shell Desktop " + theme + " theme";
    caption.textContent = theme === "xp"
      ? "XP theme · Luna gradients · 30px taskbar"
      : theme === "aqua"
        ? "Aqua · traffic lights · screen menu bar · Dock"
        : "Classic 98 · hard bevels · 28px taskbar";
  });
});

document.querySelector("#launch-preview")?.addEventListener("click", (event) => {
  const button = event.currentTarget;
  const mount = document.querySelector("#preview-mount");
  if (!mount || !(button instanceof HTMLButtonElement)) return;
  const iframe = document.createElement("iframe");
  iframe.src = "/play/";
  iframe.title = "Live Pocket Shell Desktop WebAssembly preview";
  iframe.allow = "fullscreen";
  mount.replaceChildren(iframe);
  mount.classList.add("running");
  button.textContent = "Desktop running";
  button.disabled = true;
});
