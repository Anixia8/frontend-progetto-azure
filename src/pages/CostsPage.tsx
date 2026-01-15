import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { useAuth } from "../auth/Authcontext";
import { apiFetch } from "../api/apiFetch";
import { loadWithCache } from "../cache/loadWithCache";
import { dataCache } from "../cache/dataCache";
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

type Cost = {
  date: string;
  amount: number;
};

type CostByResource = {
  date: string;
  resourceId: string;
  resourceName: string;
  amount: number;
};

type ViewMode = "month" | "day";

export function CostsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  // ---- modalità vista ----
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  // ---- dati ----
  const [costs, setCosts] = useState<Cost[]>([]);
  const [costsByResource, setCostsByResource] = useState<CostByResource[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Filtri mese/anno ----
  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState<number>(now.getMonth() + 1); // 1..12
  const [year, setYear] = useState<number>(now.getFullYear());

  const years = useMemo(() => {
    const y = now.getFullYear();
    return Array.from({ length: 6 }, (_, i) => y - i);
  }, [now]);

  // ---- Filtro giorno ----
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const todayIso = useMemo(() => `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`, [now]);
  const [day, setDay] = useState<string>(todayIso);

  const totalCostMonth = useMemo(() => costs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0), [costs]);
  const totalCostDay = useMemo(
    () => costsByResource.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [costsByResource]
  );

  const monthLabel = useMemo(() => {
    const d = new Date(year, month - 1, 1);
    return d.toLocaleString("it-IT", { month: "long", year: "numeric" });
  }, [month, year]);

  const dayLabel = useMemo(() => {
    const [yy, mm, dd] = day.split("-");
    if (!yy || !mm || !dd) return day;
    return `${dd}/${mm}/${yy}`;
  }, [day]);

  const chartData = useMemo(() => {
    return [...costs]
      .slice()
      .reverse()
      .map((c) => ({
        day: c.date.slice(8, 10),
        amount: Number(c.amount),
      }));
  }, [costs]);

  const pxPerDay = 38;
  const chartWidth = Math.max(520, chartData.length * pxPerDay);

  // ✅ Cache “manuale”: non scade mai. Si invalida SOLO su force oppure cambio key.
  const COSTS_TTL = Number.POSITIVE_INFINITY;

  const cacheKeyMonth = useMemo(() => `costs:month:${year}-${month}`, [year, month]);
  const cacheKeyDay = useMemo(() => `costs:day:${day}`, [day]);

  const loadCosts = async (mode: ViewMode, opts?: { force?: boolean }) => {
    setLoading(true);
    setError(null);

    try {
      if (mode === "month") {
        if (opts?.force) dataCache.invalidate(cacheKeyMonth);

        const data = await loadWithCache<Cost[]>(cacheKeyMonth, COSTS_TTL, async () => {
          const res = await apiFetch<Cost[]>(`/api/costs?month=${month}&year=${year}`, { method: "GET" });
          if (!res.ok) throw new Error(res.error ?? `Errore HTTP ${res.status}`);
          return Array.isArray(res.data) ? res.data : [];
        });

        setCosts(data);
        setCostsByResource([]);
        return;
      }

      // mode === "day"
      if (opts?.force) dataCache.invalidate(cacheKeyDay);

      const data = await loadWithCache<CostByResource[]>(cacheKeyDay, COSTS_TTL, async () => {
        const res = await apiFetch<CostByResource[]>(`/api/costs?date=${day}`, { method: "GET" });
        if (!res.ok) throw new Error(res.error ?? `Errore HTTP ${res.status}`);
        return Array.isArray(res.data) ? res.data : [];
      });

      setCostsByResource(data);
      setCosts([]);
    } catch (err: any) {
      const msg =
        typeof err?.message === "string" && err.message
          ? err.message
          : "Errore nel caricamento dei costi.";

      setError(msg);
      setCosts([]);
      setCostsByResource([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setCosts([]);
      setCostsByResource([]);
      setLoading(false);
      setError(null);
      return;
    }

    // carico in base alla modalità: usa cache (no force)
    if (viewMode === "month") {
      void loadCosts("month");
    } else {
      void loadCosts("day");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, viewMode]);

  // opzionale: se cambi mese/anno o day, NON carico da solo (resta come prima: serve “Applica”)
  // Se vuoi che al cambio selettore carichi subito, dimmelo e lo facciamo.

  const handleApply = () => {
    if (viewMode === "month") void loadCosts("month");
    else void loadCosts("day");
  };

  const handleRefresh = () => {
    // Forza aggiornamento (bypassa cache)
    if (viewMode === "month") void loadCosts("month", { force: true });
    else void loadCosts("day", { force: true });
  };

  return (
    <div>
      <h1>Costi</h1>

      {authLoading && <p style={{ color: "#6b7280" }}>Verifica autenticazione in corso...</p>}

      {!authLoading && !isAuthenticated && (
        <p style={{ color: "#6b7280" }}>Collega il tuo account cloud per vedere i tuoi costi.</p>
      )}

      {!authLoading && isAuthenticated && (
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "end",
            flexWrap: "wrap",
            marginTop: "0.75rem",
          }}
        >
          <div>
            <label style={labelStyle}>Visualizzazione</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              disabled={loading}
              style={inputStyle}
            >
              <option value="month">Per mese</option>
              <option value="day">Per giorno</option>
            </select>
          </div>

          {viewMode === "month" ? (
            <>
              <div>
                <label style={labelStyle}>Mese</label>
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))} disabled={loading} style={inputStyle}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1, 1).toLocaleString("it-IT", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Anno</label>
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} disabled={loading} style={inputStyle}>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button className="btn" onClick={handleApply} disabled={loading} title="Carica i costi del mese selezionato">
                {loading ? "Carico..." : "Applica"}
              </button>

              {/* ✅ bottone refresh vero (opzionale ma utile) */}
              <button className="btn" onClick={handleRefresh} disabled={loading} title="Forza aggiornamento (ignora cache)">
                {loading ? "Aggiorno..." : "Aggiorna"}
              </button>

              <div style={{ marginLeft: "auto", color: "#374151" }}>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Periodo selezionato</div>
                <div style={{ fontWeight: 600 }}>{monthLabel}</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={labelStyle}>Giorno</label>
                <input type="date" value={day} onChange={(e) => setDay(e.target.value)} disabled={loading} style={inputStyle} />
              </div>

              <button className="btn" onClick={handleApply} disabled={loading} title="Carica i costi del giorno selezionato">
                {loading ? "Carico..." : "Applica"}
              </button>

              {/* ✅ bottone refresh vero */}
              <button className="btn" onClick={handleRefresh} disabled={loading} title="Forza aggiornamento (ignora cache)">
                {loading ? "Aggiorno..." : "Aggiorna"}
              </button>

              <div style={{ marginLeft: "auto", color: "#374151" }}>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Giorno selezionato</div>
                <div style={{ fontWeight: 600 }}>{dayLabel}</div>
              </div>
            </>
          )}
        </div>
      )}

      {!authLoading && isAuthenticated && loading && (
        <p style={{ color: "#6b7280", marginTop: "0.75rem" }}>Caricamento dei costi da Azure...</p>
      )}

      {!authLoading && isAuthenticated && error && !loading && (
        <p style={{ color: "#b91c1c", marginTop: "0.75rem" }}>{error}</p>
      )}

      {!authLoading && isAuthenticated && !loading && !error && viewMode === "month" && costs.length > 0 && (
        <>
          <div style={{ marginTop: "0.75rem", color: "#111827", fontWeight: 600 }}>
            Totale {monthLabel}: € {totalCostMonth.toFixed(2)}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(420px, 1fr) minmax(320px, 1fr)",
              gap: "1.25rem",
              marginTop: "0.75rem",
              alignItems: "stretch",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                backgroundColor: "white",
                borderRadius: "0.75rem",
                overflow: "hidden",
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>Data</th>
                  <th style={thStyle}>Costo (€)</th>
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => (
                  <tr key={c.date}>
                    <td style={tdStyle}>{c.date}</td>
                    <td style={tdStyle}>{Number(c.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              style={{
                background: "white",
                borderRadius: "0.75rem",
                padding: "0.75rem",
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Andamento giornaliero (€)</div>

              <div style={{ overflowX: "auto", overflowY: "hidden", width: "100%", paddingBottom: 6 }}>
                <div style={{ width: chartWidth, height: 260 }}>
                  <BarChart width={chartWidth} height={260} data={chartData}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip formatter={(value) => (typeof value === "number" ? `€ ${value.toFixed(2)}` : value)} />
                    <Bar dataKey="amount" fill="#14b8a6" radius={[0, 0, 0, 0]} />
                  </BarChart>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!authLoading && isAuthenticated && !loading && !error && viewMode === "day" && costsByResource.length > 0 && (
        <>
          <div style={{ marginTop: "0.75rem", color: "#111827", fontWeight: 600 }}>
            Totale {dayLabel}: € {totalCostDay.toFixed(2)}
          </div>

          <table
            style={{
              width: "100%",
              marginTop: "0.75rem",
              borderCollapse: "collapse",
              backgroundColor: "white",
              borderRadius: "0.75rem",
              overflow: "hidden",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>Risorsa</th>
                <th style={thStyle}>Costo (€)</th>
              </tr>
            </thead>
            <tbody>
              {costsByResource.map((r) => (
                <tr key={r.resourceId || `${r.resourceName}-${r.amount}`}>
                  <td style={tdStyle}>{r.resourceName || "-"}</td>
                  <td style={tdStyle}>{Number(r.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!authLoading &&
        isAuthenticated &&
        !loading &&
        !error &&
        ((viewMode === "month" && costs.length === 0) || (viewMode === "day" && costsByResource.length === 0)) && (
          <p style={{ color: "#6b7280", marginTop: "0.75rem" }}>Nessun dato di costo disponibile.</p>
        )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#6b7280",
  fontSize: 13,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  padding: "0.45rem 0.6rem",
  borderRadius: "0.5rem",
  border: "1px solid #d1d5db",
  background: "white",
};

const thStyle: React.CSSProperties = {
  padding: "0.7rem 0.9rem",
  borderBottom: "1px solid #e5e7eb",
  backgroundColor: "#f9fafb",
  fontSize: "0.85rem",
  color: "#6b7280",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  padding: "0.7rem 0.9rem",
  borderBottom: "1px solid #e5e7eb",
};




