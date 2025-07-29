import React, { useState } from "react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

export interface CardData {
  id: string;
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  borderColor?: string;
  defaultVisible?: boolean;
}

interface CollapsibleCardsProps {
  cards: CardData[];
  title?: string;
  className?: string;
}

export const CollapsibleCards: React.FC<CollapsibleCardsProps> = ({
  cards,
  title,
  className = ""
}) => {
  // Inicializar estado con cards visibles por defecto
  const [visibleCards, setVisibleCards] = useState<Record<string, boolean>>(
    cards.reduce((acc, card) => {
      acc[card.id] = card.defaultVisible ?? true;
      return acc;
    }, {} as Record<string, boolean>)
  );

  const toggleCard = (cardId: string) => {
    setVisibleCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  const visibleCardsList = cards.filter(card => visibleCards[card.id]);

  return (
    <div className={`space-y-4 ${className}`}>
      {title && (
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      )}
      
      {/* Botones de toggle */}
      <div className="flex flex-wrap gap-2">
        {cards.map((card) => {
          const IconComponent = card.icon;
          return (
            <Button
              key={card.id}
              variant={visibleCards[card.id] ? "default" : "outline"}
              size="sm"
              onClick={() => toggleCard(card.id)}
              className="flex items-center gap-2"
            >
              <IconComponent className="h-4 w-4" />
              {card.title}
              <span className="ml-1">
                {visibleCards[card.id] ? "−" : "+"}
              </span>
            </Button>
          );
        })}
      </div>

      {/* Grid de cards visibles */}
      {visibleCardsList.length > 0 && (
        <div className={`grid gap-4 ${
          visibleCardsList.length === 1 ? "md:grid-cols-1" :
          visibleCardsList.length === 2 ? "md:grid-cols-2" :
          "md:grid-cols-3"
        }`}>
          {visibleCardsList.map((card) => {
            const IconComponent = card.icon;
            return (
              <Card
                key={card.id}
                className={`transition-all duration-200 ease-in-out ${
                  card.borderColor || ""
                }`}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {card.title}
                  </CardTitle>
                  <IconComponent 
                    className={`h-4 w-4 ${
                      card.color || "text-muted-foreground"
                    }`} 
                  />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${card.color || ""}`}>
                    {typeof card.value === 'number' 
                      ? card.value.toLocaleString() 
                      : card.value
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {card.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CollapsibleCards;