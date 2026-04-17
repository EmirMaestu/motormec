import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  Link2,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Car,
  User,
  Gauge,
  Wrench,
  Hash,
  Phone,
  Image,
  Shield,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type { Id } from "../../../convex/_generated/dataModel";

// ─── Tipos ────────────────────────────────────────────────────────────────
type StatusType = "pending" | "processed" | "error" | "linked";

interface HistorialEntry {
  _id: string;
  _creationTime: number;
  whatsappFrom: string;
  whatsappTimestamp: string;
  rawMessage?: string;
  marca_modelo?: string;
  kilometraje?: string;
  patente?: string;
  tarea?: string;
  cliente?: string;
  fotoIds: string[];
  vehicleId?: string;
  customerId?: string;
  status: StatusType;
  errorMessage?: string;
  createdAt: string;
}

interface NumeroAutorizado {
  _id: Id<"numerosAutorizados">;
  _creationTime: number;
  phone: string;
  name: string;
  active: boolean;
  addedAt: string;
  addedBy?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const statusConfig: Record<
  StatusType,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pendiente",
    color: "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    icon: <Clock className="w-3 h-3" />,
  },
  processed: {
    label: "Procesado",
    color: "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-zinc-700",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  error: {
    label: "Error",
    color: "bg-red-50 dark:bg-red-950/50 text-red-500 dark:text-red-400 border-red-200 dark:border-red-800",
    icon: <AlertCircle className="w-3 h-3" />,
  },
  linked: {
    label: "Vinculado",
    color: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    icon: <Link2 className="w-3 h-3" />,
  },
};

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function formatPhone(phone: string): string {
  if (phone.startsWith("549")) {
    return `+${phone.slice(0, 2)} ${phone.slice(2, 3)} ${phone.slice(3, 5)} ${phone.slice(5, 9)} ${phone.slice(9)}`;
  }
  return `+${phone}`;
}

// ─── Tarjeta de registro individual ───────────────────────────────────────
function RegistroCard({ registro }: { registro: HistorialEntry }) {
  const [expandido, setExpandido] = useState(false);
  const cfg = statusConfig[registro.status] ?? statusConfig.pending;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden hover:border-gray-200 dark:hover:border-zinc-700 transition-colors">
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpandido(!expandido)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
              registro.status === "linked"
                ? "bg-emerald-50 dark:bg-emerald-950/50"
                : registro.status === "error"
                ? "bg-red-50 dark:bg-red-950/50"
                : registro.status === "processed"
                ? "bg-gray-100 dark:bg-zinc-800"
                : "bg-amber-50 dark:bg-amber-950/50"
            }`}
          >
            <MessageSquare
              className={`w-4 h-4 ${
                registro.status === "linked"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : registro.status === "error"
                  ? "text-red-500 dark:text-red-400"
                  : registro.status === "processed"
                  ? "text-gray-500 dark:text-zinc-400"
                  : "text-amber-500 dark:text-amber-400"
              }`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {registro.marca_modelo ? (
                <span className="font-semibold text-gray-900 dark:text-zinc-100 truncate">
                  {registro.marca_modelo}
                </span>
              ) : (
                <span className="text-gray-400 dark:text-zinc-500 italic text-sm">Sin vehículo</span>
              )}
              {registro.patente && (
                <span className="text-xs font-mono bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 px-2 py-0.5 rounded-md">
                  {registro.patente}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Phone className="w-3 h-3 text-gray-400 dark:text-zinc-500" />
              <span className="text-xs text-gray-500 dark:text-zinc-400">{formatPhone(registro.whatsappFrom)}</span>
              {registro.fotoIds.length > 0 && (
                <>
                  <span className="text-gray-300">·</span>
                  <Image className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500">{registro.fotoIds.length} foto{registro.fotoIds.length > 1 ? "s" : ""}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.color}`}>
            {cfg.icon}
            {cfg.label}
          </span>
          <span className="text-xs text-gray-400 hidden sm:block">
            {formatTimestamp(registro.createdAt)}
          </span>
          {expandido ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {expandido && (
        <div className="border-t border-gray-100 dark:border-zinc-800 px-5 py-4 bg-gray-50 dark:bg-zinc-800/40 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {registro.cliente && (
              <DataField icon={<User className="w-3.5 h-3.5 text-purple-500" />} label="Cliente" value={registro.cliente} />
            )}
            {registro.kilometraje && (
              <DataField icon={<Gauge className="w-3.5 h-3.5 text-gray-500 dark:text-zinc-400" />} label="Kilometraje" value={`${registro.kilometraje} km`} />
            )}
            {registro.tarea && (
              <DataField icon={<Wrench className="w-3.5 h-3.5 text-orange-500" />} label="Trabajo" value={registro.tarea} />
            )}
            {registro.patente && (
              <DataField icon={<Hash className="w-3.5 h-3.5 text-gray-500" />} label="Patente" value={registro.patente} />
            )}
            {registro.vehicleId && (
              <DataField icon={<Car className="w-3.5 h-3.5 text-green-500" />} label="Vehículo ID" value={registro.vehicleId.slice(-8)} />
            )}
          </div>

          {registro.rawMessage && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Mensaje original</p>
              <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-700 rounded-xl px-3 py-2.5">
                <p className="text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-wrap">{registro.rawMessage}</p>
              </div>
            </div>
          )}

          {registro.errorMessage && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg px-3 py-2.5">
              <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-0.5">Error</p>
              <p className="text-sm text-red-700 dark:text-red-300">{registro.errorMessage}</p>
            </div>
          )}

          <p className="text-xs text-gray-400 text-right">{formatTimestamp(registro.createdAt)}</p>
        </div>
      )}
    </div>
  );
}

