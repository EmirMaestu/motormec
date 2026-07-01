import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, LogOut, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAdminAuth } from "@/adminAuth";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/Modal";
import { Badge, Button, Card, Field, Input, PageHeader, Spinner } from "@/components/ui";
import { FormField, NumberInput, Select } from "@/components/form";
import { formatDate } from "@/lib/utils";

interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  active: boolean;
  waDisplayNumber: string | null;
  hasWhatsApp: boolean;
  createdAt: string;
  counts: { users: number; vehicles: number; orders: number };
}

const PLANS = ["arranque", "pro", "cadena", "enterprise"];

export function AdminConsole() {
  const { admin, isLoading } = useAdminAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Spinner />
      </div>
    );
  }
  if (!admin) return <AdminLogin />;
  return <Console />;
}

function AdminLogin() {
  const { login } = useAdminAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Credenciales inválidas" : "No se pudo ingresar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-deep-forest p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-[16px] bg-paper-white p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="grid h-10 w-10 place-items-center rounded-[4px] bg-deep-forest text-chartreuse-lime">
            <ShieldCheck size={20} />
          </span>
          <span className="font-display text-[24px] text-deep-forest">Momec · Admin</span>
        </div>
        <div className="space-y-4">
          <Field label="Usuario">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </Field>
          <Field label="Contraseña">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </div>
        {error ? <p className="mt-4 text-[14px] text-red-700">{error}</p> : null}
        <Button type="submit" disabled={loading} className="mt-6 w-full">
          {loading ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>
    </div>
  );
}

