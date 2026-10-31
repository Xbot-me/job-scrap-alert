"use client";

import * as React from "react";

type Theme = "light" | "dark";
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getTheme = (): Theme => {
  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};
const getServerTheme = (): Theme => "light";
const ThemeContext = React.createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore(subscribe, getTheme, getServerTheme);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggle = React.useCallback(() => {
    const next: Theme = getTheme() === "dark" ? "light" : "dark";
    window.localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    for (const listener of listeners) listener();
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return React.useContext(ThemeContext);
}
