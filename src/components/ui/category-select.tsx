import { useState, useRef, useEffect } from "react"
import { Check, ChevronDown, Plus } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Input } from "./input"

interface CategorySelectProps {
  value: string
  onValueChange: (value: string) => void
  options: string[]
  placeholder?: string
  className?: string
  createLabel?: string
  emptyLabel?: string
}

export function CategorySelect({
  value,
  onValueChange,
  options,
  placeholder = "Seleccionar categoría...",
  className,
  createLabel = "Crear",
  emptyLabel = "No se encontraron categorías"
}: CategorySelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [newCategory, setNewCategory] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(search.toLowerCase())
  )

  const canCreate = search.trim() && !options.some(option => 
    option.toLowerCase() === search.trim().toLowerCase()
  )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  const handleCreate = () => {
    if (newCategory.trim()) {
      onValueChange(newCategory.trim())
      setNewCategory("")
      setOpen(false)
      setSearch("")
    }
  }

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue)
    setOpen(false)
    setSearch("")
  }

  const handleCreateFromSearch = () => {
    onValueChange(search.trim())
    setOpen(false)
    setSearch("")
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn("justify-between w-full", className)}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")} />
      </Button>
      
      {open && (
        <div className="absolute z-[9999] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-hidden min-w-full">
          <div className="border-b p-2">
            <Input
              placeholder="Buscar o crear categoría..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
            />
          </div>
          
          <div className="max-h-60 overflow-y-auto">
            {/* Opción para crear nueva categoría desde búsqueda */}
            {canCreate && (
              <div className="border-b">
                <button
                  onClick={handleCreateFromSearch}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-900 transition-colors"
                >
                  <Plus className="h-4 w-4 text-blue-600" />
                  <span>Crear "<strong>{search.trim()}</strong>"</span>
                </button>
              </div>
            )}
            
            {/* Opciones existentes */}
            {filteredOptions.length > 0 ? (
              <div className="py-1">
                {filteredOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleSelect(option)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-900 transition-colors text-left",
                      value === option && "bg-blue-100 text-blue-900"
                    )}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === option ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              !canCreate && (
                <div className="p-4 text-center text-sm text-gray-500">
                  {emptyLabel}
                </div>
              )
            )}
          </div>
          
          {/* Formulario para crear categoría personalizada */}
          <div className="border-t p-3">
            <div className="text-xs font-medium text-gray-600 mb-2">
              O crear una nueva:
            </div>
            <div className="flex gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Nueva categoría"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleCreate()
                  }
                }}
                className="h-8 text-sm flex-1"
              />
              <Button size="sm" onClick={handleCreate} disabled={!newCategory.trim()}>
                {createLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}