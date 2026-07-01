import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Plus, Search, Trash2 } from "lucide-react";
import { api, qs } from "@/lib/api";
import { useAuth } from "@/auth";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
import type { Customer, Service, Vehicle } from "@/lib/types";

const STATUSES = ["Ingresado", "En Reparación", "Listo", "Entregado", "Suspendido"];

export function VehiclesPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Vehicle | null>(null);

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
          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(v)}>
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
          ...(isAdmin ? [{ header: "Costo", cell: (v: Vehicle) => formatCurrency(v.cost) }] : []),
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
            {isAdmin ? <CardRow label="Costo">{formatCurrency(v.cost)}</CardRow> : null}
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

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Eliminar vehículo"
        message={`¿Eliminar ${confirmDelete?.plate} (${confirmDelete?.brand} ${confirmDelete?.model})? Se borra el vehículo y sus órdenes. Esta acción no se puede deshacer.`}
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
    photos: string[];
  }>;
  photos: string[];
  loosePhotos: string[];
}

function PhotoGrid({ photos }: { photos: string[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((p) => (
        <a key={p} href={`/api/media/${p}`} target="_blank" rel="noreferrer">
          <img
            src={`/api/media/${p}`}
            alt="Foto del vehículo"
            className="h-24 w-full rounded-[8px] object-cover"
          />
        </a>
      ))}
    </div>
  );
}

function VehicleDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["vehicle-detail", id],
    queryFn: () => api.get<VehicleDetail>(`/api/vehicles/${id}/detail`),
  });
  const v = data?.vehicle;
  const openOrder = (number: number) => {
    onClose();
    navigate(`/ordenes?q=${encodeURIComponent(`#${number}`)}`);
  };

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
            {isAdmin ? (
              <div>
                <div className="eyebrow">Costo</div>
                <div className="text-deep-forest">{formatCurrency(v.cost)}</div>
              </div>
            ) : null}
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
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => openOrder(o.number)}
                    className="w-full rounded-[12px] bg-pale-sage px-3 py-2 text-left transition hover:bg-vivid-green/20"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-medium text-deep-forest">Orden #{o.number}</span>
                      <Badge tone={o.status}>{o.status}</Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[12px] text-charcoal">
                      <span className="truncate">{o.services.join(", ") || "sin servicios"}</span>
                      {isAdmin ? <span className="shrink-0">{formatCurrency(o.total)}</span> : null}
                    </div>
                    {o.photos.length ? (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-1 text-[11px] text-charcoal">
                          Fotos del ingreso ({o.photos.length})
                        </div>
                        <PhotoGrid photos={o.photos} />
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fotos sin orden vinculada (historial viejo) */}
          {data?.loosePhotos?.length ? (
            <div className="border-t border-black/10 pt-4">
              <div className="eyebrow mb-2">Otras fotos ({data.loosePhotos.length})</div>
              <PhotoGrid photos={data.loosePhotos} />
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

function CreateVehicleModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [plate, setPlate] = useState("");
  const [found, setFound] = useState<Vehicle | null>(null);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
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

  const { data: customersData } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get<{ customers: Customer[] }>("/api/customers"),
  });

  const createService = useMutation({
    mutationFn: (name: string) => api.post("/api/services", { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] }),
  });

  // Al escribir una patente conocida, ofrecemos reutilizar ese vehículo (nueva entrada).
  const lookup = useMutation({
    mutationFn: (p: string) =>
      api.get<{ vehicle: Vehicle | null; customer: Customer | null; visitCount?: number }>(
        `/api/vehicles/search${qs({ plate: p })}`,
      ),
    onSuccess: (res) => {
      if (res.vehicle) {
        setFound(res.vehicle);
        setBrand(res.vehicle.brand ?? "");
        setModel(res.vehicle.model ?? "");
        setCustomerId(res.vehicle.customerId ?? null);
        setOwner(res.customer?.name ?? res.vehicle.owner ?? "");
        setPhone(res.customer?.phone ?? res.vehicle.phone ?? "");
        toast.toast(
          `Patente ya registrada (${res.visitCount ?? 1} visita/s). Se cargará una nueva entrada.`,
          "info",
        );
      } else {
        setFound(null);
      }
    },
  });

  const plateError = submitted && !isValidPlate(plate) ? "Patente inválida (AB123CD o AAA123)" : undefined;

  const create = useMutation({
    mutationFn: () =>
      found
        ? api.post("/api/vehicles/new-entry", {
            plate,
            services,
            cost: Number(cost) || 0,
            mileage: mileage ? Number(mileage) : null,
          })
        : api.post("/api/vehicles", {
            plate,
            brand: brand.trim(),
            model: model.trim(),
            owner: owner.trim(),
            phone,
            customerId,
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
    if (!isValidPlate(plate)) return;
    if (!found && !brand.trim()) return;
    create.mutate();
  };

  const onPlateChange = (v: string) => {
    setPlate(v);
    if (found) setFound(null); // el usuario editó la patente → salir del modo "reusar"
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
            {create.isPending ? "Guardando…" : found ? "Cargar nueva entrada" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Patente"
          required
          error={plateError}
          hint={found ? undefined : "Se busca al salir del campo para reutilizar el vehículo"}
        >
          <div className="flex gap-2">
            <PlateInput
              value={plate}
              onChange={onPlateChange}
              onBlur={() => plate.length >= 2 && lookup.mutate(plate)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-3"
              onClick={() => plate.length >= 2 && lookup.mutate(plate)}
              disabled={lookup.isPending}
            >
              <Search size={16} />
            </Button>
          </div>
        </FormField>
        <FormField label="Kilometraje" hint="Solo números">
          <NumberInput value={mileage} onChange={setMileage} placeholder="185000" />
        </FormField>
      </div>

      {found ? (
        <div className="rounded-[12px] bg-pale-sage p-3 text-[13px] text-deep-forest">
          Reutilizando{" "}
          <b>
            {found.brand} {found.model}
          </b>{" "}
          de <b>{owner || "—"}</b>. Se registra una <b>nueva entrada</b> con la misma patente y
          cliente. Cambiá la patente para crear un vehículo distinto.
        </div>
      ) : (
        <>
          <BrandModelSelect brand={brand} model={model} onBrand={setBrand} onModel={setModel} />

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Cliente" hint="Buscá uno existente o escribí uno nuevo">
              <ClientSelect
                customers={customersData?.customers ?? []}
                value={owner}
                linked={Boolean(customerId)}
                onSelect={(c) => {
                  setCustomerId(c.id);
                  setOwner(c.name);
                  if (c.phone) setPhone(c.phone);
                }}
                onNewName={(name) => {
                  setCustomerId(null);
                  setOwner(name);
                }}
              />
            </FormField>
            <FormField label="Teléfono" hint="Solo números">
              <NumberInput value={phone} onChange={setPhone} placeholder="2611234567" />
            </FormField>
          </div>
        </>
      )}

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

/** Buscador/vinculador de clientes: elegir uno existente o escribir uno nuevo. */
function ClientSelect({
  customers,
  value,
  linked,
  onSelect,
  onNewName,
}: {
  customers: Customer[];
  value: string;
  linked: boolean;
  onSelect: (c: Customer) => void;
  onNewName: (name: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const q = query.toLowerCase().trim();
  const filtered = (q ? customers.filter((c) => c.name.toLowerCase().includes(q)) : customers).slice(
    0,
    8,
  );
  const exact = customers.some((c) => c.name.toLowerCase() === q);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-[4px] border border-black/30 bg-paper-white px-2 py-2 focus-within:border-deep-forest">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onNewName(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Nombre del cliente"
          className="w-full bg-transparent px-1 text-[16px] text-deep-forest outline-none"
        />
        {linked ? (
          <span className="shrink-0 rounded-full bg-vivid-green/30 px-2 py-0.5 text-[11px] text-deep-forest">
            vinculado
          </span>
        ) : null}
      </div>

      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-[4px] border border-black/15 bg-paper-white py-1 shadow-[0_8px_30px_rgba(4,63,46,0.12)]">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelect(c);
                  setQuery(c.name);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-[15px] text-deep-forest hover:bg-pale-sage"
              >
                <span>{c.name}</span>
                <span className="text-[12px] text-charcoal">{c.phone}</span>
              </button>
            ))}
            {q && !exact ? (
              <button
                type="button"
                onClick={() => {
                  onNewName(query.trim());
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[15px] text-deep-forest hover:bg-pale-sage"
              >
                <Plus size={15} /> Usar “{query.trim()}” (cliente nuevo)
              </button>
            ) : null}
            {filtered.length === 0 && !q ? (
              <div className="px-3 py-2 text-[14px] text-charcoal">Escribí para buscar…</div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
