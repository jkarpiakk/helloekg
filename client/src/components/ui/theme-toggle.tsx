import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`rounded-full min-h-[44px] min-w-[44px] ${className}`}
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Przełącz na jasny motyw" : "Przełącz na ciemny motyw"}
      data-testid="theme-toggle"
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
