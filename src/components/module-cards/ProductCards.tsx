import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CarouselCards } from "../ui/carousel-cards";
import type { CardData } from "../ui/carousel-cards";
import { 
  Package, 
  AlertTriangle, 
  DollarSign, 
  TrendingUp,
  Archive,
  ShoppingCart
} from "lucide-react";

export const ProductCards: React.FC = () => {
  const products = useQuery(api.products.getProducts) ?? [];
  const lowStockProducts = useQuery(api.products.getLowStockProducts) ?? [];

  const totalProducts = products.length;
  const totalValue = products.reduce((sum, product) => sum + (product.quantity * product.price), 0);
  const outOfStock = products.filter(p => p.quantity === 0).length;
  const averagePrice = products.length > 0 ? totalValue / products.reduce((sum, p) => sum + p.quantity, 0) : 0;
  const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);

  const cards: CardData[] = [
    {
      id: "totalProducts",
      title: "Total Productos",
      value: totalProducts,
      description: "productos en inventario",
      icon: Package,
    },
    {
      id: "lowStock",
      title: "Bajo Stock",
      value: lowStockProducts.length,
      description: "productos requieren atención",
      icon: AlertTriangle,
      color: "text-orange-600",
      borderColor: "border-orange-200",
    },
    {
      id: "totalValue",
      title: "Valor Total",
      value: `$${totalValue.toLocaleString()}`,
      description: "valor del inventario",
      icon: DollarSign,
      color: "text-green-600",
    },
    {
      id: "outOfStock",
      title: "Agotados",
      value: outOfStock,
      description: "productos sin stock",
      icon: Archive,
      color: "text-red-600",
      borderColor: "border-red-200",
    },
    {
      id: "totalQuantity",
      title: "Cantidad Total",
      value: totalQuantity,
      description: "unidades en inventario",
      icon: ShoppingCart,
      color: "text-blue-600",
    },
    {
      id: "averagePrice",
      title: "Precio Promedio",
      value: `$${averagePrice.toFixed(2)}`,
      description: "precio promedio por unidad",
      icon: TrendingUp,
      color: "text-purple-600",
    }
  ];

  return (
    <CarouselCards 
      cards={cards} 
      title="Estadísticas de Inventario"
    />
  );
};

export default ProductCards;