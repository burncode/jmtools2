export type AppTheme = "dark" | "light" | "system";
export type AppDensity = "comfortable" | "compact" | "spacious";
export type AppAccentColor = "amber" | "blue" | "cyan" | "rose" | "violet";

const accentColors: AppAccentColor[] = ["amber", "blue", "cyan", "rose", "violet"];

let activeTheme: AppTheme = "dark";

/**
 * Apply the resolved theme to the document root.
 * Handles "dark", "light", and "system" modes.
 * "system" reads the OS preference via prefers-color-scheme.
 */
export function applyAppTheme(theme: AppTheme) {
  activeTheme = theme;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme = theme === "system" ? (prefersDark ? "dark" : "light") : theme;

  document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  document.documentElement.classList.toggle("light", resolvedTheme === "light");
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themeMode = theme;
}

/**
 * Apply the UI density to the document root.
 */
export function applyAppDensity(density: AppDensity) {
  document.documentElement.dataset.density = density;
}

/**
 * Apply the user accent color palette to the document root.
 */
export function applyAppAccentColor(accent: AppAccentColor) {
  const resolvedAccent = accentColors.includes(accent) ? accent : "blue";
  document.documentElement.dataset.accent = resolvedAccent;
}

/**
 * Watch OS color-scheme changes when in "system" mode.
 * Returns an unsubscribe function.
 */
export function watchSystemTheme(currentTheme: () => AppTheme): () => void {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function handleChange() {
    const theme = currentTheme();
    if (theme === "system") {
      applyAppTheme("system");
    }
  }

  mediaQuery.addEventListener("change", handleChange);
  return () => mediaQuery.removeEventListener("change", handleChange);
}

/**
 * Convenience: call on mount to apply saved settings and start
 * the system-theme watcher. Returns an unsubscribe function
 * suitable for a useEffect cleanup.
 */
export function initAppTheme(theme: AppTheme) {
  applyAppTheme(theme);
  return watchSystemTheme(() => activeTheme);
}
