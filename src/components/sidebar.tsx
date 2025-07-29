import { useState, useEffect } from "react"
import { Car, LayoutDashboard, DollarSign, FileText, Package, Menu, X } from "lucide-react"
import { Button } from "./ui/button"
import { cn } from "../lib/utils"
import { UserButton, useUser } from "@clerk/clerk-react"

interface SidebarProps {
  currentPage: string
  onPageChange: (page: string) => void
}

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { name: "Vehículos", icon: Car, id: "vehicles" },
  { name: "Inventario", icon: Package, id: "stock" },
  { name: "Finanzas", icon: DollarSign, id: "finance" },
  { name: "Reportes", icon: FileText, id: "reports" },
]

export default function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { user } = useUser()

  // Cargar estado del sidebar desde localStorage
  useEffect(() => {
    const savedState = localStorage.getItem("sidebar-collapsed")
    if (savedState !== null) {
      setIsCollapsed(JSON.parse(savedState))
    }
  }, [])

  // Guardar estado en localStorage
  const toggleSidebar = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem("sidebar-collapsed", JSON.stringify(newState))
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const handleNavigation = (pageId: string) => {
    onPageChange(pageId)
    setIsMobileMenuOpen(false) // Cerrar menú móvil al navegar
  }

  return (
    <>
      {/* Overlay para móvil */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={toggleMobileMenu}
        />
      )}

      {/* Botón de menú móvil */}
      <div className="lg:hidden fixed top-6 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleMobileMenu}
          className="bg-white shadow-md"
        >
          {isMobileMenuOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 h-screen bg-white border-r border-gray-200 z-50 transition-all duration-300 ease-in-out",
          "lg:translate-x-0", // Always visible on desktop
          isCollapsed ? "lg:w-16" : "lg:w-64",
          // Mobile: show/hide based on isMobileMenuOpen
          isMobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full w-64 lg:translate-x-0",
          "lg:relative lg:z-auto" // Reset z-index and position for desktop
        )}
      >
        {/* Header del sidebar */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 h-20">
          <div className={cn("flex items-center space-x-2", isCollapsed && "lg:justify-center lg:space-x-0")}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            {(!isCollapsed || isMobileMenuOpen) && (
              <div className="lg:block">
                <h1 className="font-bold text-lg text-gray-900">MotorMec</h1>
                <p className="text-sm text-gray-500">Taller Automotriz</p>
              </div>
            )}
          </div>
          
          {/* Botón de colapsar (solo desktop) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="hidden lg:flex h-8 w-8"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        {/* Navegación */}
        <nav className="p-4 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.id)}
                className={cn(
                  "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-200",
                  isActive
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "text-gray-700 hover:bg-gray-100",
                  isCollapsed && "lg:justify-center lg:space-x-0"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "text-blue-700")} />
                {(!isCollapsed || isMobileMenuOpen) && (
                  <span className="font-medium">{item.name}</span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer con UserButton y estado del sistema */}
        <div className="absolute bottom-4 left-4 right-4 space-y-3">
          {/* UserButton */}
          <div className="flex items-center justify-center">
            <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-200 w-full">
              <div className={cn(
                "flex items-center space-x-2",
                isCollapsed && !isMobileMenuOpen && "justify-center space-x-0"
              )}>
                <div className="flex-shrink-0">
                  <UserButton 
                    appearance={{
                      elements: {
                        avatarBox: "w-8 h-8",
                        userButtonPopoverCard: "shadow-lg border border-gray-200",
                        userButtonPopoverActionButton: "hover:bg-gray-50",
                        userButtonPopoverActionButtonText: "text-gray-700",
                        userButtonPopoverFooter: "hidden"
                      }
                    }}
                    showName={false}
                    userProfileMode="navigation"
                    userProfileUrl="/user-profile"
                  />
                </div>
                {(!isCollapsed || isMobileMenuOpen) && (
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
          
          {/* Estado del sistema */}
          {(!isCollapsed || isMobileMenuOpen) && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Sistema Online</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}