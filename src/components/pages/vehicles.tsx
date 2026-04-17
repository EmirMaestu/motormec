import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useOrganization, useUser } from "@clerk/clerk-react";
import {
  formatDateToDDMMYYYY,
} from "../../lib/dateUtils";
import {
  Plus,
  Search,
  Filter,
  Edit3,
  MoreHorizontal,
  Calculator,
  Crown,
  User,
  Users,
  Wrench,
  Play,
  Pause,
  Square,
  History,
  ChevronDown,
  Car,
  FilePlus,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { Label } from "../ui/label";
import { VehicleCards } from "../module-cards";
import { CreatableSelect } from "../ui/creatable-select";
import DateRangeFilter, { type DateRangeValue } from "../ui/date-range-filter";

// Componente para seleccionar cliente
function CustomerSelector({
  selectedCustomerId,
  onCustomerChange,
  onNewCustomerName,
  newCustomerName,
}: {
  selectedCustomerId?: string;
  onCustomerChange: (customerId: string, customerData: any) => void;
  onNewCustomerName?: (name: string) => void;
  newCustomerName?: string;
}) {
  const customers = useQuery(api.customers.getActiveCustomers);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNewCustomerConfirmed, setIsNewCustomerConfirmed] = useState(false);

  const filteredCustomers = (customers ?? []).filter((c: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  });

  const handleCancelNewCustomer = () => {
    setIsNewCustomerConfirmed(false);
    setSearchQuery("");
    if (onNewCustomerName) onNewCustomerName("");
  };

  // Si hay un nuevo cliente confirmado
  if (isNewCustomerConfirmed && newCustomerName) {
    return (
      <div className="w-full">
        <div className="flex h-10 w-full items-center justify-between rounded-md border border-green-500 bg-green-50 px-3 py-2 text-sm ring-offset-background">
          <span className="font-medium">{newCustomerName}</span>
          <button
            type="button"
            onClick={handleCancelNewCustomer}
            className="text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>
        <p className="text-xs text-green-600 mt-1">
          Nuevo cliente (se creará al guardar)
        </p>
      </div>
    );
  }

  // Encontrar el nombre del cliente seleccionado
  const selectedCustomer = customers?.find(
    (c: any) => c._id === selectedCustomerId
  );

  if (selectedCustomer) {
    return (
      <div className="w-full">
        <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
          <span>{selectedCustomer.name}</span>
          <button
            type="button"
            onClick={() => {
              onCustomerChange("", {} as any);
              setSearchQuery("");
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {selectedCustomer.phone}
          {selectedCustomer.totalVehicles
            ? ` · ${selectedCustomer.totalVehicles} vehículos`
            : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        placeholder="Buscar cliente por nombre o teléfono..."
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setIsDropdownOpen(true);
        }}
        onFocus={() => setIsDropdownOpen(true)}
        onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
        autoComplete="off"
      />
      {isDropdownOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg dark:shadow-zinc-950/50 max-h-52 overflow-y-auto">
          <button
            type="button"
            className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 text-sm text-gray-700 dark:text-zinc-300 font-medium border-b border-gray-100 dark:border-zinc-800"
            onMouseDown={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                if (onNewCustomerName) onNewCustomerName(searchQuery.trim());
                setIsNewCustomerConfirmed(true);
              } else {
                if (onNewCustomerName) onNewCustomerName("");
              }
              setIsDropdownOpen(false);
            }}
          >
            + Crear nuevo cliente{searchQuery.trim() ? `: "${searchQuery.trim()}"` : ""}
          </button>
          {filteredCustomers.length > 0 ? (
            filteredCustomers.slice(0, 8).map((customer: any) => (
              <button
                key={customer._id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-100 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCustomerChange(customer._id, customer);
                  setSearchQuery("");
                  setIsDropdownOpen(false);
                }}
              >
                <span className="font-medium">{customer.name}</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  {customer.phone}
                  {customer.totalVehicles
                    ? ` · ${customer.totalVehicles} vehículos`
                    : ""}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No se encontraron clientes
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Componente para seleccionar responsables
function ResponsibleSelector({
  responsibles,
  onChange,
}: {
  responsibles: {
    name: string;
    role: string;
    userId?: string;
    isAdmin?: boolean;
  }[];
  onChange: (
    responsibles: {
      name: string;
      role: string;
      userId?: string;
      isAdmin?: boolean;
    }[]
  ) => void;
}) {
  const { organization } = useOrganization();
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState("");

  // Obtener miembros de la organización
  useEffect(() => {
    const fetchMembers = async () => {
      if (organization) {
        try {
          const members = await organization.getMemberships();
          setOrgMembers(members.data || []);
        } catch (error) {
          console.error("Error fetching organization members:", error);
        }
      }
    };

    fetchMembers();
  }, [organization]);

  const addResponsible = () => {
    if (selectedMember) {
      const member = orgMembers.find(
        (m) => m.publicUserData.userId === selectedMember
      );
      if (member) {
        const newResponsible = {
          name:
            member.publicUserData.firstName +
            " " +
            (member.publicUserData.lastName || ""),
          role: member.role === "org:admin" ? "Admin" : "Miembro",
          userId: member.publicUserData.userId,
          isAdmin: member.role === "org:admin",
        };

        // Verificar que no esté ya asignado
        if (!responsibles.find((r) => r.userId === newResponsible.userId)) {
          onChange([...responsibles, newResponsible]);
        }

        setSelectedMember("");
      }
    }
  };

  const removeResponsible = (index: number) => {
    onChange(responsibles.filter((_, i) => i !== index));
  };

  const availableMembers = orgMembers.filter(
    (member) =>
      !responsibles.find((r) => r.userId === member.publicUserData.userId)
  );

  return (
    <div className="space-y-2">
      {responsibles.length > 0 && (
        <div className="space-y-1">
          {responsibles.map((responsible, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-gray-50 p-2 rounded"
            >
              <div className="flex items-center gap-2">
                {responsible.isAdmin ? (
                  <Crown className="h-3 w-3 text-yellow-600" />
                ) : (
                  <User className="h-3 w-3 text-gray-500 dark:text-zinc-400" />
                )}
                <span className="text-sm">
                  <strong>{responsible.name}</strong>
                  {responsible.isAdmin && (
                    <Badge
                      variant="outline"
                      className="ml-2 text-xs bg-yellow-50 text-yellow-700 border-yellow-200"
                    >
                      Admin
                    </Badge>
                  )}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeResponsible(index)}
                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}

      {availableMembers.length > 0 && (
        <div className="space-y-2">
          {selectedMember ? (
            // Mostrar miembro seleccionado con su nombre
            <div className="space-y-2">
              <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  {orgMembers.find(
                    (m) => m.publicUserData.userId === selectedMember
                  )?.role === "org:admin" ? (
                    <Crown className="h-3 w-3 text-yellow-600" />
                  ) : (
                    <User className="h-3 w-3 text-gray-500 dark:text-zinc-400" />
                  )}
                  <span>
                    {
                      orgMembers.find(
                        (m) => m.publicUserData.userId === selectedMember
                      )?.publicUserData.firstName
                    }{" "}
                    {
                      orgMembers.find(
                        (m) => m.publicUserData.userId === selectedMember
                      )?.publicUserData.lastName
                    }
                  </span>
                  {orgMembers.find(
                    (m) => m.publicUserData.userId === selectedMember
                  )?.role === "org:admin" && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200"
                    >
                      Admin
                    </Badge>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMember("")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </div>
              <Button
                type="button"
                onClick={addResponsible}
                size="sm"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar responsable
              </Button>
            </div>
          ) : (
            // Mostrar selector
            <div className="space-y-2">
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar miembro..." />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.map((member) => (
                    <SelectItem
                      key={member.publicUserData.userId}
                      value={member.publicUserData.userId}
                    >
                      <div className="flex items-center gap-2">
                        {member.role === "org:admin" ? (
                          <Crown className="h-3 w-3 text-yellow-600" />
                        ) : (
                          <User className="h-3 w-3 text-gray-500 dark:text-zinc-400" />
                        )}
                        {member.publicUserData.firstName}{" "}
                        {member.publicUserData.lastName}
                        {member.role === "org:admin" && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200"
                          >
                            Admin
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={addResponsible}
                size="sm"
                disabled={!selectedMember}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar responsable
              </Button>
            </div>
          )}
        </div>
      )}

      {availableMembers.length === 0 && orgMembers.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Todos los miembros de la organización ya están asignados.
        </p>
      )}

      {orgMembers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No se encontraron miembros en la organización.
        </p>
      )}
    </div>
  );
}

export default function Vehicles() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { membership } = useOrganization();

  // Determinar si el usuario es admin
  const isAdmin = membership?.role === "org:admin";
  const currentUserId = user?.id;

  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateRangeValue>({
    type: "all",
    label: "Todos",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Convex hooks - obtener vehículos según el rol del usuario y filtros de fecha
  const allVehiclesRaw = useQuery(
    api.vehicles.getVehicles,
    dateFilter.type === "all" ? {} : "skip"
  ) ?? [];

  const filteredVehiclesByDate = useQuery(
    api.vehicles.getVehiclesByDateRange,
    dateFilter.startDate && dateFilter.endDate && dateFilter.type !== "all" && currentUserId !== undefined
      ? {
          startDate: dateFilter.startDate,
          endDate: dateFilter.endDate,
          userId: currentUserId || undefined,
          isAdmin: isAdmin === true,
        }
      : "skip"
  ) ?? [];

  // Usar datos según el filtro activo, aplicando filtro de rol para no-admin
  const allVehiclesUnsorted = dateFilter.type === "all"
    ? (isAdmin === true
        ? allVehiclesRaw
        : allVehiclesRaw.filter((v: any) =>
            !v.responsibles || v.responsibles.length === 0 ||
            v.responsibles.some((r: any) => r.userId === currentUserId)
          ))
    : filteredVehiclesByDate;

  // Ordenar por fecha de ingreso descendente (más recientes primero)
  const allVehicles = [...allVehiclesUnsorted].sort(
    (a, b) =>
      new Date(b.lastUpdated || b.entryDate).getTime() -
      new Date(a.lastUpdated || a.entryDate).getTime()
  );

  // Aplicar filtros localmente
  const vehiclesInTaller = allVehicles.filter((vehicle) => {
    // Filtro de búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        vehicle.plate.toLowerCase().includes(search) ||
        vehicle.brand.toLowerCase().includes(search) ||
        vehicle.model.toLowerCase().includes(search) ||
        vehicle.owner.toLowerCase().includes(search) ||
        vehicle.phone.toLowerCase().includes(search) ||
        (vehicle.description &&
          vehicle.description.toLowerCase().includes(search)) ||
        vehicle.services.some((service: string) =>
          service.toLowerCase().includes(search)
        );

      if (!matchesSearch) return false;
    }

    // Filtro de estado
    if (statusFilter !== "all") {
      if (statusFilter === "delivered") {
        // "Entregados" - only include vehicles with status "Entregado"
        if (vehicle.status !== "Entregado") return false;
      } else if (statusFilter === "not_delivered") {
        // "No entregados" - include all statuses except "Entregado"
        if (vehicle.status === "Entregado") return false;
      }
    }

    // Filtro de responsable
    if (responsibleFilter !== "all") {
      if (responsibleFilter === "unassigned") {
        if (vehicle.responsibles && vehicle.responsibles.length > 0)
          return false;
      } else if (responsibleFilter === "assigned") {
        if (!vehicle.responsibles || vehicle.responsibles.length === 0)
          return false;
      } else if (responsibleFilter === "mine" && currentUserId) {
        if (
          !vehicle.responsibles ||
          !vehicle.responsibles.some((r: any) => r.userId === currentUserId)
        )
          return false;
      }
    }

    return true;
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, responsibleFilter, dateFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(vehiclesInTaller.length / ITEMS_PER_PAGE));
  const paginatedVehicles = vehiclesInTaller.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const createVehicle = useMutation(api.vehicles.createVehicle);
  const createNewEntry = useMutation(api.vehicles.createNewEntryForExistingVehicle);
  const updateVehicle = useMutation(api.vehicles.updateVehicle);
  const deleteVehicle = useMutation(api.vehicles.deleteVehicle);
  const startWorkOnVehicle = useMutation(api.vehicles.startWorkOnVehicle);
  const pauseWorkOnVehicle = useMutation(api.vehicles.pauseWorkOnVehicle);
  const completeWorkOnVehicle = useMutation(api.vehicles.completeWorkOnVehicle);
  const createOrGetCustomer = useMutation(api.customers.createOrGetCustomer);
  
  // Queries y mutations para servicios
  // const services = useQuery(api.services.getServices);
  // const createService = useMutation(api.services.createService);
  
  // Convertir servicios de BD a array de strings
  const serviceOptions: string[] = []; // services?.map((s: { name: string }) => s.name) || [];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isNewEntryDialogOpen, setIsNewEntryDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeliverDialogOpen, setIsDeliverDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [vehicleToDeliver, setVehicleToDeliver] = useState<any>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<any>(null);
  const [selectedVehicleForEntry, setSelectedVehicleForEntry] = useState<any>(null);
  const [newEntryPlate, setNewEntryPlate] = useState("");
  const [isPlateDropdownOpen, setIsPlateDropdownOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({
    services: [] as string[],
    cost: "",
    description: "",
    mileage: "",
    responsibles: [] as {
      name: string;
      role: string;
      userId?: string;
      isAdmin?: boolean;
    }[],
  });

  // Query para obtener todas las placas disponibles
  const allVehiclePlates = useQuery(api.vehicles.getAllVehiclePlates) ?? [];
  
  // Query para buscar vehículo por placa (debe estar después de la declaración del estado)
  const searchVehicleByPlate = useQuery(
    api.vehicles.searchVehicleByPlate,
    newEntryPlate.length >= 2 ? { plate: newEntryPlate } : "skip"
  );

  // Filtrar placas para autocompletado
  const filteredPlates = allVehiclePlates.filter((vehicle) =>
    vehicle.plate.toLowerCase().includes(newEntryPlate.toLowerCase())
  ).slice(0, 5); // Limitar a 5 sugerencias
  const [newVehicle, setNewVehicle] = useState({
    plate: "",
    brand: "",
    model: "",
    owner: "",
    phone: "",
    customerId: "",
    services: [] as string[],
    cost: "",
    description: "",
    mileage: "", // Kilometraje
    responsibles: [] as {
      name: string;
      role: string;
      userId?: string;
      isAdmin?: boolean;
    }[],
  });
  const [isExistingPlate, setIsExistingPlate] = useState(false);
  const [showPlateDropdown, setShowPlateDropdown] = useState(false);

  // Filtrar placas para autocompletado en el diálogo de nuevo vehículo
  const filteredNewVehiclePlates = newVehicle.plate.length >= 1
    ? allVehiclePlates.filter((v) =>
        v.plate.toLowerCase().includes(newVehicle.plate.toLowerCase())
      ).slice(0, 5)
    : [];

  const getStatusBadge = (status: string) => {
    const base = "text-[11px] font-medium px-2 py-0.5 rounded-full border inline-flex items-center";
    const map: Record<string, string> = {
      "Ingresado": "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
      "En Reparación": "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
      "Listo": "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
      "Entregado": "bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700",
      "Suspendido": "bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
    };
    return <span className={`${base} ${map[status] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>{status}</span>;
  };

  const handleAddVehicle = async () => {
    if (
      newVehicle.plate &&
      newVehicle.brand &&
      newVehicle.model &&
      newVehicle.owner
    ) {
      try {
        let responsibles = newVehicle.responsibles.map((r) => ({
          name: r.name,
          role: r.role,
          assignedAt: new Date().toISOString(),
          userId: r.userId,
          isAdmin: r.isAdmin,
        }));

        // Si es miembro (no admin) y no se ha asignado responsables, asignarse automáticamente
        if (!isAdmin && responsibles.length === 0 && user) {
          responsibles = [
            {
              name: `${user.firstName} ${user.lastName}`.trim(),
              role: "Miembro",
              assignedAt: new Date().toISOString(),
              userId: user.id,
              isAdmin: false,
            },
          ];
        }

        // Si no hay customerId, crear o buscar el cliente
        let customerId = newVehicle.customerId;
        if (!customerId && newVehicle.owner && newVehicle.phone) {
          // Crear el cliente o devolver el existente si ya existe con ese teléfono
          const newCustomerId = await createOrGetCustomer({
            name: newVehicle.owner,
            phone: newVehicle.phone,
          });
          customerId = newCustomerId;
        }

        if (isExistingPlate) {
          // Crear nueva entrada para vehículo existente
          await createNewEntry({
            plate: newVehicle.plate,
            services:
              newVehicle.services.length > 0
                ? newVehicle.services
                : ["Mantenimiento general"],
            cost: parseFloat(newVehicle.cost) || 0,
            description: newVehicle.description,
            mileage: newVehicle.mileage ? parseInt(newVehicle.mileage) : undefined,
            entryDate: new Date().toISOString(),
            responsibles: responsibles.length > 0 ? responsibles : undefined,
          });
        } else {
          await createVehicle({
            plate: newVehicle.plate,
            brand: newVehicle.brand,
            model: newVehicle.model,
            year: new Date().getFullYear(),
            owner: newVehicle.owner,
            phone: newVehicle.phone,
            customerId: customerId ? (customerId as any) : undefined,
            status: "Ingresado",
            entryDate: new Date().toISOString(),
            services:
              newVehicle.services.length > 0
                ? newVehicle.services
                : ["Mantenimiento general"],
            cost: parseFloat(newVehicle.cost) || 0,
            description: newVehicle.description,
            mileage: newVehicle.mileage ? parseInt(newVehicle.mileage) : undefined,
            responsibles,
          });
        }

        setNewVehicle({
          plate: "",
          brand: "",
          model: "",
          owner: "",
          phone: "",
          customerId: "",
          services: [],
          cost: "",
          description: "",
          mileage: "",
          responsibles: [],
        });
        setIsExistingPlate(false);
        setShowPlateDropdown(false);
        setIsDialogOpen(false);
      } catch (error) {
        console.error("Error al crear vehículo:", error);
      }
    }
  };

  const handleEditVehicle = (vehicle: any) => {
    // Los miembros no-admin solo pueden editar vehículos donde estén asignados o sin asignar
    if (!isAdmin && !canEditVehicle(vehicle)) {
      alert("Solo puedes editar vehículos asignados a ti o sin asignar.");
      return;
    }

    setEditingVehicle({
      ...vehicle,
      services: Array.isArray(vehicle.services) ? [...vehicle.services] : [],
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateVehicle = async () => {
    if (editingVehicle && editingVehicle._id) {
      try {
        // Si no hay customerId, crear o buscar el cliente
        let customerId = editingVehicle.customerId;
        if (!customerId && editingVehicle.owner && editingVehicle.phone) {
          // Crear el cliente o devolver el existente si ya existe con ese teléfono
          const newCustomerId = await createOrGetCustomer({
            name: editingVehicle.owner,
            phone: editingVehicle.phone,
          });
          customerId = newCustomerId;
        }

        await updateVehicle({
          id: editingVehicle._id,
          plate: editingVehicle.plate,
          brand: editingVehicle.brand,
          model: editingVehicle.model,
          year: typeof editingVehicle.year === 'number' 
            ? editingVehicle.year 
            : parseInt(editingVehicle.year) || new Date().getFullYear(),
          owner: editingVehicle.owner,
          phone: editingVehicle.phone,
          customerId: customerId || undefined,
          status: editingVehicle.status,
          services: editingVehicle.services,
          cost: parseFloat(editingVehicle.cost),
          description: editingVehicle.description,
          mileage: editingVehicle.mileage,
          responsibles: editingVehicle.responsibles || [],
          parts: editingVehicle.parts || [],
        });

        setIsEditDialogOpen(false);
        setEditingVehicle(null);
      } catch (error) {
        console.error("Error al actualizar vehículo:", error);
      }
    }
  };

  // Efecto para actualizar el vehículo seleccionado cuando se busca por placa
  useEffect(() => {
    if (searchVehicleByPlate) {
      setSelectedVehicleForEntry(searchVehicleByPlate);
      setIsPlateDropdownOpen(false);
    } else if (newEntryPlate.length >= 2) {
      setSelectedVehicleForEntry(null);
    }
  }, [searchVehicleByPlate, newEntryPlate]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-plate-dropdown]')) {
        setIsPlateDropdownOpen(false);
      }
    };

    if (isPlateDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isPlateDropdownOpen]);

  const handleCreateNewEntry = async () => {
    if (!selectedVehicleForEntry || !newEntryPlate) {
      alert("Por favor, selecciona un vehículo existente");
      return;
    }

    if (newEntry.services.length === 0) {
      alert("Por favor, ingresa al menos un servicio");
      return;
    }

    if (!newEntry.mileage || newEntry.mileage.trim() === "") {
      alert("Por favor, ingresa el kilometraje del vehículo");
      return;
    }

    try {
      let responsibles = newEntry.responsibles.map((r) => ({
        name: r.name,
        role: r.role,
        assignedAt: new Date().toISOString(),
        userId: r.userId,
        isAdmin: r.isAdmin,
      }));

      // Si es miembro (no admin) y no se ha asignado responsables, asignarse automáticamente
      if (!isAdmin && responsibles.length === 0 && user) {
        responsibles = [
          {
            name: `${user.firstName} ${user.lastName}`.trim(),
            role: "Miembro",
            assignedAt: new Date().toISOString(),
            userId: user.id,
            isAdmin: false,
          },
        ];
      }

      await createNewEntry({
        plate: newEntryPlate,
        services: newEntry.services.length > 0 ? newEntry.services : ["Mantenimiento general"],
        cost: parseFloat(newEntry.cost) || 0,
        description: newEntry.description,
        mileage: newEntry.mileage ? parseInt(newEntry.mileage) : undefined,
        responsibles,
      });

      // Limpiar formulario
      setNewEntry({
        services: [],
        cost: "",
        description: "",
        mileage: "",
        responsibles: [],
      });
      setNewEntryPlate("");
      setSelectedVehicleForEntry(null);
      setIsPlateDropdownOpen(false);
      setIsNewEntryDialogOpen(false);
    } catch (error: any) {
      console.error("Error al crear nueva entrada:", error);
      alert(error.message || "Error al crear nueva entrada");
    }
  };

  const handleViewDetail = (vehicle: any) => {
    navigate(`/vehiculos/${encodeURIComponent(vehicle.plate)}/detalle`);
  };

  const handleStartWork = async (vehicle: any) => {
    if (!user) return;

    await startWorkOnVehicle({
      vehicleId: vehicle._id,
      userId: user.id,
      userName: user.fullName || user.firstName || "Usuario",
      isAdmin: isAdmin,
    });
  };

  const handlePauseWork = async (vehicle: any) => {
    if (!user) return;

    try {
      const result = await pauseWorkOnVehicle({
        vehicleId: vehicle._id,
        userId: user.id,
      });
      console.log("Trabajo pausado:", result);
    } catch (error) {
      console.error("Error al pausar trabajo:", error);
      alert("Error al pausar el trabajo. Por favor intenta de nuevo.");
    }
  };

  const handleCompleteWork = async (vehicle: any) => {
    if (!user) return;

    try {
      const result = await completeWorkOnVehicle({
        vehicleId: vehicle._id,
        userId: user.id,
      });
      console.log("Trabajo completado:", result);
    } catch (error) {
      console.error("Error al completar trabajo:", error);
      alert("Error al completar el trabajo. Por favor intenta de nuevo.");
    }
  };

  // Función helper para determinar si el usuario está trabajando en un vehículo
  const isUserWorking = (vehicle: any) => {
    return (
      vehicle.responsibles?.find((r: any) => r.userId === user?.id)
        ?.isWorking || false
    );
  };

  // Función para determinar si el usuario está asignado al vehículo
  const isUserAssigned = (vehicle: any) => {
    return (
      vehicle.responsibles?.some((r: any) => r.userId === user?.id) || false
    );
  };

  const handleDeleteVehicle = (vehicle: any) => {
    // Solo los admins pueden eliminar vehículos
    if (!isAdmin) {
      alert("Solo los administradores pueden eliminar vehículos.");
      return;
    }

    setVehicleToDelete(vehicle);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteVehicle = async () => {
    if (!vehicleToDelete) return;

    try {
      await deleteVehicle({ id: vehicleToDelete._id });
      setIsDeleteDialogOpen(false);
      setVehicleToDelete(null);
    } catch (error) {
      console.error("Error al eliminar vehículo:", error);
      alert("Error al eliminar el vehículo. Por favor intenta de nuevo.");
    }
  };

  const handleDeliverVehicle = (vehicle: any) => {
    // Los miembros no-admin solo pueden entregar vehículos donde estén asignados o sin asignar
    if (!isAdmin && !canEditVehicle(vehicle)) {
      alert("Solo puedes entregar vehículos asignados a ti o sin asignar.");
      return;
    }

    setVehicleToDeliver(vehicle);
    setIsDeliverDialogOpen(true);
  };

  const createVehicleTransaction = useMutation(
    api.transactions.createVehicleTransaction
  );

  // Helper para verificar si el usuario puede editar un vehículo
  const canEditVehicle = (vehicle: any) => {
    if (isAdmin) return true;

    // Sin responsables asignados - puede editar (está libre)
    if (!vehicle.responsibles || vehicle.responsibles.length === 0) {
      return true;
    }

    // Si el usuario está entre los responsables asignados - puede editar
    return vehicle.responsibles.some((r: any) => r.userId === currentUserId);
  };

  const confirmDeliverVehicle = async () => {
    if (vehicleToDeliver) {
      try {
        const deliveryDate = new Date().toISOString();

        // Actualizar estado del vehículo
        await updateVehicle({
          id: vehicleToDeliver._id,
          status: "Entregado",
          exitDate: deliveryDate,
        });

        // Crear transacción automática en finanzas
        await createVehicleTransaction({
          vehicleId: vehicleToDeliver._id,
          vehiclePlate: vehicleToDeliver.plate,
          vehicleBrand: vehicleToDeliver.brand,
          vehicleModel: vehicleToDeliver.model,
          customerName: vehicleToDeliver.owner,
          services: vehicleToDeliver.services || [],
          amount:
            vehicleToDeliver.costs?.totalCost || vehicleToDeliver.cost || 0,
          deliveryDate: deliveryDate,
        });

        setIsDeliverDialogOpen(false);
        setVehicleToDeliver(null);
      } catch (error) {
        console.error("Error al entregar vehículo:", error);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
            Gestión de Vehículos
          </h1>
          <p className="text-sm text-gray-400 dark:text-zinc-500">
            Administra los vehículos en el taller
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nuevo
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsDialogOpen(true)}>
                <Car className="h-4 w-4 mr-2" />
                Nuevo Vehículo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsNewEntryDialogOpen(true)}>
                <FilePlus className="h-4 w-4 mr-2" />
                Nueva Entrada
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={isNewEntryDialogOpen} onOpenChange={setIsNewEntryDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Nueva Entrada - Vehículo Existente</DialogTitle>
                <DialogDescription>
                  Agrega un nuevo arreglo para un vehículo que ya existe en el sistema
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="entryPlate">Placa del Vehículo</Label>
                  <div className="relative" data-plate-dropdown>
                    <Input
                      id="entryPlate"
                      value={newEntryPlate}
                      onChange={(e) => {
                        setNewEntryPlate(e.target.value.toUpperCase());
                        setIsPlateDropdownOpen(true);
                      }}
                      onFocus={() => {
                        if (filteredPlates.length > 0) {
                          setIsPlateDropdownOpen(true);
                        }
                      }}
                      placeholder="ABC-123"
                      autoComplete="off"
                    />
                    {/* Dropdown de sugerencias */}
                    {isPlateDropdownOpen && newEntryPlate.length > 0 && filteredPlates.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {filteredPlates.map((vehicle) => (
                          <button
                            key={vehicle.plate}
                            type="button"
                            onClick={() => {
                              setNewEntryPlate(vehicle.plate);
                              setIsPlateDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors border-b border-gray-100 dark:border-zinc-800 last:border-b-0"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {vehicle.plate}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {vehicle.vehicleInfo.brand} {vehicle.vehicleInfo.model} - {vehicle.vehicleInfo.owner}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {vehicle.visitCount} visita{vehicle.visitCount !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedVehicleForEntry && (
                    <div className="bg-gray-50 dark:bg-zinc-800 p-3 rounded-lg border border-gray-200 dark:border-zinc-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                        {selectedVehicleForEntry.brand} {selectedVehicleForEntry.model}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-zinc-400">
                        Cliente: {selectedVehicleForEntry.owner} | Tel: {selectedVehicleForEntry.phone}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
                        Visitas anteriores: {selectedVehicleForEntry.visitCount}
                      </p>
                    </div>
                  )}
                  {newEntryPlate.length >= 2 && !selectedVehicleForEntry && filteredPlates.length === 0 && (
                    <p className="text-sm text-red-600">
                      No se encontró ningún vehículo con esta placa
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="entryServices">Servicios</Label>
                  <CreatableSelect
                    value={newEntry.services}
                    onChange={(services) =>
                      setNewEntry({ ...newEntry, services })
                    }
                    options={serviceOptions}
                    onCreateOption={(serviceName) => {
                      console.log("Nuevo servicio:", serviceName);
                    }}
                    placeholder="Seleccionar o agregar servicios..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Responsables</Label>
                  <ResponsibleSelector
                    responsibles={newEntry.responsibles}
                    onChange={(responsibles) =>
                      setNewEntry({ ...newEntry, responsibles })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="entryMileage">
                    Kilometraje <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="entryMileage"
                    type="number"
                    value={newEntry.mileage}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, mileage: e.target.value })
                    }
                    onFocus={(e) => e.target.select()}
                    placeholder="150000"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Ingresa el kilometraje actual del vehículo en este momento
                  </p>
                </div>
                {isAdmin && (
                  <div className="grid gap-2">
                    <Label htmlFor="entryCost">Costo Estimado</Label>
                    <Input
                      id="entryCost"
                      type="number"
                      step="0.01"
                      value={newEntry.cost}
                      onChange={(e) =>
                        setNewEntry({ ...newEntry, cost: e.target.value })
                      }
                      onFocus={(e) => e.target.select()}
                      placeholder="0.00"
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="entryDescription">Descripción</Label>
                  <Input
                    id="entryDescription"
                    value={newEntry.description}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, description: e.target.value })
                    }
                    placeholder="Descripción detallada del problema o servicio"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsNewEntryDialogOpen(false);
                    setNewEntryPlate("");
                    setSelectedVehicleForEntry(null);
                    setIsPlateDropdownOpen(false);
                    setNewEntry({
                      services: [],
                      cost: "",
                      description: "",
                      mileage: "",
                      responsibles: [],
                    });
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateNewEntry}
                  disabled={!selectedVehicleForEntry || newEntry.services.length === 0}
                >
                  Crear Nueva Entrada
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setNewVehicle({ plate: "", brand: "", model: "", owner: "", phone: "", customerId: "", services: [], cost: "", description: "", mileage: "", responsibles: [] });
              setIsExistingPlate(false);
              setShowPlateDropdown(false);
            }
          }}>
            <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden flex flex-col max-h-[92vh]">
              {/* Header */}
              <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 dark:bg-zinc-800">
                    <Car className="h-4 w-4 text-gray-700 dark:text-zinc-300" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100 leading-tight">
                      {isExistingPlate ? "Nueva Entrada" : "Ingresar Vehículo"}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                      {isExistingPlate ? "Nueva entrada para vehículo ya registrado" : "Registra un vehículo en el taller"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-5 space-y-5">

                  {/* ── Sección Vehículo ── */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Car className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
                      <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Vehículo</span>
                    </div>

                    {/* Placa */}
                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-1.5 relative">
                        <Label htmlFor="plate" className="text-xs font-medium text-gray-700 dark:text-zinc-300">Placa</Label>
                        <Input
                          id="plate"
                          value={newVehicle.plate}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setNewVehicle({ ...newVehicle, plate: val });
                            setShowPlateDropdown(val.length >= 1);
                            if (isExistingPlate) {
                              setIsExistingPlate(false);
                              setNewVehicle((prev) => ({
                                ...prev,
                                plate: val,
                                brand: "",
                                model: "",
                                owner: "",
                                phone: "",
                                customerId: "",
                              }));
                            }
                          }}
                          onFocus={() => setShowPlateDropdown(newVehicle.plate.length >= 1)}
                          onBlur={() => setTimeout(() => setShowPlateDropdown(false), 200)}
                          placeholder="ABC-123"
                          autoComplete="off"
                          className="font-mono tracking-wider"
                        />
                        {isExistingPlate && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                            <p className="text-[11px] text-amber-600 dark:text-amber-400">Vehículo existente — se creará nueva entrada</p>
                          </div>
                        )}
                        {showPlateDropdown && filteredNewVehiclePlates.length > 0 && !isExistingPlate && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-hidden">
                            {filteredNewVehiclePlates.map((v) => (
                              <button
                                key={v.plate}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 text-sm flex justify-between items-center border-b border-gray-50 dark:border-zinc-800 last:border-b-0 transition-colors"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setNewVehicle((prev) => ({
                                    ...prev,
                                    plate: v.plate,
                                    brand: v.vehicleInfo.brand,
                                    model: v.vehicleInfo.model,
                                    owner: v.vehicleInfo.owner,
                                  }));
                                  setIsExistingPlate(true);
                                  setShowPlateDropdown(false);
                                }}
                              >
                                <span className="font-mono font-semibold text-gray-900 dark:text-zinc-100">{v.plate}</span>
                                <span className="text-xs text-gray-500 dark:text-zinc-400">
                                  {v.vehicleInfo.brand} {v.vehicleInfo.model} · {v.vehicleInfo.owner}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Marca + Modelo — solo para vehículos nuevos */}
                    {!isExistingPlate ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="brand" className="text-xs font-medium text-gray-700 dark:text-zinc-300">Marca</Label>
                          <Input
                            id="brand"
                            value={newVehicle.brand}
                            onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })}
                            placeholder="Toyota"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="model" className="text-xs font-medium text-gray-700 dark:text-zinc-300">Modelo</Label>
                          <Input
                            id="model"
                            value={newVehicle.model}
                            onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                            placeholder="Corolla"
                          />
                        </div>
                      </div>
                    ) : (
                      /* Card resumen del vehículo existente */
                      <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-3.5 py-3">
                        <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                          {newVehicle.brand} {newVehicle.model}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{newVehicle.owner}</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-100 dark:border-zinc-800" />

                  {/* ── Sección Cliente ── */}
                  {!isExistingPlate && (
                    <>
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
                          <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Cliente</span>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="customer" className="text-xs font-medium text-gray-700 dark:text-zinc-300">Buscar o crear cliente</Label>
                          <CustomerSelector
                            selectedCustomerId={newVehicle.customerId}
                            onCustomerChange={(customerId, customerData) => {
                              setNewVehicle({
                                ...newVehicle,
                                customerId: customerId,
                                owner: customerData.name,
                                phone: customerData.phone,
                              });
                            }}
                            onNewCustomerName={(name) => {
                              setNewVehicle({
                                ...newVehicle,
                                customerId: "",
                                owner: name,
                              });
                            }}
                            newCustomerName={!newVehicle.customerId ? newVehicle.owner : ""}
                          />
                        </div>
                        {isAdmin && (
                          <div className="space-y-1.5">
                            <Label htmlFor="phone" className="text-xs font-medium text-gray-700 dark:text-zinc-300">Teléfono</Label>
                            <Input
                              id="phone"
                              value={newVehicle.phone}
                              onChange={(e) => setNewVehicle({ ...newVehicle, phone: e.target.value })}
                              placeholder="+57 300 000 0000"
                              disabled={!!newVehicle.customerId}
                            />
                            {newVehicle.customerId && (
                              <p className="text-[11px] text-gray-400 dark:text-zinc-500">Teléfono del cliente seleccionado</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="border-t border-gray-100 dark:border-zinc-800" />
                    </>
                  )}

                  {/* ── Sección Servicio ── */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
                      <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Servicio</span>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="services" className="text-xs font-medium text-gray-700 dark:text-zinc-300">Servicios</Label>
                      <CreatableSelect
                        value={newVehicle.services}
                        onChange={(services) => setNewVehicle({ ...newVehicle, services })}
                        options={serviceOptions}
                        onCreateOption={(serviceName) => {
                          console.log("Nuevo servicio:", serviceName);
                        }}
                        placeholder="Escribí o seleccioná un servicio..."
                      />
                    </div>

                    <div className={`grid gap-3 ${isAdmin ? "grid-cols-2" : "grid-cols-1"}`}>
                      <div className="space-y-1.5">
                        <Label htmlFor="mileage" className="text-xs font-medium text-gray-700 dark:text-zinc-300">
                          Kilometraje <span className="text-gray-400 dark:text-zinc-500 font-normal">(km)</span>
                        </Label>
                        <Input
                          id="mileage"
                          type="number"
                          value={newVehicle.mileage}
                          onChange={(e) => setNewVehicle({ ...newVehicle, mileage: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          placeholder="150000"
                        />
                      </div>
                      {isAdmin && (
                        <div className="space-y-1.5">
                          <Label htmlFor="cost" className="text-xs font-medium text-gray-700 dark:text-zinc-300">Costo estimado</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-zinc-500 pointer-events-none select-none">$</span>
                            <Input
                              id="cost"
                              type="number"
                              step="0.01"
                              value={newVehicle.cost}
                              onChange={(e) => setNewVehicle({ ...newVehicle, cost: e.target.value })}
                              onFocus={(e) => e.target.select()}
                              placeholder="0"
                              className="pl-6"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="description" className="text-xs font-medium text-gray-700 dark:text-zinc-300">Descripción</Label>
                      <textarea
                        id="description"
                        value={newVehicle.description}
                        onChange={(e) => setNewVehicle({ ...newVehicle, description: e.target.value })}
                        placeholder="Describí el problema o el trabajo a realizar..."
                        rows={3}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-100 dark:border-zinc-800" />

                  {/* ── Sección Responsables ── */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
                      <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Responsables</span>
                    </div>
                    <ResponsibleSelector
                      responsibles={newVehicle.responsibles}
                      onChange={(responsibles) => setNewVehicle({ ...newVehicle, responsibles })}
                    />
                  </div>

                </div>
              </div>

              {/* Footer fijo */}
              <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-900/60 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAddVehicle}
                  disabled={!newVehicle.plate || (!isExistingPlate && (!newVehicle.brand || !newVehicle.model || !newVehicle.owner))}
                >
                  {isExistingPlate ? "Crear Nueva Entrada" : "Registrar Vehículo"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Diálogo de Edición */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Vehículo</DialogTitle>
              <DialogDescription>
                Modifica la información del vehículo
              </DialogDescription>
            </DialogHeader>
            {editingVehicle && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-plate">Placa</Label>
                    <Input
                      id="edit-plate"
                      value={editingVehicle.plate}
                      onChange={(e) =>
                        setEditingVehicle({
                          ...editingVehicle,
                          plate: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-brand">Marca</Label>
                    <Input
                      id="edit-brand"
                      value={editingVehicle.brand}
                      onChange={(e) =>
                        setEditingVehicle({
                          ...editingVehicle,
                          brand: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-model">Modelo</Label>
                    <Input
                      id="edit-model"
                      value={editingVehicle.model}
                      onChange={(e) =>
                        setEditingVehicle({
                          ...editingVehicle,
                          model: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-customer">Cliente</Label>
                    <CustomerSelector
                      selectedCustomerId={editingVehicle.customerId}
                      onCustomerChange={(customerId, customerData) => {
                        setEditingVehicle({
                          ...editingVehicle,
                          customerId: customerId,
                          owner: customerData.name,
                          phone: customerData.phone,
                        });
                      }}
                      onNewCustomerName={(name) => {
                        setEditingVehicle({
                          ...editingVehicle,
                          customerId: "",
                          owner: name,
                        });
                      }}
                      newCustomerName={
                        !editingVehicle.customerId ? editingVehicle.owner : ""
                      }
                    />
                  </div>
                  {isAdmin && (
                    <div className="grid gap-2">
                      <Label htmlFor="edit-phone">Teléfono</Label>
                      <Input
                        id="edit-phone"
                        value={editingVehicle.phone}
                        onChange={(e) =>
                          setEditingVehicle({
                            ...editingVehicle,
                            phone: e.target.value,
                          })
                        }
                        disabled={!!editingVehicle.customerId}
                      />
                      {editingVehicle.customerId && (
                        <p className="text-xs text-muted-foreground">
                          Teléfono del cliente seleccionado
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-status">Estado</Label>
                    <Select
                      value={editingVehicle.status}
                      onValueChange={(value) =>
                        setEditingVehicle({ ...editingVehicle, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>{editingVehicle.status}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ingresado">Ingresado</SelectItem>
                        <SelectItem value="En Reparación">
                          En Reparación
                        </SelectItem>
                        <SelectItem value="Listo">Listo</SelectItem>
                        <SelectItem value="Entregado">Entregado</SelectItem>
                        <SelectItem value="Suspendido">Suspendido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {isAdmin && (
                    <div className="grid gap-2">
                      <Label htmlFor="edit-cost">Costo</Label>
                      <Input
                        id="edit-cost"
                        type="number"
                        step="0.01"
                        value={editingVehicle.cost}
                        onChange={(e) =>
                          setEditingVehicle({
                            ...editingVehicle,
                            cost: e.target.value,
                          })
                        }
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-services">Servicios</Label>
                  <CreatableSelect
                    key={editingVehicle._id}
                    value={editingVehicle.services || []}
                    onChange={(services) =>
                      setEditingVehicle({ ...editingVehicle, services })
                    }
                    options={serviceOptions}
                    onCreateOption={(serviceName) => {
                      // createService({ name: serviceName });
                      console.log("Nuevo servicio:", serviceName);
                    }}
                    placeholder="Seleccionar o agregar servicios..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Responsables</Label>
                  <ResponsibleSelector
                    key={`responsibles-${editingVehicle._id}`}
                    responsibles={
                      editingVehicle.responsibles?.map((r: any) => ({
                        name: r.name,
                        role: r.role,
                        userId: r.userId,
                        isAdmin: r.isAdmin,
                      })) || []
                    }
                    onChange={(responsibles) =>
                      setEditingVehicle({
                        ...editingVehicle,
                        responsibles: responsibles.map((r) => ({
                          name: r.name,
                          role: r.role,
                          assignedAt: new Date().toISOString(),
                          userId: r.userId,
                          isAdmin: r.isAdmin,
                        })),
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-description">Descripción</Label>
                  <Input
                    id="edit-description"
                    value={editingVehicle.description || ""}
                    onChange={(e) =>
                      setEditingVehicle({
                        ...editingVehicle,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-mileage">Kilometraje</Label>
                  <Input
                    id="edit-mileage"
                    type="number"
                    value={editingVehicle.mileage || ""}
                    onChange={(e) =>
                      setEditingVehicle({
                        ...editingVehicle,
                        mileage: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    onFocus={(e) => e.target.select()}
                    placeholder="150000"
                  />
                </div>

                {/* Sección de Repuestos */}
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Repuestos y Partes
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newParts = [
                          ...(editingVehicle.parts || []),
                          {
                            id: Date.now().toString(),
                            name: "",
                            price: 0,
                            quantity: 1,
                            source: "purchased",
                            supplier: "",
                            notes: "",
                          },
                        ];
                        setEditingVehicle({
                          ...editingVehicle,
                          parts: newParts,
                        });
                      }}
                      className="text-xs"
                    >
                      + Agregar Repuesto
                    </Button>
                  </div>

                  {editingVehicle.parts && editingVehicle.parts.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {editingVehicle.parts.map((part: any, index: number) => (
                        <div
                          key={part.id || index}
                          className="bg-gray-50 rounded-lg p-3 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">
                              Repuesto #{index + 1}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newParts = editingVehicle.parts.filter(
                                  (_: any, i: number) => i !== index
                                );
                                setEditingVehicle({
                                  ...editingVehicle,
                                  parts: newParts,
                                });
                              }}
                              className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                            >
                              ×
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Nombre</Label>
                              <Input
                                value={part.name}
                                onChange={(e) => {
                                  const newParts = [...editingVehicle.parts];
                                  newParts[index] = {
                                    ...part,
                                    name: e.target.value,
                                  };
                                  setEditingVehicle({
                                    ...editingVehicle,
                                    parts: newParts,
                                  });
                                }}
                                placeholder="Nombre del repuesto"
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Origen</Label>
                              <Select
                                value={part.source}
                                onValueChange={(value) => {
                                  const newParts = [...editingVehicle.parts];
                                  newParts[index] = { ...part, source: value };
                                  setEditingVehicle({
                                    ...editingVehicle,
                                    parts: newParts,
                                  });
                                }}
                              >
                                <SelectTrigger className="text-sm">
                                  <SelectValue>
                                    {part.source === "purchased"
                                      ? "Comprado"
                                      : "Cliente"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="purchased">
                                    Comprado
                                  </SelectItem>
                                  <SelectItem value="client">
                                    Cliente
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Cantidad</Label>
                              <Input
                                type="number"
                                min="1"
                                value={part.quantity}
                                onChange={(e) => {
                                  const newParts = [...editingVehicle.parts];
                                  newParts[index] = {
                                    ...part,
                                    quantity: parseInt(e.target.value) || 1,
                                  };
                                  setEditingVehicle({
                                    ...editingVehicle,
                                    parts: newParts,
                                  });
                                }}
                                onFocus={(e) => e.target.select()}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Precio unitario</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={part.price}
                                onChange={(e) => {
                                  const newParts = [...editingVehicle.parts];
                                  newParts[index] = {
                                    ...part,
                                    price: parseFloat(e.target.value) || 0,
                                  };
                                  setEditingVehicle({
                                    ...editingVehicle,
                                    parts: newParts,
                                  });
                                }}
                                onFocus={(e) => e.target.select()}
                                placeholder="0.00"
                                className="text-sm"
                              />
                            </div>
                          </div>

                          {part.source === "purchased" && (
                            <div>
                              <Label className="text-xs">Proveedor</Label>
                              <Input
                                value={part.supplier || ""}
                                onChange={(e) => {
                                  const newParts = [...editingVehicle.parts];
                                  newParts[index] = {
                                    ...part,
                                    supplier: e.target.value,
                                  };
                                  setEditingVehicle({
                                    ...editingVehicle,
                                    parts: newParts,
                                  });
                                }}
                                placeholder="Nombre del proveedor"
                                className="text-sm"
                              />
                            </div>
                          )}

                          <div>
                            <Label className="text-xs">Notas</Label>
                            <Input
                              value={part.notes || ""}
                              onChange={(e) => {
                                const newParts = [...editingVehicle.parts];
                                newParts[index] = {
                                  ...part,
                                  notes: e.target.value,
                                };
                                setEditingVehicle({
                                  ...editingVehicle,
                                  parts: newParts,
                                });
                              }}
                              placeholder="Notas adicionales..."
                              className="text-sm"
                            />
                          </div>

                          <div className="bg-white rounded p-2 border">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">Total:</span>
                              <span className="font-semibold text-green-600">
                                $
                                {(
                                  (part.price || 0) * (part.quantity || 1)
                                ).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}

                      {editingVehicle.parts.length > 0 && (
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-900">
                              Total en Repuestos:
                            </span>
                            <span className="text-lg font-bold text-green-600">
                              $
                              {editingVehicle.parts
                                .reduce(
                                  (sum: number, part: any) =>
                                    sum +
                                    (part.price || 0) * (part.quantity || 1),
                                  0
                                )
                                .toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-500">
                      No hay repuestos agregados. Haz clic en "Agregar Repuesto"
                      para comenzar.
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleUpdateVehicle}>Guardar Cambios</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* Diálogo de Confirmación de Entrega */}
        <Dialog
          open={isDeliverDialogOpen}
          onOpenChange={setIsDeliverDialogOpen}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Confirmar Entrega</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas marcar este vehículo como entregado?
              </DialogDescription>
            </DialogHeader>
            {vehicleToDeliver && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-lg border border-gray-200 dark:border-zinc-700">
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                        {vehicleToDeliver.plate} - {vehicleToDeliver.brand}{" "}
                        {vehicleToDeliver.model}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-zinc-400">
                        Cliente: {vehicleToDeliver.owner}
                      </p>
                      {isAdmin && (
                        <p className="text-sm text-gray-600 dark:text-zinc-400">
                          Costo total: $
                          {vehicleToDeliver.cost?.toLocaleString() || "0"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-900/50">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-amber-600 dark:text-amber-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        Importante
                      </h3>
                      <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                        Una vez marcado como entregado, el vehículo se moverá al
                        historial y no podrá ser modificado sin cambiar su
                        estado.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDeliverDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmDeliverVehicle}
                className="bg-green-600 hover:bg-green-700"
              >
                Confirmar Entrega
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo de Confirmación de Eliminación */}
        <Dialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Confirmar Eliminación</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas eliminar este vehículo? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            {vehicleToDelete && (
              <div className="space-y-4">
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-red-900">
                        {vehicleToDelete.plate} - {vehicleToDelete.brand}{" "}
                        {vehicleToDelete.model}
                      </h3>
                      <p className="text-sm text-red-700">
                        Cliente: {vehicleToDelete.owner}
                      </p>
                      <p className="text-sm text-red-700">
                        Estado: {vehicleToDelete.status}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-yellow-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-yellow-800">
                        Advertencia
                      </h3>
                      <p className="text-sm text-yellow-700 mt-1">
                        Esta acción eliminará permanentemente el vehículo y toda su información asociada. 
                        Esta acción no se puede deshacer.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setVehicleToDelete(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmDeleteVehicle}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar Vehículo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de Estadísticas Colapsables - Ocultas en móvil */}
      <div className="hidden md:block">
        <VehicleCards />
      </div>

      {/* Barra de búsqueda + botón Filtros (único para todos los tamaños) */}
      {(() => {
        const activeFilterCount = [
          dateFilter.type !== "all" ? 1 : 0,
          statusFilter !== "all" ? 1 : 0,
          responsibleFilter !== "all" ? 1 : 0,
        ].reduce((a, b) => a + b, 0);

        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por placa, marca, cliente..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                  showFilters || activeFilterCount > 0
                    ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-gray-900 dark:border-zinc-100"
                    : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                }`}
              >
                <Filter className="h-4 w-4" />
                <span className="hidden xs:inline">Filtros</span>
                {activeFilterCount > 0 ? (
                  <span className={`text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center ${
                    showFilters || activeFilterCount > 0
                      ? "bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100"
                      : "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  }`}>
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </div>

            {showFilters && (
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <DateRangeFilter
                    value={dateFilter}
                    onChange={setDateFilter}
                    compact
                    className="w-full"
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue>
                        {statusFilter === "all" ? "Todos los estados"
                          : statusFilter === "delivered" ? "Entregados"
                          : "No entregados"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="not_delivered">No entregados</SelectItem>
                      <SelectItem value="delivered">Entregados</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
                    <SelectTrigger className="w-full">
                      <User className="h-4 w-4 mr-2" />
                      <SelectValue>
                        {responsibleFilter === "all" ? "Todos los responsables"
                          : responsibleFilter === "mine" ? "Asignados a mí"
                          : responsibleFilter === "assigned" ? "Con responsable"
                          : "Sin asignar"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="mine">Asignados a mí</SelectItem>
                      <SelectItem value="assigned">Con responsable</SelectItem>
                      <SelectItem value="unassigned">Sin asignar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      setStatusFilter("all");
                      setResponsibleFilter("all");
                      setDateFilter({ type: "all", label: "Todos" });
                    }}
                    className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 text-left transition-colors w-fit"
                  >
                    Limpiar filtros ({activeFilterCount})
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Tabla de vehículos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <CardTitle>Vehículos en Taller</CardTitle>
                {dateFilter.type !== "thisMonth" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Periodo: {dateFilter.label}
                  </p>
                )}
              </div>
              {!isAdmin && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700 hidden sm:inline-flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Vista de Miembro
                </span>
              )}
              {isAdmin && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hidden sm:inline-flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  Vista de Admin
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {/* Contador de resultados */}
              <p className="text-sm text-muted-foreground hidden sm:block">
                {searchTerm ||
                statusFilter !== "all" ||
                responsibleFilter !== "all" ? (
                  <>
                    {vehiclesInTaller.length} de {allVehicles.length} vehículo
                    {allVehicles.length !== 1 ? "s" : ""}
                    {(searchTerm ||
                      statusFilter !== "all" ||
                      responsibleFilter !== "all") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchTerm("");
                          setStatusFilter("all");
                          setResponsibleFilter("all");
                        }}
                        className="ml-2 h-6 px-2 text-xs"
                      >
                        Limpiar filtros
                      </Button>
                    )}
                  </>
                ) : !isAdmin ? (
                  `Mostrando ${vehiclesInTaller.length} vehículo${vehiclesInTaller.length !== 1 ? "s" : ""} (asignados a ti + sin asignar)`
                ) : (
                  `${vehiclesInTaller.length} vehículo${vehiclesInTaller.length !== 1 ? "s" : ""} en total`
                )}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Vehículo</TableHead>
                  <TableHead className="min-w-[120px]">Cliente</TableHead>
                  <TableHead className="min-w-[100px] hidden sm:table-cell">
                    Servicios
                  </TableHead>
                  <TableHead className="min-w-[100px] hidden sm:table-cell">
                    Responsables
                  </TableHead>
                  <TableHead className="min-w-[80px]">Estado</TableHead>
                  <TableHead className="min-w-[80px] hidden sm:table-cell">KM</TableHead>
                  {isAdmin && (
                    <TableHead className="min-w-[80px] hidden sm:table-cell">
                      Costo
                    </TableHead>
                  )}
                  <TableHead className="min-w-[80px] hidden sm:table-cell">
                    Ingreso
                  </TableHead>
                  <TableHead className="min-w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehiclesInTaller.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isAdmin ? 9 : 8}
                      className="text-center py-8"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Search className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            No se encontraron vehículos
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {searchTerm ||
                            statusFilter !== "all" ||
                            responsibleFilter !== "all"
                              ? "Intenta ajustar los filtros"
                              : !isAdmin
                                ? "No tienes vehículos asignados ni hay vehículos sin asignar"
                                : "No hay vehículos en el taller"}
                          </p>
                        </div>
                        {(searchTerm ||
                          statusFilter !== "all" ||
                          responsibleFilter !== "all") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSearchTerm("");
                              setStatusFilter("all");
                              setResponsibleFilter("all");
                            }}
                            className="mt-2"
                          >
                            Limpiar filtros
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedVehicles.map((vehicle) => (
                    <TableRow
                      key={vehicle._id}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors group"
                      onClick={() => handleViewDetail(vehicle)}
                      title="Clic para ver detalles del vehículo"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-0.5 h-7 bg-gray-200 dark:bg-zinc-700 rounded-full group-hover:bg-gray-400 dark:group-hover:bg-zinc-500 transition-colors"></div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-zinc-100">{vehicle.plate}</p>
                            <p className="text-xs text-gray-400 dark:text-zinc-500">
                              {vehicle.brand} {vehicle.model}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium truncate max-w-[120px] sm:max-w-none">{vehicle.owner}</p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="max-w-64">
                          <div className="flex flex-wrap gap-1 mb-1">
                            {vehicle.services.length > 0 && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700 max-w-[180px] truncate block">
                                {vehicle.services[0]}
                              </span>
                            )}
                            {vehicle.services.length > 1 && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700">
                                +{vehicle.services.length - 1} más
                              </span>
                            )}
                          </div>
                          {vehicle.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {vehicle.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="max-w-48">
                          {vehicle.responsibles &&
                          vehicle.responsibles.length > 0 ? (
                            <div className="space-y-1">
                              {vehicle.responsibles
                                .slice(0, 2)
                                .map((responsible, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center gap-1"
                                  >
                                    <div className="flex items-center gap-1">
                                      {responsible.isAdmin ? (
                                        <Crown className="h-3 w-3 text-yellow-600" />
                                      ) : (
                                        <User className="h-3 w-3 text-gray-500 dark:text-zinc-400" />
                                      )}
                                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                                        responsible.isAdmin
                                          ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                                          : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                                      }`}>
                                        {responsible.name}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              {vehicle.responsibles.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{vehicle.responsibles.length - 2} más
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Sin asignar
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm font-medium">
                          {vehicle.mileage ? vehicle.mileage.toLocaleString() : '-'}
                        </span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="hidden sm:table-cell">
                          <span className="font-medium">
                            ${vehicle.cost.toLocaleString()}
                          </span>
                        </TableCell>
                      )}
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm">
                          {formatDateToDDMMYYYY(vehicle.entryDate)}
                        </span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          {!isAdmin && !canEditVehicle(vehicle) && (
                            <Badge
                              variant="outline"
                              className="text-xs bg-gray-50 text-gray-600 border-gray-300 hidden sm:inline-flex"
                            >
                              <svg
                                className="h-3 w-3 mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                              </svg>
                              Restringido
                            </Badge>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 w-9 p-0 border border-gray-200 hover:bg-gray-50"
                              >
                                <span className="sr-only">Abrir menú</span>
                                <MoreHorizontal className="h-5 w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => handleEditVehicle(vehicle)}
                                disabled={!canEditVehicle(vehicle)}
                                className={
                                  !canEditVehicle(vehicle)
                                    ? "text-gray-400 cursor-not-allowed"
                                    : ""
                                }
                              >
                                <Edit3 className="mr-2 h-4 w-4" />
                                Editar
                                {!canEditVehicle(vehicle) && (
                                  <svg
                                    className="ml-auto h-3 w-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                    />
                                  </svg>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/vehiculos/${encodeURIComponent(vehicle.plate)}/detalle`);
                                }}
                              >
                                <History className="mr-2 h-4 w-4" />
                                Ver Historial de Arreglos
                              </DropdownMenuItem>
                              {isAdmin && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    navigate(`/vehiculos/${vehicle._id}/costos`)
                                  }
                                  disabled={!canEditVehicle(vehicle)}
                                  className={
                                    !canEditVehicle(vehicle)
                                      ? "text-gray-400 cursor-not-allowed"
                                      : ""
                                  }
                                >
                                  <Calculator className="mr-2 h-4 w-4" />
                                  Gestionar Costos
                                  {!canEditVehicle(vehicle) && (
                                    <svg
                                      className="ml-auto h-3 w-3"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                      />
                                    </svg>
                                  )}
                                </DropdownMenuItem>
                              )}

                              {/* Botones de trabajo */}
                              {vehicle.status !== "Entregado" &&
                                vehicle.status !== "Suspendido" &&
                                (isUserAssigned(vehicle) ||
                                  !vehicle.responsibles ||
                                  vehicle.responsibles.length === 0) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    {!isUserWorking(vehicle) ? (
                                      <DropdownMenuItem
                                        onClick={() => handleStartWork(vehicle)}
                                      >
                                        <Play className="mr-2 h-4 w-4 text-green-600" />
                                        <span className="text-green-600">
                                          Iniciar Trabajo
                                        </span>
                                      </DropdownMenuItem>
                                    ) : (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handlePauseWork(vehicle)
                                          }
                                        >
                                          <Pause className="mr-2 h-4 w-4 text-yellow-600" />
                                          <span className="text-yellow-600">
                                            Pausar Trabajo
                                          </span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleCompleteWork(vehicle)
                                          }
                                        >
                                          <Square className="mr-2 h-4 w-4 text-green-600" />
                                          <span className="text-green-600">
                                            Completar Trabajo
                                          </span>
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </>
                                )}

                              {vehicle.status !== "Entregado" &&
                                vehicle.status !== "Suspendido" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleDeliverVehicle(vehicle)
                                      }
                                      disabled={!canEditVehicle(vehicle)}
                                      className={
                                        !canEditVehicle(vehicle)
                                          ? "text-gray-400 cursor-not-allowed"
                                          : "text-green-600 focus:text-green-600"
                                      }
                                    >
                                      <svg
                                        className="mr-2 h-4 w-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                      Entregar
                                      {!canEditVehicle(vehicle) && (
                                        <svg
                                          className="ml-auto h-3 w-3"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                          />
                                        </svg>
                                      )}
                                    </DropdownMenuItem>
                                  </>
                                )}

                              {/* Opción de eliminar - solo para admins */}
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteVehicle(vehicle)}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4">
              <p className="text-xs text-muted-foreground order-2 sm:order-1">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, vehiclesInTaller.length)} de {vehiclesInTaller.length}
              </p>
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  ← Anterior
                </Button>
                <span className="text-xs font-medium text-gray-700 dark:text-zinc-300 px-1 tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente →
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
