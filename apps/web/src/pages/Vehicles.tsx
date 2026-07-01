import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/auth";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/Modal";
import { CardRow, DataList } from "@/components/DataList";
import {
  BrandModelSelect,
  CreatableMultiSelect,
  FormField,
  MoneyInput,
  NumberInput,
  PlateInput,
} from "@/components/form";
import { Badge, Button, Input, PageHeader } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { isValidPlate } from "@/lib/validation";
import type { Service, Vehicle } from "@/lib/types";

const STATUSES = ["Ingresado", "En Reparación", "Listo", "Entregado", "Suspendido"];

export function VehiclesPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => api.get<{ vehicles: Vehicle[] }>("/api/vehicles"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["vehicles"] });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/vehicles/${id}`, { status }),
    onSuccess: () => {
      invalidate();
      toast.success("Estado actualizado");
    },
    onError: () => toast.error("No se pudo actualizar"),
  });
  const startWork = useMutation({
    mutationFn: (id: string) => api.post(`/api/vehicles/${id}/start`),
    onSuccess: () => {
      invalidate();
      toast.success("Trabajo iniciado");
    },
  });
  const pauseWork = useMutation({
    mutationFn: (id: string) => api.post(`/api/vehicles/${id}/pause`),
    onSuccess: () => {
      invalidate();
      toast.success("Trabajo pausado");
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/vehicles/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success("Vehículo eliminado");
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const filtered = useMemo(() => {
    let list = data?.vehicles ?? [];
    if (statusFilter) list = list.filter((v) => v.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q)
      list = list.filter((v) =>
        [v.plate, v.brand, v.model, v.owner].join(" ").toLowerCase().includes(q),
      );
    return list;
  }, [data, statusFilter, search]);

  const StatusSelect = ({ v }: { v: Vehicle }) => (
    <select
      className="rounded-[4px] border border-black/20 bg-pale-sage px-2 py-1 text-[13px]"
      value={v.status}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => updateStatus.mutate({ id: v.id, status: e.target.value })}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );

  const Actions = ({ v }: { v: Vehicle }) => {
    const working = v.responsibles?.some((r) => r.isWorking);
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {working ? (
          <Button size="sm" variant="ghost" onClick={() => pauseWork.mutate(v.id)}>
            <Pause size={14} />
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => startWork.mutate(v.id)}>
            <Play size={14} />
          </Button>
        )}
        {isAdmin ? (
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (confirm(`¿Eliminar ${v.plate}?`)) remove.mutate(v.id);
            }}
          >
            <Trash2 size={14} />
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="Taller"
        title="Vehículos"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={18} /> <span className="hidden sm:inline">Nuevo</span>
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <Input
          className="sm:max-w-xs"
          placeholder="Buscar patente, marca, dueño…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-[4px] border border-black/30 bg-paper-white px-3 py-2.5 text-[16px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <DataList
        items={filtered}
        loading={isLoading}
        keyOf={(v) => v.id}
        onRowClick={(v) => setDetailId(v.id)}
        rowClassName={(v) =>
          v.status === "Entregado" ? "bg-deep-forest/[0.05] text-charcoal" : undefined
        }
        emptyTitle="No hay vehículos"
        emptyHint="Agregá el primer ingreso con el botón Nuevo."
        columns={[
          { header: "Patente", cell: (v) => <span className="font-medium">{v.plate}</span> },
          { header: "Vehículo", cell: (v) => `${v.brand} ${v.model}`.trim() || "—" },
          { header: "Dueño", cell: (v) => v.owner || "—" },
          { header: "Estado", cell: (v) => <StatusSelect v={v} /> },
          { header: "Costo", cell: (v) => formatCurrency(v.cost) },
          { header: "Ingreso", cell: (v) => formatDate(v.entryDate) },
          { header: "", align: "right", cell: (v) => <Actions v={v} /> },
        ]}
        card={(v) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-[18px] text-deep-forest">{v.plate}</div>
                <div className="text-[13px] text-charcoal">{`${v.brand} ${v.model}`.trim() || "—"}</div>
              </div>
              <Badge tone={v.status}>{v.status}</Badge>
            </div>
            <CardRow label="Dueño">{v.owner || "—"}</CardRow>
            <CardRow label="Costo">{formatCurrency(v.cost)}</CardRow>
            <CardRow label="Ingreso">{formatDate(v.entryDate)}</CardRow>
            <div className="flex items-center justify-between pt-1">
              <StatusSelect v={v} />
              <Actions v={v} />
            </div>
          </div>
        )}
      />

      {showCreate ? (
        <CreateVehicleModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            invalidate();
            toast.success("Vehículo creado");
          }}
        />
      ) : null}
      {detailId ? <VehicleDetailModal id={detailId} onClose={() => setDetailId(null)} /> : null}
    </div>
  );
}

interface VehicleDetail {
  vehicle: Vehicle;
  customer: { name: string; phone: string } | null;
  orders: Array<{
    id: string;
    number: number;
    status: string;
    total: number;
    services: string[];
    entryDate: string;
  }>;
  photos: string[];
}

function VehicleDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["vehicle-detail", id],
    queryFn: () => api.get<VehicleDetail>(`/api/vehicles/${id}/detail`),
  });
  const v = data?.vehicle;

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={v ? v.plate : "Vehículo"}>
      {!v ? (
        <div className="py-8 text-center text-charcoal">Cargando…</div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-display text-[20px] text-deep-forest">
                {`${v.brand} ${v.model}`.trim() || "—"}
              </div>
              <div className="text-[13px] text-charcoal">
                {v.owner || "Sin dueño"}
                {data?.customer?.phone ? ` · ${data.customer.phone}` : ""}
              </div>
            </div>
            <Badge tone={v.status}>{v.status}</Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 text-[13px]">
            <div>
              <div className="eyebrow">Kilometraje</div>
              <div className="text-deep-forest">{v.mileage ? `${v.mileage.toLocaleString("es-AR")} km` : "—"}</div>
            </div>
            <div>
              <div className="eyebrow">Costo</div>
              <div className="text-deep-forest">{formatCurrency(v.cost)}</div>
            </div>
            <div>
              <div className="eyebrow">Ingreso</div>
              <div className="text-deep-forest">{formatDate(v.entryDate)}</div>
            </div>
          </div>

          {/* Órdenes (historial de trabajo) */}
          <div className="border-t border-black/10 pt-4">
            <div className="eyebrow mb-2">Órdenes de este vehículo</div>
            {(data?.orders.length ?? 0) === 0 ? (
              <p className="text-[13px] text-charcoal">Sin órdenes cargadas.</p>
            ) : (
              <div className="space-y-2">
                {data!.orders.map((o) => (
                  <div key={o.id} className="rounded-[12px] bg-pale-sage px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-medium text-deep-forest">Orden #{o.number}</span>
                      <Badge tone={o.status}>{o.status}</Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[12px] text-charcoal">
                      <span className="truncate">{o.services.join(", ") || "sin servicios"}</span>
                      <span className="shrink-0">{formatCurrency(o.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fotos */}
          <div className="border-t border-black/10 pt-4">
            <div className="eyebrow mb-2">Fotos {data?.photos.length ? `(${data.photos.length})` : ""}</div>
            {(data?.photos.length ?? 0) === 0 ? (
              <p className="text-[13px] text-charcoal">Sin fotos todavía.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {data!.photos.map((p) => (
                  <a key={p} href={`/api/media/${p}`} target="_blank" rel="noreferrer">
                    <img
                      src={`/api/media/${p}`}
                      alt="Foto del vehículo"
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
  );
}

function CreateVehicleModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [owner, setOwner] = useState("");
  const [phone, setPhone] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [cost, setCost] = useState("");
  const [mileage, setMileage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: servicesData } = useQuery({
    queryKey: ["services"],
    queryFn: () => api.get<{ services: Service[] }>("/api/services"),
  });
  const serviceOptions = (servicesData?.services ?? []).map((s) => s.name);

  const createService = useMutation({
    mutationFn: (name: string) => api.post("/api/services", { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] }),
  });

  const plateError = submitted && !isValidPlate(plate) ? "Patente inválida (AB123CD o AAA123)" : undefined;

  const create = useMutation({
    mutationFn: () =>
      api.post("/api/vehicles", {
        plate,
        brand: brand.trim(),
        model: model.trim(),
        owner: owner.trim(),
        phone,
        services,
        cost: Number(cost) || 0,
        mileage: mileage ? Number(mileage) : null,
        status: "Ingresado",
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: () => toast.error("No se pudo guardar el vehículo"),
  });

  const submit = () => {
    setSubmitted(true);
    if (!isValidPlate(plate) || !brand.trim()) return;
    create.mutate();
  };

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Nuevo vehículo"
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
        <FormField label="Patente" required error={plateError}>
          <PlateInput value={plate} onChange={setPlate} />
        </FormField>
        <FormField label="Kilometraje" hint="Solo números">
          <NumberInput value={mileage} onChange={setMileage} placeholder="185000" />
        </FormField>
      </div>

      <BrandModelSelect brand={brand} model={model} onBrand={setBrand} onModel={setModel} />

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Dueño">
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Nombre" />
        </FormField>
        <FormField label="Teléfono" hint="Solo números">
          <NumberInput value={phone} onChange={setPhone} placeholder="2611234567" />
        </FormField>
      </div>

      <FormField label="Servicios" hint="Elegí o creá servicios; los nuevos se guardan">
        <CreatableMultiSelect
          value={services}
          onChange={setServices}
          options={serviceOptions}
          onCreate={(name) => createService.mutateAsync(name).then(() => undefined)}
        />
      </FormField>

      <FormField label="Costo estimado">
        <MoneyInput value={cost} onChange={setCost} />
      </FormField>
    </Modal>
  );
}
