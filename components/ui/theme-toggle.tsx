"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  return (
    <button
      aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
      onClick={() => {
        setDark(!dark);
        document.documentElement.classList.toggle("dark", !dark);
      }}
      className="rounded-lg border border-border bg-card p-2.5 text-muted-foreground hover:bg-accent"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
