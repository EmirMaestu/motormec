import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "../../lib/utils"

interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>
}

const SelectContext = React.createContext<SelectContextValue>({
  value: "",
  onValueChange: () => {},
  isOpen: false,
  setIsOpen: () => {},
  triggerRef: { current: null },
})

const Select = ({
  children,
  onValueChange,
  value
}: {
  children: React.ReactNode
  onValueChange?: (value: string) => void
  value?: string
}) => {
  const [selectedValue, setSelectedValue] = React.useState(value || "")
  const [isOpen, setIsOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  // Sync internal state when controlled value changes
  React.useEffect(() => {
    if (value !== undefined) setSelectedValue(value)
  }, [value])

  const handleValueChange = (newValue: string) => {
    setSelectedValue(newValue)
    onValueChange?.(newValue)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <SelectContext.Provider value={{
        value: selectedValue,
        onValueChange: handleValueChange,
        isOpen,
        setIsOpen,
        triggerRef,
      }}>
        {children}
      </SelectContext.Provider>
    </div>
  )
}

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { isOpen, setIsOpen, triggerRef } = React.useContext(SelectContext)

  // Combine external ref and internal triggerRef
  const setRefs = React.useCallback(
    (el: HTMLButtonElement | null) => {
      (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = el
      if (typeof ref === "function") ref(el)
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el
    },
    [ref, triggerRef]
  )

  return (
    <button
      ref={setRefs}
      type="button"
      role="combobox"
      aria-expanded={isOpen}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 ease-in-out hover:border-gray-400 focus:border-gray-500",
        className
      )}
      onClick={() => setIsOpen(!isOpen)}
      {...props}
    >
      {children}
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          "h-4 w-4 opacity-50 transition-transform duration-200 ease-in-out flex-shrink-0 ml-1",
          isOpen && "rotate-180"
        )}
      >
        <path
          d="m4.93179 5.43179c.20464-.20464.53667-.20464.74131 0L7.5 7.25893l1.8269-1.82714c.2046-.20464.5367-.20464.7413 0 .2047.20464.2047.53666 0 .74131L8.24131 8.06821c-.20464.20464-.53667.20464-.74131 0L5.67289 6.24131c-.20464-.20465-.20464-.53667 0-.74131Z"
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </svg>
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & {
    placeholder?: string
  }
>(({ className, placeholder, ...props }, ref) => {
  const { value } = React.useContext(SelectContext)

  return (
    <span
      ref={ref}
      className={cn("flex-1 truncate text-left", value ? "" : "text-muted-foreground", className)}
      {...props}
    >
      {value || placeholder}
    </span>
  )
})
SelectValue.displayName = "SelectValue"

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { isOpen, setIsOpen, triggerRef } = React.useContext(SelectContext)
  const [shouldRender, setShouldRender] = React.useState(false)
  const [coords, setCoords] = React.useState({ top: 0, left: 0, width: 0 })

  React.useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      // Calculate position from trigger's bounding rect
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        setCoords({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        })
      }
    } else {
      const timer = setTimeout(() => setShouldRender(false), 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen, triggerRef])

  if (!shouldRender) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={() => setIsOpen(false)}
      />

      {/* Content — rendered at fixed position above everything */}
      <div
        ref={ref}
        style={{
          position: "fixed",
          top: coords.top,
          left: coords.left,
          width: coords.width,
          zIndex: 9999,
        }}
        className={cn(
          "max-h-80 overflow-hidden rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg dark:shadow-zinc-950/50 transition-all duration-200 ease-out",
          isOpen
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 -translate-y-2",
          className
        )}
        {...props}
      >
        <div className="p-1 max-h-72 overflow-y-auto">
          {children}
        </div>
      </div>
    </>,
    document.body
  )
})
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    value: string
  }
>(({ className, children, value, ...props }, ref) => {
  const { onValueChange, value: selectedValue } = React.useContext(SelectContext)
  const isSelected = selectedValue === value

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-3 pr-2 text-sm outline-none transition-all duration-150 ease-in-out",
        "hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-gray-900 dark:hover:text-zinc-100 active:bg-gray-200 dark:active:bg-zinc-600",
        isSelected && "bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 font-medium",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      onClick={() => onValueChange(value)}
      {...props}
    >
      {isSelected && (
        <div className="absolute left-1 flex h-4 w-4 items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-gray-900 dark:bg-zinc-100 transition-all duration-150" />
        </div>
      )}
      <span className={cn("transition-all duration-150", isSelected && "ml-4")}>
        {children}
      </span>
    </div>
  )
})
SelectItem.displayName = "SelectItem"

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
}
