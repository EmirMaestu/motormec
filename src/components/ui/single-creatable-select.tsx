import React, { useState, useRef, useEffect, useMemo } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

interface SingleCreatableSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options?: string[];
  className?: string;
  disabled?: boolean;
}

export const SingleCreatableSelect: React.FC<SingleCreatableSelectProps> = ({
  value = "",
  onChange,
  placeholder = "Seleccionar o escribir...",
  options = [],
  className,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = useMemo(() => {
    if (inputValue) {
      return options.filter(option => 
        option.toLowerCase().includes(inputValue.toLowerCase())
      );
    } else {
      return options;
    }
  }, [inputValue, options]);

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

  const selectOption = (option: string) => {
    onChange(option);
    setInputValue("");
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      selectOption(inputValue.trim());
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setInputValue("");
    }
  };

  const handleInputClick = () => {
    if (!disabled) {
      setIsOpen(true);
      inputRef.current?.focus();
    }
  };

  const displayValue = value || "";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Input container */}
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
        <div className="flex items-center justify-between">
          {/* Display value or input */}
          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="w-full bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
              autoFocus
            />
          ) : (
            <span className={cn("text-sm", !displayValue && "text-muted-foreground")}>
              {displayValue || placeholder}
            </span>
          )}
          
          {/* Indicador de dropdown */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) {
                setIsOpen(!isOpen);
              }
            }}
            className="flex items-center justify-center p-1 rounded hover:bg-gray-100"
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
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border bg-white shadow-lg animate-in fade-in-0 zoom-in-95">
          <div className="p-1">
            {/* Opción para crear nueva categoría */}
            {inputValue.trim() && !options.some(opt => opt.toLowerCase() === inputValue.toLowerCase()) && (
              <button
                type="button"
                onClick={() => selectOption(inputValue.trim())}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-900 rounded-sm transition-colors duration-150"
              >
                <Plus className="h-4 w-4 text-blue-600" />
                <span>Crear "<strong>{inputValue}</strong>"</span>
              </button>
            )}
            
            {/* Opciones existentes */}
            {filteredOptions.map((option, index) => (
              <button
                key={index}
                type="button"
                onClick={() => selectOption(option)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-900 rounded-sm transition-colors duration-150",
                  value === option && "bg-blue-100 text-blue-900"
                )}
              >
                {option}
              </button>
            ))}
            
            {/* Mensaje cuando no hay opciones */}
            {filteredOptions.length === 0 && !inputValue.trim() && (
              <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                No hay categorías disponibles
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SingleCreatableSelect;