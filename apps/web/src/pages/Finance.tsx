import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/Modal";
import { CardRow, DataList } from "@/components/DataList";
import { DateInput, FormField, MoneyInput, Select } from "@/components/form";
import { Badge, Button, Input, PageHeader, StatCard } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

interface Summary {
  totalIngresos: number;
  totalEgresos: number;
  balance: number;
}

export function FinancePage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => api.get<{ transactions: Transaction[] }>("/api/transactions"),
  });
  const { data: summary } = useQuery({
    queryKey: ["transactions", "summary"],
    queryFn: () => api.get<Summary>("/api/transactions/summary"),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["transactions"] });

  const suspend = useMutation({
    mutationFn: (id: string) => api.post(`/api/transactions/${id}/suspend`),
    onSuccess: () => {
      invalidate();
      toast.success("Movimiento suspendido");
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Finanzas"
        title="Movimientos"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={18} /> <span className="hidden sm:inline">Nuevo</span>
          </Button>
        }
      />

      {summary ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 mb-6">
          <StatCard label="Ingresos" value={formatCurrency(summary.totalIngresos)} accent />
          <StatCard label="Egresos" value={formatCurrency(summary.totalEgresos)} />
          <StatCard label="Balance" value={formatCurrency(summary.balance)} />
        </div>
      ) : null}

      <DataList
        items={data?.transactions ?? []}
        loading={isLoading}
        keyOf={(t) => t.id}
        emptyTitle="Sin movimientos"
        columns={[
          { header: "Fecha", cell: (t) => formatDate(t.date) },
          { header: "Descripción", cell: (t) => <span className="line-clamp-1">{t.description}</span> },
          { header: "Tipo", cell: (t) => <Badge tone={t.type}>{t.type}</Badge> },
          { header: "Categoría", cell: (t) => t.category },
          {
            header: "Monto",
            cell: (t) => (
              <span className={t.type === "Ingreso" ? "text-vivid-green" : "text-red-700"}>
                {formatCurrency(t.amount)}
              </span>
            ),
          },
          {
            header: "",
            align: "right",
            cell: (t) => (
              <Button size="sm" variant="ghost" onClick={() => suspend.mutate(t.id)}>
                Suspender
              </Button>
            ),
          },
        ]}
        card={(t) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="line-clamp-2 text-[15px] text-deep-forest">{t.description}</span>
              <span className={t.type === "Ingreso" ? "text-vivid-green font-medium" : "text-red-700 font-medium"}>
                {t.type === "Ingreso" ? "+" : "−"}
                {formatCurrency(Math.abs(t.amount))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <Badge tone={t.type}>{t.category || t.type}</Badge>
              <span className="text-[13px] text-charcoal">{formatDate(t.date)}</span>
            </div>
          </div>
        )}
      />

      {showCreate ? (
        <CreateTxModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            invalidate();
            toast.success("Movimiento registrado");
          }}
        />
      ) : null}
    </div>
  );
}

function CreateTxModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0]!,
    description: "",
    type: "Ingreso",
    category: "",
    amount: "",
    supplier: "",
    paymentMethod: "Efectivo",
  });
  const [submitted, setSubmitted] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: () =>
      api.post("/api/transactions", {
        date: form.date,
        description: form.description.trim(),
        type: form.type,
        category: form.category.trim() || "Otros",
        amount: Number(form.amount) || 0,
        supplier: form.supplier.trim() || undefined,
        paymentMethod: form.paymentMethod,
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: () => toast.error("No se pudo registrar"),
  });

  const descError = submitted && !form.description.trim() ? "Descripción obligatoria" : undefined;
  const amountError = submitted && !(Number(form.amount) > 0) ? "Monto inválido" : undefined;

  const submit = () => {
    setSubmitted(true);
    if (!form.description.trim() || !(Number(form.amount) > 0)) return;
    create.mutate();
  };

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Nuevo movimiento"
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
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Fecha" required>
          <DateInput value={form.date} onChange={(v) => set("date", v)} />
        </FormField>
        <FormField label="Tipo" required>
          <Select value={form.type} onChange={(v) => set("type", v)}>
            <option>Ingreso</option>
            <option>Egreso</option>
          </Select>
        </FormField>
      </div>
      <FormField label="Descripción" required error={descError}>
        <Input value={form.description} onChange={(e) => set("description", e.target.value)} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Categoría">
          <Input value={form.category} onChange={(e) => set("category", e.target.value)} />
        </FormField>
        <FormField label="Monto" required error={amountError}>
          <MoneyInput value={form.amount} onChange={(v) => set("amount", v)} />
        </FormField>
        <FormField label="Persona/Proveedor">
          <Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} />
        </FormField>
        <FormField label="Método de pago">
          <Select value={form.paymentMethod} onChange={(v) => set("paymentMethod", v)}>
            <option>Efectivo</option>
            <option>Transferencia</option>
            <option>Débito</option>
            <option>Crédito</option>
            <option>MercadoPago</option>
          </Select>
        </FormField>
      </div>
    </Modal>
  );
}
