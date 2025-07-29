import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CarouselCards } from "../ui/carousel-cards";
import type { CardData } from "../ui/carousel-cards";
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  UserCheck,
  Calendar,
  Percent
} from "lucide-react";

export const PartnerCards: React.FC = () => {
  const allPartners = useQuery(api.partners.getPartners) ?? [];
  const activePartners = useQuery(api.partners.getActivePartners) ?? [];

  const totalPartners = allPartners.length;
  const totalContributions = allPartners.reduce((sum, partner) => sum + partner.totalContributed, 0);
  const monthlyContributions = activePartners.reduce((sum, partner) => sum + partner.monthlyContribution, 0);
  const averageInvestment = activePartners.length > 0 
    ? activePartners.reduce((sum, p) => sum + p.investmentPercentage, 0) / activePartners.length 
    : 0;
  const totalInvestmentPercentage = activePartners.reduce((sum, p) => sum + p.investmentPercentage, 0);

  const cards: CardData[] = [
    {
      id: "activePartners",
      title: "Socios Activos",
      value: activePartners.length,
      description: "socios participando activamente",
      icon: UserCheck,
      color: "text-green-600",
      borderColor: "border-green-200",
    },
    {
      id: "totalPartners",
      title: "Total Socios",
      value: totalPartners,
      description: "socios registrados en total",
      icon: Users,
    },
    {
      id: "totalContributions",
      title: "Contribuciones Totales",
      value: `$${totalContributions.toLocaleString()}`,
      description: "capital total aportado",
      icon: DollarSign,
      color: "text-green-600",
    },
    {
      id: "monthlyContributions",
      title: "Contribuciones Mensuales",
      value: `$${monthlyContributions.toLocaleString()}`,
      description: "aporte mensual esperado",
      icon: Calendar,
      color: "text-blue-600",
      borderColor: "border-blue-200",
    },
    {
      id: "investmentPercentage",
      title: "Inversión Total",
      value: `${totalInvestmentPercentage.toFixed(1)}%`,
      description: "porcentaje total de inversión",
      icon: Percent,
      color: "text-purple-600",
    },
    {
      id: "averageInvestment",
      title: "Inversión Promedio",
      value: `${averageInvestment.toFixed(1)}%`,
      description: "porcentaje promedio por socio",
      icon: TrendingUp,
      color: "text-orange-600",
    }
  ];

  return (
    <CarouselCards 
      cards={cards} 
      title="Estadísticas de Socios"
    />
  );
};

export default PartnerCards;