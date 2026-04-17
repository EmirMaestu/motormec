import { useState } from "react";
import { useQuery } from "convex/react";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

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

// ─── Helpers ───────────────────────────────────────────────────────────────
const statusConfig: Record<
  StatusType,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pendiente",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: <Clock className="w-3 h-3" />,
  },
  processed: {
    label: "Procesado",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  error: {
    label: "Error",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: <AlertCircle className="w-3 h-3" />,
  },
  linked: {
    label: "Vinculado",
    color: "bg-green-100 text-green-800 border-green-200",
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
  // Formatear número de WhatsApp (ej: 5491155556666 → +54 9 11 5555 6666)
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
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Cabecera */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpandido(!expandido)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Ícono de estado */}
          <div
            className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
              registro.status === "linked"
                ? "bg-green-100"
                : registro.status === "error"
                ? "bg-red-100"
                : registro.status === "processed"
                ? "bg-blue-100"
                : "bg-yellow-100"
            }`}
          >
            <MessageSquare
              className={`w-4 h-4 ${
                registro.status === "linked"
                  ? "text-green-600"
                  : registro.status === "error"
                  ? "text-red-600"
                  : registro.status === "processed"
                  ? "text-blue-600"
                  : "text-yellow-600"
              }`}
            />
          </div>

          {/* Info principal */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {registro.marca_modelo ? (
                <span className="font-semibold text-gray-900 truncate">
                  {registro.marca_modelo}
                </span>
              ) : (
                <span className="text-gray-400 italic text-sm">Sin vehículo</span>
              )}
              {registro.patente && (
                <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {registro.patente}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Phone className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-500">{formatPhone(registro.whatsappFrom)}</span>
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
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.color}`}
          >
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

      {/* Detalle expandido */}
      {expandido && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-4">
          {/* Datos extraídos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {registro.cliente && (
              <DataField icon={<User className="w-3.5 h-3.5 text-purple-500" />} label="Cliente" value={registro.cliente} />
            )}
            {registro.kilometraje && (
              <DataField icon={<Gauge className="w-3.5 h-3.5 text-blue-500" />} label="Kilometraje" value={`${registro.kilometraje} km`} />
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

          {/* Mensaje original */}
          {registro.rawMessage && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Mensaje original</p>
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{registro.rawMessage}</p>
              </div>
            </div>
          )}

          {/* Error si hay */}
          {registro.errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <p className="text-xs font-medium text-red-600 mb-0.5">Error</p>
              <p className="text-sm text-red-700">{registro.errorMessage}</p>
            </div>
          )}

          <p className="text-xs text-gray-400 text-right">{formatTimestamp(registro.createdAt)}</p>
        </div>
      )}
    </div>
  );
}

function DataField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800 truncate">{value}</p>
      </div>
    </div>
  );
}

// ─── Estadísticas ──────────────────────────────────────────────────────────
function StatsRow({ registros }: { registros: HistorialEntry[] }) {
  const counts = registros.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const stats = [
    { label: "Total", value: registros.length, color: "text-gray-700", bg: "bg-gray-100" },
    { label: "Vinculados", value: counts.linked ?? 0, color: "text-green-700", bg: "bg-green-100" },
    { label: "Procesados", value: counts.processed ?? 0, color: "text-blue-700", bg: "bg-blue-100" },
    { label: "Pendientes", value: counts.pending ?? 0, color: "text-yellow-700", bg: "bg-yellow-100" },
    { label: "Errores", value: counts.error ?? 0, color: "text-red-700", bg: "bg-red-100" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {stats.map((s) => (
        <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3`}>
          <p className="text-2xl font-bold ${s.color}">{s.value}</p>
          <p className={`text-xs font-medium ${s.color} opacity-80`}>{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────
export default function WhatsAppBot() {
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");

  const statusParam =
    filtroStatus === "todos"
      ? undefined
      : (filtroStatus as StatusType);

  const registros = useQuery(api.historialTaller.listar, {
    status: statusParam,
    limit: 100,
  }) as HistorialEntry[] | undefined;

  // Filtrar por búsqueda de texto (patente, cliente, teléfono)
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Cabecera */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bot WhatsApp</h1>
          <p className="text-sm text-gray-500">Ingresos recibidos por WhatsApp</p>
        </div>
      </div>

      {/* Estadísticas */}
      {registros && <StatsRow registros={registros} />}

      {/* Filtros */}
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

      {/* Lista de registros */}
      {registros === undefined ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : registrosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No hay registros</p>
          <p className="text-gray-400 text-sm mt-1">
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
    </div>
  );
}
