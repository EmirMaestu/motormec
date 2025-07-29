import React from "react";
import { CarouselCards } from "../ui/carousel-cards";
import type { CardData } from "../ui/carousel-cards";
import { BarChart3, Users, TrendingUp } from "lucide-react";

export const ReportsCards: React.FC = () => {
  const cards: CardData[] = [
    {
      id: "servicesCompleted",
      title: "Servicios Realizados",
      value: 47,
      description: "+12% vs mes anterior",
      icon: BarChart3,
      color: "text-blue-600",
      borderColor: "border-blue-200",
    },
    {
      id: "uniqueClients",
      title: "Clientes Únicos",
      value: 23,
      description: "+8% nuevos clientes",
      icon: Users,
      color: "text-green-600",
      borderColor: "border-green-200",
    },
    {
      id: "averageTime",
      title: "Tiempo Promedio",
      value: "2.3 días",
      description: "+0.2 vs mes anterior",
      icon: TrendingUp,
      color: "text-orange-600",
      borderColor: "border-orange-200",
    },
    {
      id: "satisfaction",
      title: "Satisfacción",
      value: "4.8/5",
      description: "+0.1 calificación promedio",
      icon: TrendingUp,
      color: "text-purple-600",
      borderColor: "border-purple-200",
    }
  ];

  return (
    <CarouselCards 
      cards={cards} 
      title="Métricas Principales"
    />
  );
};

export default ReportsCards;