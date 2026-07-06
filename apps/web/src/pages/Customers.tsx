import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/Modal";
import { CardRow, DataList } from "@/components/DataList";
import { FormField, NumberInput } from "@/components/form";
import { Badge, Button, Input, PageHeader, StatCard, Textarea } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { isValidPhone } from "@/lib/validation";
import type { Customer, CustomerBalance, PaymentEstado } from "@/lib/types";

const CUSTOMER_ESTADO_LABEL: Record<PaymentEstado, string> = {
  impaga: "Impaga",
  parcial: "Parcial",
  pagada: "Pagada",
};

function customerEstadoTone(estado: PaymentEstado): string {
  if (estado === "pagada") return "Entregado";
  if (estado === "parcial") return "En Reparación";
  return "Egreso";
}

interface Stats {
  totalCustomers: number;
  totalSpent: number;
  totalVehicles: number;
}

export function CustomersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<{ customers: Customer[] }>("/api/customers"),
  });
  const { data: stats } = useQuery({
    queryKey: ["customers", "stats"],
    queryFn: () => api.get<Stats>("/api/customers/stats"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["customers"] });

  const filtered = useMemo(() => {
    const list = data?.customers ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => [c.name, c.phone, c.email].join(" ").toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div>
      <PageHeader
        eyebrow="Cartera"
        title="Clientes"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={18} /> <span className="hidden sm:inline">Nuevo</span>
          </Button>
        }
      />

      {stats ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 mb-6">
          <StatCard label="Clientes" value={stats.totalCustomers} />
          <StatCard label="Facturado" value={formatCurrency(stats.totalSpent)} accent />
          <StatCard label="Vehículos" value={stats.totalVehicles} />
        </div>
      ) : null}

      <Input
        className="sm:max-w-xs mb-5"
        placeholder="Buscar nombre, teléfono…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <DataList
        items={filtered}
        loading={isLoading}
        keyOf={(c) => c.id}
        onRowClick={(c) => setDetailId(c.id)}
        emptyTitle="No hay clientes"
        columns={[
          { header: "Nombre", cell: (c) => <span className="font-medium">{c.name}</span> },
          { header: "Teléfono", cell: (c) => c.phone || "—" },
          { header: "Vehículos", cell: (c) => c.totalVehicles ?? 0 },
          { header: "Gastado", cell: (c) => formatCurrency(c.totalSpent) },
          { header: "Última visita", cell: (c) => formatDate(c.lastVisit) },
        ]}
        card={(c) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-display text-[18px] text-deep-forest">{c.name}</div>
              <span className="text-[14px] text-deep-forest">{formatCurrency(c.totalSpent)}</span>
            </div>
            <CardRow label="Teléfono">{c.phone || "—"}</CardRow>
            <CardRow label="Vehículos">{c.totalVehicles ?? 0}</CardRow>
            <CardRow label="Última visita">{formatDate(c.lastVisit)}</CardRow>
          </div>
        )}
      />

      {showCreate ? (
        <CreateCustomerModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            invalidate();
            toast.success("Cliente creado");
          }}
          onError={(m) => toast.error(m)}
        />
      ) : null}

      {detailId ? (
        <CustomerDetailModal
          customer={data?.customers.find((c) => c.id === detailId) ?? null}
          id={detailId}
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </div>
  );
}

/* --------------------------- Customer detail ----------------------------- */
function CustomerDetailModal({
  id,
  customer,
  onClose,
}: {
  id: string;
  customer: Customer | null;
  onClose: () => void;
}) {
  const { data: balance } = useQuery({
    queryKey: ["customer-balance", id],
    queryFn: () => api.get<CustomerBalance>(`/api/customers/${id}/balance`),
  });
  const deudaTotal = balance?.deudaTotal ?? 0;
  const ordenes = balance?.ordenes ?? [];

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={customer?.name ?? "Cliente"}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-1">
        <CardRow label="Teléfono">{customer?.phone || "—"}</CardRow>
        {customer?.email ? <CardRow label="Email">{customer.email}</CardRow> : null}
        <CardRow label="Vehículos">{customer?.totalVehicles ?? 0}</CardRow>
        <CardRow label="Última visita">{formatDate(customer?.lastVisit)}</CardRow>
      </div>

      {/* Cuenta corriente: deuda total + órdenes con saldo */}
      <div
        className={
          deudaTotal > 0
            ? "rounded-[8px] bg-red-50 border border-red-200 px-4 py-3"
            : "rounded-[8px] bg-pale-sage px-4 py-3"
        }
      >
        <div className="flex items-center justify-between">
          <span className="eyebrow">Deuda</span>
          <span
            className={
              deudaTotal > 0
                ? "font-display text-[22px] text-red-700"
                : "font-display text-[22px] text-deep-forest"
            }
          >
            {formatCurrency(deudaTotal)}
          </span>
        </div>
        {deudaTotal <= 0 ? (
          <p className="mt-1 text-[13px] text-charcoal">Sin saldos pendientes.</p>
        ) : null}
      </div>

      {ordenes.length ? (
        <div>
          <div className="eyebrow mb-1">Órdenes con saldo</div>
          <div className="space-y-1">
            {ordenes.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-[14px]">
                <span className="flex items-center gap-2">
                  <span className="text-deep-forest">#{o.number}</span>
                  <Badge tone={customerEstadoTone(o.estado)}>{CUSTOMER_ESTADO_LABEL[o.estado]}</Badge>
                </span>
                <span className="text-deep-forest">{formatCurrency(o.saldo)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function CreateCustomerModal({
  onClose,
  onSaved,
  onError,
}: {
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    documentType: "DNI",
    documentNumber: "",
    address: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: () =>
      api.post("/api/customers", {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        documentType: form.documentType,
        documentNumber: form.documentNumber.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: () => onError("No se pudo guardar (¿teléfono duplicado?)"),
  });

  const nameError = submitted && !form.name.trim() ? "El nombre es obligatorio" : undefined;
  const phoneError = submitted && form.phone && !isValidPhone(form.phone) ? "Teléfono inválido" : undefined;

  const submit = () => {
    setSubmitted(true);
    if (!form.name.trim()) return;
    if (form.phone && !isValidPhone(form.phone)) return;
    create.mutate();
  };

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Nuevo cliente"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <FormField label="Nombre" required error={nameError}>
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Teléfono" error={phoneError} hint="Solo números">
          <NumberInput value={form.phone} onChange={(v) => set("phone", v)} placeholder="2611234567" />
        </FormField>
        <FormField label="Email">
          <Input value={form.email} onChange={(e) => set("email", e.target.value)} inputMode="email" />
        </FormField>
        <FormField label="Tipo doc.">
          <Input value={form.documentType} onChange={(e) => set("documentType", e.target.value)} />
        </FormField>
        <FormField label="Nro. doc.">
          <NumberInput value={form.documentNumber} onChange={(v) => set("documentNumber", v)} />
        </FormField>
      </div>
      <FormField label="Dirección">
        <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
      </FormField>
      <FormField label="Notas">
        <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </FormField>
    </Modal>
  );
}
