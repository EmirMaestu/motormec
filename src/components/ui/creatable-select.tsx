import React, { useState, useRef, useEffect, useMemo } from "react";
import { X, Plus, ChevronDown } from "lucide-react";
import { Badge } from "./badge";
import { cn } from "../../lib/utils";

interface CreatableSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  options?: string[];
  className?: string;
  disabled?: boolean;
  onCreateOption?: (option: string) => void; // Callback para crear nueva opción en BD
}

export const CreatableSelect: React.FC<CreatableSelectProps> = ({
  value = [],
  onChange,
  placeholder = "Seleccionar o agregar...",
  options = [],
  className,
  disabled = false,
  onCreateOption, // Nuevo prop
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Servicios predefinidos comunes en talleres
  const defaultOptions = useMemo(() => [
    "Cambio de aceite",
    "Cambio de filtros",
    "Revisión de frenos",
    "Alineación",
    "Balanceado",
    "Cambio de llantas",
    "Revisión de motor",
    "Cambio de bujías",
    "Revisión eléctrica",
    "Cambio de batería",
    "Revisión de suspensión",
    "Cambio de amortiguadores",
    "Mantenimiento general",
    "Diagnóstico",
    "Reparación de transmisión",
    "Cambio de embrague",
    "Reparación de aire acondicionado",
    "Cambio de correa de distribución",
    "Revisión de escape",
    "Cambio de pastillas de freno"
  ], []);

  const allOptions = useMemo(() => {
    // Eliminar duplicados y combinar opciones de BD con las predefinidas
    const combined = [...options, ...defaultOptions];
    return Array.from(new Set(combined));
  }, [defaultOptions, options]);

  const filteredOptions = useMemo(() => {
    if (inputValue) {
      return allOptions.filter(option => 
        option.toLowerCase().includes(inputValue.toLowerCase()) &&
        !value.includes(option)
      );
    } else {
      return allOptions.filter(option => !value.includes(option));
    }
  }, [inputValue, value, allOptions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setInputValue("");
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        setInputValue("");
      }
    };

    if (isOpen) {
      // Usar una pequeña demora para evitar conflictos inmediatos
      setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscapeKey);
      }, 100);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isOpen]);

  const addService = (service: string) => {
    if (service.trim() && !value.includes(service.trim())) {
      const trimmedService = service.trim();
      
      // Si hay un callback para crear la opción en BD, llamarlo
      if (onCreateOption && !allOptions.some(opt => opt.toLowerCase() === trimmedService.toLowerCase())) {
        onCreateOption(trimmedService);
      }
      
      onChange([...value, trimmedService]);
      setInputValue("");
      setIsOpen(false);
    }
  };

  const removeService = (serviceToRemove: string) => {
    onChange(value.filter(service => service !== serviceToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      addService(inputValue);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleInputClick = () => {
    if (!disabled) {
      setIsOpen(true);
      inputRef.current?.focus();
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Input container con badges */}
      <div 
        className={cn(
          "min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          "cursor-text transition-all duration-200",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
        onClick={handleInputClick}
      >
        <div className="flex flex-wrap gap-1 items-center">
          {/* Badges de servicios seleccionados */}
          {value.map((service, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors duration-150"
            >
              <span className="text-xs">{service}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeService(service);
                  }}
                  className="ml-1 hover:bg-gray-300 dark:hover:bg-zinc-500 rounded-full p-0.5 transition-colors duration-150"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          
          {/* Input para agregar nuevos servicios */}
          <div className="flex-1 min-w-20">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={value.length === 0 ? placeholder : ""}
              disabled={disabled}
              className="w-full bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
            />
          </div>
          
          {/* Indicador de dropdown */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) {
                setIsOpen(!isOpen);
              }
            }}
            className="flex items-center justify-center p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700"
          >
            <ChevronDown 
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )} 
            />
          </button>
        </div>
      </div>

      {/* Dropdown con opciones */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg dark:shadow-zinc-950/50 animate-in fade-in-0 zoom-in-95">
            <div className="p-1">
              {/* Opción para crear nuevo servicio */}
              {inputValue.trim() && !allOptions.some(opt => opt.toLowerCase() === inputValue.toLowerCase()) && (
                <button
                  type="button"
                  onClick={() => addService(inputValue)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-sm transition-colors duration-150"
                >
                  <Plus className="h-4 w-4 text-gray-600 dark:text-zinc-400" />
                  <span>Crear "<strong>{inputValue}</strong>"</span>
                </button>
              )}
              
              {/* Opciones existentes */}
              {filteredOptions.map((option, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => addService(option)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-sm transition-colors duration-150"
                >
                  {option}
                </button>
              ))}
              
              {/* Mensaje cuando no hay opciones */}
              {filteredOptions.length === 0 && !inputValue.trim() && (
                <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                  No hay más servicios disponibles
                </div>
              )}
            </div>
        </div>
      )}
    </div>
  );
};

export default CreatableSelect;