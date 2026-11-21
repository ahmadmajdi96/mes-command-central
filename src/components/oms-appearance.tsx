import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";
const Appearance = createContext({ theme: "light" as Theme, toggle: () => {} });
const storageKey = "oms-theme";

export function OMSAppearance({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === "dark") {
        document.documentElement.classList.add("dark");
        setTheme("dark");
      }
    } catch {
      // Light is the default when browser storage is unavailable.
    }
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", next === "dark");
    setTheme(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // The current page still uses the selected appearance.
    }
  }

  return <Appearance.Provider value={{ theme, toggle }}>{children}</Appearance.Provider>;
}

export function useOMSAppearance() {
  return useContext(Appearance);
}

export function OMSThemeToggle() {
  const { theme, toggle } = useOMSAppearance();
  const dark = theme === "dark";
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-10 shrink-0 border-border bg-card"
      aria-label={dark ? "Switch to light appearance" : "Switch to dark appearance"}
      onClick={toggle}
    >
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}
