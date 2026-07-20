// Shared between the server layout (which inlines the bootstrap script) and
// the client theme store. No "use client" here on purpose.

export const THEME_STORAGE_KEY = "french-for-life:theme:v1";

// Inlined into <head> so the correct theme paints before anything renders.
// Kept tiny and dependency-free; it must never throw.
export const themeBootstrapScript = `(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch (error) {
    document.documentElement.dataset.theme = "light";
  }
})();`;
