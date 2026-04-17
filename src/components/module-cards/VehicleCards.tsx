import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CarouselCards } from "../ui/carousel-cards";
import type { CardData } from "../ui/carousel-cards";
import { 
  Car, 
  Wrench, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  DollarSign
} from "lucide-react";

export const VehicleCards: React.FC = () => {
  const vehicleStats = useQuery(api.vehicles.getVehicleStats);
  const vehiclesInTaller = useQuery(api.vehicles.getVehiclesInTaller);

  if (!vehicleStats || !vehiclesInTaller) {
    return <div>Cargando estadísticas de vehículos...</div>;
  }

  const cards: CardData[] = [
    {
      id: "totalVehicles",
      title: "Total Vehículos",
      value: vehicleStats.total,
      description: "vehículos registrados",
      icon: Car,
    },
    {
      id: "inTaller",
      title: "En Taller",
      value: vehicleStats.inTaller,
      description: "vehículos actualmente en reparación",
      icon: Wrench,
    },
    {
      id: "delivered",
      title: "Entregados",
      value: vehicleStats.byStatus.entregados,
      description: "vehículos completados",
      icon: CheckCircle,
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      id: "inProgress",
      title: "En Reparación",
      value: vehicleStats.byStatus.enReparacion,
      description: "vehículos siendo reparados",
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
    },
    {
      id: "suspended",
      title: "Suspendidos",
      value: vehicleStats.byStatus.suspendidos,
      description: "vehículos suspendidos",
      icon: AlertTriangle,
      color: "text-red-500 dark:text-red-400",
    },
    {
      id: "earnings",
      title: "Ingresos Totales",
      value: `$${vehicleStats.totalEarnings.toLocaleString()}`,
      description: "ingresos por vehículos entregados",
      icon: DollarSign,
      color: "text-emerald-600 dark:text-emerald-400",
    }
  ];

  return (
    <CarouselCards 
      cards={cards} 
      title="Estadísticas de Vehículos"
    />
  );
};

export default VehicleCards;