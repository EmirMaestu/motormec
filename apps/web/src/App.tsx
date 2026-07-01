import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { AdminAuthProvider } from "./adminAuth";
import { Spinner } from "./components/ui";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { VehiclesPage } from "./pages/Vehicles";
import { CustomersPage } from "./pages/Customers";
import { FinancePage } from "./pages/Finance";
import { StockPage } from "./pages/Stock";
import { PartnersPage } from "./pages/Partners";
import { ReportsPage } from "./pages/Reports";
import { WhatsAppPage } from "./pages/WhatsApp";
import { OrdersPage } from "./pages/Orders";
import { QuotesPage } from "./pages/Quotes";
import { SettingsPage } from "./pages/Settings";
import { AdminConsole } from "./pages/admin/AdminConsole";

export function App() {
  return (
    <Routes>
      {/* Platform super-admin console — separate auth (mm_admin cookie). */}
      <Route
        path="/admin/*"
        element={
          <AdminAuthProvider>
            <AdminConsole />
          </AdminAuthProvider>
        }
      />
      {/* Tenant (taller) dashboard. */}
      <Route path="/*" element={<TenantApp />} />
    </Routes>
  );
}

function TenantApp() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Spinner />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/vehiculos" element={<VehiclesPage />} />
        <Route path="/ordenes" element={<OrdersPage />} />
        <Route path="/presupuestos" element={<QuotesPage />} />
        <Route path="/configuracion" element={<SettingsPage />} />
        <Route path="/clientes" element={<CustomersPage />} />
        <Route path="/finanzas" element={<FinancePage />} />
        <Route path="/inventario" element={<StockPage />} />
        <Route path="/socios" element={<PartnersPage />} />
        <Route path="/reportes" element={<ReportsPage />} />
        <Route path="/whatsapp" element={<WhatsAppPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}
