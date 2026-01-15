import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/apiFetch";
import { loadWithCache } from "../cache/loadWithCache";
import { dataCache } from "../cache/dataCache";

export type StorageAccount = {
  id: string;
  name: string;
  resourceGroup: string | null;
  location: string;
  sku: string | null;
  kind: string;
};

type UseStorageAccountsOptions = {
  enabled?: boolean;      // carica solo se true (es. autenticato)
  autoRefreshMs?: number; // refresh periodico (0/undefined = off)
  ttlMs?: number;         // TTL cache (default 60s)
};

const CACHE_KEY = "resources:storage";

export function useStorageAccounts(options: UseStorageAccountsOptions = {}) {
  const { enabled = true, autoRefreshMs, ttlMs = Infinity } = options;

  const [storageAccounts, setStorageAccounts] = useState<StorageAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // id della risorsa su cui sto facendo un'azione (es. delete)
  const [actionStorageId, setActionStorageId] = useState<string | null>(null);

  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!enabled) return;

      const force = !!opts?.force;
      if (force) dataCache.invalidate(CACHE_KEY);

      setLoading(true);
      setError(null);

      try {
        const data = await loadWithCache<StorageAccount[]>(
          CACHE_KEY,
          ttlMs,
          async () => {
            const result = await apiFetch<StorageAccount[]>("/api/storage-accounts");
            if (!result.ok) {
              throw new Error(result.error ?? `Errore HTTP ${result.status}`);
            }
            return result.data ?? [];
          }
        );

        setStorageAccounts(data ?? []);
      } catch (e: any) {
        setStorageAccounts([]);
        setError(e?.message ?? "Errore nel caricamento Storage Accounts.");
      } finally {
        setLoading(false);
      }
    },
    [enabled, ttlMs]
  );

  const deleteStorageAccount = useCallback(
    async (storageId: string) => {
      if (!enabled) return false;

      setActionStorageId(storageId);
      setError(null);

      const result = await apiFetch("/api/storage-accounts/delete", {
        method: "POST",
        body: { id: storageId },
      });

      if (!result.ok) {
        setError(result.error ?? `Errore HTTP ${result.status}`);
        setActionStorageId(null);
        return false;
      }

      // dopo delete: forza refresh per non rivedere cache
      await refresh({ force: true });
      setActionStorageId(null);
      return true;
    },
    [enabled, refresh]
  );

  // load iniziale / reset quando non abilitato
  useEffect(() => {
    if (!enabled) {
      setStorageAccounts([]);
      setLoading(false);
      setError(null);
      setActionStorageId(null);
      return;
    }
    void refresh(); // usa cache
  }, [enabled, refresh]);

  // auto refresh opzionale: qui forzo (così non resta stale)
  useEffect(() => {
    if (!enabled) return;
    if (!autoRefreshMs || autoRefreshMs <= 0) return;

    const t = window.setInterval(() => void refresh({ force: true }), autoRefreshMs);
    return () => window.clearInterval(t);
  }, [enabled, autoRefreshMs, refresh]);

  const stats = useMemo(() => ({ total: storageAccounts.length }), [storageAccounts]);

  return {
    storageAccounts,
    loading,
    error,
    actionStorageId,
    refresh, // ora supporta refresh({force:true})
    deleteStorageAccount,
    stats,
  };
}


