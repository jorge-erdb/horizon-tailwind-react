import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const ThemeContext = createContext(null);

// Tailwind is configured with `darkMode: "class"` and every dashboard class
// is written as `dark:`, so the whole theme hangs off one class on <body>.
// Keeping that class in a single provider is what stops the two toggles
// (the auth page's floating button and the dashboard navbar's) from holding
// separate opinions about which theme is on.
const STORAGE_KEY = "nova.theme";

function readStoredTheme() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : null;
  } catch {
    // Safari in private mode, or storage disabled by policy.
    return null;
  }
}

function storeTheme(theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* non-fatal — the session just loses its theme preference */
  }
}

// An explicit choice always wins. Absent one, follow the OS setting rather
// than assuming light: a visitor whose system is dark should not get a white
// flash on first load.
function resolveInitialTheme() {
  const stored = readStoredTheme();
  if (stored) return stored;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(resolveInitialTheme);

  // The class lives on <body>, not on <html>, because that is where the
  // existing layouts and `document.body.classList` checks already look.
  useEffect(() => {
    document.body.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Only track the OS while the user has expressed no preference of their
  // own; once they pick, their choice sticks across sessions.
  useEffect(() => {
    if (readStoredTheme()) return undefined;
    let media;
    try {
      media = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return undefined;
    }
    const onChange = (event) => setTheme(event.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      storeTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, isDark: theme === "dark", toggleTheme }),
    [theme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