function DataField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 dark:text-zinc-500">{label}</p>
        <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate">{value}</p>
      </div>
    </div>
  );
}

// ─── Estadísticas ──────────────────────────────────────────────────────────
function StatsRow({ registros }: { registros: HistorialEntry[] }) {
  const counts = registros.reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );

  const stats = [
    { label: "Total", value: registros.length, color: "text-gray-600 dark:text-zinc-300", bg: "bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700" },
    { label: "Vinculados", value: counts.linked ?? 0, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900" },
    { label: "Procesados", value: counts.processed ?? 0, color: "text-gray-600 dark:text-zinc-400", bg: "bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700" },
    { label: "Pendientes", value: counts.pending ?? 0, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900" },
    { label: "Errores", value: counts.error ?? 0, color: "text-red-500 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {stats.map((s) => (
        <div key={s.label} className={`${s.bg} rounded-2xl px-4 py-3`}>
          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          <p className={`text-xs font-medium ${s.color} opacity-80`}>{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Números autorizados ──────────────────────────────────────────────
function NumerosAutorizadosTab() {
  const numeros = useQuery(api.numerosAutorizados.listar) as NumeroAutorizado[] | undefined;
  const agregarMutation = useMutation(api.numerosAutorizados.agregar);
  const toggleMutation = useMutation(api.numerosAutorizados.toggleActivo);
  const eliminarMutation = useMutation(api.numerosAutorizados.eliminar);

  const [nuevoTelefono, setNuevoTelefono] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const handleAgregar = async () => {
    if (!nuevoTelefono.trim() || !nuevoNombre.trim()) {
      setError("Completá el teléfono y el nombre.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      await agregarMutation({
        phone: nuevoTelefono.trim(),
        name: nuevoNombre.trim(),
      });
      setNuevoTelefono("");
      setNuevoNombre("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al agregar el número");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Formulario para agregar */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Agregar número autorizado
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-zinc-400 mb-1 block">Teléfono WhatsApp</label>
            <Input
              placeholder="ej: 5492612494123"
              value={nuevoTelefono}
              onChange={(e) => setNuevoTelefono(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Formato E.164 sin + (ej: 549 + área + número)</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-zinc-400 mb-1 block">Nombre</label>
            <Input
              placeholder="ej: Juan Mecánico"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleAgregar}
              disabled={guardando}
              className="w-full"
            >
              {guardando ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Agregar
            </Button>
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-3">{error}</p>
        )}
      </div>

      {/* Lista de números */}
      {numeros === undefined ? (
        <div className="flex justify-center py-10">
          <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      ) : numeros.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <Shield className="w-12 h-12 text-gray-200 dark:text-zinc-700 mb-3" />
          <p className="text-gray-500 dark:text-zinc-400 font-medium">Sin números autorizados</p>
          <p className="text-gray-400 dark:text-zinc-500 text-sm mt-1">
            Agregá los números que pueden usar el bot
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {numeros.map((n) => (
            <div
              key={n._id}
              className={`bg-white dark:bg-zinc-900 border rounded-2xl px-5 py-3.5 flex items-center justify-between gap-3 transition-colors ${
                n.active
                  ? "border-gray-100 dark:border-zinc-800"
                  : "border-dashed border-gray-200 dark:border-zinc-700 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  n.active ? "bg-emerald-50 dark:bg-emerald-950/50" : "bg-gray-100 dark:bg-zinc-800"
                }`}>
                  <Phone className={`w-3.5 h-3.5 ${n.active ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 dark:text-zinc-100 truncate">{n.name}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 font-mono">{formatPhone(n.phone)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  n.active
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500"
                }`}>
                  {n.active ? "Activo" : "Inactivo"}
                </span>
                <button
                  onClick={() => toggleMutation({ id: n._id, active: !n.active })}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  title={n.active ? "Desactivar" : "Activar"}
                >
                  {n.active ? (
                    <ToggleRight className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                <button
                  onClick={() => eliminarMutation({ id: n._id })}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 hover:text-red-500 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────
export default function WhatsAppBot() {
  const [tab, setTab] = useState<"historial" | "autorizados">("historial");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");

  const statusParam =
    filtroStatus === "todos" ? undefined : (filtroStatus as StatusType);

  const registros = useQuery(api.historialTaller.listar, {
    status: statusParam,
    limit: 100,
  }) as HistorialEntry[] | undefined;

  const registrosFiltrados = (registros ?? []).filter((r) => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (
      r.patente?.toLowerCase().includes(q) ||
      r.cliente?.toLowerCase().includes(q) ||
      r.marca_modelo?.toLowerCase().includes(q) ||
      r.whatsappFrom.includes(q) ||
      r.rawMessage?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-4xl space-y-6">
      {/* Cabecera */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Bot WhatsApp</h1>
        <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">Ingresos y configuración del bot de WhatsApp</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-zinc-800/60 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("historial")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "historial"
              ? "bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 shadow-sm"
              : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Historial
        </button>
        <button
          onClick={() => setTab("autorizados")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "autorizados"
              ? "bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 shadow-sm"
              : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
          }`}
        >
          <Shield className="w-4 h-4" />
          Números Autorizados
        </button>
      </div>

      {/* ── Tab Historial ── */}
      {tab === "historial" && (
        <>
          {registros && <StatsRow registros={registros} />}

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por patente, cliente, teléfono..."
                    className="pl-9"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    <SelectItem value="pending">Pendientes</SelectItem>
                    <SelectItem value="processed">Procesados</SelectItem>
                    <SelectItem value="linked">Vinculados</SelectItem>
                    <SelectItem value="error">Con error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {registros === undefined ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : registrosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 dark:text-zinc-600 mb-3" />
              <p className="text-gray-500 dark:text-zinc-400 font-medium">No hay registros</p>
              <p className="text-gray-400 dark:text-zinc-500 text-sm mt-1">
                {busqueda || filtroStatus !== "todos"
                  ? "Probá con otros filtros"
                  : "Los mensajes de WhatsApp aparecerán aquí"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {registrosFiltrados.map((r) => (
                <RegistroCard key={r._id} registro={r} />
              ))}
              <p className="text-center text-xs text-gray-400 pt-2">
                Mostrando {registrosFiltrados.length} de {registros.length} registros
              </p>
            </div>
          )}
        </>
      )}

      {/* ── Tab Números Autorizados ── */}
      {tab === "autorizados" && <NumerosAutorizadosTab />}
    </div>
  );
}
