import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CarouselCards } from "../ui/carousel-cards";
import type { CardData } from "../ui/carousel-cards";
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  Calculator,
  CreditCard,
  Target
} from "lucide-react";

export const FinanceCards: React.FC = () => {
  const financialSummary = useQuery(api.transactions.getFinancialSummary);
  const activeTransactions = useQuery(api.transactions.getActiveTransactions) ?? [];

  if (!financialSummary) {
    return <div>Cargando estadísticas financieras...</div>;
  }

  const averageIncome = activeTransactions.filter(t => t.type === "Ingreso").length > 0
    ? financialSummary.totalIngresos / activeTransactions.filter(t => t.type === "Ingreso").length
    : 0;
  const averageExpense = activeTransactions.filter(t => t.type === "Egreso").length > 0
    ? financialSummary.totalEgresos / activeTransactions.filter(t => t.type === "Egreso").length
    : 0;

  const cards: CardData[] = [
    {
      id: "totalIncome",
      title: "Total Ingresos",
      value: `$${financialSummary.totalIngresos.toLocaleString()}`,
      description: "ingresos totales registrados",
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      id: "totalExpenses",
      title: "Total Egresos",
      value: `$${financialSummary.totalEgresos.toLocaleString()}`,
      description: "gastos totales registrados",
      icon: TrendingDown,
      color: "text-red-500 dark:text-red-400",
    },
    {
      id: "balance",
      title: "Balance",
      value: `$${financialSummary.balance.toLocaleString()}`,
      description: financialSummary.balance >= 0 ? "ganancia neta" : "pérdida neta",
      icon: BarChart3,
      color: financialSummary.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400",
    },
    {
      id: "activeTransactions",
      title: "Transacciones Activas",
      value: financialSummary.totalActive,
      description: "transacciones válidas",
      icon: CreditCard,
    },
    {
      id: "suspendedTransactions",
      title: "Transacciones Suspendidas",
      value: financialSummary.totalSuspended,
      description: "transacciones suspendidas",
      icon: Target,
      color: "text-amber-600 dark:text-amber-400",
    },
    {
      id: "averageIncome",
      title: "Ingreso Promedio",
      value: `$${averageIncome.toFixed(2)}`,
      description: "promedio por transacción de ingreso",
      icon: Calculator,
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      id: "averageExpense",
      title: "Egreso Promedio",
      value: `$${averageExpense.toFixed(2)}`,
      description: "promedio por transacción de egreso",
      icon: Calculator,
      color: "text-red-500 dark:text-red-400",
    }
  ];

  return (
    <CarouselCards 
      cards={cards} 
      title="Estadísticas Financieras"
    />
  );
};

export default FinanceCards;