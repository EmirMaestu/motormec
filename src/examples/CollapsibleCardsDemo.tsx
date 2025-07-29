import React from "react";
import { 
  VehicleCards, 
  ProductCards, 
  PartnerCards, 
  FinanceCards 
} from "../components/module-cards";

// Ejemplo completo de cómo usar las cards carousel en cada módulo
export const CollapsibleCardsDemo: React.FC = () => {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Sistema de Cards Carousel</h1>
        <p className="text-gray-600 mb-8">
          Ejemplos de cards carousel responsive para cada módulo del sistema
        </p>
      </div>

      {/* Sección de Vehículos */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Módulo de Vehículos</h2>
        <VehicleCards />
      </div>

      {/* Sección de Productos */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Módulo de Inventario</h2>
        <ProductCards />
      </div>

      {/* Sección de Socios */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Módulo de Socios</h2>
        <PartnerCards />
      </div>

      {/* Sección de Finanzas */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Módulo de Finanzas</h2>
        <FinanceCards />
      </div>

      {/* Documentación de uso */}
      <div className="mt-12 p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Cómo usar las Cards Carousel</h3>
        
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium mb-2">1. Importar en tu componente:</h4>
            <pre className="bg-gray-800 text-green-400 p-3 rounded overflow-x-auto">
{`import { VehicleCards } from "../components/module-cards";`}
            </pre>
          </div>

          <div>
            <h4 className="font-medium mb-2">2. Usar en tu JSX:</h4>
            <pre className="bg-gray-800 text-green-400 p-3 rounded overflow-x-auto">
{`{/* Cards de Estadísticas Carousel */}
<VehicleCards />`}
            </pre>
          </div>

          <div>
            <h4 className="font-medium mb-2">3. Cards disponibles:</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><code className="bg-gray-200 px-2 py-1 rounded">VehicleCards</code> - Estadísticas de vehículos</li>
              <li><code className="bg-gray-200 px-2 py-1 rounded">ProductCards</code> - Estadísticas de inventario</li>
              <li><code className="bg-gray-200 px-2 py-1 rounded">PartnerCards</code> - Estadísticas de socios</li>
              <li><code className="bg-gray-200 px-2 py-1 rounded">FinanceCards</code> - Estadísticas financieras</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-2">4. Características:</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>✅ Carousel responsive (3 cards en desktop, 1 en móvil)</li>
              <li>✅ Navegación con flechas e indicadores</li>
              <li>✅ Animaciones suaves de transición</li>
              <li>✅ Colores automáticos según el tipo de dato</li>
              <li>✅ Controles táctiles para móvil</li>
              <li>✅ Conectado automáticamente a Convex</li>
              <li>✅ Accesibilidad mejorada</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollapsibleCardsDemo;