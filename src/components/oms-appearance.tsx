import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";
const Appearance = createContext<{ theme: Theme | undefined; toggle: () => void }>({
  theme: undefined,
  toggle: () => {},
});
const storageKey = "oms-theme";
export const omsThemeBootstrap = `try {
  document.documentElement.classList.toggle("dark", localStorage.getItem(${JSON.stringify(storageKey)}) === "dark");
} catch {}`;

export function OMSAppearance({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>();

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function toggle() {
    const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
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
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-10 shrink-0 border-border bg-card"
      aria-label="Dark appearance"
      aria-pressed={theme === undefined ? undefined : theme === "dark"}
      onClick={toggle}
    >
      <Sun aria-hidden className="hidden dark:block" />
      <Moon aria-hidden className="dark:hidden" />
    </Button>
  );
}
