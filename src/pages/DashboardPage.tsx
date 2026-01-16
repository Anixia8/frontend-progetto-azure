//import
import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { useAuth } from "../auth/Authcontext";
import { apiFetch } from "../api/apiFetch";
import { CostStatsSection } from "../components/CostStatsSection";
import { loadWithCache } from "../cache/loadWithCache";
import { dataCache } from "../cache/dataCache";


type ResourceType = "vm" | "storage" | "azure-sql";

type VmItem = { id: string; name: string };
type StorageItem = { id: string; name: string };
type AzureSqlDbItem = { id: string; name: string };
type CostItem = { date: string; amount: number };

// (tipi per grafici — solo per i dati passati al componente)
type LinePoint = { day: string; amount: number };
type PieSlice = { name: string; value: number };

export function DashboardPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  // dati REALI (da backend)
  const [totalVms, setTotalVms] = useState(0);
  const [totalResources, setTotalResources] = useState(0);
  const [monthlyCost, setMonthlyCost] = useState(0);

  const [totalStorages, setTotalStorages] = useState(0);
  const [totalAzureSqlDbs, setTotalAzureSqlDbs] = useState(0);

  // ✅ per line chart (costi giornalieri mese corrente)
  const [monthlyCostsDaily, setMonthlyCostsDaily] = useState<CostItem[]>([]);
  const [pieData, setPieData] = useState<PieSlice[]>([]);

  // dropdown “a cascata” per scegliere quale totale visualizzare
  type TotalKind = "vm" | "storage" | "azure-sql";
  const [totalKind, setTotalKind] = useState<TotalKind>("vm");

  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);

  // mese/anno correnti (stabili)
  const now = useMemo(() => new Date(), []);
  const currentMonth = now.getMonth() + 1; // 1..12
  const currentYear = now.getFullYear();

  const monthLabel = useMemo(() => {
    return new Date(currentYear, currentMonth - 1, 1).toLocaleString("it-IT", {
      month: "long",
      year: "numeric",
    });
  }, [currentMonth, currentYear]);

  // dati per il line chart: da CostItem[] -> {day, amount} e ordinati 01..31
  const lineData: LinePoint[] = useMemo(() => {
    return [...monthlyCostsDaily]
      .slice()
      .reverse()
      .map((c) => ({
        day: c.date.slice(8, 10),
        amount: Number(c.amount) || 0,
      }));
  }, [monthlyCostsDaily]);


const DASH_TTL = Infinity; // 60s (puoi alzare a 120_000 se vuoi)

type FetchError = { status?: number; message: string };

