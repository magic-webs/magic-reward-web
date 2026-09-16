"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

// The dashboard's ThemeToggle is a shadcn ghost Button, which draws on the
// dashboard's own tokens. The public site has its own palette, so it gets
// its own control rather than dragging those tokens into the header.
export function SiteThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // The server has no idea what was saved in localStorage, so commit to one
  // icon until next-themes has resolved the real value on the client.
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`flex size-9 items-center justify-center rounded-full text-(--site-muted) transition-colors hover:bg-(--site-fg)/5 hover:text-(--site-fg) ${className}`}
    >
      {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
