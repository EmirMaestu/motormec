import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import { api, qs } from "@/lib/api";
import { useAuth } from "@/auth";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CardRow, DataList } from "@/components/DataList";
import {
  BrandModelSelect,
  ComboSelect,
  CreatableMultiSelect,
  FormField,
  MoneyInput,
  NumberInput,
  PlateInput,
  Select,
  TaxDiscountSection,
} from "@/components/form";
import { Badge, Button, IconButton, Input, PageHeader } from "@/components/ui";
import { centsToPesos, formatCurrency, formatDate, pesosToCents } from "@/lib/utils";
import { compressImage } from "@/lib/image";
import { isValidPlate } from "@/lib/validation";
import { ORDER_STATUSES, type OrderPart, type Payment, type PaymentEstado, type Product, type Service, type Vehicle, type WorkOrder } from "@/lib/types";

/** Métodos de pago (deben coincidir con el enum del backend). */
const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "mercadopago", label: "MercadoPago" },
  { value: "otro", label: "Otro" },
];

const PAYMENT_ESTADO_LABEL: Record<PaymentEstado, string> = {
  impaga: "Impaga",
  parcial: "Parcial",
  pagada: "Pagada",
};

function paymentEstadoTone(estado: PaymentEstado): string {
  if (estado === "pagada") return "Entregado";
  if (estado === "parcial") return "En Reparación";
  return "Egreso";
}

/** Deriva el estado de cobro de una orden a partir de total y paidAmount. */
function orderPaymentEstado(total: number, paidAmount: number): PaymentEstado {
  if (paidAmount <= 0) return "impaga";
  if (paidAmount >= total) return "pagada";
  return "parcial";
}

export function OrdersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["orders", statusFilter],
    queryFn: () => api.get<{ orders: WorkOrder[] }>("/api/orders" + qs({ status: statusFilter })),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["orders"] });

  const filtered = useMemo(() => {
    const list = data?.orders ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) =>
      [`#${o.number}`, o.vehiclePlate, o.customerName, o.vehicleInfo].join(" ").toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div>
      <PageHeader
        eyebrow="Taller"
        title="Órdenes"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={18} /> <span className="hidden sm:inline">Nueva orden</span>
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <Input
          className="sm:max-w-xs"
          placeholder="Buscar #, patente, cliente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-[4px] border border-black/30 bg-paper-white px-3 py-2.5 text-[16px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <DataList
        items={filtered}
        loading={isLoading}
        keyOf={(o) => o.id}
        onRowClick={(o) => setDetailId(o.id)}
        emptyTitle="No hay órdenes"
        emptyHint="Creá la primera orden de trabajo."
        columns={[
          { header: "#", cell: (o) => <span className="font-medium">#{o.number}</span> },
          { header: "Vehículo", cell: (o) => `${o.vehiclePlate} · ${o.vehicleInfo}`.trim() },
          { header: "Cliente", cell: (o) => o.customerName || "—" },
          { header: "Estado", cell: (o) => <Badge tone={mapTone(o.status)}>{o.status}</Badge> },
          { header: "Total", align: "right", cell: (o) => formatCurrency(o.total) },
        ]}
        card={(o) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-[18px] text-deep-forest">#{o.number} · {o.vehiclePlate}</div>
                <div className="text-[13px] text-charcoal">{o.vehicleInfo || "—"}</div>
              </div>
              <Badge tone={mapTone(o.status)}>{o.status}</Badge>
            </div>
            <CardRow label="Cliente">{o.customerName || "—"}</CardRow>
            <CardRow label="Ingreso">{formatDate(o.entryDate)}</CardRow>
            <CardRow label="Total">{formatCurrency(o.total)}</CardRow>
          </div>
        )}
      />

      {showCreate ? (
        <CreateOrderModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            invalidate();
            toast.success("Orden creada");
          }}
        />
      ) : null}

      {detailId ? (
        <OrderDetailModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={invalidate}
        />
      ) : null}
    </div>
  );
}

function mapTone(status: string): string {
  if (status === "Entregado") return "Entregado";
  if (status === "Cancelado") return "Suspendido";
  if (status === "Listo para entregar") return "Listo";
  if (status === "Pendiente") return "Ingresado";
  return "En Reparación";
}

