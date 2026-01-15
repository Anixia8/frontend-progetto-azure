import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode} from "react";
import { API_BASE_URL } from "../config";

type AuthContextType = {
  isAuthenticated: boolean;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshSession = async () => {
    try {
      
      const res = await fetch(`${API_BASE_URL}/api/session`, {
        credentials: "include",
      });

      if (!res.ok) {
        setIsAuthenticated(false);
        return;
      }

      const data = await res.json(); // es. { authenticated: true }
      setIsAuthenticated(!!data.authenticated);
    } catch {
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    (async () => {
      await refreshSession();
      setLoading(false);
    })();
  }, []);

  const login = () => {
    
    window.location.href = `${API_BASE_URL}/api/login`;
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // se fallisce non è gravissimo, consideriamo comunque l’utente disconnesso
    } finally {
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, loading, login, logout, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve essere usato dentro un AuthProvider");
  }
  return ctx;
}
