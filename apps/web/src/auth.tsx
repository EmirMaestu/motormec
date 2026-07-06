import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { setActiveCurrency, type Currency } from "@/lib/utils";
import type { Tenant, User } from "@/lib/types";

interface MeResponse {
  user: User;
  tenant: Tenant;
}

interface AuthValue {
  user: User | null;
  tenant: Tenant | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (tenantSlug: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-fetch de /api/me (ej. tras cambiar settings del taller). */
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api.get<MeResponse>("/api/me");
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const tenant = data?.tenant ?? null;
  const currency = (tenant?.settings as { currency?: Currency } | undefined)?.currency ?? "ARS";

  // La moneda activa (módulo-level en utils) sigue a la del taller. Cuando el
  // tenant se carga o se actualiza, todos los formatCurrency del árbol re-renderizan.
  useEffect(() => {
    setActiveCurrency(currency);
  }, [currency]);

  const value: AuthValue = {
    user: data?.user ?? null,
    tenant,
    isLoading,
    isAdmin: data?.user?.role === "admin",
    login: async (tenantSlug, username, password) => {
      await api.post("/api/login", { tenantSlug, username, password });
      await queryClient.invalidateQueries();
    },
    logout: async () => {
      try {
        await api.post("/api/logout");
      } finally {
        queryClient.clear();
        // Reset duro para salir de la sesión sin depender de un refetch.
        window.location.href = "/app/";
      }
    },
    refreshMe: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
