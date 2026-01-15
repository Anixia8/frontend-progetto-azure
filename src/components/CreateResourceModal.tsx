import { useMemo, useState } from "react";
import { apiFetch } from "../api/apiFetch";

type ResourceType = "vm" | "storage" | "azure-sql";

type Props = {
  open: boolean;
  onClose: () => void;

  // callback opzionali per aggiornare le liste dopo la creazione
  onCreatedVm?: () => void | Promise<void>;
  onCreatedStorage?: () => void | Promise<void>;
  onCreatedAzureSql?: () => void | Promise<void>;
};

export function CreateResourceModal({
  open,
  onClose,
  onCreatedVm,
  onCreatedStorage,
  onCreatedAzureSql,
}: Props) {
  const [type, setType] = useState<ResourceType>("vm");

  // stato comune
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ====== VM fields ======
  const [vmRg, setVmRg] = useState("");
  const [vmVnet, setVmVnet] = useState("");
  const [vmSubnet, setVmSubnet] = useState("");
  const [vmName, setVmName] = useState("");
  const [vmUsername, setVmUsername] = useState("");
  const [vmPassword, setVmPassword] = useState("");
  const [vmSize, setVmSize] = useState("Standard_DS1_v2");

  // ====== Storage fields ======
  const [stRg, setStRg] = useState("");
  const [stAccountName, setStAccountName] = useState("");
  const [stContainerName, setStContainerName] = useState("");

  // ====== Azure SQL fields ======
  const [sqlRg, setSqlRg] = useState("");
  const [sqlServerName, setSqlServerName] = useState("");
  const [sqlDbName, setSqlDbName] = useState("");
  const [sqlAdminLogin, setSqlAdminLogin] = useState("");
  const [sqlAdminPassword, setSqlAdminPassword] = useState("");
  const [sqlAllowAzure, setSqlAllowAzure] = useState(true);
  const [sqlSku, setSqlSku] = useState("Basic");

  const title = useMemo(() => {
    if (type === "vm") return "Crea Virtual Machine";
    if (type === "storage") return "Crea Storage Account";
    return "Crea Azure SQL Database";
  }, [type]);

  const resetFeedback = () => {
    setError(null);
    setSuccessMsg(null);
  };

  const closeAndReset = () => {
    resetFeedback();
    setSubmitting(false);
    onClose();
  };

  const validate = (): string[] => {
    const missing: string[] = [];

    if (type === "vm") {
      if (!vmRg) missing.push("rg_name");
      if (!vmVnet) missing.push("vnet_name");
      if (!vmSubnet) missing.push("subnet_name");
      if (!vmName) missing.push("vm_name");
      if (!vmUsername) missing.push("username");
      if (!vmPassword) missing.push("password");
    }

    if (type === "storage") {
      if (!stRg) missing.push("rg_name");
      if (!stAccountName) missing.push("storage_account_name");
      // container_name è opzionale
    }

    if (type === "azure-sql") {
      if (!sqlRg) missing.push("rg_name");
      if (!sqlServerName) missing.push("server_name");
      if (!sqlDbName) missing.push("db_name");

      // admin_login/password servono SOLO se il server non esiste:
      // ma dal frontend conviene richiederli comunque, così non ti trovi errori a runtime.
      if (!sqlAdminLogin) missing.push("admin_login");
      if (!sqlAdminPassword) missing.push("admin_password");
    }

    return missing;
  };

  const onSubmit = async () => {
    resetFeedback();

    const missing = validate();
    if (missing.length > 0) {
      setError(`Compila i campi obbligatori: ${missing.join(", ")}`);
      return;
    }

    setSubmitting(true);

    try {
      if (type === "vm") {
        const res = await apiFetch("/api/provision-vm", {
          method: "POST",
          body: {
            rg_name: vmRg,
            vnet_name: vmVnet,
            subnet_name: vmSubnet,
            vm_name: vmName,
            username: vmUsername,
            password: vmPassword,
            vm_size: vmSize,
          },
        });

        if (!res.ok) {
          setError(res.error ?? `Errore HTTP ${res.status}`);
          setSubmitting(false);
          return;
        }

        setSuccessMsg("VM creata correttamente.");
        await onCreatedVm?.();
      }

      if (type === "storage") {
        const res = await apiFetch("/api/provision-storage", {
          method: "POST",
          body: {
            rg_name: stRg,
            storage_account_name: stAccountName,
            container_name: stContainerName || undefined,
          },
        });

        if (!res.ok) {
          setError(res.error ?? `Errore HTTP ${res.status}`);
          setSubmitting(false);
          return;
        }

        setSuccessMsg("Storage account creato correttamente.");
        await onCreatedStorage?.();
      }

      if (type === "azure-sql") {
        const res = await apiFetch("/api/provision-azure-sql", {
          method: "POST",
          body: {
            rg_name: sqlRg,
            server_name: sqlServerName,
            db_name: sqlDbName,
            admin_login: sqlAdminLogin,
            admin_password: sqlAdminPassword,
            allow_azure_services: sqlAllowAzure,
            sku_name: sqlSku,
          },
        });

        if (!res.ok) {
          setError(res.error ?? `Errore HTTP ${res.status}`);
          setSubmitting(false);
          return;
        }

        setSuccessMsg("Azure SQL creato correttamente.");
        await onCreatedAzureSql?.();
      }

      setSubmitting(false);
    } catch (e) {
      setError("Errore imprevisto durante la creazione.");
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div style={backdropStyle} onClick={closeAndReset}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="btn btn-danger" onClick={closeAndReset} disabled={submitting}>
            Chiudi
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Tipo risorsa</label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as ResourceType);
              resetFeedback();
            }}
            disabled={submitting}
            style={inputStyle}
          >
            <option value="vm">Virtual Machine</option>
            <option value="storage">Storage Account</option>
            <option value="azure-sql">Azure SQL Database</option>
          </select>
        </div>

        {/* ===== FORM DINAMICI ===== */}
        {type === "vm" && (
          <div style={{ marginTop: 12 }}>
            <div style={grid2}>
              <Field label="Resource Group" value={vmRg} onChange={setVmRg} disabled={submitting} />
              <Field label="VM name" value={vmName} onChange={setVmName} disabled={submitting} />
              <Field label="VNet name" value={vmVnet} onChange={setVmVnet} disabled={submitting} />
              <Field label="Subnet name" value={vmSubnet} onChange={setVmSubnet} disabled={submitting} />
              <Field label="Username" value={vmUsername} onChange={setVmUsername} disabled={submitting} />
              <Field label="Password" value={vmPassword} onChange={setVmPassword} disabled={submitting} type="password" />
              <Field label="VM size" value={vmSize} onChange={setVmSize} disabled={submitting} placeholder="Standard_DS1_v2" />
            </div>
          </div>
        )}

        {type === "storage" && (
          <div style={{ marginTop: 12 }}>
            <div style={grid2}>
              <Field label="Resource Group" value={stRg} onChange={setStRg} disabled={submitting} />
              <Field label="Storage account name" value={stAccountName} onChange={setStAccountName} disabled={submitting} />
              <Field label="Container name (opzionale)" value={stContainerName} onChange={setStContainerName} disabled={submitting} />
            </div>
            <p style={{ color: "#6b7280", marginTop: 8, fontSize: 13 }}>
              Nota: il nome dello storage account deve essere globalmente unico.
            </p>
          </div>
        )}

        {type === "azure-sql" && (
          <div style={{ marginTop: 12 }}>
            <div style={grid2}>
              <Field label="Resource Group" value={sqlRg} onChange={setSqlRg} disabled={submitting} />
              <Field label="Server name" value={sqlServerName} onChange={setSqlServerName} disabled={submitting} />
              <Field label="Database name" value={sqlDbName} onChange={setSqlDbName} disabled={submitting} />
              <Field label="Admin login" value={sqlAdminLogin} onChange={setSqlAdminLogin} disabled={submitting} />
              <Field
                label="Admin password"
                value={sqlAdminPassword}
                onChange={setSqlAdminPassword}
                disabled={submitting}
                type="password"
              />

              <div>
                <label style={labelStyle}>SKU</label>
                <select
                  value={sqlSku}
                  onChange={(e) => setSqlSku(e.target.value)}
                  disabled={submitting}
                  style={inputStyle}
                >
                  <option value="Basic">Basic</option>
                  <option value="S0">S0</option>
                  <option value="S1">S1</option>
                  <option value="S2">S2</option>
                  <option value="GP_S_Gen5_1">GP_S_Gen5_1</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24 }}>
                <input
                  type="checkbox"
                  checked={sqlAllowAzure}
                  onChange={(e) => setSqlAllowAzure(e.target.checked)}
                  disabled={submitting}
                />
                <span style={{ color: "#374151" }}>
                  Permetti connessioni da “Azure services” (firewall 0.0.0.0)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Feedback */}
        {error && <p style={{ color: "#b91c1c", marginTop: 12 }}>{error}</p>}
        {successMsg && <p style={{ color: "#166534", marginTop: 12 }}>{successMsg}</p>}

        {/* Azioni */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button className="btn" onClick={closeAndReset} disabled={submitting}>
            Annulla
          </button>

          <button className="btn btn-primary" onClick={() => void onSubmit()} disabled={submitting}>
            {submitting ? "Creazione..." : "Crea risorsa"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        style={inputStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        type={type}
        placeholder={placeholder}
      />
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 9999,
};

const modalStyle: React.CSSProperties = {
  width: "min(900px, 100%)",
  background: "white",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#6b7280",
  fontSize: 13,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  outline: "none",
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};
