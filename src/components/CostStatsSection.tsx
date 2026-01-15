//import type React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const PIE_COLORS_BY_TYPE: Record<string, string> = {
  "Virtual Machines": "#3b82f6", // blu
  "Databases": "#a855f7",        // viola
  "Storage Accounts": "#22c55e",          // verde
  "Other": "#9ca3af",            // grigio (fallback)
};

const PIE_FALLBACK_COLORS = ["#f59e0b", "#ef4444", "#06b6d4", "#84cc16"];

type LinePoint = { day: string; amount: number }; // day: "01", "02", ...
type PieSlice = { name: string; value: number };  // es: VM / Storage / Azure SQL

export function CostStatsSection({
  monthLabel,
  //totalMonth,
  lineData,
  pieData,
  loading,
  error,
}: {
  monthLabel: string;
  //totalMonth: number;
  lineData: LinePoint[];
  pieData: PieSlice[];
  loading?: boolean;
  error?: string | null;
}) {
  const hasLine = (lineData?.length ?? 0) > 0;
  const hasPie = (pieData?.length ?? 0) > 0;

  return (
    <section style={{ marginTop: "1.25rem" }}>
      <div
        style={{
          background: "white",
          borderRadius: "0.75rem",
          padding: "1rem",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#111827" }}>Statistiche sui costi</h2>
            <div style={{ marginTop: 4, color: "#6b7280", fontSize: 13 }}>
              Periodo: <span style={{ fontWeight: 600, color: "#374151" }}>{monthLabel}</span>
            </div>
          </div>
        </div>

        {/* Stato */}
        {loading && <p style={{ color: "#6b7280", marginTop: 12 }}>Caricamento statistiche costi…</p>}
        {!loading && error && <p style={{ color: "#b91c1c", marginTop: 12 }}>{error}</p>}

        {/* Contenuto */}
        {!loading && !error && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(480px, 1fr) minmax(320px, 0.7fr)",
              gap: "1rem",
              marginTop: 12,
              alignItems: "stretch",
            }}
          >
            {/* LINE CHART: andamento */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "0.75rem",
                minHeight: 320,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                Andamento giornaliero (€)
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>
                Totale per giorno nel mese corrente
              </div>

              {!hasLine ? (
                <p style={{ color: "#6b7280", marginTop: 14 }}>Nessun dato disponibile per il grafico.</p>
              ) : (
                <div style={{ width: "100%", height: 260, marginTop: 10 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip
                        formatter={(value) =>
                          typeof value === "number" ? `€ ${value.toFixed(2)}` : value
                        }
                        labelFormatter={(label) => `Giorno ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* PIE CHART: ripartizione */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "0.75rem",
                minHeight: 320,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                Ripartizione costi
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>
                Costi per tipologia risorsa
              </div>

              {!hasPie ? (
                <p style={{ color: "#6b7280", marginTop: 14 }}>Nessun dato disponibile per la ripartizione.</p>
              ) : (
                <div style={{ width: "100%", height: 260, marginTop: 10 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        formatter={(value) =>
                          typeof value === "number" ? `€ ${value.toFixed(2)}` : value
                        }
                      />
                      <Legend verticalAlign="bottom" height={36} />
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {/* niente colori fissi: recharts userà default; se vuoi palette tua poi la aggiungiamo */}
                        {pieData.map((entry, idx) => {
                            const color =
                                PIE_COLORS_BY_TYPE[entry.name] ??
                                PIE_FALLBACK_COLORS[idx % PIE_FALLBACK_COLORS.length];

                            return <Cell key={`${entry.name}-${idx}`} fill={color} />;
                        })}

                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Mini elenco numeri (utile anche se il grafico è piccolo) */}
              {hasPie && (
                <div style={{ marginTop: 6 }}>
                  {pieData.map((s) => (
                    <div
                      key={s.name}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        fontSize: 13,
                        color: "#374151",
                        padding: "6px 0",
                        borderTop: "1px solid #f3f4f6",
                      }}
                    >
                      <span>{s.name}</span>
                      <span style={{ fontWeight: 600 }}>€ {Number(s.value || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** ESEMPIO DI DATI PLACEHOLDER (da rimuovere quando colleghi le API) */
export const demoLineData: LinePoint[] = [
  { day: "01", amount: 1.2 },
  { day: "02", amount: 0.8 },
  { day: "03", amount: 1.6 },
  { day: "04", amount: 1.1 },
];

export const demoPieData: PieSlice[] = [
  { name: "Virtual Machines", value: 12.4 },
  { name: "Databases", value: 9.8 },
  { name: "Storage Accounts", value: 6.1 },
];
