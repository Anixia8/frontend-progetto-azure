import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api/apiFetch";
import { loadWithCache } from "../cache/loadWithCache";
import { dataCache } from "../cache/dataCache";

export type AzureSqlDatabase = {
  id: string;
  name: string;
  server: string | null;
  resourceGroup: string | null;
  location: string;
  sku: string | null;
  status: string | null;
};

type UseAzureSqlDatabasesOptions = {
  enabled: boolean;
  autoRefreshMs?: number; // opzionale
  ttlMs?: number;         // default 60s
};

const CACHE_KEY = "resources:sql";

export function useAzureSqlDatabases({ enabled, autoRefreshMs, ttlMs = Infinity }: UseAzureSqlDatabasesOptions) {
  const [databases, setDatabases] = useState<AzureSqlDatabase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actionDbId, setActionDbId] = useState<string | null>(null);

  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!enabled) return;

      const force = !!opts?.force;
      if (force) dataCache.invalidate(CACHE_KEY);

      setLoading(true);
      setError(null);

      try {
        const data = await loadWithCache<AzureSqlDatabase[]>(
          CACHE_KEY,
          ttlMs,
          async () => {
            const result = await apiFetch<AzureSqlDatabase[]>("/api/azure-sql-databases");
            if (!result.ok) {
              throw new Error(result.error ?? `Errore HTTP ${result.status}`);
            }
            return result.data ?? [];
          }
        );

        setDatabases(data ?? []);
      } catch (e: any) {
        setDatabases([]);
        setError(e?.message ?? "Errore nel caricamento database Azure SQL.");
      } finally {
        setLoading(false);
      }
    },
    [enabled, ttlMs]
  );

  const deleteDatabase = useCallback(
    async (dbId: string) => {
      if (!enabled) return false;

      setActionDbId(dbId);
      setError(null);

      const result = await apiFetch("/api/azure-sql-databases/delete", {
        method: "POST",
        body: { id: dbId },
      });

      if (!result.ok) {
        setError(result.error ?? `Errore HTTP ${result.status}`);
        setActionDbId(null);
        return false;
      }

      // dopo delete: forza refresh per non rivedere cache
      await refresh({ force: true });
      setActionDbId(null);
      return true;
    },
    [enabled, refresh]
  );

  useEffect(() => {
    if (enabled) {
      void refresh(); // usa cache
    } else {
      setDatabases([]);
      setLoading(false);
      setError(null);
      setActionDbId(null);
    }
  }, [enabled, refresh]);

  // auto refresh opzionale (se vuoi)
  useEffect(() => {
    if (!enabled) return;
    if (!autoRefreshMs || autoRefreshMs <= 0) return;

    const t = window.setInterval(() => void refresh({ force: true }), autoRefreshMs);
    return () => window.clearInterval(t);
  }, [enabled, autoRefreshMs, refresh]);

  return { databases, loading, error, refresh, deleteDatabase, actionDbId };
}

