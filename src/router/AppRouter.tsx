import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import LayoutWithRouter from '../components/LayoutWithRouter';
import ProtectedRoute from '../components/ProtectedRoute';

// Páginas principales
import Dashboard from '../components/pages/dashboard';
import Vehicles from '../components/pages/vehicles';
import VehicleRepairHistory from '../components/pages/VehicleRepairHistory';
import VehicleCostManagement from '../components/pages/VehicleCostManagement';
import ImportVehicles from '../components/pages/ImportVehicles';
import Finance from '../components/pages/finance';
import Reports from '../components/pages/reports-new';
import Partners from '../components/pages/partners';
import Customers from '../components/pages/customers';
import StockManagement from '../stock-management';
import FixCustomerMetrics from '../components/pages/FixCustomerMetrics';

// Ejemplos y demos
import CarouselCardsDemo from '../examples/CollapsibleCardsDemo';
import ConvexUsageExample from '../examples/ConvexUsageExample';
import CustomersUsageExample from '../examples/CustomersUsageExample';

const AppRouter: React.FC = () => {
  return (
    <Router>
      <SignedIn>
        <LayoutWithRouter>
          <Routes>
            {/* Ruta principal - redirige al dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Páginas principales del sistema */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/vehiculos" element={<Vehicles />} />
<Route path="/vehiculos/:plate/historial-arreglos" element={<VehicleRepairHistory />} />
            <Route path="/vehiculos/importar" element={
              <ProtectedRoute adminOnly={true}>
                <ImportVehicles />
              </ProtectedRoute>
            } />
            <Route path="/vehiculos/:vehicleId/costos" element={
              <ProtectedRoute adminOnly={true}>
                <VehicleCostManagement />
              </ProtectedRoute>
            } />
            <Route path="/finanzas" element={
              <ProtectedRoute adminOnly={true}>
                <Finance />
              </ProtectedRoute>
            } />
            <Route path="/inventario" element={<StockManagement />} />
            <Route path="/reportes" element={
              <ProtectedRoute adminOnly={true}>
                <Reports />
              </ProtectedRoute>
            } />
            
            {/* Páginas adicionales que podrías necesitar */}
            <Route path="/socios" element={
              <ProtectedRoute adminOnly={true}>
                <Partners />
              </ProtectedRoute>
            } />
            <Route path="/clientes" element={
              <ProtectedRoute adminOnly={true}>
                <Customers />
              </ProtectedRoute>
            } />
            
            {/* Herramientas de administración */}
            <Route path="/herramientas/recalcular-metricas" element={
              <ProtectedRoute adminOnly={true}>
                <FixCustomerMetrics />
              </ProtectedRoute>
            } />
            
            {/* Ejemplos y demos */}
            <Route path="/ejemplos/cards" element={<CarouselCardsDemo />} />
            <Route path="/ejemplos/convex" element={<ConvexUsageExample />} />
            <Route path="/ejemplos/clientes" element={<CustomersUsageExample />} />
            
            {/* Ruta 404 */}
            <Route path="*" element={
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                  <p className="text-gray-600 mb-4">Página no encontrada</p>
                  <a href="/dashboard" className="text-blue-600 hover:underline">
                    Volver al Dashboard
                  </a>
                </div>
              </div>
            } />
          </Routes>
        </LayoutWithRouter>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </Router>
  );
};

export default AppRouter;