import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import LayoutWithRouter from '../components/LayoutWithRouter';

// Páginas principales
import Dashboard from '../components/pages/dashboard';
import Vehicles from '../components/pages/vehicles';
import VehicleHistory from '../components/pages/VehicleHistory';
import VehicleCostManagement from '../components/pages/VehicleCostManagement';
import Finance from '../components/pages/finance';
import Reports from '../components/pages/reports';
import StockManagement from '../stock-management';

// Ejemplos y demos
import CarouselCardsDemo from '../examples/CollapsibleCardsDemo';
import ConvexUsageExample from '../examples/ConvexUsageExample';

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
            <Route path="/vehiculos/historial" element={<VehicleHistory />} />
            <Route path="/vehiculos/:vehicleId/costos" element={<VehicleCostManagement />} />
            <Route path="/finanzas" element={<Finance />} />
            <Route path="/inventario" element={<StockManagement />} />
            <Route path="/reportes" element={<Reports />} />
            
            {/* Páginas adicionales que podrías necesitar */}
            <Route path="/socios" element={<div className="p-6"><h1 className="text-2xl font-bold">Módulo de Socios</h1><p>En desarrollo...</p></div>} />
            
            {/* Ejemplos y demos */}
            <Route path="/ejemplos/cards" element={<CarouselCardsDemo />} />
            <Route path="/ejemplos/convex" element={<ConvexUsageExample />} />
            
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