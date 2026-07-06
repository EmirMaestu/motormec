import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Printer, Trash2, Wrench } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CardRow, DataList } from "@/components/DataList";
import { FormField, MoneyInput, NumberInput, TaxDiscountSection } from "@/components/form";
import { Button, Input, PageHeader, Textarea } from "@/components/ui";
import { formatCurrency, formatDate, pesosToCents } from "@/lib/utils";
import type { Customer } from "@/lib/types";

interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
}
interface Quote {
  id: string;
  number: number;
  customerName: string;
  customerPhone?: string | null;
  vehiclePlate?: string | null;
  vehicleInfo?: string | null;
  items: QuoteItem[];
  notes?: string | null;
  subtotal: number;
  discountAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  validUntil?: string | null;
  createdByName?: string | null;
  createdAt: string;
  status?: string | null;
  workOrderId?: string | null;
}

export function QuotesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Quote | null>(null);
  const [confirmConvert, setConfirmConvert] = useState<Quote | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: () => api.get<{ quotes: Quote[] }>("/api/quotes"),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["quotes"] });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/quotes/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success("Presupuesto eliminado");
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const convert = useMutation({
    mutationFn: (id: string) =>
      api.post<{ order: { number: number } }>(`/api/quotes/${id}/convert`),
    onSuccess: (res) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success(`Orden #${res.order.number} creada desde el presupuesto`);
    },
    onError: (e) =>
      toast.error(
        e instanceof ApiError && e.status === 409
          ? "Ese presupuesto ya fue convertido en orden"
          : "No se pudo convertir en orden",
      ),
  });

  const print = usePrintQuote();

  return (
    <div>
      <PageHeader
        eyebrow="Taller"
        title="Presupuestos"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={18} /> <span className="hidden sm:inline">Nuevo</span>
          </Button>
        }
      />

      <DataList
        items={data?.quotes ?? []}
        loading={isLoading}
        keyOf={(q) => q.id}
        emptyTitle="Sin presupuestos"
        emptyHint="Creá tu primer presupuesto con la marca de tu taller."
        columns={[
          { header: "N°", cell: (q) => <span className="font-medium">#{q.number}</span> },
          { header: "Cliente", cell: (q) => q.customerName || "—" },
          { header: "Vehículo", cell: (q) => q.vehicleInfo || q.vehiclePlate || "—" },
          { header: "Total", cell: (q) => formatCurrency(q.total) },
          { header: "Fecha", cell: (q) => formatDate(q.createdAt) },
          {
            header: "",
            cell: (q) => (
              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                {q.workOrderId ? (
                  <span className="rounded-full bg-deep-forest/10 px-2 py-0.5 text-[11px] font-medium text-deep-forest">
                    Convertido
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" title="Convertir en orden" onClick={() => setConfirmConvert(q)}>
                    <Wrench size={15} />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => print(q)}>
                  <Printer size={15} />
                </Button>
                <Button size="sm" variant="danger" onClick={() => setConfirmDelete(q)}>
                  <Trash2 size={15} />
                </Button>
              </div>
            ),
          },
        ]}
        card={(q) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-deep-forest">#{q.number} · {q.customerName || "—"}</span>
              <span className="font-display text-[18px] text-deep-forest">{formatCurrency(q.total)}</span>
            </div>
            <CardRow label="Vehículo">{q.vehicleInfo || q.vehiclePlate || "—"}</CardRow>
            <CardRow label="Fecha">{formatDate(q.createdAt)}</CardRow>
            <div className="flex flex-wrap gap-2 pt-1">
              {q.workOrderId ? (
                <span className="self-center rounded-full bg-deep-forest/10 px-2 py-0.5 text-[12px] font-medium text-deep-forest">
                  Convertido en orden
                </span>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmConvert(q)}>
                  <Wrench size={15} /> A orden
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => print(q)}>
                <Printer size={15} /> PDF
              </Button>
              <Button size="sm" variant="danger" onClick={() => setConfirmDelete(q)}>
                <Trash2 size={15} /> Borrar
              </Button>
            </div>
          </div>
        )}
      />

      {showCreate ? (
        <CreateQuoteModal
          onClose={() => setShowCreate(false)}
          onSaved={(q) => {
            invalidate();
            toast.success(`Presupuesto #${q.number} creado`);
            print(q);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Eliminar presupuesto"
        message={`¿Eliminar el presupuesto #${confirmDelete?.number}? No se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Volver"
        danger
        loading={remove.isPending}
        onConfirm={() => {
          if (confirmDelete) remove.mutate(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={confirmConvert !== null}
        title="Convertir en orden"
        message={`¿Crear una orden de trabajo a partir del presupuesto #${confirmConvert?.number}? Se copian los ítems y el total; si la patente o el cliente no existen, se crean.`}
        confirmLabel="Crear orden"
        cancelLabel="Volver"
        loading={convert.isPending}
        onConfirm={() => {
          if (confirmConvert) convert.mutate(confirmConvert.id);
          setConfirmConvert(null);
        }}
        onCancel={() => setConfirmConvert(null)}
      />
    </div>
  );
}

/**
 * Abre el PDF del presupuesto generado por el servidor (mismo documento branded
 * que manda el bot por WhatsApp). Así web y WhatsApp son idénticos.
 */
function usePrintQuote() {
  return (q: Quote) => {
    window.open(`/api/quotes/${q.id}/pdf`, "_blank", "noopener");
  };
}

function emptyItem(): QuoteItem {
  return { description: "", quantity: 1, unitPrice: 0 };
}

function CreateQuoteModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (q: Quote) => void;
}) {
  const toast = useToast();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleInfo, setVehicleInfo] = useState("");
  const [items, setItems] = useState<QuoteItem[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [discount, setDiscount] = useState("");
  const [taxRate, setTaxRate] = useState(0); // bps; "Sin IVA" por defecto

  const { data: customersData } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<{ customers: Customer[] }>("/api/customers"),
  });

  // Subtotal en pesos (ítems); el desglose (descuento/IVA/total) lo hace TaxDiscountSection.
  const subtotal = useMemo(
    () => items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0),
    [items],
  );

  const create = useMutation({
    mutationFn: () =>
      api.post<{ quote: Quote }>("/api/quotes", {
        customerId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        vehiclePlate: vehiclePlate.trim() || undefined,
        vehicleInfo: vehicleInfo.trim() || undefined,
        items: items
          .filter((i) => i.description.trim())
          .map((i) => ({ description: i.description.trim(), quantity: Number(i.quantity) || 1, unitPrice: pesosToCents(Number(i.unitPrice) || 0) })),
        discountAmount: pesosToCents(Number(discount) || 0),
        taxRate,
        notes: notes.trim() || undefined,
        validUntil: validUntil || undefined,
      }),
    onSuccess: (res) => {
      onSaved(res.quote);
      onClose();
    },
    onError: () => toast.error("No se pudo crear el presupuesto"),
  });

  const validItems = items.filter((i) => i.description.trim()).length > 0;
  const setItem = (idx: number, patch: Partial<QuoteItem>) =>
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Nuevo presupuesto"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => (customerName.trim() && validItems ? create.mutate() : toast.error("Cargá cliente y al menos un ítem"))}
            disabled={create.isPending}
          >
            {create.isPending ? "Guardando…" : "Guardar e imprimir"}
          </Button>
        </>
      }
    >
      <FormField label="Cliente" required hint="Elegí uno existente o escribí uno nuevo">
        <select
          className="mb-2 w-full rounded-[4px] border border-black/30 bg-paper-white px-3 py-2 text-[15px] text-deep-forest"
          value={customerId ?? ""}
          onChange={(e) => {
            const c = customersData?.customers.find((x) => x.id === e.target.value);
            setCustomerId(c?.id ?? null);
            if (c) {
              setCustomerName(c.name);
              setCustomerPhone(c.phone ?? "");
            }
          }}
        >
          <option value="">— Cliente nuevo —</option>
          {(customersData?.customers ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.phone ? `· ${c.phone}` : ""}
            </option>
          ))}
        </select>
        <Input
          value={customerName}
          onChange={(e) => {
            setCustomerName(e.target.value);
            setCustomerId(null);
          }}
          placeholder="Nombre del cliente"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Teléfono">
          <NumberInput value={customerPhone} onChange={setCustomerPhone} placeholder="2611234567" />
        </FormField>
        <FormField label="Válido hasta">
          <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Patente (opcional)">
          <Input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())} placeholder="AB123CD" />
        </FormField>
        <FormField label="Vehículo (opcional)">
          <Input value={vehicleInfo} onChange={(e) => setVehicleInfo(e.target.value)} placeholder="Ford Focus 2015" />
        </FormField>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[14px] font-medium text-deep-forest">Ítems</span>
          <Button size="sm" variant="ghost" onClick={() => setItems((a) => [...a, emptyItem()])}>
            <Plus size={14} /> Agregar
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_64px_110px_auto] gap-2 items-center">
              <Input
                value={it.description}
                onChange={(e) => setItem(idx, { description: e.target.value })}
                placeholder="Servicio o repuesto"
              />
              <NumberInput
                value={String(it.quantity)}
                onChange={(v) => setItem(idx, { quantity: Number(v) || 0 })}
                placeholder="1"
              />
              <MoneyInput value={String(it.unitPrice)} onChange={(v) => setItem(idx, { unitPrice: Number(v) || 0 })} />
              <button
                onClick={() => setItems((a) => (a.length > 1 ? a.filter((_, i) => i !== idx) : a))}
                className="grid h-9 w-9 place-items-center rounded-[4px] text-red-700 hover:bg-red-50"
                aria-label="Quitar ítem"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <TaxDiscountSection
        subtotal={subtotal}
        discount={discount}
        onDiscount={setDiscount}
        taxRate={taxRate}
        onTaxRate={setTaxRate}
      />

      <FormField label="Observaciones">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Condiciones, garantía, etc." />
      </FormField>
    </Modal>
  );
}
