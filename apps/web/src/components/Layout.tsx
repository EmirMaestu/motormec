import { useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import {
  BarChart3,
  Boxes,
  Car,
  ClipboardList,
  DollarSign,
  FileText,
  Handshake,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  MessageSquare,
  MoreHorizontal,
  Settings,
  Users,
} from "lucide-react";
import { useAuth } from "@/auth";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/Logo";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

// Sidebar order (desktop). Órdenes sits right after Vehículos.
const DESKTOP_NAV: NavItem[] = [
  { to: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { to: "/vehiculos", label: "Vehículos", icon: Car },
  { to: "/ordenes", label: "Órdenes", icon: ClipboardList },
  { to: "/presupuestos", label: "Presupuestos", icon: FileText },
  { to: "/clientes", label: "Clientes", icon: Users, adminOnly: true },
  { to: "/inventario", label: "Inventario", icon: Boxes },
  { to: "/finanzas", label: "Finanzas", icon: DollarSign, adminOnly: true },
  { to: "/reportes", label: "Reportes", icon: BarChart3, adminOnly: true },
  { to: "/socios", label: "Socios", icon: Handshake, adminOnly: true },
  { to: "/whatsapp", label: "Bot WhatsApp", icon: MessageSquare, adminOnly: true },
  { to: "/configuracion", label: "Configuración", icon: Settings },
];

// Mobile bottom bar — the exact tabs requested. Anything not here is in "Más".
const BOTTOM: NavItem[] = [
  { to: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { to: "/vehiculos", label: "Vehículos", icon: Car },
  { to: "/clientes", label: "Clientes", icon: Users, adminOnly: true },
  { to: "/inventario", label: "Inventario", icon: Boxes },
  { to: "/finanzas", label: "Finanzas", icon: DollarSign, adminOnly: true },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, tenant, isAdmin, logout } = useAuth();
  const location = useLocation();

  const allowed = (n: NavItem) => !n.adminOnly || isAdmin;
  const desktopNav = DESKTOP_NAV.filter(allowed);
  const bottomTabs = BOTTOM.filter(allowed).slice(0, 5);
  // "Más" = every reachable route not already in the bottom bar.
  const bottomPaths = new Set(bottomTabs.map((b) => b.to));
  const moreItems = desktopNav.filter((n) => !bottomPaths.has(n.to));

  const sectionLabel =
    DESKTOP_NAV.find((n) => location.pathname.startsWith(n.to))?.label ?? "Momec";

  return (
    <div className="min-h-screen md:flex">
      {/* ---------------- Desktop sidebar ---------------- */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-60 bg-paper-white border-r border-black/10 flex-col">
        <div className="flex items-center gap-2 px-5 h-16 border-b border-black/10">
          <LogoMark size={36} />
          <div>
            <div className="font-display text-[20px] leading-none text-deep-forest">Momec</div>
            <div className="text-[11px] text-charcoal truncate max-w-[140px]">{tenant?.name ?? ""}</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {desktopNav.map((item) => (
            <SideLink key={item.to} item={item} />
          ))}
        </nav>
        <div className="border-t border-black/10 p-3">
          <div className="px-2 pb-2">
            <div className="text-[14px] font-medium text-deep-forest">{user?.name}</div>
            <div className="text-[12px] text-charcoal capitalize">{user?.role}</div>
          </div>
          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-2 rounded-[4px] px-3 py-2 text-[14px] text-deep-forest hover:bg-pale-sage"
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ---------------- Mobile top bar ---------------- */}
      <header className="md:hidden sticky top-0 z-30 h-14 bg-paper-white/95 backdrop-blur border-b border-black/10 flex items-center justify-center pt-safe">
        <span className="font-display text-[20px] text-deep-forest">{sectionLabel}</span>
      </header>

      {/* ---------------- Main ---------------- */}
      <main className="flex-1 md:ml-60">
        <div
          key={location.pathname}
          className="route-fade mx-auto max-w-[1200px] px-4 sm:px-6 md:px-10 py-6 md:py-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8"
        >
          {children}
        </div>
      </main>

      {/* ---------------- Mobile bottom navigation ---------------- */}
      <MobileTabBar tabs={bottomTabs} secondary={moreItems} onLogout={logout} />
    </div>
  );
}

function SideLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-[4px] px-3 py-2 text-[15px] font-medium transition-colors",
          isActive ? "bg-deep-forest text-paper-white" : "text-deep-forest hover:bg-pale-sage",
        )
      }
    >
      <Icon size={18} />
      {item.label}
    </NavLink>
  );
}

function MobileTabBar({
  tabs,
  secondary,
  onLogout,
}: {
  tabs: NavItem[];
  secondary: NavItem[];
  onLogout: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <>
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-paper-white/95 backdrop-blur pb-safe">
        <div className="flex items-stretch justify-around">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                    isActive ? "text-deep-forest" : "text-charcoal/50",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-[10px] transition-colors",
                        isActive && "bg-chartreuse-lime text-ink-black",
                      )}
                    >
                      <Icon size={18} />
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-charcoal/50"
          >
            <span className="grid h-7 w-7 place-items-center rounded-[10px]">
              <MoreHorizontal size={18} />
            </span>
            Más
          </button>
        </div>
      </nav>

      {/* "Más" bottom sheet */}
      <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="md:hidden fixed inset-0 z-50 bg-deep-forest/40 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]" />
          <Dialog.Content className="md:hidden fixed inset-x-0 bottom-0 z-50 rounded-t-[16px] bg-paper-white border border-black/10 pb-safe animate-[sheetUp_220ms_cubic-bezier(0.32,0.72,0,1)]">
            <div className="flex justify-center pt-2.5">
              <span className="h-1.5 w-10 rounded-full bg-black/15" />
            </div>
            <Dialog.Title className="px-5 pt-3 pb-1 font-display text-[22px] text-deep-forest">
              Más
            </Dialog.Title>
            <div className="px-3 py-2">
              {secondary.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.to}
                    onClick={() => {
                      setMoreOpen(false);
                      navigate(item.to);
                    }}
                    className="flex w-full items-center gap-3 rounded-[4px] px-3 py-3 text-[16px] text-deep-forest hover:bg-pale-sage"
                  >
                    <Icon size={20} /> {item.label}
                  </button>
                );
              })}
              <div className="my-2 border-t border-black/10" />
              <div className="px-3 py-2 text-[13px] text-charcoal">
                {user?.name} · <span className="capitalize">{user?.role}</span>
              </div>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-3 rounded-[4px] px-3 py-3 text-[16px] text-red-700 hover:bg-red-50"
              >
                <LogOut size={20} /> Cerrar sesión
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
