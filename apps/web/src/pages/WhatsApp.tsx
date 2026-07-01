import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/Modal";
import { CardRow, DataList } from "@/components/DataList";
import { FormField, NumberInput } from "@/components/form";
import { Badge, Button, Card, Input, PageHeader, Spinner, Toggle } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { HistorialTaller, NumeroAutorizado } from "@/lib/types";

export function WhatsAppPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);

  const historial = useQuery({
    queryKey: ["wa", "historial"],
    queryFn: () => api.get<{ historial: HistorialTaller[] }>("/api/whatsapp/historial"),
    refetchInterval: 20_000,
  });
  const numeros = useQuery({
    queryKey: ["wa", "numeros"],
    queryFn: () => api.get<{ numeros: NumeroAutorizado[] }>("/api/whatsapp/numeros"),
  });
  const config = useQuery({
    queryKey: ["wa", "config"],
    queryFn: () =>
      api.get<{
        waPhoneNumberId: string | null;
        waDisplayNumber: string | null;
        hasAccessToken: boolean;
        notifyCustomers: boolean;
      }>("/api/whatsapp/config"),
  });

  const setNotify = useMutation({
    mutationFn: (notifyCustomers: boolean) => api.put("/api/whatsapp/config", { notifyCustomers }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa", "config"] });
      toast.success("Preferencia guardada");
    },
    onError: () => toast.error("No se pudo guardar"),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/api/whatsapp/numeros/${id}`, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa", "numeros"] });
      toast.success("Número actualizado");
    },
  });

  return (
    <div>
      <PageHeader eyebrow="Integración" title="Bot WhatsApp" />

      <Card className="mb-6">
        <h3 className="eyebrow mb-3">Configuración del número</h3>
        {config.data ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[14px]">
              <Info label="Phone Number ID" value={config.data.waPhoneNumberId ?? "—"} />
              <Info label="Número visible" value={config.data.waDisplayNumber ?? "—"} />
              <Info label="Token" value={config.data.hasAccessToken ? "Configurado ✓" : "Falta"} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-black/10 pt-4">
              <div>
                <div className="text-[14px] font-medium text-deep-forest">Avisar al cliente por WhatsApp</div>
                <div className="text-[12px] text-charcoal">
                  Cuando la orden pasa a “En reparación”, “Esperando repuestos”, “Listo para entregar” o “Entregado”.
                </div>
              </div>
              <Toggle
                checked={config.data.notifyCustomers}
                disabled={setNotify.isPending}
                onChange={(v) => setNotify.mutate(v)}
              />
            </div>
          </>
        ) : (
          <Spinner />
        )}
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="font-display text-[22px] text-deep-forest mb-3">Ingresos por WhatsApp</h2>
          <DataList
            items={historial.data?.historial ?? []}
            loading={historial.isLoading}
            keyOf={(h) => h.id}
            emptyTitle="Sin mensajes todavía"
            columns={[
              { header: "Fecha", cell: (h) => formatDate(h.createdAt) },
              { header: "De", cell: (h) => h.waFrom },
              { header: "Patente", cell: (h) => h.patente ?? "—" },
              { header: "Tarea", cell: (h) => <span className="line-clamp-1">{h.tarea ?? "—"}</span> },
              { header: "Estado", cell: (h) => <Badge tone={h.status}>{h.status}</Badge> },
            ]}
            card={(h) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-deep-forest">{h.patente ?? "Sin patente"}</span>
                  <Badge tone={h.status}>{h.status}</Badge>
                </div>
                <CardRow label="De">{h.waFrom}</CardRow>
                <CardRow label="Tarea">{h.tarea ?? "—"}</CardRow>
                <CardRow label="Fecha">{formatDate(h.createdAt)}</CardRow>
              </div>
            )}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-[22px] text-deep-forest">Números autorizados</h2>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus size={16} />
            </Button>
          </div>
          <Card className="space-y-3">
            {(numeros.data?.numeros.length ?? 0) === 0 ? (
              <p className="text-[14px] text-charcoal">Sin números.</p>
            ) : (
              numeros.data!.numeros.map((n) => (
                <div key={n.id} className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[14px] font-medium">{n.name}</div>
                    <div className="text-[12px] text-charcoal">{n.phone}</div>
                  </div>
                  <button onClick={() => toggle.mutate({ id: n.id, active: !n.active })}>
                    <Badge tone={n.active ? "processed" : "error"}>{n.active ? "Activo" : "Inactivo"}</Badge>
                  </button>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>

      {showAdd ? (
        <AddNumberModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["wa", "numeros"] });
            toast.success("Número autorizado");
          }}
        />
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="text-deep-forest">{value}</div>
    </div>
  );
}

function AddNumberModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => api.post("/api/whatsapp/numeros", { phone: phone.trim(), name: name.trim() }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e: unknown) =>
      toast.error(
        e instanceof ApiError && e.code === "plan_limit"
          ? (e.message ?? "Alcanzaste el límite del plan")
          : "No se pudo guardar",
      ),
  });
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Autorizar número"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => create.mutate()} disabled={!phone.trim() || !name.trim()}>
            Guardar
          </Button>
        </>
      }
    >
      <FormField label="Teléfono" hint="E.164, ej: 5492611234567">
        <NumberInput value={phone} onChange={setPhone} placeholder="5492611234567" />
      </FormField>
      <FormField label="Nombre" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
    </Modal>
  );
}
