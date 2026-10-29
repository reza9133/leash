// Three themes: light, dim (a softer, semi-light slate) and dark. The choice is remembered.
import { createStore, safeStorage, useStore } from "./store";

export const THEMES = ["light", "dim", "dark"] as const;
export type ThemeName = (typeof THEMES)[number];

const KEY = "leash.theme";
const META: Record<ThemeName, string> = { light: "#edf0f4", dim: "#262d38", dark: "#0b121a" };

function initial(): ThemeName {
  const saved = safeStorage.get(KEY);
  if (saved && (THEMES as readonly string[]).includes(saved)) return saved as ThemeName;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dim";
  return "light";
}

export const themeStore = createStore<{ theme: ThemeName }>({ theme: initial() });

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", META[theme]);
}

export function setTheme(theme: ThemeName): void {
  safeStorage.set(KEY, theme);
  themeStore.patch({ theme });
  applyTheme(theme);
}

export function cycleTheme(): void {
  const i = THEMES.indexOf(themeStore.get().theme);
  setTheme(THEMES[(i + 1) % THEMES.length]);
}

export function initTheme(): void {
  applyTheme(themeStore.get().theme);
}

export const useTheme = () => useStore(themeStore).theme;

export const prefersReducedMotion = (): boolean => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
