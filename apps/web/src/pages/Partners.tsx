import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/Modal";
import { CardRow, DataList } from "@/components/DataList";
import { DateInput, FormField, MoneyInput, NumberInput } from "@/components/form";
import { Badge, Button, Input, PageHeader } from "@/components/ui";
import { formatCurrency, formatDate, pesosToCents } from "@/lib/utils";
import type { Partner } from "@/lib/types";

export function PartnersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: () => api.get<{ partners: Partner[] }>("/api/partners"),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["partners"] });

  return (
    <div>
      <PageHeader
        eyebrow="Sociedad"
        title="Socios"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={18} /> <span className="hidden sm:inline">Nuevo</span>
          </Button>
        }
      />

      <DataList
        items={data?.partners ?? []}
        loading={isLoading}
        keyOf={(p) => p.id}
        emptyTitle="Sin socios"
        columns={[
          { header: "Nombre", cell: (p) => <span className="font-medium">{p.name}</span> },
          { header: "% Inversión", cell: (p) => `${p.investmentPercentage}%` },
          { header: "Aporte mensual", cell: (p) => formatCurrency(p.monthlyContribution) },
          { header: "Total aportado", cell: (p) => formatCurrency(p.totalContributed) },
          { header: "Estado", cell: (p) => (p.active ? <Badge tone="processed">Activo</Badge> : <Badge tone="error">Inactivo</Badge>) },
        ]}
        card={(p) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-display text-[18px] text-deep-forest">{p.name}</div>
              {p.active ? <Badge tone="processed">Activo</Badge> : <Badge tone="error">Inactivo</Badge>}
            </div>
            <CardRow label="% Inversión">{p.investmentPercentage}%</CardRow>
            <CardRow label="Aporte mensual">{formatCurrency(p.monthlyContribution)}</CardRow>
            <CardRow label="Total aportado">{formatCurrency(p.totalContributed)}</CardRow>
            <CardRow label="Ingreso">{formatDate(p.joinDate)}</CardRow>
          </div>
        )}
      />

      {showCreate ? (
        <CreatePartnerModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            invalidate();
            toast.success("Socio agregado");
          }}
        />
      ) : null}
    </div>
  );
}

function CreatePartnerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    investmentPercentage: "0",
    monthlyContribution: "0",
    totalContributed: "0",
    joinDate: new Date().toISOString().split("T")[0]!,
  });
  const [submitted, setSubmitted] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: () =>
      api.post("/api/partners", {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        investmentPercentage: Number(form.investmentPercentage) || 0,
        monthlyContribution: pesosToCents(Number(form.monthlyContribution) || 0),
        totalContributed: pesosToCents(Number(form.totalContributed) || 0),
        joinDate: form.joinDate,
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: () => toast.error("No se pudo guardar"),
  });

  const nameError = submitted && !form.name.trim() ? "Nombre obligatorio" : undefined;
  const submit = () => {
    setSubmitted(true);
    if (!form.name.trim()) return;
    create.mutate();
  };

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Nuevo socio"
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
        <FormField label="Email">
          <Input value={form.email} onChange={(e) => set("email", e.target.value)} inputMode="email" />
        </FormField>
        <FormField label="Teléfono">
          <NumberInput value={form.phone} onChange={(v) => set("phone", v)} />
        </FormField>
        <FormField label="% Inversión">
          <NumberInput value={form.investmentPercentage} onChange={(v) => set("investmentPercentage", v)} />
        </FormField>
        <FormField label="Aporte mensual">
          <MoneyInput value={form.monthlyContribution} onChange={(v) => set("monthlyContribution", v)} />
        </FormField>
        <FormField label="Total aportado">
          <MoneyInput value={form.totalContributed} onChange={(v) => set("totalContributed", v)} />
        </FormField>
        <FormField label="Fecha ingreso">
          <DateInput value={form.joinDate} onChange={(v) => set("joinDate", v)} />
        </FormField>
      </div>
    </Modal>
  );
}