/* --------------------------- Parts editor -------------------------------- */
function PartsEditor({
  parts,
  onChange,
  products,
}: {
  parts: OrderPart[];
  onChange: (p: OrderPart[]) => void;
  products: Product[];
}) {
  const [mode, setMode] = useState<"inventario" | "manual">("inventario");
  const [productName, setProductName] = useState("");
  const [manualName, setManualName] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");

  const add = () => {
    const quantity = Number(qty) || 1;
    if (mode === "inventario") {
      const prod = products.find((p) => p.name === productName);
      if (!prod) return;
      // `price` (MoneyInput) y el estado `parts` viven en PESOS; prod.price viene en centavos.
      onChange([
        ...parts,
        { productId: prod.id, name: prod.name, quantity, unitPrice: Number(price) || centsToPesos(prod.price), fromInventory: true },
      ]);
      setProductName("");
    } else {
      if (!manualName.trim()) return;
      onChange([...parts, { name: manualName.trim(), quantity, unitPrice: Number(price) || 0, fromInventory: false }]);
      setManualName("");
    }
    setQty("1");
    setPrice("");
  };

  return (
    <div className="space-y-3">
      {parts.length > 0 ? (
        <div className="space-y-2">
          {parts.map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-[4px] bg-pale-sage px-3 py-2">
              <div className="min-w-0">
                <div className="text-[14px] text-deep-forest truncate">
                  {p.name} {p.fromInventory ? <span className="text-[11px] text-charcoal">(stock)</span> : null}
                </div>
                <div className="text-[12px] text-charcoal">
                  {p.quantity} × {formatCurrency(pesosToCents(p.unitPrice))} = {formatCurrency(pesosToCents(p.quantity * p.unitPrice))}
                </div>
              </div>
              <IconButton onClick={() => onChange(parts.filter((_, j) => j !== i))}>
                <Trash2 size={15} />
              </IconButton>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex gap-1 rounded-[4px] bg-pale-sage p-1 w-fit text-[13px]">
        {(["inventario", "manual"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={mode === m ? "rounded-[4px] bg-deep-forest text-paper-white px-3 py-1" : "px-3 py-1 text-deep-forest"}
          >
            {m === "inventario" ? "Del inventario" : "Manual"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {mode === "inventario" ? (
          <div className="col-span-2">
            <ComboSelect
              value={productName}
              onChange={(v) => {
                setProductName(v);
                const prod = products.find((p) => p.name === v);
                if (prod) setPrice(String(centsToPesos(prod.price)));
              }}
              options={products.map((p) => p.name)}
              placeholder="Elegí un producto"
              otherLabel="—"
            />
          </div>
        ) : (
          <Input className="col-span-2" placeholder="Nombre del repuesto" value={manualName} onChange={(e) => setManualName(e.target.value)} />
        )}
        <NumberInput value={qty} onChange={setQty} placeholder="Cantidad" />
        <MoneyInput value={price} onChange={setPrice} placeholder="Precio unit." />
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={add}>
        <Plus size={15} /> Agregar repuesto
      </Button>
    </div>
  );
}

/* --------------------------- Create order -------------------------------- */
function CreateOrderModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [plate, setPlate] = useState("");
  const [foundVehicle, setFoundVehicle] = useState<Vehicle | null>(null);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [owner, setOwner] = useState("");
  const [phone, setPhone] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [parts, setParts] = useState<OrderPart[]>([]);
  const [labor, setLabor] = useState("");
  const [notes, setNotes] = useState("");
  const [estimated, setEstimated] = useState("");
  const [discount, setDiscount] = useState("");
  const [taxRate, setTaxRate] = useState(0); // bps; "Sin IVA" por defecto
  const [submitted, setSubmitted] = useState(false);

  const { data: servicesData } = useQuery({
    queryKey: ["services"],
    queryFn: () => api.get<{ services: Service[] }>("/api/services"),
  });
  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<{ products: Product[] }>("/api/products"),
  });

  const lookup = useMutation({
    mutationFn: () => api.get<{ vehicle: Vehicle | null }>("/api/vehicles/search" + qs({ plate })),
    onSuccess: (res) => {
      if (res.vehicle) {
        setFoundVehicle(res.vehicle);
        setBrand(res.vehicle.brand);
        setModel(res.vehicle.model);
        setOwner(res.vehicle.owner);
        setPhone(res.vehicle.phone);
        toast.success(`Vehículo encontrado: ${res.vehicle.plate}`);
      } else {
        setFoundVehicle(null);
        toast.toast("No existe; se creará uno nuevo");
      }
    },
  });

  const createService = useMutation({
    mutationFn: (name: string) => api.post("/api/services", { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] }),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post("/api/orders", {
        vehicleId: foundVehicle?.id ?? null,
        plate,
        brand: brand.trim(),
        model: model.trim(),
        customerName: owner.trim(),
        phone,
        services,
        // El estado `parts` vive en PESOS; el backend espera centavos.
        parts: parts.map((p) => ({ ...p, unitPrice: pesosToCents(p.unitPrice) })),
        laborCost: pesosToCents(Number(labor) || 0),
        discountAmount: pesosToCents(Number(discount) || 0),
        taxRate,
        notes: notes.trim() || undefined,
        estimatedDate: estimated || null,
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: () => toast.error("No se pudo crear la orden"),
  });

  const plateError = submitted && !isValidPlate(plate) ? "Patente inválida" : undefined;
  const submit = () => {
    setSubmitted(true);
    if (!isValidPlate(plate)) return;
    create.mutate();
  };

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Nueva orden de trabajo"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Creando…" : "Crear orden"}
          </Button>
        </>
      }
    >
      <FormField label="Patente" required error={plateError} hint={foundVehicle ? `Reusando vehículo de ${foundVehicle.owner || "—"}` : "Buscá para reutilizar un vehículo existente"}>
        <div className="flex gap-2">
          <PlateInput value={plate} onChange={(v) => { setPlate(v); setFoundVehicle(null); }} />
          <Button type="button" variant="ghost" onClick={() => plate && lookup.mutate()}>
            <Search size={16} />
          </Button>
        </div>
      </FormField>

      <BrandModelSelect brand={brand} model={model} onBrand={setBrand} onModel={setModel} />

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Cliente">
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Nombre" />
        </FormField>
        <FormField label="Teléfono" hint="Solo números">
          <NumberInput value={phone} onChange={setPhone} />
        </FormField>
      </div>

      <FormField label="Servicios" hint="Elegí o creá; los nuevos quedan guardados">
        <CreatableMultiSelect
          value={services}
          onChange={setServices}
          options={(servicesData?.services ?? []).map((s) => s.name)}
          onCreate={(name) => createService.mutateAsync(name).then(() => undefined)}
        />
      </FormField>

      <FormField label="Repuestos">
        <PartsEditor parts={parts} onChange={setParts} products={productsData?.products ?? []} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Mano de obra">
          <MoneyInput value={labor} onChange={setLabor} />
        </FormField>
        <FormField label="Fecha estimada">
          <Input type="date" value={estimated} onChange={(e) => setEstimated(e.target.value)} />
        </FormField>
      </div>

      <FormField label="Observaciones">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormField>

      <TaxDiscountSection
        subtotal={(Number(labor) || 0) + parts.reduce((s, p) => s + p.quantity * p.unitPrice, 0)}
        discount={discount}
        onDiscount={setDiscount}
        taxRate={taxRate}
        onTaxRate={setTaxRate}
        totalLabel="Total estimado"
      />
    </Modal>
  );
}

/* --------------------------- Order detail -------------------------------- */
function OrderDetailModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { data } = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.get<{ order: WorkOrder; photos: string[] }>(`/api/orders/${id}`),
  });
  const order = data?.order;
  const photos = data?.photos ?? [];
  const { data: servicesData } = useQuery({
    queryKey: ["services"],
    queryFn: () => api.get<{ services: Service[] }>("/api/services"),
  });
  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<{ products: Product[] }>("/api/products"),
  });
  const createService = useMutation({
    mutationFn: (name: string) => api.post("/api/services", { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] }),
  });

  const [editing, setEditing] = useState(false);
  const [services, setServices] = useState<string[]>([]);
  const [parts, setParts] = useState<OrderPart[]>([]);
  const [labor, setLabor] = useState("");
  const [notes, setNotes] = useState("");
  const [estimated, setEstimated] = useState("");
  const [discount, setDiscount] = useState("");
  const [taxRate, setTaxRate] = useState(0); // bps
  const [confirmKind, setConfirmKind] = useState<null | "cancel" | "delete">(null);
  const [showPayment, setShowPayment] = useState(false);

  const { data: paymentsData } = useQuery({
    queryKey: ["order-payments", id],
    queryFn: () => api.get<{ payments: Payment[] }>(`/api/orders/${id}/payments`),
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["order", id] });
  const closeable = order && order.status !== "Entregado" && order.status !== "Cancelado";

  function startEdit() {
    if (!order) return;
    setServices(order.services);
    // El backend guarda en centavos; el estado de edición vive en PESOS.
    setParts(order.parts.map((p) => ({ ...p, unitPrice: centsToPesos(p.unitPrice) })));
    setLabor(order.laborCost ? String(centsToPesos(order.laborCost)) : "");
    setNotes(order.notes ?? "");
    setEstimated(order.estimatedDate ?? "");
    setDiscount(order.discountAmount ? String(centsToPesos(order.discountAmount)) : "");
    setTaxRate(order.taxRate ?? 0);
    setEditing(true);
  }

  const setStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/api/orders/${id}`, { status }),
    onSuccess: () => {
      onChanged();
      refetch();
      toast.success("Estado actualizado");
    },
  });
  const save = useMutation({
    mutationFn: () =>
      api.patch(`/api/orders/${id}`, {
        services,
        // El estado `parts` vive en PESOS; el backend espera centavos.
        parts: parts.map((p) => ({ ...p, unitPrice: pesosToCents(p.unitPrice) })),
        laborCost: pesosToCents(Number(labor) || 0),
        discountAmount: pesosToCents(Number(discount) || 0),
        taxRate,
        notes: notes.trim() || undefined,
        estimatedDate: estimated || null,
      }),
    onSuccess: () => {
      onChanged();
      refetch();
      toast.success("Orden actualizada");
      setEditing(false);
    },
    onError: () => toast.error("No se pudo guardar"),
  });
  const cancelOrder = useMutation({
    mutationFn: () => api.patch(`/api/orders/${id}`, { status: "Cancelado" }),
    onSuccess: () => {
      onChanged();
      toast.success("Orden cancelada (queda en el historial)");
      onClose();
    },
  });
  const finalize = useMutation({
    mutationFn: () => api.post<{ warnings: string[] }>(`/api/orders/${id}/finalize`),
    onSuccess: (res) => {
      onChanged();
      if (res.warnings?.length) toast.toast(res.warnings.join(" · "));
      toast.success("Orden entregada · stock y finanzas actualizados");
      onClose();
    },
    onError: (e: unknown) => toast.error((e as { message?: string })?.message ?? "No se pudo finalizar"),
  });
  const deleteOrder = useMutation({
    mutationFn: () => api.del(`/api/orders/${id}`),
    onSuccess: () => {
      onChanged();
      toast.success("Orden borrada");
      onClose();
    },
    onError: () => toast.error("No se pudo borrar"),
  });
  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      const image = await compressImage(file);
      return api.post(`/api/orders/${id}/photos`, { image });
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["vehicle-detail"] });
      toast.success("Foto agregada");
    },
    onError: () => toast.error("No se pudo subir la foto"),
  });
  const onPickPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    for (const f of Array.from(files)) uploadPhoto.mutate(f);
  };

  return (
   <>
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={order ? `Orden #${order.number}` : "Orden"}
      footer={
        !order ? null : editing ? (
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Descartar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </>
        ) : closeable ? (
          <>
            <Button variant="danger" onClick={() => setConfirmKind("cancel")}>
              Cancelar orden
            </Button>
            <Button onClick={() => finalize.mutate()} disabled={finalize.isPending}>
              {finalize.isPending ? "Procesando…" : "Finalizar y entregar"}
            </Button>
          </>
        ) : isAdmin ? (
          <Button
            variant="danger"
            onClick={() => setConfirmKind("delete")}
            disabled={deleteOrder.isPending}
          >
            <Trash2 size={15} /> Borrar orden
          </Button>
        ) : null
      }
    >
      {!order ? (
        <p className="text-charcoal">Cargando…</p>
      ) : editing ? (
        <div className="space-y-4">
          <FormField label="Servicios">
            <CreatableMultiSelect
              value={services}
              onChange={setServices}
              options={(servicesData?.services ?? []).map((s) => s.name)}
              onCreate={(name) => createService.mutateAsync(name).then(() => undefined)}
            />
          </FormField>
          <FormField label="Repuestos">
            <PartsEditor parts={parts} onChange={setParts} products={productsData?.products ?? []} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Mano de obra">
              <MoneyInput value={labor} onChange={setLabor} />
            </FormField>
            <FormField label="Fecha estimada">
              <Input type="date" value={estimated} onChange={(e) => setEstimated(e.target.value)} />
            </FormField>
          </div>
          <FormField label="Observaciones">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
          <TaxDiscountSection
            subtotal={(Number(labor) || 0) + parts.reduce((s, p) => s + p.quantity * p.unitPrice, 0)}
            discount={discount}
            onDiscount={setDiscount}
            taxRate={taxRate}
            onTaxRate={setTaxRate}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-display text-[20px] text-deep-forest">{order.vehiclePlate}</div>
              <div className="text-[13px] text-charcoal truncate">{order.vehicleInfo} · {order.customerName}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge tone={mapTone(order.status)}>{order.status}</Badge>
              {closeable ? (
                <Button size="sm" variant="ghost" onClick={startEdit}>
                  Editar
                </Button>
              ) : null}
            </div>
          </div>

          {closeable ? (
            <FormField label="Estado">
              <Select value={order.status} onChange={(v) => setStatus.mutate(v)}>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}

          {order.services.length ? (
            <div>
              <div className="eyebrow mb-1">Servicios</div>
              <div className="flex flex-wrap gap-1.5">
                {order.services.map((s) => (
                  <span key={s} className="rounded-full bg-pale-sage px-2.5 py-1 text-[13px] text-deep-forest">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {order.parts.length ? (
            <div>
              <div className="eyebrow mb-1">Repuestos</div>
              <div className="space-y-1">
                {order.parts.map((p, i) => (
                  <div key={i} className="flex justify-between text-[14px]">
                    <span>{p.name} {p.fromInventory ? "(stock)" : ""}</span>
                    <span>{p.quantity} × {formatCurrency(p.unitPrice)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-1 border-t border-black/10 pt-3">
            <CardRow label="Mano de obra">{formatCurrency(order.laborCost)}</CardRow>
            <CardRow label="Repuestos">{formatCurrency(order.partsCost)}</CardRow>
            {order.discountAmount ? (
              <CardRow label="Descuento">-{formatCurrency(order.discountAmount)}</CardRow>
            ) : null}
            {order.taxRate ? (
              <CardRow label={`IVA (${order.taxRate / 100}%)`}>{formatCurrency(order.taxAmount)}</CardRow>
            ) : null}
            <div className="flex items-center justify-between pt-1">
              <span className="font-medium text-deep-forest">Total</span>
              <span className="font-display text-[22px] text-deep-forest">{formatCurrency(order.total)}</span>
            </div>
          </div>

          {/* Cobro: pagado, saldo y estado de pago */}
          {(() => {
            const paidAmount = order.paidAmount ?? 0;
            const saldo = order.total - paidAmount;
            const estado = orderPaymentEstado(order.total, paidAmount);
            const pagada = saldo <= 0;
            return (
              <div className="space-y-2 rounded-[8px] bg-pale-sage px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">Cobro</span>
                  <Badge tone={paymentEstadoTone(estado)}>{PAYMENT_ESTADO_LABEL[estado]}</Badge>
                </div>
                <CardRow label="Pagado">{formatCurrency(paidAmount)}</CardRow>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-deep-forest">Saldo</span>
                  <span className="font-display text-[20px] text-deep-forest">{formatCurrency(saldo)}</span>
                </div>
                {paymentsData?.payments.length ? (
                  <div className="space-y-1 border-t border-black/10 pt-2">
                    {paymentsData.payments.map((p) => (
                      <div key={p.id} className="flex justify-between text-[13px] text-charcoal">
                        <span>{formatDate(p.paidAt)} · {p.method}</span>
                        <span className="text-deep-forest">{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {!pagada ? (
                  <Button size="sm" className="w-full mt-1" onClick={() => setShowPayment(true)}>
                    Registrar pago
                  </Button>
                ) : null}
              </div>
            );
          })()}

          {order.notes ? (
            <div>
              <div className="eyebrow mb-1">Observaciones</div>
              <p className="text-[14px] text-deep-forest">{order.notes}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 text-[13px] text-charcoal">
            <div>Ingreso: {formatDate(order.entryDate)}</div>
            <div>Entrega: {formatDate(order.deliveryDate)}</div>
          </div>

          {/* Fotos de este ingreso (el "momento") */}
          <div className="border-t border-black/10 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="eyebrow">Fotos del ingreso {photos.length ? `(${photos.length})` : ""}</span>
              <label className="cursor-pointer text-[13px] font-medium text-deep-forest hover:underline">
                {uploadPhoto.isPending ? "Subiendo…" : "+ Agregar foto"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  disabled={uploadPhoto.isPending}
                  onChange={(e) => {
                    onPickPhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {photos.length === 0 ? (
              <p className="text-[13px] text-charcoal">
                Sin fotos. Sacá o subí fotos del estado del vehículo al ingresar.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <a key={p} href={`/api/media/${p}`} target="_blank" rel="noreferrer">
                    <img
                      src={`/api/media/${p}`}
                      alt="Foto del ingreso"
                      className="h-24 w-full rounded-[8px] object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>

    <ConfirmDialog
      open={confirmKind !== null}
      title={confirmKind === "delete" ? "Borrar orden" : "Cancelar orden"}
      message={
        confirmKind === "delete"
          ? `¿Borrar la orden #${order?.number}? Se elimina definitivamente y no queda en el historial.`
          : `¿Cancelar la orden #${order?.number}? Queda registrada como Cancelado en el historial.`
      }
      confirmLabel={confirmKind === "delete" ? "Borrar" : "Cancelar orden"}
      cancelLabel="Volver"
      danger
      loading={confirmKind === "delete" ? deleteOrder.isPending : cancelOrder.isPending}
      onConfirm={() => {
        if (confirmKind === "delete") deleteOrder.mutate();
        else cancelOrder.mutate();
        setConfirmKind(null);
      }}
      onCancel={() => setConfirmKind(null)}
    />

    {showPayment && order ? (
      <RegisterPaymentModal
        orderId={id}
        orderNumber={order.number}
        saldo={order.total - (order.paidAmount ?? 0)}
        onClose={() => setShowPayment(false)}
        onSaved={() => {
          onChanged();
          refetch();
          queryClient.invalidateQueries({ queryKey: ["order-payments", id] });
          queryClient.invalidateQueries({ queryKey: ["customer-balance"] });
          toast.success("Pago registrado");
        }}
      />
    ) : null}
   </>
  );
}

/* --------------------------- Register payment ---------------------------- */
function RegisterPaymentModal({
  orderId,
  orderNumber,
  saldo,
  onClose,
  onSaved,
}: {
  orderId: string;
  orderNumber: number;
  saldo: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(centsToPesos(saldo)));
  const [method, setMethod] = useState("efectivo");
  const [submitted, setSubmitted] = useState(false);

  const pesos = Number(amount) || 0;
  const amountError = submitted && pesos <= 0 ? "Ingresá un monto mayor a 0" : undefined;

  const pay = useMutation({
    mutationFn: () =>
      api.post(`/api/orders/${orderId}/payments`, { amount: pesosToCents(pesos), method }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: () => toast.error("No se pudo registrar el pago"),
  });

  const submit = () => {
    setSubmitted(true);
    if (pesos <= 0) return;
    pay.mutate();
  };

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={`Registrar pago · Orden #${orderNumber}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pay.isPending}>
            {pay.isPending ? "Registrando…" : "Registrar pago"}
          </Button>
        </>
      }
    >
      <div className="flex items-center justify-between rounded-[8px] bg-pale-sage px-4 py-3">
        <span className="eyebrow">Saldo pendiente</span>
        <span className="font-display text-[20px] text-deep-forest">{formatCurrency(saldo)}</span>
      </div>
      <FormField label="Monto" required error={amountError} hint="En pesos">
        <MoneyInput value={amount} onChange={setAmount} />
      </FormField>
      <FormField label="Método">
        <Select value={method} onChange={setMethod}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </FormField>
    </Modal>
  );
}
