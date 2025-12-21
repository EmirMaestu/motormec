import { useState } from "react";
import { Calendar as CalendarIcon, Check } from "lucide-react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "../../lib/utils";
import { formatDateToDDMMYYYY, formatDateForInput } from "../../lib/dateUtils";

export interface DateRange {
  from: string | null;
  to: string | null;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("custom");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const periods = [
    { label: "Hoy", value: "today" },
    { label: "Ayer", value: "yesterday" },
    { label: "Esta Semana", value: "thisWeek" },
    { label: "Semana Pasada", value: "lastWeek" },
    { label: "Este Mes", value: "thisMonth" },
    { label: "Mes Pasado", value: "lastMonth" },
    { label: "Este Año", value: "thisYear" },
    { label: "Últimos 30 Días", value: "last30Days" },
    { label: "Últimos 90 Días", value: "last90Days" },
  ];

  const getDateRange = (period: string): DateRange => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case "today":
        return {
          from: today.toISOString(),
          to: today.toISOString(),
        };
      case "yesterday": {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          from: yesterday.toISOString(),
          to: yesterday.toISOString(),
        };
      }
      case "thisWeek": {
        const firstDay = new Date(today);
        firstDay.setDate(today.getDate() - today.getDay());
        return {
          from: firstDay.toISOString(),
          to: today.toISOString(),
        };
      }
      case "lastWeek": {
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(today.getDate() - today.getDay() - 1);
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
        return {
          from: lastWeekStart.toISOString(),
          to: lastWeekEnd.toISOString(),
        };
      }
      case "thisMonth": {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          from: firstDay.toISOString(),
          to: today.toISOString(),
        };
      }
      case "lastMonth": {
        const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          from: firstDay.toISOString(),
          to: lastDay.toISOString(),
        };
      }
      case "thisYear": {
        const firstDay = new Date(now.getFullYear(), 0, 1);
        return {
          from: firstDay.toISOString(),
          to: today.toISOString(),
        };
      }
      case "last30Days": {
        const past = new Date(today);
        past.setDate(past.getDate() - 30);
        return {
          from: past.toISOString(),
          to: today.toISOString(),
        };
      }
      case "last90Days": {
        const past = new Date(today);
        past.setDate(past.getDate() - 90);
        return {
          from: past.toISOString(),
          to: today.toISOString(),
        };
      }
      default:
        return { from: null, to: null };
    }
  };

  const handlePeriodSelect = (period: string) => {
    setSelectedPeriod(period);
    if (period !== "custom") {
      const range = getDateRange(period);
      setCustomFrom("");
      setCustomTo("");
      onChange(range);
      setIsOpen(false);
    }
  };

  const handleApplyCustomRange = () => {
    if (customFrom && customTo) {
      onChange({
        from: new Date(customFrom).toISOString(),
        to: new Date(customTo).toISOString(),
      });
      setSelectedPeriod("custom");
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setCustomFrom("");
    setCustomTo("");
  };

  const getDisplayText = () => {
    if (!value.from || !value.to) {
      return "Seleccionar período";
    }

    const period = periods.find((p) => {
      const range = getDateRange(p.value);
      return (
        range.from === value.from &&
        range.to === value.to
      );
    });

    if (period) {
      return period.label;
    }

    return `${formatDateToDDMMYYYY(value.from)} - ${formatDateToDDMMYYYY(value.to)}`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value.from && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {getDisplayText()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-sm mb-2">Períodos rápidos</h3>
            <div className="grid grid-cols-2 gap-2">
              {periods.map((period) => (
                <Button
                  key={period.value}
                  variant={
                    selectedPeriod === period.value ? "default" : "outline"
                  }
                  size="sm"
                  className="justify-start"
                  onClick={() => handlePeriodSelect(period.value)}
                >
                  {selectedPeriod === period.value && (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {period.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t">
            <h3 className="font-semibold text-sm mb-3">Rango personalizado</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">
                  Desde
                </label>
                <input
                  type="date"
                  value={customFrom || (value.from ? formatDateForInput(value.from) : "")}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">
                  Hasta
                </label>
                <input
                  type="date"
                  value={customTo || (value.to ? formatDateForInput(value.to) : "")}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCancel}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleApplyCustomRange}
              disabled={!customFrom || !customTo}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}






