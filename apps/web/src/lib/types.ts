export type Role = "admin" | "mecanico";

export interface User {
  id: string;
  name: string;
  email?: string | null;
  username?: string;
  role: Role;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  settings?: Record<string, unknown>;
}

export interface WorkSession {
  startTime: string;
  endTime?: string;
  duration?: number;
}

export interface Responsible {
  name: string;
  assignedAt: string;
  role?: string;
  userId?: string;
  isAdmin?: boolean;
  isWorking?: boolean;
  workStartedAt?: string;
  totalWorkTime?: number;
  workSessions?: WorkSession[];
}

export interface Part {
  id: string;
  name: string;
  price: number;
  quantity: number;
  source: "client" | "purchased";
  supplier?: string;
  notes?: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  owner: string;
  phone: string;
  customerId: string | null;
  status: string;
  entryDate: string;
  exitDate?: string | null;
  services: string[];
  cost: number;
  description?: string | null;
  inTaller?: boolean;
  mileage?: number | null;
  responsibles: Responsible[];
  costs?: { laborCost: number; partsCost: number; totalCost: number } | null;
  parts: Part[];
  lastUpdated?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone: string;
  address?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  notes?: string | null;
  active: boolean;
  totalVehicles?: number;
  totalSpent?: number;
  lastVisit?: string | null;
  visitCount?: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  type: "Ingreso" | "Egreso";
  category: string;
  amount: number;
  active: boolean;
  supplier?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
  vehicleId?: string | null;
}

export interface Product {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  type: string;
  price: number;
  reorderPoint: number;
  lowStock: boolean;
}

export interface Partner {
  id: string;
  name: string;
  email: string;
  phone: string;
  investmentPercentage: number;
  monthlyContribution: number;
  totalContributed: number;
  joinDate: string;
  active: boolean;
}

export interface Service {
  id: string;
  name: string;
  active: boolean;
  usageCount?: number;
}

export interface HistorialTaller {
  id: string;
  waMessageId: string;
  waFrom: string;
  waTimestamp: string;
  rawMessage?: string | null;
  marcaModelo?: string | null;
  kilometraje?: string | null;
  patente?: string | null;
  tarea?: string | null;
  cliente?: string | null;
  fotoPaths: string[];
  vehicleId?: string | null;
  customerId?: string | null;
  status: "pending" | "processed" | "error" | "linked";
  createdAt: string;
}

export interface NumeroAutorizado {
  id: string;
  phone: string;
  name: string;
  active: boolean;
}

export const ORDER_STATUSES = [
  "Pendiente",
  "Diagnosticando",
  "Esperando repuestos",
  "En reparación",
  "Listo para entregar",
  "Entregado",
  "Cancelado",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderPart {
  productId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  fromInventory: boolean;
}

export interface WorkOrder {
  id: string;
  number: number;
  vehicleId: string | null;
  customerId: string | null;
  vehiclePlate: string;
  vehicleInfo: string;
  customerName: string;
  status: OrderStatus;
  services: string[];
  parts: OrderPart[];
  laborCost: number;
  partsCost: number;
  total: number;
  mileage?: number | null;
  notes?: string | null;
  entryDate: string;
  estimatedDate?: string | null;
  deliveryDate?: string | null;
  finalizedAt?: string | null;
  createdAt: string;
}

export interface VehicleStats {
  total: number;
  inTaller: number;
  outOfTaller: number;
  byStatus: {
    ingresados: number;
    enReparacion: number;
    listos: number;
    entregados: number;
    suspendidos: number;
  };
  totalEarnings: number;
}
