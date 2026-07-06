import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Minus, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/auth";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/Modal";
import { CardRow, DataList } from "@/components/DataList";
import { FormField, MoneyInput, NumberInput } from "@/components/form";
import { Badge, Button, IconButton, Input, PageHeader } from "@/components/ui";
import { formatCurrency, pesosToCents } from "@/lib/utils";
import type { Product } from "@/lib/types";

export function StockPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<{ products: Product[] }>("/api/products"),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["products"] });

  const adjust = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      api.patch(`/api/products/${id}`, { quantity }),
    onSuccess: invalidate,
  });

  const lowCount = data?.products.filter((p) => p.lowStock).length ?? 0;

  const Stepper = ({ p }: { p: Product }) => (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <IconButton onClick={() => adjust.mutate({ id: p.id, quantity: Math.max(0, p.quantity - 1) })}>
        <Minus size={16} />
      </IconButton>
      <span className="w-10 text-center font-medium">{p.quantity}</span>
      <IconButton onClick={() => adjust.mutate({ id: p.id, quantity: p.quantity + 1 })}>
        <Plus size={16} />
      </IconButton>
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Inventario"
        title="Stock"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={18} /> <span className="hidden sm:inline">Producto</span>
          </Button>
        }
      />

      {lowCount > 0 ? (
        <div className="mb-5 flex items-center gap-2 rounded-[16px] bg-chartreuse-lime px-4 py-3 text-ink-black">
          <AlertTriangle size={18} /> {lowCount} producto(s) con stock bajo.
        </div>
      ) : null}

      <DataList
        items={data?.products ?? []}
        loading={isLoading}
        keyOf={(p) => p.id}
        emptyTitle="Sin productos"
        columns={[
          { header: "Producto", cell: (p) => <span className="font-medium">{p.name}</span> },
          { header: "Tipo", cell: (p) => p.type || "—" },
          { header: "Cantidad", cell: (p) => <Stepper p={p} /> },
          { header: "Precio", cell: (p) => formatCurrency(p.price) },
          { header: "Estado", cell: (p) => (p.lowStock ? <Badge tone="error">Bajo</Badge> : <Badge tone="processed">OK</Badge>) },
        ]}
        card={(p) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-[18px] text-deep-forest">{p.name}</div>
                <div className="text-[13px] text-charcoal">{p.type || "—"}</div>
              </div>
              {p.lowStock ? <Badge tone="error">Bajo</Badge> : <Badge tone="processed">OK</Badge>}
            </div>
            <CardRow label="Precio">{formatCurrency(p.price)}</CardRow>
            <CardRow label="Reorden">{p.reorderPoint}</CardRow>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[13px] text-charcoal">{p.unit}</span>
              <Stepper p={p} />
            </div>
          </div>
        )}
      />

      {showCreate ? (
        <CreateProductModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            invalidate();
            toast.success("Producto creado");
          }}
        />
      ) : null}
    </div>
  );
}

function CreateProductModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    type: "",
    unit: "unidad",
    quantity: "0",
    price: "0",
    reorderPoint: "0",
  });
  const [submitted, setSubmitted] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: () =>
      api.post("/api/products", {
        name: form.name.trim(),
        type: form.type.trim(),
        unit: form.unit.trim() || "unidad",
        quantity: Number(form.quantity) || 0,
        price: pesosToCents(Number(form.price) || 0),
        reorderPoint: Number(form.reorderPoint) || 0,
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
      title="Nuevo producto"
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
        <FormField label="Tipo">
          <Input value={form.type} onChange={(e) => set("type", e.target.value)} />
        </FormField>
        <FormField label="Unidad">
          <Input value={form.unit} onChange={(e) => set("unit", e.target.value)} />
        </FormField>
        <FormField label="Cantidad">
          <NumberInput value={form.quantity} onChange={(v) => set("quantity", v)} />
        </FormField>
        <FormField label="Precio">
          <MoneyInput value={form.price} onChange={(v) => set("price", v)} />
        </FormField>
        <FormField label="Punto de reorden" hint="Alerta de stock bajo">
          <NumberInput value={form.reorderPoint} onChange={(v) => set("reorderPoint", v)} />
        </FormField>
      </div>
    </Modal>
  );
}
