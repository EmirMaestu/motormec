import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface PlatformAdmin {
  adminId: string;
  name: string;
  username: string;
}

interface AdminAuthValue {
  admin: PlatformAdmin | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["adminMe"],
    queryFn: async () => {
      try {
        return await api.get<{ admin: PlatformAdmin }>("/api/admin/me");
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const value: AdminAuthValue = {
    admin: data?.admin ?? null,
    isLoading,
    login: async (username, password) => {
      await api.post("/api/admin/login", { username, password });
      await queryClient.invalidateQueries({ queryKey: ["adminMe"] });
    },
    logout: async () => {
      await api.post("/api/admin/logout");
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: ["adminMe"] });
    },
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
