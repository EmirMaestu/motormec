import { Link } from "react-router-dom";
import { MessageSquare, LogOut, Building2 } from "lucide-react";
import { useAuth } from "@/auth";
import { Card, PageHeader } from "@/components/ui";

export function SettingsPage() {
  const { user, tenant, isAdmin, logout } = useAuth();
  return (
    <div>
      <PageHeader eyebrow="Cuenta" title="Configuración" />

      <div className="space-y-4 max-w-2xl">
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <span className="grid h-10 w-10 place-items-center rounded-[4px] bg-deep-forest text-chartreuse-lime">
              <Building2 size={20} />
            </span>
            <div>
              <div className="font-display text-[22px] text-deep-forest">{tenant?.name}</div>
              <div className="text-[13px] text-charcoal">Taller · {tenant?.slug}</div>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-[14px]">
            <div>
              <dt className="eyebrow">Usuario</dt>
              <dd className="text-deep-forest">{user?.name}</dd>
            </div>
            <div>
              <dt className="eyebrow">Rol</dt>
              <dd className="text-deep-forest capitalize">{user?.role}</dd>
            </div>
          </dl>
        </Card>

        {isAdmin ? (
          <Link
            to="/whatsapp"
            className="flex items-center gap-3 rounded-[16px] bg-paper-white border border-black/10 p-4 active:bg-pale-sage transition"
          >
            <span className="grid h-10 w-10 place-items-center rounded-[4px] bg-pale-sage text-deep-forest">
              <MessageSquare size={20} />
            </span>
            <div className="flex-1">
              <div className="font-medium text-deep-forest">Bot de WhatsApp</div>
              <div className="text-[13px] text-charcoal">Números autorizados y credenciales</div>
            </div>
          </Link>
        ) : null}

        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-[16px] border border-red-200 bg-red-50 p-4 text-red-700 active:bg-red-100 transition md:hidden"
        >
          <LogOut size={20} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}
