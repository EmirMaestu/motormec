import * as React from "react"

import { cn } from "../../lib/utils"

const Dialog = ({ children, open, onOpenChange }: {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const dialogOpen = open !== undefined ? open : isOpen
  const setDialogOpen = onOpenChange !== undefined ? onOpenChange : setIsOpen

  React.useEffect(() => {
    if (dialogOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [dialogOpen])

  return (
    <DialogContext.Provider value={{ isOpen: dialogOpen, setIsOpen: setDialogOpen }}>
      {children}
    </DialogContext.Provider>
  )
}

const DialogContext = React.createContext<{
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}>({
  isOpen: false,
  setIsOpen: () => {}
})

const DialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean
  }
>(({ className, children, asChild = false, ...props }, ref) => {
  const { setIsOpen } = React.useContext(DialogContext)
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setIsOpen(true)
    props.onClick?.(e)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleClick
    } as any)
  }

  return (
    <button
      ref={ref}
      className={className}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
})
DialogTrigger.displayName = "DialogTrigger"

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { isOpen, setIsOpen } = React.useContext(DialogContext)
  const [isAnimating, setIsAnimating] = React.useState(false)
  const [shouldRender, setShouldRender] = React.useState(false)
  
  React.useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      // Pequeño delay para que el elemento se renderice antes de la animación
      setTimeout(() => setIsAnimating(true), 10)
    } else {
      setIsAnimating(false)
      // Esperar a que termine la animación antes de desmontar
      setTimeout(() => setShouldRender(false), 200)
    }
  }, [isOpen])

  const handleClose = () => {
    setIsOpen(false)
  }
  
  if (!shouldRender) return null

  return (
    <div className={cn(
      "fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto transition-opacity duration-200",
      isAnimating ? "opacity-100" : "opacity-0"
    )}>
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 transition-opacity duration-200",
          isAnimating ? "opacity-100" : "opacity-0"
        )}
        onClick={handleClose}
      />
      <div
        ref={ref}
        className={cn(
          "relative z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg rounded-xl my-8 min-h-fit transition-all duration-200",
          isAnimating ? "scale-100 opacity-100" : "scale-95 opacity-0",
          className
        )}
        {...props}
      >
        <button
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          onClick={handleClose}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
          >
            <path
              d="m11.7816 4.03157c.0824-.08241.0824-.21569 0-.2981-.0824-.08241-.2157-.08241-.2981 0L7.50002 7.70792 3.51852 3.73307c-.08241-.08241-.21569-.08241-.2981 0-.08241.08241-.08241.21569 0 .2981L7.20192 8.00002 3.22002 11.9819c-.08241.0824-.08241.2157 0 .2981.08241.0824.21569.0824.2981 0L7.50002 8.29212l3.98152 3.97538c.0824.0824.2157.0824.2981 0 .0824-.0824.0824-.2157 0-.2981L8.79812 8.00002l3.98148-3.96845Z"
              fill="currentColor"
              fillRule="evenodd"
              clipRule="evenodd"
            />
          </svg>
        </button>
        {children}
      </div>
    </div>
  )
})
DialogContent.displayName = "DialogContent"

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}