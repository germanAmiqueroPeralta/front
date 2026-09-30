"use client";

import { useCallback, useEffect, useState } from "react";

/** Pantallas del panel (cada una equivale a una vista de la Red de Salud). */
export type View =
  | { name: "packages" }
  | { name: "packageChoice"; code: string }
  | { name: "moduleChildren"; code: string }
  | { name: "modulePrestations"; code: string }
  | { name: "prestationChildren"; code: string; prestacionId: number }
  | { name: "child"; childId: number; code?: string }
  | { name: "stats" }
  | { name: "directory" }
  | { name: "directoryChild"; childId: number }
  | { name: "claims" }
  | { name: "claimDetail"; claimId: number }
  | { name: "audit" }
  | { name: "myChildren" }
  | { name: "tracking" }
  | { name: "guardianChild"; childId: number }
  | { name: "packageConfig"; code: string }
  | { name: "parents" }
  | { name: "roles" }
  | { name: "users" }
  | { name: "permissions" }
  | { name: "regions" }
  | { name: "facilities" }
  | { name: "guardians" }
  | { name: "guardianDetail"; guardianId: string }
  | { name: "children" }
  | { name: "carePackage"; packageId: string }
  | { name: "services" }
  | { name: "dashboard" }
  | { name: "search" }
  | { name: "alerts" }
  | { name: "controls" }
  | { name: "childControls"; childId: string }
  | { name: "adminClaim"; claimId: string }
  | { name: "sessions" }
  | { name: "devices" };

const same = (a: View, b: View) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Navegación entre pantallas del panel conectada al historial del navegador:
 * el botón "atrás" del navegador o el gesto atrás del celular vuelven a la pantalla anterior.
 */
export function useViewHistory(initial: View) {
  const [view, setView] = useState<View>(initial);

  useEffect(() => {
    window.history.replaceState({ ...window.history.state, sicnaView: initial }, "");
    const onPop = (e: PopStateEvent) => {
      const next = e.state?.sicnaView as View | undefined;
      if (next) {
        setView(next);
        window.scrollTo({ top: 0 });
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, []);

  const go = useCallback(
    (next: View) => {
      if (same(view, next)) return;
      window.history.pushState({ ...window.history.state, sicnaView: next }, "");
      window.scrollTo({ top: 0 });
      setView(next);
    },
    [view],
  );

  return { view, go };
}
