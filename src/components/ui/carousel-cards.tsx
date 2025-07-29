import React, { useState } from "react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

export interface CardData {
  id: string;
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  borderColor?: string;
}

interface CarouselCardsProps {
  cards: CardData[];
  title?: string;
  className?: string;
}

export const CarouselCards: React.FC<CarouselCardsProps> = ({
  cards,
  title,
  className = ""
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Configuración responsive
  const getVisibleCards = () => {
    // En móvil: 1 card, en tablet: 2 cards, en desktop: 3 cards
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 768) return 1;  // móvil
      if (window.innerWidth < 1024) return 2; // tablet
      return 3; // desktop
    }
    return 3; // fallback para SSR
  };

  const [visibleCards, setVisibleCards] = useState(getVisibleCards());

  // Actualizar visibleCards en resize
  React.useEffect(() => {
    const handleResize = () => {
      setVisibleCards(getVisibleCards());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const maxIndex = Math.max(0, cards.length - visibleCards);

  const nextSlide = () => {
    setCurrentIndex(prev => Math.min(prev + 1, maxIndex));
  };

  const prevSlide = () => {
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(Math.min(index, maxIndex));
  };

  if (cards.length === 0) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {title && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          
          {/* Controles de navegación - Solo mostrar si hay más cards que las visibles */}
          {cards.length > visibleCards && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={prevSlide}
                disabled={currentIndex === 0}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              {/* Indicadores de página */}
              <div className="flex gap-1">
                {Array.from({ length: maxIndex + 1 }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => goToSlide(i)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-colors",
                      currentIndex === i 
                        ? "bg-blue-600" 
                        : "bg-gray-300 hover:bg-gray-400"
                    )}
                  />
                ))}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={nextSlide}
                disabled={currentIndex === maxIndex}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Carousel Container */}
      <div className="relative overflow-hidden">
        <div 
          className="flex transition-transform duration-300 ease-in-out"
          style={{
            transform: `translateX(-${currentIndex * (100 / visibleCards)}%)`
          }}
        >
          {cards.map((card) => {
            const IconComponent = card.icon;
            return (
              <div
                key={card.id}
                className={cn(
                  "flex-shrink-0 px-2",
                  // Responsive widths
                  "w-full", // móvil: 100%
                  "md:w-1/2", // tablet: 50%
                  "lg:w-1/3" // desktop: 33.333%
                )}
              >
                <Card
                  className={cn(
                    "h-full transition-all duration-200 ease-in-out hover:shadow-md",
                    card.borderColor || ""
                  )}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {card.title}
                    </CardTitle>
                    <IconComponent 
                      className={cn(
                        "h-4 w-4",
                        card.color || "text-muted-foreground"
                      )} 
                    />
                  </CardHeader>
                  <CardContent>
                    <div className={cn("text-2xl font-bold", card.color || "")}>
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Navegación por teclado */}
      <div className="sr-only">
        <p>
          Carousel con {cards.length} elementos. 
          Mostrando {Math.min(visibleCards, cards.length)} de {cards.length}.
          Página {currentIndex + 1} de {maxIndex + 1}.
        </p>
      </div>

    </div>
  );
};

export default CarouselCards;