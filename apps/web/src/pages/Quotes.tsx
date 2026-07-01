import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Printer, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/auth";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CardRow, DataList } from "@/components/DataList";
import { FormField, MoneyInput, NumberInput } from "@/components/form";
import { Button, Input, PageHeader, Textarea } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { printDocument } from "@/lib/export";
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
  total: number;
  validUntil?: string | null;
  createdByName?: string | null;
  createdAt: string;
}

export function QuotesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Quote | null>(null);

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
              <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
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
            <div className="flex gap-2 pt-1">
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
    </div>
  );
}

/** Genera e imprime el PDF del presupuesto con la marca del taller. */
function usePrintQuote() {
  const { tenant } = useAuth();
  return (q: Quote) => {
    const logoPath = (tenant?.settings as { logoPath?: string } | undefined)?.logoPath;
    const header = (tenant?.settings as { quoteHeader?: { phone?: string; address?: string; email?: string } } | undefined)?.quoteHeader;
    const logo = logoPath
      ? `<img src="/api/media/${logoPath}" style="max-height:70px;max-width:220px;object-fit:contain" />`
      : `<div style="font-family:Georgia,serif;font-size:28px;color:#043f2e">${tenant?.name ?? "Taller"}</div>`;
    const rows = q.items.map((it) => [
      it.description,
      String(it.quantity),
      formatCurrency(it.unitPrice),
      formatCurrency(it.quantity * it.unitPrice),
    ]);
    const itemsHtml = rows
      .map(
        (r) =>
          `<tr><td>${r[0]}</td><td class="right">${r[1]}</td><td class="right">${r[2]}</td><td class="right">${r[3]}</td></tr>`,
      )
      .join("");
    const contacto = [header?.phone, header?.address, header?.email].filter(Boolean).join(" · ");
    const body = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #043f2e;padding-bottom:14px">
        <div>${logo}<div class="muted" style="margin-top:6px">${tenant?.name ?? ""}${contacto ? " · " + contacto : ""}</div></div>
        <div style="text-align:right">
          <h2 style="margin:0">Presupuesto #${q.number}</h2>
          <div class="muted">${new Date(q.createdAt).toLocaleDateString("es-AR")}</div>
          ${q.validUntil ? `<div class="muted">Válido hasta ${q.validUntil}</div>` : ""}
        </div>
      </div>
      <div style="margin-top:14px">
        <strong>Cliente:</strong> ${q.customerName || "—"}${q.customerPhone ? " · " + q.customerPhone : ""}<br/>
        ${q.vehicleInfo || q.vehiclePlate ? `<strong>Vehículo:</strong> ${[q.vehicleInfo, q.vehiclePlate].filter(Boolean).join(" · ")}` : ""}
      </div>
      <table>
        <thead><tr><th>Detalle</th><th class="right">Cant.</th><th class="right">Precio</th><th class="right">Subtotal</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:12px">
        <div style="font-family:Georgia,serif;font-size:22px;color:#043f2e">Total: ${formatCurrency(q.total)}</div>
      </div>
      ${q.notes ? `<div style="margin-top:14px"><strong>Observaciones:</strong><br/>${q.notes.replace(/\n/g, "<br/>")}</div>` : ""}
      <div style="margin-top:36px;border-top:1px solid #0000001a;padding-top:10px;font-size:11px;color:#6b7280;text-align:center">
        Presupuesto generado con Momec · <a href="https://momec.pro" style="color:#2a6f2b">momec.pro</a>
      </div>`;
    printDocument(`Presupuesto #${q.number}`, body);
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

  const { data: customersData } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<{ customers: Customer[] }>("/api/customers"),
  });

  const total = useMemo(
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
          .map((i) => ({ description: i.description.trim(), quantity: Number(i.quantity) || 1, unitPrice: Number(i.unitPrice) || 0 })),
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
        <div className="mt-2 text-right font-display text-[20px] text-deep-forest">
          Total: {formatCurrency(total)}
        </div>
      </div>

      <FormField label="Observaciones">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Condiciones, garantía, etc." />
      </FormField>
    </Modal>
  );
}
