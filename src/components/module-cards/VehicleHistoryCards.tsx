import React from "react";
import { CarouselCards } from "../ui/carousel-cards";
import type { CardData } from "../ui/carousel-cards";
import { Car, CheckCircle, XCircle, DollarSign } from "lucide-react";

interface VehicleHistoryCardsProps {
  totalVehicles: number;
  deliveredCount: number;
  suspendedCount: number;
  totalEarnings: number;
}

export const VehicleHistoryCards: React.FC<VehicleHistoryCardsProps> = ({
  totalVehicles,
  deliveredCount,
  suspendedCount,
  totalEarnings,
}) => {
  const cards: CardData[] = [
    {
      id: "totalHistoric",
      title: "Total Histórico",
      value: totalVehicles,
      description: "vehículos procesados",
      icon: Car,
    },
    {
      id: "delivered",
      title: "Entregados",
      value: deliveredCount,
      description: "trabajos completados",
      icon: CheckCircle,
      color: "text-green-600",
      borderColor: "border-green-200",
    },
    {
      id: "suspended",
      title: "Suspendidos",
      value: suspendedCount,
      description: "trabajos suspendidos",
      icon: XCircle,
      color: "text-red-600",
      borderColor: "border-red-200",
    },
    {
      id: "totalEarnings",
      title: "Ingresos Totales",
      value: `$${totalEarnings.toLocaleString()}`,
      description: "de vehículos entregados",
      icon: DollarSign,
      color: "text-green-600",
      borderColor: "border-green-200",
    }
  ];

  return (
    <CarouselCards 
      cards={cards} 
      title="Estadísticas del Historial"
    />
  );
};

export default VehicleHistoryCards;