function Console() {
  const { admin, logout } = useAdminAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => api.get<{ tenants: AdminTenant[] }>("/api/admin/tenants"),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });

  return (
    <div className="min-h-screen bg-pale-sage">
      <header className="bg-paper-white border-b border-black/10">
        <div className="mx-auto max-w-[1100px] px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-[4px] bg-deep-forest text-chartreuse-lime">
              <ShieldCheck size={18} />
            </span>
            <span className="font-display text-[20px] text-deep-forest">Momec · Consola</span>
          </div>
          <div className="flex items-center gap-3 text-[14px]">
            <span className="text-charcoal hidden sm:inline">{admin?.name}</span>
            <button onClick={() => logout()} className="flex items-center gap-1.5 text-deep-forest hover:underline">
              <LogOut size={16} /> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-6 py-8">
        <PageHeader
          eyebrow="Plataforma"
          title="Talleres"
          actions={
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={18} /> Nuevo taller
            </Button>
          }
        />

        {isLoading ? (
          <Spinner />
        ) : (data?.tenants.length ?? 0) === 0 ? (
          <Card>Todavía no hay talleres. Creá el primero.</Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data!.tenants.map((t) => (
              <button
                key={t.id}
                onClick={() => setDetailId(t.id)}
                className="text-left rounded-[16px] bg-paper-white border border-black/10 p-5 hover:border-deep-forest transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display text-[20px] text-deep-forest">{t.name}</div>
                    <div className="text-[12px] text-charcoal">/{t.slug}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={t.active ? "processed" : "error"}>{t.active ? "Activo" : "Suspendido"}</Badge>
                    <span className="text-[11px] uppercase tracking-wide text-forest-mid">{t.plan}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4 text-[13px] text-charcoal">
                  <span>👥 {t.counts.users}</span>
                  <span>🚗 {t.counts.vehicles}</span>
                  <span>🧾 {t.counts.orders}</span>
                  <span className={t.hasWhatsApp ? "text-vivid-green" : "text-charcoal/50"}>
                    {t.hasWhatsApp ? "WhatsApp ✓" : "Sin WhatsApp"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {showCreate ? (
        <CreateTenantModal onClose={() => setShowCreate(false)} onSaved={invalidate} />
      ) : null}
      {detailId ? (
        <TenantDetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={invalidate} />
      ) : null}
    </div>
  );
}

function CreateTenantModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    plan: "arranque",
    adminName: "",
    adminUsername: "admin",
    adminPassword: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: () => api.post("/api/admin/tenants", form),
    onSuccess: () => {
      toast.success("Taller creado");
      onSaved();
      onClose();
    },
    onError: (e: unknown) => {
      const code = e instanceof ApiError ? e.code : "";
      toast.error(code === "slug_taken" ? "Ese slug ya existe" : "No se pudo crear");
    },
  });

  const valid = form.name.trim() && /^[a-z0-9-]{2,}$/.test(form.slug) && form.adminName.trim() && form.adminPassword.length >= 6;

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Nuevo taller"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => create.mutate()} disabled={!valid || create.isPending}>
            {create.isPending ? "Creando…" : "Crear"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Nombre del taller" required>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </FormField>
        <FormField label="Slug (URL)" required hint="minúsculas y guiones">
          <Input
            value={form.slug}
            onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            placeholder="taller-central"
          />
        </FormField>
      </div>
      <FormField label="Plan">
        <Select value={form.plan} onChange={(v) => set("plan", v)}>
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="border-t border-black/10 pt-3">
        <div className="eyebrow mb-2">Usuario admin del taller</div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Nombre" required>
            <Input value={form.adminName} onChange={(e) => set("adminName", e.target.value)} />
          </FormField>
          <FormField label="Usuario" required>
            <Input value={form.adminUsername} onChange={(e) => set("adminUsername", e.target.value)} />
          </FormField>
        </div>
        <FormField label="Contraseña" required hint="mínimo 6 caracteres">
          <Input type="password" value={form.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}

interface TenantDetail {
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    active: boolean;
    waPhoneNumberId: string | null;
    waDisplayNumber: string | null;
    hasAccessToken: boolean;
    createdAt: string;
  };
  users: Array<{ id: string; name: string; username: string; role: string; active: boolean }>;
  numbers: Array<{ id: string; phone: string; name: string; active: boolean }>;
  customers: number;
  limits: {
    label: string;
    priceUsd: number;
    maxUsers: number | null;
    maxNumbers: number | null;
    maxIaMonthly: number | null;
  };
  usage: { users: number; numbers: number; iaMonthly: number };
}

/** Una fila de consumo (usado / tope) con barra. `max=null` = ilimitado. */
function UsageRow({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const over = max != null && used >= max;
  return (
    <div>
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-charcoal">{label}</span>
        <span className={over ? "text-red-700 font-medium" : "text-deep-forest"}>
          {used}
          {max == null ? " · ilimitado" : ` / ${max}`}
        </span>
      </div>
      {max != null ? (
        <div className="mt-1 h-1.5 w-full rounded-full bg-black/10">
          <div
            className={`h-full rounded-full ${over ? "bg-red-600" : "bg-vivid-green"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function TenantDetailModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin", "tenant", id],
    queryFn: () => api.get<TenantDetail>(`/api/admin/tenants/${id}`),
  });
  const t = data?.tenant;
  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "tenant", id] });
    onChanged();
  };

  const [plan, setPlan] = useState<string | null>(null);
  const [numPhone, setNumPhone] = useState("");
  const [numName, setNumName] = useState("");

  const updateTenant = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/api/admin/tenants/${id}`, body),
    onSuccess: () => {
      refetch();
      toast.success("Actualizado");
    },
  });
  const addNumber = useMutation({
    mutationFn: () => api.post(`/api/admin/tenants/${id}/numbers`, { phone: numPhone.trim(), name: numName.trim() }),
    onSuccess: () => {
      refetch();
      setNumPhone("");
      setNumName("");
      toast.success("Número autorizado");
    },
    onError: (e: unknown) =>
      toast.error(
        e instanceof ApiError && e.code === "plan_limit"
          ? (e.message ?? "Alcanzaste el límite del plan")
          : "No se pudo autorizar",
      ),
  });
  const delNumber = useMutation({
    mutationFn: (nid: string) => api.del(`/api/admin/numbers/${nid}`),
    onSuccess: refetch,
  });

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={t ? t.name : "Taller"}>
      {!t ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="text-[13px] text-charcoal">
              /{t.slug} · creado {formatDate(t.createdAt)} · {data?.customers ?? 0} clientes
            </div>
            <Badge tone={t.active ? "processed" : "error"}>{t.active ? "Activo" : "Suspendido"}</Badge>
          </div>

          {/* Suscripción */}
          <div>
            <FormField label="Plan (suscripción)">
              <Select value={plan ?? t.plan} onChange={(v) => setPlan(v)}>
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateTenant.mutate({ plan: plan ?? t.plan })}
                disabled={updateTenant.isPending}
              >
                Guardar plan
              </Button>
              <Button
                size="sm"
                variant={t.active ? "danger" : "primary"}
                onClick={() => updateTenant.mutate({ active: !t.active })}
              >
                {t.active ? "Suspender taller" : "Activar taller"}
              </Button>
            </div>

            {/* Consumo vs. límites del plan */}
            {data?.limits && data?.usage ? (
              <div className="mt-3 rounded-[16px] bg-pale-sage p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-deep-forest">
                    Plan {data.limits.label}
                  </span>
                  <span className="text-[12px] text-charcoal">
                    {data.limits.priceUsd > 0 ? `USD ${data.limits.priceUsd}/mes` : "a convenir"}
                  </span>
                </div>
                <UsageRow label="Usuarios" used={data.usage.users} max={data.limits.maxUsers} />
                <UsageRow label="Números WhatsApp" used={data.usage.numbers} max={data.limits.maxNumbers} />
                <UsageRow label="Mensajes IA (este mes)" used={data.usage.iaMonthly} max={data.limits.maxIaMonthly} />
              </div>
            ) : null}
          </div>

          {/* Authorized numbers */}
          <div className="border-t border-black/10 pt-4">
            <div className="rounded-[12px] bg-pale-sage p-3 mb-3 text-[13px] text-charcoal">
              Momec usa un <b>único número de WhatsApp</b> para todos los talleres. El ruteo se hace por el
              <b> remitente</b>: agregá acá los números de los empleados de este taller y todo lo que
              escriban al bot caerá en este taller.
            </div>
            <div className="eyebrow mb-2">Números autorizados (quién puede cargar por el bot)</div>
            <div className="space-y-2 mb-3">
              {(data?.numbers ?? []).map((n) => (
                <div key={n.id} className="flex items-center justify-between rounded-[4px] bg-pale-sage px-3 py-2">
                  <span className="text-[14px]">
                    {n.name} · <span className="text-charcoal">{n.phone}</span>
                  </span>
                  <button onClick={() => delNumber.mutate(n.id)} className="text-red-700">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {(data?.numbers.length ?? 0) === 0 ? <p className="text-[13px] text-charcoal">Ninguno todavía.</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberInput value={numPhone} onChange={setNumPhone} placeholder="5492611234567" />
              <Input value={numName} onChange={(e) => setNumName(e.target.value)} placeholder="Nombre" />
            </div>
            <Button variant="ghost" size="sm" onClick={() => addNumber.mutate()} disabled={!numPhone || !numName} className="mt-2">
              <Plus size={15} /> Autorizar número
            </Button>
          </div>

          {/* Users */}
          <div className="border-t border-black/10 pt-4">
            <div className="eyebrow mb-2">Usuarios del taller</div>
            <div className="space-y-2">
              {(data?.users ?? []).map((u) => (
                <div key={u.id} className="flex items-center justify-between text-[14px]">
                  <span>
                    {u.name} · <span className="text-charcoal">{u.username}</span>
                  </span>
                  <Badge tone="processed">{u.role}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
