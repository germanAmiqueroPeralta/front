"use client";

import { Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/** Sin barra: solo el botón del menú (móvil) y el de modo nocturno, flotando en su posición. */
export function Header({ onOpenMobile }: { onOpenMobile: () => void }) {
  return (
    <>
      <button
        className="fixed left-5 top-5 z-20 rounded-lg border border-border bg-card p-2.5 text-muted-foreground shadow-sm hover:bg-accent lg:hidden"
        onClick={onOpenMobile}
        aria-label="Abrir menú"
      >
        <Menu className="size-4" />
      </button>
      <div className="fixed right-5 top-5 z-20 shadow-sm md:right-8">
        <ThemeToggle />
      </div>
    </>
  );
}
