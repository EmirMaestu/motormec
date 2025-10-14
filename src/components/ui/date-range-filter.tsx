import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Button } from "./button"
import { Input } from "./input"
import { Label } from "./label"
import { Badge } from "./badge"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { 
  Calendar as CalendarIcon, 
  Filter,
  Clock,
  CalendarDays,
  X,
  Check
} from "lucide-react"

export interface DateRangeValue {
  type: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'last30Days' | 'last90Days' | 'custom'
  startDate?: string
  endDate?: string
  label?: string
}

interface DateRangeFilterProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  className?: string
  showPresets?: boolean
  compact?: boolean
}

const DATE_PRESETS = [
  { 
    type: 'today' as const, 
    label: 'Hoy',
    icon: Clock,
    getDateRange: () => {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      return { startDate: todayStr, endDate: todayStr }
    }
  },
  { 
    type: 'yesterday' as const, 
    label: 'Ayer',
    icon: Clock,
    getDateRange: () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]
      return { startDate: yesterdayStr, endDate: yesterdayStr }
    }
  },
  { 
    type: 'thisWeek' as const, 
    label: 'Esta Semana',
    icon: CalendarDays,
    getDateRange: () => {
      const now = new Date()
      const monday = new Date(now)
      monday.setDate(now.getDate() - now.getDay() + 1)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return { 
        startDate: monday.toISOString().split('T')[0], 
        endDate: sunday.toISOString().split('T')[0] 
      }
    }
  },
  { 
    type: 'lastWeek' as const, 
    label: 'Semana Pasada',
    icon: CalendarDays,
    getDateRange: () => {
      const now = new Date()
      const lastMonday = new Date(now)
      lastMonday.setDate(now.getDate() - now.getDay() - 6)
      const lastSunday = new Date(lastMonday)
      lastSunday.setDate(lastMonday.getDate() + 6)
      return { 
        startDate: lastMonday.toISOString().split('T')[0], 
        endDate: lastSunday.toISOString().split('T')[0] 
      }
    }
  },
  { 
    type: 'thisMonth' as const, 
    label: 'Este Mes',
    icon: CalendarIcon,
    getDateRange: () => {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { 
        startDate: firstDay.toISOString().split('T')[0], 
        endDate: lastDay.toISOString().split('T')[0] 
      }
    }
  },
  { 
    type: 'lastMonth' as const, 
    label: 'Mes Pasado',
    icon: CalendarIcon,
    getDateRange: () => {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
      return { 
        startDate: firstDay.toISOString().split('T')[0], 
        endDate: lastDay.toISOString().split('T')[0] 
      }
    }
  },
  { 
    type: 'thisYear' as const, 
    label: 'Este Año',
    icon: CalendarIcon,
    getDateRange: () => {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), 0, 1)
      const lastDay = new Date(now.getFullYear(), 11, 31)
      return { 
        startDate: firstDay.toISOString().split('T')[0], 
        endDate: lastDay.toISOString().split('T')[0] 
      }
    }
  },
  { 
    type: 'last30Days' as const, 
    label: 'Últimos 30 Días',
    icon: CalendarDays,
    getDateRange: () => {
      const now = new Date()
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(now.getDate() - 30)
      return { 
        startDate: thirtyDaysAgo.toISOString().split('T')[0], 
        endDate: now.toISOString().split('T')[0] 
      }
    }
  },
  { 
    type: 'last90Days' as const, 
    label: 'Últimos 90 Días',
    icon: CalendarDays,
    getDateRange: () => {
      const now = new Date()
      const ninetyDaysAgo = new Date(now)
      ninetyDaysAgo.setDate(now.getDate() - 90)
      return { 
        startDate: ninetyDaysAgo.toISOString().split('T')[0], 
        endDate: now.toISOString().split('T')[0] 
      }
    }
  }
]

