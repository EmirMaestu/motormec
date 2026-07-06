import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare, LogOut, Building2, ImageUp, Coins } from "lucide-react";
import { useAuth } from "@/auth";
import { api } from "@/lib/api";
import type { Currency } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { Button, Card, PageHeader } from "@/components/ui";

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "ARS", label: "Peso argentino (ARS)" },
  { value: "CLP", label: "Peso chileno (CLP)" },
  { value: "USD", label: "Dólar (USD)" },
];

/** Moneda del taller: se usa en presupuestos, cobros y toda la app. */
function CurrencySelector({ current }: { current: Currency }) {
  const toast = useToast();
  const { refreshMe } = useAuth();
  const save = useMutation({
    mutationFn: (currency: Currency) =>
      api.patch<{ ok: boolean; settings: Record<string, unknown> }>("/api/settings", { currency }),
    onSuccess: async () => {
      // Refetch de /api/me → el useEffect del AuthContext corre setActiveCurrency
      // y toda la app re-renderiza con la nueva moneda.
      await refreshMe();
      toast.success("Moneda actualizada");
    },
    onError: () => toast.error("No se pudo actualizar la moneda"),
  });

  return (
    <Card>
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-[4px] bg-pale-sage text-deep-forest">
          <Coins size={20} />
        </span>
        <div>
          <div className="font-medium text-deep-forest">Moneda del taller</div>
          <div className="text-[13px] text-charcoal">Se usa en presupuestos, cobros y montos</div>
        </div>
      </div>
      <select
        value={current}
        disabled={save.isPending}
        onChange={(e) => save.mutate(e.target.value as Currency)}
        className="w-full rounded-[4px] border border-ink-black bg-white px-3 py-2 text-[14px] text-deep-forest disabled:opacity-60"
      >
        {CURRENCIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </Card>
  );
}

/** Logo propio del taller (aparece en los presupuestos). */
function LogoUploader({ currentPath }: { currentPath?: string }) {
  const toast = useToast();
  const [preview, setPreview] = useState<string | null>(currentPath ? `/api/media/${currentPath}` : null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const image = await readDataUrl(file);
      return api.post<{ logoPath: string }>("/api/settings/logo", { image });
    },
    onSuccess: (res) => {
      setPreview(`/api/media/${res.logoPath}`);
      toast.success("Logo actualizado · aparece en tus próximos presupuestos");
    },
    onError: () => toast.error("No se pudo subir el logo (máx 5MB, PNG/JPG/SVG)"),
  });

  return (
    <Card>
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-[4px] bg-pale-sage text-deep-forest">
          <ImageUp size={20} />
        </span>
        <div>
          <div className="font-medium text-deep-forest">Logo del taller</div>
          <div className="text-[13px] text-charcoal">Se usa en los presupuestos (PNG o JPG)</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="grid h-20 w-40 place-items-center rounded-[8px] border border-black/10 bg-white overflow-hidden">
          {preview ? (
            <img src={preview} alt="Logo" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[13px] text-charcoal">Sin logo</span>
          )}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-[4px] border border-ink-black px-3 py-1.5 text-[14px] font-medium text-deep-forest hover:bg-pale-sage">
          <ImageUp size={15} /> {upload.isPending ? "Subiendo…" : "Subir logo"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={upload.isPending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </Card>
  );
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function SettingsPage() {
  const { user, tenant, isAdmin, logout } = useAuth();
  const logoPath = (tenant?.settings as { logoPath?: string } | undefined)?.logoPath;
  const currency = (tenant?.settings as { currency?: Currency } | undefined)?.currency ?? "ARS";
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

        {isAdmin ? <CurrencySelector current={currency} /> : null}

        {isAdmin ? <LogoUploader currentPath={logoPath} /> : null}

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
