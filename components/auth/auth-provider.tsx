"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { REMEMBER_ME_STORAGE_KEY } from "@/lib/auth/constants";
import { clearSavedEmailOnLogout } from "@/lib/auth/client-storage";
import type { SessionUser } from "@/types/auth";

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        return null;
      }
      const json = await res.json();
      setUser(json.data ?? null);
      return json.data as (SessionUser & { rememberMe?: boolean }) | null;
    } catch {
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      const me = await refresh();

      const shouldExtend =
        me &&
        (me.rememberMe ||
          (typeof window !== "undefined" &&
            localStorage.getItem(REMEMBER_ME_STORAGE_KEY) === "1"));

      if (shouldExtend) {
        try {
          await fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "include",
          });
          await refresh();
        } catch {
          /* cookie session still valid */
        }
      }

      setLoading(false);
    }

    void load();
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    clearSavedEmailOnLogout();
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin: user?.role === "admin",
        refresh: async () => {
          await refresh();
        },
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
