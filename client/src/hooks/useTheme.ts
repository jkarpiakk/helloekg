import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

/**
 * helloEKG theme: dark is the default. Light is opt-in via the `light` class
 * on <html>, persisted to localStorage. A no-flash init script in index.html
 * applies the saved preference before first paint.
 */
function getInitialTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") root.classList.add("light");
    else root.classList.remove("light");
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, [theme]);

  const toggle = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    [],
  );

  return { theme, setTheme, toggle };
}

export default useTheme;