export default function DateRangeFilter({ 
  value, 
  onChange, 
  className = "",
  showPresets = true,
  compact = false 
}: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customStartDate, setCustomStartDate] = useState(value.startDate || "")
  const [customEndDate, setCustomEndDate] = useState(value.endDate || "")

  const getCurrentLabel = () => {
    if (value.type === 'custom') {
      if (value.startDate && value.endDate) {
        const start = new Date(value.startDate).toLocaleDateString('es-ES')
        const end = new Date(value.endDate).toLocaleDateString('es-ES')
        return `${start} - ${end}`
      }
      return "Personalizado"
    }
    
    const preset = DATE_PRESETS.find(p => p.type === value.type)
    return preset?.label || "Seleccionar periodo"
  }

  const handlePresetSelect = (preset: typeof DATE_PRESETS[0]) => {
    const dateRange = preset.getDateRange()
    onChange({
      type: preset.type,
      ...dateRange,
      label: preset.label
    })
    setIsOpen(false)
  }

  const handleCustomApply = () => {
    if (customStartDate && customEndDate) {
      onChange({
        type: 'custom',
        startDate: customStartDate,
        endDate: customEndDate,
        label: 'Personalizado'
      })
      setIsOpen(false)
    }
  }

  const handleClear = () => {
    onChange({
      type: 'thisMonth',
      ...DATE_PRESETS.find(p => p.type === 'thisMonth')!.getDateRange(),
      label: 'Este Mes'
    })
  }

  if (compact) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={`justify-between ${className}`}>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="truncate">{getCurrentLabel()}</span>
            </div>
            <CalendarIcon className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-72 sm:w-80 p-0 max-h-[70vh] overflow-y-auto" 
          align="start"
          side="bottom"
          sideOffset={4}
          avoidCollisions={true}
          collisionPadding={16}
          collisionBoundary={document.querySelector('body')}
        >
          <div className="p-3 space-y-3">
            {/* Presets */}
            {showPresets && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-600">Periodos rápidos</Label>
                <div className="grid grid-cols-2 gap-1">
                  {DATE_PRESETS.map((preset) => {
                    const Icon = preset.icon
                    return (
                      <Button
                        key={preset.type}
                        variant={value.type === preset.type ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handlePresetSelect(preset)}
                        className="justify-start h-8 text-xs px-2"
                      >
                        <Icon className="h-3 w-3 mr-1" />
                        <span className="truncate">{preset.label}</span>
                        {value.type === preset.type && (
                          <Check className="h-3 w-3 ml-auto flex-shrink-0" />
                        )}
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Custom range */}
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs font-medium text-gray-600">Rango personalizado</Label>
              <div className="grid gap-2">
                <div>
                  <Label htmlFor="start-date" className="text-xs text-gray-500">Desde</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date" className="text-xs text-gray-500">Hasta</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsOpen(false)}
                  className="flex-1 h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleCustomApply}
                  disabled={!customStartDate || !customEndDate}
                  className="flex-1 h-8 text-xs"
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5 text-blue-600" />
            Filtro de Fechas
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-normal">
              {getCurrentLabel()}
            </Badge>
            {value.type !== 'thisMonth' && (
              <Button variant="ghost" size="sm" onClick={handleClear}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Presets */}
        {showPresets && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Periodos rápidos</Label>
            <div className="grid gap-2 md:grid-cols-3">
              {DATE_PRESETS.map((preset) => {
                const Icon = preset.icon
                return (
                  <Button
                    key={preset.type}
                    variant={value.type === preset.type ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePresetSelect(preset)}
                    className="justify-start"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {preset.label}
                  </Button>
                )
              })}
            </div>
          </div>
        )}

        {/* Custom range */}
        <div className="space-y-3 border-t pt-4">
          <Label className="text-sm font-medium">Rango personalizado</Label>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="custom-start" className="text-xs text-gray-500">Fecha desde</Label>
              <Input
                id="custom-start"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="custom-end" className="text-xs text-gray-500">Fecha hasta</Label>
              <Input
                id="custom-end"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
            </div>
          </div>
          <Button 
            onClick={handleCustomApply}
            disabled={!customStartDate || !customEndDate}
            className="w-full"
          >
            <Check className="h-4 w-4 mr-2" />
            Aplicar Rango Personalizado
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}