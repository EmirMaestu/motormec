import { useState, useEffect, type ReactNode } from "react"
import NavigationSidebar from "./NavigationSidebar"
import { cn } from "../lib/utils"

interface LayoutProps {
  children: ReactNode
}

export default function LayoutWithRouter({ children }: LayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Sincronizar con el estado del sidebar
  useEffect(() => {
    const sync = () => {
      const saved = localStorage.getItem("sidebar-collapsed")
      if (saved !== null) setIsCollapsed(JSON.parse(saved))
    }
    sync()
    const id = setInterval(sync, 150)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex">
      <NavigationSidebar />

      {/* ── Contenido principal ────────────────────────────────────────── */}
      <main
        className={cn(
          "flex-1 min-h-screen transition-all duration-300 ease-in-out overflow-x-hidden",
          // Mobile: no margin (sidebar overlay)
          "ml-0",
          // Desktop: margen según estado del sidebar
          isCollapsed ? "lg:ml-[68px]" : "lg:ml-60"
        )}
      >
        {/* Top bar mobile — solo para que el contenido no quede bajo el hamburger */}
        <div className="lg:hidden h-14 flex-shrink-0" />

        {/* Área de contenido */}
        <div className="px-5 py-6 sm:px-8 sm:py-8 max-w-screen-2xl">
          {children}
        </div>
      </main>
    </div>
  )
}
