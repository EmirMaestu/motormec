import { useState, useEffect, type ReactNode } from "react"
import { useLocation } from "react-router-dom"
import NavigationSidebar from "./NavigationSidebar"
import { cn } from "../lib/utils"

interface LayoutProps {
  children: ReactNode
}

// Mapeo de rutas a títulos y descripciones
const routeConfig = {
  "/dashboard": {
    title: "Dashboard",
    description: "Vista general del taller"
  },
  "/vehiculos": {
    title: "Gestión de Vehículos",
    description: "Administra los vehículos en el taller"
  },
  "/vehiculos/historial": {
    title: "Historial de Vehículos",
    description: "Vehículos entregados y suspendidos"
  },
  "/inventario": {
    title: "Inventario",
    description: "Gestión de inventario y repuestos"
  },
  "/finanzas": {
    title: "Finanzas",
    description: "Control financiero y facturación"
  },
  "/reportes": {
    title: "Reportes",
    description: "Informes y estadísticas"
  },
  "/socios": {
    title: "Socios",
    description: "Gestión de socios y participaciones"
  },
  "/ejemplos/cards": {
    title: "Demo Cards",
    description: "Ejemplo de cards colapsables"
  },
  "/ejemplos/convex": {
    title: "Demo Convex",
    description: "Ejemplo de uso de Convex"
  }
}

export default function LayoutWithRouter({ children }: LayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const location = useLocation()
  
  // Obtener configuración de la ruta actual
  const getRouteConfig = () => {
    // Verificar rutas exactas primero
    if (routeConfig[location.pathname as keyof typeof routeConfig]) {
      return routeConfig[location.pathname as keyof typeof routeConfig]
    }
    
    // Verificar rutas dinámicas
    if (location.pathname.includes('/vehiculos/') && location.pathname.includes('/costos')) {
      return {
        title: "Gestión de Costos",
        description: "Administrar costos de vehículo"
      }
    }
    
    // Ruta por defecto
    return {
      title: "Página",
      description: "Navegación"
    }
  }
  
  const currentRoute = getRouteConfig()

  // Sincronizar con el estado del sidebar
  useEffect(() => {
    const savedState = localStorage.getItem("sidebar-collapsed")
    if (savedState !== null) {
      setIsCollapsed(JSON.parse(savedState))
    }

    // Escuchar cambios en localStorage para sincronizar
    const handleStorageChange = () => {
      const savedState = localStorage.getItem("sidebar-collapsed")
      if (savedState !== null) {
        setIsCollapsed(JSON.parse(savedState))
      }
    }

    window.addEventListener("storage", handleStorageChange)
    
    // También escuchar cambios internos
    const checkCollapsedState = () => {
      const savedState = localStorage.getItem("sidebar-collapsed")
      if (savedState !== null) {
        const newState = JSON.parse(savedState)
        if (newState !== isCollapsed) {
          setIsCollapsed(newState)
        }
      }
    }

    const interval = setInterval(checkCollapsedState, 100)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      clearInterval(interval)
    }
  }, [isCollapsed])

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <NavigationSidebar />
      
      {/* Contenido Principal */}
      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out min-w-0",
          // En desktop, ajustar margen según el estado del sidebar
          "ml-0 lg:ml-64", // Por defecto, margen para sidebar expandido
          isCollapsed && "lg:ml-16" // Margen reducido para sidebar colapsado
        )}
      >
        {/* Header del contenido */}
        <header className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 lg:px-8 h-20 z-30">
          <div className="flex items-center">
            {/* Espacio para el botón del menú móvil */}
            <div className="lg:hidden w-10 flex-shrink-0"></div>
            
            <div className="flex-1 min-w-0 px-2 lg:px-0">
              <h2 className="text-xl font-semibold text-gray-900 truncate">
                {currentRoute.title}
              </h2>
              <p className="text-sm text-gray-500 mt-1 hidden sm:block truncate">
                {currentRoute.description}
              </p>
            </div>
          </div>
        </header>

        {/* Contenido scrolleable */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-6 lg:p-8 min-w-0">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 px-6 py-4 lg:px-8 h-16">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500">
            <p>&copy; 2024 MotorMec. Todos los derechos reservados.</p>
            <p className="mt-2 sm:mt-0">Versión 1.0.0</p>
          </div>
        </footer>
      </div>
    </div>
  )
}