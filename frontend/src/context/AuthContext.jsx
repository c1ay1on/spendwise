import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, clearToken, getToken, saveToken } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getToken);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return undefined;
    }
    let active = true;
    api("/api/auth/me")
      .then((result) => { if (active) setUser(result.user); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    const onLogout = () => {
      setToken(null);
      setUser(null);
      setLoading(false);
    };
    window.addEventListener("spendwise:logout", onLogout);
    return () => window.removeEventListener("spendwise:logout", onLogout);
  }, []);

  async function authenticate(path, values) {
    const result = await api(path, { method: "POST", body: JSON.stringify(values) });
    saveToken(result.token);
    setToken(result.token);
    setUser(result.user);
    return result;
  }

  function logout() {
    clearToken();
    setToken(null);
    setUser(null);
  }

  const value = useMemo(() => ({
    user,
    loading,
    login: (values) => authenticate("/api/auth/login", values),
    register: (values) => authenticate("/api/auth/register", values),
    logout
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}
