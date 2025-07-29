import React from "react";
import { CarouselCards } from "../ui/carousel-cards";
import type { CardData } from "../ui/carousel-cards";
import { Car, DollarSign, Clock, Wrench, CheckCircle } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export const DashboardCards: React.FC = () => {
  const { user } = useUser();
  const isAdmin = user?.organizationMemberships?.[0]?.role === "org:admin";
  
  // Obtener estadísticas reales
  const vehicleStats = useQuery(api.vehicles.getVehicleStats);
  const userVehicles = useQuery(api.vehicles.getVehiclesForUser, {
    userId: user?.id || "",
    isAdmin: isAdmin || false
  });

  // Calcular vehículos asignados al usuario actual (para mecánicos)
  const assignedVehicles = userVehicles?.filter(vehicle => 
    vehicle.responsibles?.some(r => r.userId === user?.id)
  ) || [];

  const completedVehicles = assignedVehicles.filter(v => v.status === "Listo");

  let cards: CardData[] = [];

  if (isAdmin) {
    // Cards para administradores (con métricas financieras)
    cards = [
      {
        id: "vehiclesInTaller",
        title: "Vehículos en Taller",
        value: vehicleStats?.inTaller || 0,
        description: `Total: ${vehicleStats?.total || 0} vehículos`,
        icon: Car,
      },
      {
        id: "monthlyEarnings",
        title: "Ingresos Totales",
        value: `$${vehicleStats?.totalEarnings?.toLocaleString() || 0}`,
        description: "Vehículos entregados",
        icon: DollarSign,
        color: "text-green-600",
        borderColor: "border-green-200",
      },
      {
        id: "pendingJobs",
        title: "En Reparación",
        value: vehicleStats?.byStatus.enReparacion || 0,
        description: `${vehicleStats?.byStatus.ingresados || 0} ingresados`,
        icon: Clock,
        color: "text-yellow-600",
        borderColor: "border-yellow-200",
      },
      {
        id: "completedJobs",
        title: "Trabajos Listos",
        value: vehicleStats?.byStatus.listos || 0,
        description: "Para entregar",
        icon: CheckCircle,
        color: "text-blue-600",
        borderColor: "border-blue-200",
      }
    ];
  } else {
    // Cards para mecánicos (sin métricas financieras)
    cards = [
      {
        id: "myVehicles",
        title: "Mis Vehículos",
        value: assignedVehicles.length,
        description: "Asignados a mí",
        icon: Car,
        color: "text-blue-600",
        borderColor: "border-blue-200",
      },
      {
        id: "inProgress",
        title: "En Proceso",
        value: assignedVehicles.filter(v => v.status === "En Reparación").length,
        description: "Trabajando ahora",
        icon: Wrench,
        color: "text-orange-600",
        borderColor: "border-orange-200",
      },
      {
        id: "completed",
        title: "Completados",
        value: completedVehicles.length,
        description: "Listos para entregar",
        icon: CheckCircle,
        color: "text-green-600",
        borderColor: "border-green-200",
      },
      {
        id: "available",
        title: "Disponibles",
        value: userVehicles?.filter(vehicle => 
          !vehicle.responsibles || vehicle.responsibles.length === 0
        ).length || 0,
        description: "Para tomar",
        icon: Clock,
        color: "text-purple-600",
        borderColor: "border-purple-200",
      }
    ];
  }

  return (
    <CarouselCards 
      cards={cards} 
      title={isAdmin ? "Estadísticas del Taller" : "Mi Estado de Trabajo"}
    />
  );
};

export default DashboardCards;