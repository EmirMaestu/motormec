import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import { UserButton, useUser, useOrganization } from "@clerk/clerk-react";
import { useTheme } from "../lib/theme";
import {
  LayoutDashboard,
  Car,
  DollarSign,
  Users,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Wrench,
  Sun,
  Moon,
} from "lucide-react";

const navigationItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
    adminOnly: false,
  },
  {
    title: "Vehículos",
    icon: Car,
    path: "/vehiculos",
    adminOnly: false,
  },
  {
    title: "Finanzas",
    icon: DollarSign,
    path: "/finanzas",
    adminOnly: true,
  },
  {
    title: "Clientes",
    icon: Users,
    path: "/clientes",
    adminOnly: true,
  },
  {
    title: "Bot WhatsApp",
    icon: MessageSquare,
    path: "/whatsapp-bot",
    adminOnly: true,
  },
];

export default function NavigationSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const { user } = useUser();
  const { membership } = useOrganization();
  const { theme, toggle } = useTheme();

  const isAdmin = membership?.role === "org:admin";

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) setIsCollapsed(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Cerrar mobile al navegar
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const filteredItems = navigationItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  const isActive = (path: string) =>
    location.pathname === path ||
    (path !== "/dashboard" && location.pathname.startsWith(path));

  return (
    <>
      {/* ── Botón hamburguesa mobile ─────────────────────────────────── */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white dark:bg-zinc-900 shadow-sm border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* ── Overlay mobile ───────────────────────────────────────────── */}
      <div
        className={cn(
          "lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
          isMobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsMobileOpen(false)}
      />

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen z-40 flex flex-col",
          "bg-white dark:bg-zinc-950 border-r border-gray-100 dark:border-zinc-800",
          "transition-all duration-300 ease-in-out",
          "lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          isCollapsed ? "w-[68px]" : "w-60"
        )}
      >
        {/* ── Logo ─────────────────────────────────────────────────── */}
        <div className={cn(
          "flex items-center h-16 flex-shrink-0 border-b border-gray-100 dark:border-zinc-800 px-4",
          isCollapsed ? "justify-center" : "justify-between"
        )}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-gray-900 dark:bg-zinc-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Wrench className="h-4 w-4 text-white dark:text-zinc-900" />
            </div>
            {!isCollapsed && (
              <span className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate tracking-tight">
                MotorMec
              </span>
            )}
          </div>

          {/* Botón colapsar — solo desktop */}
          {!isCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="hidden lg:flex p-1.5 rounded-md text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
              aria-label="Colapsar sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── Botón expandir (solo visible cuando colapsado, desktop) ── */}
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="hidden lg:flex mx-auto mt-3 p-1.5 rounded-md text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Expandir sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        {/* ── Botón cerrar mobile ───────────────────────────────────── */}
        {isMobileOpen && (
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden absolute top-4 right-3 p-1.5 rounded-md text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* ── Navegación ───────────────────────────────────────────── */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                title={isCollapsed ? item.title : undefined}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group",
                  active
                    ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium"
                    : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800/60 font-normal",
                  isCollapsed && "justify-center px-0"
                )}
              >
                <Icon className={cn(
                  "h-[18px] w-[18px] flex-shrink-0",
                  active
                    ? "text-white dark:text-zinc-900"
                    : "text-gray-400 dark:text-zinc-500 group-hover:text-gray-700 dark:group-hover:text-zinc-300"
                )} />

                {!isCollapsed && (
                  <span className="truncate">{item.title}</span>
                )}

                {/* Tooltip colapsado */}
                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    {item.title}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Toggle dark mode ─────────────────────────────────────── */}
        <div className={cn(
          "px-3 pb-2",
          isCollapsed && "flex justify-center"
        )}>
          <button
            onClick={toggle}
            title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full transition-all duration-150",
              "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800/60",
              isCollapsed && "justify-center px-0 w-auto"
            )}
          >
            {theme === "dark"
              ? <Sun className="h-[18px] w-[18px] flex-shrink-0 text-gray-400 dark:text-zinc-500" />
              : <Moon className="h-[18px] w-[18px] flex-shrink-0 text-gray-400 dark:text-zinc-500" />
            }
            {!isCollapsed && (
              <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
            )}
          </button>
        </div>

        {/* ── Usuario ──────────────────────────────────────────────── */}
        <div className={cn(
          "flex-shrink-0 border-t border-gray-100 dark:border-zinc-800 p-3",
        )}>
          <div className={cn(
            "flex items-center gap-2.5 rounded-lg px-2 py-2",
            isCollapsed && "justify-center px-0"
          )}>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-7 h-7",
                  userButtonPopoverCard: "shadow-xl border border-gray-100 rounded-xl",
                  userButtonPopoverActionButton: "hover:bg-gray-50 rounded-lg",
                  userButtonPopoverActionButtonText: "text-gray-700 text-sm",
                  userButtonPopoverFooter: "hidden",
                },
              }}
              showName={false}
            />
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate leading-tight">
                  {user?.firstName || "Usuario"}
                </p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">
                  {isAdmin ? "Administrador" : "Empleado"}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