const loadDashboardData = async () => {
  if (!isAuthenticated) return;

  setDashLoading(true);
  setDashError(null);

  // chiavi cache (costs/pie dipendono da mese/anno!)
  const keyVms = "dash:vms";
  const keyStorage = "dash:storage";
  const keyDb = "dash:db";
  const keyCosts = `dash:costs:${currentYear}-${currentMonth}`;
  const keyPie = `dash:pie:${currentYear}-${currentMonth}`;

  // helper: fa apiFetch e se non ok lancia errore con status
  const fetchOrThrow = async <T,>(endpoint: string): Promise<T> => {
    const res = await apiFetch<T>(endpoint, { method: "GET" });
    if (!res.ok) {
      const err: FetchError = { status: res.status, message: res.error || "Errore backend" };
      throw err;
    }
    return (res.data ?? null) as T;
  };

  try {
    const [vms, storages, dbs, costs, pie] = await Promise.all([
      loadWithCache(keyVms, DASH_TTL, async () => (await fetchOrThrow<VmItem[]>("/api/vms")) ?? []),
      loadWithCache(keyStorage, DASH_TTL, async () => (await fetchOrThrow<StorageItem[]>("/api/storage-accounts")) ?? []),
      loadWithCache(keyDb, DASH_TTL, async () => (await fetchOrThrow<AzureSqlDbItem[]>("/api/azure-sql-databases")) ?? []),
      loadWithCache(
        keyCosts,
        DASH_TTL,
        async () => (await fetchOrThrow<CostItem[]>(`/api/costs?month=${currentMonth}&year=${currentYear}`)) ?? []
      ),
      loadWithCache(
        keyPie,
        DASH_TTL,
        async () => (await fetchOrThrow<PieSlice[]>(`/api/costs/by-type?month=${currentMonth}&year=${currentYear}`)) ?? []
      ),
    ]);

    setTotalVms(vms.length);
    setTotalStorages(storages.length);
    setTotalAzureSqlDbs(dbs.length);
    setTotalResources(vms.length + storages.length + dbs.length);

    setPieData(pie ?? []);
    setMonthlyCostsDaily(costs ?? []);

    const total = (costs ?? []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    setMonthlyCost(total);
  } catch (e: any) {
    const status = (e as FetchError)?.status;

    if (status === 401) {
      setDashError("Non sei autenticato. Collega l'account cloud per vedere i dati.");
    } else if (status === 429) {
      setDashError("Troppe richieste verso Azure (429). Riprova tra qualche secondo.");
    } else {
      setDashError("Errore nel caricamento dei dati della dashboard.");
    }

    setMonthlyCostsDaily([]);
    setMonthlyCost(0);
  } finally {
    setDashLoading(false);
  }
};


  useEffect(() => {
    if (!isAuthenticated) {
      setTotalVms(0);
      setTotalResources(0);
      setMonthlyCost(0);
      setTotalStorages(0);
      setTotalAzureSqlDbs(0);
      setMonthlyCostsDaily([]);
      setDashError(null);
      setDashLoading(false);
      return;
    }

    void loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentMonth, currentYear]);

  // modal + form create resource
  const [showCreateResource, setShowCreateResource] = useState(false);
  const [resourceType, setResourceType] = useState<ResourceType>("vm");

  // ====== VM fields ======
  const [newVmRg, setNewVmRg] = useState("");
  const [newVmVnet, setNewVmVnet] = useState("");
  const [newVmSubnet, setNewVmSubnet] = useState("");
  const [newVmName, setNewVmName] = useState("");
  const [newVmUser, setNewVmUser] = useState("");
  const [newVmPassword, setNewVmPassword] = useState("");
  const [newVmSize, setNewVmSize] = useState("Standard_DS1_v2");

  // ====== Storage fields ======
  const [newStRg, setNewStRg] = useState("");
  const [newStAccountName, setNewStAccountName] = useState("");
  const [newStContainerName, setNewStContainerName] = useState("");

  // ====== Azure SQL fields ======
  const [newSqlRg, setNewSqlRg] = useState("");
  const [newSqlServerName, setNewSqlServerName] = useState("");
  const [newSqlDbName, setNewSqlDbName] = useState("");
  const [newSqlAdminLogin, setNewSqlAdminLogin] = useState("");
  const [newSqlAdminPassword, setNewSqlAdminPassword] = useState("");
  const [newSqlSkuName, setNewSqlSkuName] = useState("Basic");
  //const [newSqlAllowAzureServices, setNewSqlAllowAzureServices] = useState(true);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const openCreateResource = () => {
    setCreateError(null);
    setCreateSuccess(null);
    setShowCreateResource(true);
  };

  const closeCreateResource = () => setShowCreateResource(false);

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    // VALIDAZIONE BASE per tipo risorsa
    if (resourceType === "vm") {
      if (!newVmRg || !newVmVnet || !newVmSubnet || !newVmName || !newVmUser || !newVmPassword) {
        setCreateError("Compila tutti i campi obbligatori della VM.");
        return;
      }
    }

    if (resourceType === "storage") {
      if (!newStRg || !newStAccountName) {
        setCreateError("Compila Resource Group e Storage account name.");
        return;
      }
    }

    if (resourceType === "azure-sql") {
      if (!newSqlRg || !newSqlServerName || !newSqlDbName || !newSqlAdminLogin || !newSqlAdminPassword) {
        setCreateError("Compila tutti i campi obbligatori di Azure SQL.");
        return;
      }
    }

    setCreating(true);

    try {
      // ======== CALL API IN BASE AL TIPO ========
      if (resourceType === "vm") {
        const result = await apiFetch<any>("/api/provision-vm", {
          method: "POST",
          body: {
            rg_name: newVmRg,
            vnet_name: newVmVnet,
            subnet_name: newVmSubnet,
            vm_name: newVmName,
            username: newVmUser,
            password: newVmPassword,
            vm_size: newVmSize || "Standard_DS1_v2",
          },
        });

        if (!result.ok) {
          if (result.status === 401) {
            setCreateError("Non sei autenticato. Ricollega l'account cloud e riprova.");
            return;
          }
          setCreateError(result.error ?? `Errore HTTP ${result.status}`);
          return;
        }

        const data = result.data;
        if (data?.status === "already-exists") {
          setCreateSuccess(
            `La VM ${data.vmName ?? newVmName} esiste già nel resource group ${data.resourceGroup ?? newVmRg}.`
          );
        } else {
          setCreateSuccess(
            `VM ${data?.vmName ?? newVmName} creata correttamente nel resource group ${data?.resourceGroup ?? newVmRg}.`
          );
        }

        setNewVmName("");
        setNewVmPassword("");
      }

      if (resourceType === "storage") {
        const result = await apiFetch<any>("/api/provision-storage", {
          method: "POST",
          body: {
            rg_name: newStRg,
            storage_account_name: newStAccountName,
            container_name: newStContainerName || undefined,
          },
        });

        if (!result.ok) {
          if (result.status === 401) {
            setCreateError("Non sei autenticato. Ricollega l'account cloud e riprova.");
            return;
          }
          setCreateError(result.error ?? `Errore HTTP ${result.status}`);
          return;
        }

        const data = result.data;
        if (data?.status === "already-exists") {
          setCreateSuccess(
            `Lo storage account ${data.storageAccountName ?? newStAccountName} esiste già nel resource group ${data.resourceGroup ?? newStRg}.`
          );
        } else {
          setCreateSuccess(
            `Storage account ${data?.storageAccountName ?? newStAccountName} creato correttamente nel resource group ${data?.resourceGroup ?? newStRg}.`
          );
        }
      }

      if (resourceType === "azure-sql") {
        const result = await apiFetch<any>("/api/provision-azure-sql", {
          method: "POST",
          body: {
            rg_name: newSqlRg,
            server_name: newSqlServerName,
            db_name: newSqlDbName,
            admin_login: newSqlAdminLogin,
            admin_password: newSqlAdminPassword,
            sku_name: newSqlSkuName,
            //allow_azure_services: newSqlAllowAzureServices,
          },
        });

        if (!result.ok) {
          if (result.status === 401) {
            setCreateError("Non sei autenticato. Ricollega l'account cloud e riprova.");
            return;
          }
          setCreateError(result.error ?? `Errore HTTP ${result.status}`);
          return;
        }

        const data = result.data;
        const serverStatus = data?.server?.status;
        const dbName = data?.database?.name ?? newSqlDbName;
        const serverName = data?.server?.name ?? newSqlServerName;

        setCreateSuccess(
          `Azure SQL: server "${serverName}" (${serverStatus ?? "ok"}), database "${dbName}" creato/aggiornato.`
        );

        // pulizia password
        setNewSqlAdminPassword("");
      }

      // dopo creazione: invalido cache e ricarico dati reali
      handleRefreshDashboard();
    } catch {
      setCreateError("Errore di rete nella creazione della risorsa.");
    } finally {
      setCreating(false);
    }
  };

  const handleRefreshDashboard = () => {
    if (dashLoading) return;

    const keys = [
      "dash:vms",
      "dash:storage",
      "dash:db",
      `dash:costs:${currentYear}-${currentMonth}`,
      `dash:pie:${currentYear}-${currentMonth}`,
    ];

    dataCache.invalidateMany(keys);
    void loadDashboardData();
  };



  const resourceTitle =
    resourceType === "vm"
      ? "Crea una nuova VM"
      : resourceType === "storage"
      ? "Crea Storage Account"
      : "Crea Azure SQL Database";

  const resourceSubtitle =
    resourceType === "vm"
      ? "Compila i campi per avviare il provisioning della VM su Azure."
      : resourceType === "storage"
      ? "Compila i campi per creare uno Storage Account su Azure."
      : "Compila i campi per creare Server + Database Azure SQL (se necessari).";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <h1>Dashboard</h1>
          <p>Panoramica generale della piattaforma.</p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            className="btn"
            onClick={handleRefreshDashboard}
            disabled={authLoading || !isAuthenticated || dashLoading}
          >
            {dashLoading ? "Aggiorno..." : "Aggiorna"}
          </button>

          <button
            className="btn btn-primary"
            onClick={openCreateResource}
            disabled={authLoading || !isAuthenticated}
            title={
              authLoading
                ? "Verifica autenticazione in corso..."
                : !isAuthenticated
                ? "Collega l'account cloud per creare una risorsa"
                : ""
            }
          >
            Crea risorsa
          </button>
        </div>
      </div>

      {/* errore caricamento dashboard */}
      {!authLoading && isAuthenticated && dashError && (
        <p style={{ color: "#b91c1c", marginTop: 10 }}>{dashError}</p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginTop: "1rem",
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "0.75rem",
            padding: "1rem",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontSize: "0.9rem", color: "#6b7280", display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={totalKind}
              onChange={(e) => setTotalKind(e.target.value as TotalKind)}
              style={{
                padding: "0.15rem 0.2rem",
                borderRadius: "0.2rem",
                border: "1px solid #d1d5db",
                background: "white",
                fontSize: "0.8rem",
                color: "#6b7280",
              }}
            >
              <option value="vm">Virtual Machines</option>
              <option value="azure-sql">Databases</option>
              <option value="storage">Storage Accounts</option>
            </select>

            <span>totali</span>
          </div>

          <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>
            {totalKind === "vm" ? totalVms : totalKind === "storage" ? totalStorages : totalAzureSqlDbs}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "white",
            borderRadius: "0.75rem",
            padding: "1rem",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>Risorse totali</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>{totalResources}</div>
        </div>

        <div
          style={{
            backgroundColor: "white",
            borderRadius: "0.75rem",
            padding: "1rem",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>Costo mensile stimato</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>€ {monthlyCost.toFixed(2)}</div>
        </div>
      </div>

      {/* 
      SEZIONE: STATISTICHE COSTI */}
      {!authLoading && isAuthenticated && (
        <CostStatsSection
          monthLabel={monthLabel}
          //totalMonth={monthlyCost}
          lineData={lineData}
          pieData={pieData}
          loading={dashLoading}
          error={dashError}
        />
      )}

      {showCreateResource && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={closeCreateResource}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleCreateResource}>
              {/* HEADER */}
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">{resourceTitle}</h2>
                  <p className="modal-subtitle">{resourceSubtitle}</p>
                </div>

                <button type="button" className="btn" onClick={closeCreateResource} disabled={creating}>
                  Chiudi
                </button>
              </div>

              {/* BODY */}
              <div className="modal-body">
                {createError && <div className="alert alert-error">{createError}</div>}
                {createSuccess && <div className="alert alert-success">{createSuccess}</div>}

                {/* SELECT TIPO RISORSA */}
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>Tipo risorsa</label>
                  <select
                    className="input"
                    value={resourceType}
                    onChange={(e) => {
                      setResourceType(e.target.value as ResourceType);
                      setCreateError(null);
                      setCreateSuccess(null);
                    }}
                    disabled={creating}
                  >
                    <option value="vm">Virtual Machine</option>
                    <option value="storage">Storage Account</option>
                    <option value="azure-sql">Azure SQL Database</option>
                  </select>
                </div>

                {/* FORM DINAMICO */}
                <div className="form-grid">
                  {/* ====== VM ====== */}
                  {resourceType === "vm" && (
                    <>
                      <div className="field">
                        <label>Resource Group</label>
                        <input
                          className="input"
                          value={newVmRg}
                          onChange={(e) => setNewVmRg(e.target.value)}
                          placeholder="es. my-rg"
                        />
                        <span className="help">Resource Group già esistente</span>
                      </div>

                      <div className="field">
                        <label>Virtual Network</label>
                        <input
                          className="input"
                          value={newVmVnet}
                          onChange={(e) => setNewVmVnet(e.target.value)}
                          placeholder="es. my-vnet"
                        />
                      </div>

                      <div className="field">
                        <label>Subnet</label>
                        <input
                          className="input"
                          value={newVmSubnet}
                          onChange={(e) => setNewVmSubnet(e.target.value)}
                          placeholder="es. default"
                        />
                      </div>

                      <div className="field">
                        <label>Nome VM</label>
                        <input
                          className="input"
                          value={newVmName}
                          onChange={(e) => setNewVmName(e.target.value)}
                          placeholder="es. vm-dev-01"
                        />
                      </div>

                      <div className="field">
                        <label>Username admin</label>
                        <input
                          className="input"
                          value={newVmUser}
                          onChange={(e) => setNewVmUser(e.target.value)}
                          placeholder="es. azureuser"
                        />
                      </div>

                      <div className="field">
                        <label>Password admin</label>
                        <input
                          className="input"
                          type="password"
                          value={newVmPassword}
                          onChange={(e) => setNewVmPassword(e.target.value)}
                          placeholder="Password sicura"
                        />
                        <span className="help">Min 12 caratteri, maiuscole, minuscole, numero e simbolo</span>
                      </div>

                      <div className="field">
                        <label>Taglia VM</label>
                        <input
                          className="input"
                          value={newVmSize}
                          onChange={(e) => setNewVmSize(e.target.value)}
                          placeholder="Standard_DS1_v2"
                        />
                      </div>

                      <div />
                    </>
                  )}

                  {/* ====== STORAGE ====== */}
                  {resourceType === "storage" && (
                    <>
                      <div className="field">
                        <label>Resource Group</label>
                        <input
                          className="input"
                          value={newStRg}
                          onChange={(e) => setNewStRg(e.target.value)}
                          placeholder="es. my-rg"
                        />
                        <span className="help">Resource Group già esistente</span>
                      </div>

                      <div className="field">
                        <label>Storage account name</label>
                        <input
                          className="input"
                          value={newStAccountName}
                          onChange={(e) => setNewStAccountName(e.target.value)}
                          placeholder="es. mystorageaccount123"
                        />
                        <span className="help">Deve essere globalmente unico (solo lowercase/num)</span>
                      </div>

                      <div className="field">
                        <label>Container name (opzionale)</label>
                        <input
                          className="input"
                          value={newStContainerName}
                          onChange={(e) => setNewStContainerName(e.target.value)}
                          placeholder="es. my-container"
                        />
                      </div>

                      <div />
                    </>
                  )}

                  {/* ====== AZURE SQL ====== */}
                  {resourceType === "azure-sql" && (
                    <>
                      <div className="field">
                        <label>Resource Group</label>
                        <input
                          className="input"
                          value={newSqlRg}
                          onChange={(e) => setNewSqlRg(e.target.value)}
                          placeholder="es. my-rg"
                        />
                        <span className="help">Resource Group già esistente</span>
                      </div>

                      <div className="field">
                        <label>Server name</label>
                        <input
                          className="input"
                          value={newSqlServerName}
                          onChange={(e) => setNewSqlServerName(e.target.value)}
                          placeholder="es. srv-sql-dev-01"
                        />
                        <span className="help">Deve essere globalmente unico</span>
                      </div>

                      <div className="field">
                        <label>Database name</label>
                        <input
                          className="input"
                          value={newSqlDbName}
                          onChange={(e) => setNewSqlDbName(e.target.value)}
                          placeholder="es. db-dev-01"
                        />
                      </div>

                      <div className="field">
                        <label>Admin login</label>
                        <input
                          className="input"
                          value={newSqlAdminLogin}
                          onChange={(e) => setNewSqlAdminLogin(e.target.value)}
                          placeholder="es. sqladmin"
                        />
                      </div>

                      <div className="field">
                        <label>Admin password</label>
                        <input
                          className="input"
                          type="password"
                          value={newSqlAdminPassword}
                          onChange={(e) => setNewSqlAdminPassword(e.target.value)}
                          placeholder="Password sicura"
                        />
                      </div>

                      <div className="field">
                        <label>SKU</label>
                        <input
                          className="input"
                          value={newSqlSkuName}
                          onChange={(e) => setNewSqlSkuName(e.target.value)}
                          placeholder="Basic"
                        />
                        <span className="help">Esempi: Basic, S0, S1...</span>
                      </div>

                      

                      <div />
                    </>
                  )}
                </div>
              </div>

              {/* FOOTER */}
              <div className="modal-footer">
                <div className="footer-left">{creating ? "Provisioning in corso… potrebbe richiedere alcuni minuti." : " "}</div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" className="btn" onClick={closeCreateResource} disabled={creating}>
                    Annulla
                  </button>

                  <button type="submit" className="btn btn-primary" disabled={creating}>
                    {creating ? "Creazione..." : "Crea risorsa"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



