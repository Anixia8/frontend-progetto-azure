import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/apiFetch";
import { loadWithCache } from "../cache/loadWithCache";
import { dataCache } from "../cache/dataCache";

export type VmResource = {
  id: string;
  name: string;
  state: "running" | "stopped" | string;
  region: string;
};

type UseVmsOptions = {
  enabled?: boolean;       // carica solo se true (es. autenticato)
  autoRefreshMs?: number;  // es. 20000 per refresh ogni 20s (0/undefined = off)
  ttlMs?: number;          // TTL cache (default 60s)
};

const CACHE_KEY = "resources:vms";

export function useVms(options: UseVmsOptions = {}) {
  const { enabled = true, autoRefreshMs, ttlMs = Infinity } = options;

  const [vms, setVms] = useState<VmResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionVmId, setActionVmId] = useState<string | null>(null);

  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!enabled) return;

      const force = !!opts?.force;
      if (force) dataCache.invalidate(CACHE_KEY);

      setLoading(true);
      setError(null);

      try {
        const data = await loadWithCache<VmResource[]>(
          CACHE_KEY,
          ttlMs,
          async () => {
            const result = await apiFetch<VmResource[]>("/api/vms");
            if (!result.ok) {
              throw new Error(result.error ?? `Errore HTTP ${result.status}`);
            }
            return result.data ?? [];
          }
        );

        setVms(data ?? []);
      } catch (e: any) {
        setVms([]);
        setError(e?.message ?? "Errore nel caricamento VM.");
      } finally {
        setLoading(false);
      }
    },
    [enabled, ttlMs]
  );

  const startVm = useCallback(
    async (vmId: string) => {
      setActionVmId(vmId);
      setError(null);

      const res = await apiFetch("/api/vms/start", {
        method: "POST",
        body: { id: vmId },
      });

      if (!res.ok) {
        setError(res.error ?? `Errore HTTP ${res.status}`);
        setActionVmId(null);
        return false;
      }

      // dopo azione: forza refresh per vedere lo stato aggiornato
      await refresh({ force: true });
      setActionVmId(null);
      return true;
    },
    [refresh]
  );

  const stopVm = useCallback(
    async (vmId: string) => {
      setActionVmId(vmId);
      setError(null);

      const res = await apiFetch("/api/vms/stop", {
        method: "POST",
        body: { id: vmId },
      });

      if (!res.ok) {
        setError(res.error ?? `Errore HTTP ${res.status}`);
        setActionVmId(null);
        return false;
      }

      await refresh({ force: true });
      setActionVmId(null);
      return true;
    },
    [refresh]
  );

  const deleteVm = useCallback(
    async (vmId: string) => {
      setActionVmId(vmId);
      setError(null);

      const res = await apiFetch("/api/vms/delete", {
        method: "POST",
        body: { id: vmId },
      });

      if (!res.ok) {
        setError(res.error ?? `Errore HTTP ${res.status}`);
        setActionVmId(null);
        return false;
      }

      await refresh({ force: true });
      setActionVmId(null);
      return true;
    },
    [refresh]
  );

  // load iniziale / reset quando non abilitato
  useEffect(() => {
    if (!enabled) {
      setVms([]);
      setLoading(false);
      setError(null);
      setActionVmId(null);
      return;
    }
    void refresh(); // usa cache
  }, [enabled, refresh]);

  // auto refresh opzionale: qui io forzo (così non resta “stale” troppo a lungo)
  useEffect(() => {
    if (!enabled) return;
    if (!autoRefreshMs || autoRefreshMs <= 0) return;

    const t = window.setInterval(() => void refresh({ force: true }), autoRefreshMs);
    return () => window.clearInterval(t);
  }, [enabled, autoRefreshMs, refresh]);

  const stats = useMemo(() => {
    const running = vms.filter((v) => v.state === "running").length;
    const stopped = vms.filter((v) => v.state === "stopped").length;
    return { total: vms.length, running, stopped };
  }, [vms]);

  return {
    vms,
    loading,
    error,
    actionVmId,
    refresh,     // ora supporta refresh({force:true})
    startVm,
    stopVm,
    deleteVm,
    stats,
  };
}

