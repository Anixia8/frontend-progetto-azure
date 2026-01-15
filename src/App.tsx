import "./App.css";
import { Routes, Route, NavLink } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { ResourcesPage } from "./pages/ResourcesPage";
import { CostsPage } from "./pages/CostsPage";
import { useAuth } from "./auth/Authcontext";

function App() {
  const { isAuthenticated, loading, login, logout } = useAuth();
  return (
    <div style={{ minHeight: "100vh", width: "100%", backgroundColor: "#f3f4f6" }}>
      <header style={{ backgroundColor: "#111827", color: "#f9fafb" }}>
        <div
          style={{
            margin: "0 auto",
            padding: "0.75rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "2rem",
          }}
        >
        
          <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>
            Cloud Platform
          </span>

          <nav style={{ display: "flex", gap: "1.5rem", fontSize: "0.95rem" }}>
            <NavLink
              to="/"
              style={({ isActive }) => ({
                color: "#e5e7eb",
                textDecoration: "none",
                borderBottom: isActive ? "2px solid #f9fafb" : "2px solid transparent",
                paddingBottom: "0.15rem",
              })}
              end
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/resources"
              style={({ isActive }) => ({
                color: "#e5e7eb",
                textDecoration: "none",
                borderBottom: isActive ? "2px solid #f9fafb" : "2px solid transparent",
                paddingBottom: "0.15rem",
              })}
            >
              Risorse
            </NavLink>

            <NavLink
              to="/costs"
              style={({ isActive }) => ({
                color: "#e5e7eb",
                textDecoration: "none",
                borderBottom: isActive ? "2px solid #f9fafb" : "2px solid transparent",
                paddingBottom: "0.15rem",
              })}
            >
              Costi
            </NavLink>
          </nav>

          <div style={{ marginLeft: "auto" }}>
            {loading ? null : isAuthenticated ? (
              <button
                onClick={logout}
                style={{
                  padding: "0.35rem 0.9rem",
                  borderRadius: "9999px",
                  border: "1px solid #4b5563",
                  background: "transparent",
                  color: "#e5e7eb",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Disconnetti cloud
              </button>
            ) : (
              <button
                onClick={login}
                style={{
                  padding: "0.35rem 0.9rem",
                  borderRadius: "9999px",
                  border: "1px solid #2563eb",
                  background: "#2563eb",
                  color: "#f9fafb",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Collega account cloud
              </button>
            )}
          </div>
        </div>
      </header>

      <main
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "2rem 1.5rem",
        }}
      >
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/costs" element={<CostsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
