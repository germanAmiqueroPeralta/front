"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSisnat } from "@/hooks/use-sisnat";
import type { ApiResult } from "@/lib/api/types";

/** Si el backend dice que la sesión ya no vale (401), vuelve al login (navegación completa: borra la cookie). */
function useSessionGuard() {
  return useCallback((result: ApiResult<unknown>) => {
    if (!result.ok && result.status === 401) {
      window.location.replace("/session-expired");
      return true;
    }
    return false;
  }, []);
}

/**
 * Carga datos del backend con una Server Action. `key` decide cuándo recargar
 * (cámbiala si la acción depende de un id); `reload()` vuelve a pedir los datos
 * después de guardar algo.
 */
export function useBackendQuery<T>(key: string, load: () => Promise<ApiResult<T>>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  const expired = useSessionGuard();

  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await loadRef.current();
    if (expired(result)) return;
    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [expired]);

  useEffect(() => {
    let cancelled = false;
    loadRef.current().then((result) => {
      if (cancelled || expired(result)) return;
      if (result.ok) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [key, expired]);

  return { data, error, loading, reload };
}

/**
 * Ejecuta una Server Action que modifica datos: muestra el mensaje del backend
 * (éxito o error) en el aviso flotante y devuelve el dato, o null si falló.
 */
export function useBackendAction() {
  const { notify } = useSisnat();
  const expired = useSessionGuard();

  return useCallback(
    async <T,>(action: Promise<ApiResult<T>>, successText?: string): Promise<T | null> => {
      const result = await action;
      if (expired(result)) return null;
      if (!result.ok) {
        notify(result.error, "danger");
        return null;
      }
      notify(successText ?? (result.msg || "Cambios guardados"));
      return result.data ?? (true as T);
    },
    [notify, expired],
  );
}
