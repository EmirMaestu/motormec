import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import { UserButton, useUser } from "@clerk/clerk-react";
import {
  BarChart3,
  Car,
  DollarSign,
  Package,
  FileText,
  Users,
  UserCheck,
  ChevronLeft,
  Menu,
  X,
  Settings,
  HelpCircle,
} from "lucide-react";

const navigationItems = [
  {
    title: "Dashboard",
    icon: BarChart3,
    path: "/dashboard",
    color: "text-blue-600",
  },
  {
    title: "Vehículos",
    icon: Car,
    path: "/vehiculos",
    color: "text-green-600",
  },
  {
    title: "Inventario",
    icon: Package,
    path: "/inventario",
    color: "text-purple-600",
  },
  {
    title: "Finanzas",
    icon: DollarSign,
    path: "/finanzas",
    color: "text-emerald-600",
  },
  {
    title: "Reportes",
    icon: FileText,
    path: "/reportes",
    color: "text-orange-600",
  },
  {
    title: "Clientes",
    icon: UserCheck,
    path: "/clientes",
    color: "text-purple-600",
  },
  {
    title: "Socios",
    icon: Users,
    path: "/socios",
    color: "text-indigo-600",
  },
];

const exampleItems = [
  {
    title: "Demo Cards",
    icon: Settings,
    path: "/ejemplos/cards",
    color: "text-gray-600",
  },
  {
    title: "Demo Convex",
    icon: HelpCircle,
    path: "/ejemplos/convex",
    color: "text-gray-600",
  },
  {
    title: "Demo Clientes",
    icon: UserCheck,
    path: "/ejemplos/clientes",
    color: "text-gray-600",
  },
];

export default function NavigationSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const { user } = useUser();

  // Cargar estado del sidebar desde localStorage
  useEffect(() => {
    const savedState = localStorage.getItem("sidebar-collapsed");
    if (savedState !== null) {
      setIsCollapsed(JSON.parse(savedState));
    }
  }, []);

  // Guardar estado cuando cambie
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobile = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  return (
    <>
      {/* Botón móvil */}
      <button
        onClick={toggleMobile}
        className={cn(
          "lg:hidden fixed top-6 z-50 p-2 rounded-md bg-white shadow-md border border-gray-200 transition-all duration-300",
          isMobileOpen ? "left-52" : "left-4"
        )}
      >
        {isMobileOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>

      {/* Overlay móvil */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-white border-r border-gray-200 z-40 transition-all duration-300 ease-in-out flex flex-col",
          // Estados responsive - mantener siempre fixed para que no se mueva con el scroll
          "lg:translate-x-0", // Desktop: siempre visible
          "-translate-x-full lg:translate-x-0", // Mobile: oculto por defecto
          isMobileOpen && "translate-x-0", // Mobile: mostrar cuando esté abierto
          // Ancho según estado
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header del sidebar */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 h-20 flex-shrink-0">
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Car className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">MotorMec</span>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            className={cn(
              "hidden lg:flex p-1.5 rounded-md hover:bg-gray-100 transition-colors",
              isCollapsed && "mx-auto"
            )}
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform",
                isCollapsed && "rotate-180"
              )}
            />
          </button>
        </div>

        {/* Navegación principal */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-3">
                Principal
              </p>
            )}
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    "hover:bg-gray-50 group",
                    isActive
                      ? "bg-blue-50 text-blue-700 border-r-2 border-blue-600"
                      : "text-gray-700 hover:text-gray-900",
                    isCollapsed && "justify-center px-2"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 flex-shrink-0 transition-colors",
                      isActive
                        ? item.color
                        : "text-gray-400 group-hover:text-gray-600",
                      !isCollapsed && "mr-3"
                    )}
                  />
                  {!isCollapsed && (
                    <span className="truncate">{item.title}</span>
                  )}

                  {/* Tooltip para modo colapsado */}
                  {isCollapsed && (
                    <div className="absolute left-16 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none whitespace-nowrap z-50">
                      {item.title}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Ejemplos */}
          <div className="pt-6 space-y-1">
            {!isCollapsed && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-3">
                Ejemplos
              </p>
            )}
            {exampleItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    "hover:bg-gray-50 group",
                    isActive
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:text-gray-900",
                    isCollapsed && "justify-center px-2"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 flex-shrink-0 transition-colors",
                      "text-gray-400 group-hover:text-gray-600",
                      !isCollapsed && "mr-3"
                    )}
                  />
                  {!isCollapsed && (
                    <span className="truncate">{item.title}</span>
                  )}

                  {/* Tooltip para modo colapsado */}
                  {isCollapsed && (
                    <div className="absolute left-16 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none whitespace-nowrap z-50">
                      {item.title}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer del sidebar con UserButton */}
        <div className="p-4 border-t border-gray-200 flex-shrink-0 space-y-3 h-16">
          {/* UserButton */}
          <div className="flex items-center justify-center">
            <div className="rounded-lg w-full">
              <div
                className={cn(
                  "flex items-center space-x-2",
                  isCollapsed && "justify-center space-x-0"
                )}
              >
                <div className="flex-shrink-0">
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox: "w-8 h-8",
                        userButtonPopoverCard:
                          "shadow-lg border border-gray-200",
                        userButtonPopoverActionButton: "hover:bg-gray-50",
                        userButtonPopoverActionButtonText: "text-gray-700",
                        userButtonPopoverFooter: "hidden",
                      },
                    }}
                    showName={false}
                    userProfileMode="navigation"
                    userProfileUrl="/user-profile"
                  />
                </div>
                {!isCollapsed && (
                  <div className="text-left flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user?.firstName || "Admin"}
                    </p>
                    <p className="text-xs text-gray-500">Conectado</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
