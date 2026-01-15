import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/Authcontext";
import { useVms } from "../hooks/useVms";
import { useStorageAccounts } from "../hooks/useStorageAccounts";
import { useAzureSqlDatabases } from "../hooks/useAzureSqlDatabases";

export function ResourcesPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const {
    vms,
    loading: vmsLoading,
    error: vmsError,
    actionVmId,
    refresh: refreshVms,
    startVm,
    stopVm,
    deleteVm, // ✅
  } = useVms({
    enabled: isAuthenticated,
    autoRefreshMs: 0,
  });

  const {
    storageAccounts,
    loading: saLoading,
    error: saError,
    actionStorageId, // ✅
    refresh: refreshStorageAccounts,
    deleteStorageAccount, // ✅
  } = useStorageAccounts({
    enabled: isAuthenticated,
    autoRefreshMs: 0,
  });

  const {
    databases,
    loading: dbLoading,
    error: dbError,
    actionDbId, // ✅
    refresh: refreshDatabases,
    deleteDatabase, // ✅
  } = useAzureSqlDatabases({
    enabled: isAuthenticated,
  });

  const isRefreshing = vmsLoading || saLoading || dbLoading;

  const handleRefreshAll = async () => {
    await Promise.all([refreshVms({force: true}), refreshStorageAccounts({force: true}), refreshDatabases({force: true})]);
  };

  type ResourceFilter = "all" | "vm" | "storage" | "database";
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>("all");

  const vmSectionRef = useRef<HTMLDivElement | null>(null);
  const storageSectionRef = useRef<HTMLDivElement | null>(null);
  const dbSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const target =
      resourceFilter === "vm"
        ? vmSectionRef.current
        : resourceFilter === "storage"
        ? storageSectionRef.current
        : resourceFilter === "database"
        ? dbSectionRef.current
        : null;

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [resourceFilter, isAuthenticated]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <h1>Risorse</h1>

        <label style={{ color: "#6b7280", fontSize: "0.9rem" }}>Tipo risorsa</label>

        <select
          value={resourceFilter}
          onChange={(e) => setResourceFilter(e.target.value as ResourceFilter)}
          disabled={authLoading || !isAuthenticated}
          style={{
            padding: "0.35rem 0.6rem",
            borderRadius: "0.5rem",
            border: "1px solid #d1d5db",
            background: "white",
          }}
        >
          <option value="all">Tutte</option>
          <option value="vm">Virtual Machines</option>
          <option value="storage">Storage Account</option>
          <option value="database">Azure SQL Database</option>
        </select>

        <button
          className="btn"
          onClick={() => void handleRefreshAll()}
          disabled={authLoading || !isAuthenticated || isRefreshing}
          title={!isAuthenticated ? "Collega l'account cloud per aggiornare" : ""}
        >
          {isRefreshing ? "Aggiorno..." : "Aggiorna"}
        </button>
      </div>

      {/* 1) Auth loading */}
      {authLoading && <p style={{ color: "#6b7280" }}>Verifica autenticazione in corso...</p>}

      {/* 2) Not authenticated */}
      {!authLoading && !isAuthenticated && (
        <p style={{ color: "#6b7280" }}>Collega il tuo account cloud per vedere le tue risorse.</p>
      )}

      {/* Contenuto risorse solo se autenticato */}
      {!authLoading && isAuthenticated && (
        <>
          {/* =========================
              SEZIONE VM
            ========================= */}
          {(resourceFilter === "all" || resourceFilter === "vm") && (
            <div ref={vmSectionRef}>
              <h2 style={{ marginTop: "1.25rem" }}>Virtual Machines</h2>

              {vmsLoading && <p style={{ color: "#6b7280" }}>Caricamento VM da Azure...</p>}

              {!vmsLoading && vmsError && <p style={{ color: "#b91c1c" }}>{vmsError}</p>}

              {!vmsLoading && !vmsError && vms.length > 0 && (
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
                      <th style={thStyle}>Nome</th>
                      <th style={thStyle}>Stato</th>
                      <th style={thStyle}>Regione</th>
                      <th style={thStyle}>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vms.map((vm) => (
                      <tr key={vm.id}>
                        <td style={tdStyle}>{vm.name}</td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              padding: "0.15rem 0.5rem",
                              borderRadius: "999px",
                              fontSize: "0.75rem",
                              backgroundColor: vm.state === "running" ? "#dcfce7" : "#fee2e2",
                              color: vm.state === "running" ? "#166534" : "#991b1b",
                            }}
                          >
                            {String(vm.state).toUpperCase()}
                          </span>
                        </td>
                        <td style={tdStyle}>{vm.region}</td>
                        <td style={tdStyle}>
                          <button
                            className="btn btn-primary"
                            onClick={() => void startVm(vm.id)}
                            disabled={vmsLoading || actionVmId === vm.id || vm.state === "running"}
                          >
                            Start
                          </button>

                          <button
                            className="btn btn-warning"
                            onClick={() => void stopVm(vm.id)}
                            disabled={vmsLoading || actionVmId === vm.id || vm.state === "stopped"}
                            style={{ marginLeft: 8 }}
                          >
                            Stop
                          </button>

                          <button
                            className="btn btn-danger"
                            disabled={vmsLoading || actionVmId === vm.id}
                            style={{ marginLeft: 8 }}
                            onClick={() => {
                              const ok = window.confirm(
                                `Eliminare la VM "${vm.name}" e le risorse collegate (NIC, IP pubblico, dischi)?`
                              );
                              if (!ok) return;
                              void deleteVm(vm.id);
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!vmsLoading && !vmsError && vms.length === 0 && (
                <p style={{ color: "#6b7280" }}>Nessuna VM trovata nel tuo abbonamento.</p>
              )}
            </div>
          )}

          {/* =========================
              SEZIONE STORAGE ACCOUNT
            ========================= */}
          {(resourceFilter === "all" || resourceFilter === "storage") && (
            <div ref={storageSectionRef}>
              <h2 style={{ marginTop: "1.5rem" }}>Storage Account</h2>

              {saLoading && <p style={{ color: "#6b7280" }}>Caricamento Storage Account da Azure...</p>}

              {!saLoading && saError && <p style={{ color: "#b91c1c" }}>{saError}</p>}

              {!saLoading && !saError && storageAccounts.length > 0 && (
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
                      <th style={thStyle}>Nome</th>
                      <th style={thStyle}>Regione</th>
                      <th style={thStyle}>SKU</th>
                      <th style={thStyle}>Kind</th>
                      <th style={thStyle}>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storageAccounts.map((sa) => (
                      <tr key={sa.id}>
                        <td style={tdStyle}>{sa.name}</td>
                        <td style={tdStyle}>{sa.location}</td>
                        <td style={tdStyle}>{sa.sku ?? "-"}</td>
                        <td style={tdStyle}>{sa.kind ?? "-"}</td>
                        <td style={tdStyle}>
                          <button
                            className="btn btn-danger"
                            disabled={saLoading || actionStorageId === sa.id}
                            onClick={() => {
                              const ok = window.confirm(`Eliminare lo Storage Account "${sa.name}"?`);
                              if (!ok) return;
                              void deleteStorageAccount(sa.id);
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!saLoading && !saError && storageAccounts.length === 0 && (
                <p style={{ color: "#6b7280" }}>Nessuno Storage Account trovato nel tuo abbonamento.</p>
              )}
            </div>
          )}

          {/* =========================
              SEZIONE DATABASE AZURE SQL
            ========================= */}
          {(resourceFilter === "all" || resourceFilter === "database") && (
            <div ref={dbSectionRef}>
              <h2 style={{ marginTop: "1.5rem" }}>Azure SQL Database</h2>

              {dbLoading && <p style={{ color: "#6b7280" }}>Caricamento database Azure SQL...</p>}

              {!dbLoading && dbError && <p style={{ color: "#b91c1c" }}>{dbError}</p>}

              {!dbLoading && !dbError && databases.length > 0 && (
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
                      <th style={thStyle}>Nome</th>
                      <th style={thStyle}>Server</th>
                      <th style={thStyle}>Regione</th>
                      <th style={thStyle}>SKU</th>
                      <th style={thStyle}>Stato</th>
                      <th style={thStyle}>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {databases.map((db) => (
                      <tr key={db.id}>
                        <td style={tdStyle}>{db.name}</td>
                        <td style={tdStyle}>{db.server ?? "-"}</td>
                        <td style={tdStyle}>{db.location}</td>
                        <td style={tdStyle}>{db.sku ?? "-"}</td>
                        <td style={tdStyle}>{db.status ?? "-"}</td>
                        <td style={tdStyle}>
                          <button
                            className="btn btn-danger"
                            disabled={dbLoading || actionDbId === db.id}
                            onClick={() => {
                              const ok = window.confirm(`Eliminare il database "${db.name}"?`);
                              if (!ok) return;
                              void deleteDatabase(db.id);
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!dbLoading && !dbError && databases.length === 0 && (
                <p style={{ color: "#6b7280" }}>Nessun database Azure SQL trovato.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

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
