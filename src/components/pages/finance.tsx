import { useState, useCallback } from "react"
import { DollarSign, TrendingUp, TrendingDown, Plus, Edit3, Trash2, MoreHorizontal } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { FinanceCards } from "../module-cards"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { useUser } from "@clerk/clerk-react"

// Componente para campos con errores (fuera del componente principal)
const FormField = ({ 
  id, 
  label, 
  children, 
  error, 
  required = false 
}: { 
  id: string
  label: string
  children: React.ReactNode
  error?: string
  required?: boolean
}) => (
  <div className="grid gap-2">
    <Label htmlFor={id} className={error ? "text-red-600" : ""}>
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </Label>
    {children}
    {error && (
      <p className="text-sm text-red-600 flex items-center gap-1">
        <span className="text-xs">⚠️</span>
        {error}
      </p>
    )}
  </div>
)

export default function Finance() {
  const { user } = useUser()
  const transactions = useQuery(api.transactions.getActiveTransactions) ?? []
  const financialSummary = useQuery(api.transactions.getFinancialSummary)
  const serviceStats = useQuery(api.transactions.getServiceStats) ?? []
  const categories = useQuery(api.transactions.getCategories)
  const createTransaction = useMutation(api.transactions.createTransaction)
  const updateTransaction = useMutation(api.transactions.updateTransaction)
  const suspendTransaction = useMutation(api.transactions.suspendTransaction)

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    description: "",
    type: "Ingreso" as "Ingreso" | "Egreso",
    category: "",
    amount: "",
    person: user?.firstName || user?.emailAddresses[0]?.emailAddress || "",
    paymentMethod: "Efectivo",
    notes: "",
  })

  // Si financialSummary está cargando, mostrar valores por defecto
  const totalIngresos = financialSummary?.totalIngresos || 0
  const totalEgresos = financialSummary?.totalEgresos || 0
  const gananciaNeta = financialSummary?.balance || 0
  

  const getStatusBadge = (active: boolean) => {
    if (active) {
      return <Badge className="bg-green-100 text-green-800">Activo</Badge>
    } else {
      return <Badge className="bg-gray-100 text-gray-800">Suspendido</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    return type === "Ingreso" 
      ? <Badge className="bg-blue-100 text-blue-800">Ingreso</Badge>
      : <Badge className="bg-red-100 text-red-800">Egreso</Badge>
  }

  const validateTransaction = (transaction: typeof newTransaction) => {
    const newErrors: Record<string, string> = {}

    if (!transaction.description.trim()) {
      newErrors.description = "La descripción es requerida"
    }

    if (!transaction.category) {
      newErrors.category = "La categoría es requerida"
    }

    if (!transaction.amount || parseFloat(transaction.amount) <= 0) {
      newErrors.amount = "El monto debe ser mayor a 0"
    }

    if (transaction.type === "Egreso" && !transaction.person.trim()) {
      newErrors.person = "La persona/responsable es requerida para egresos"
    }

    if (!transaction.date) {
      newErrors.date = "La fecha es requerida"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleAddTransaction = async () => {
    if (!validateTransaction(newTransaction)) {
      return
    }

    setIsLoading(true)
    setErrors({})

    try {
      await createTransaction({
        date: newTransaction.date,
        description: newTransaction.description.trim(),
        type: newTransaction.type,
        category: newTransaction.category,
        amount: parseFloat(newTransaction.amount),
        supplier: newTransaction.person.trim() || undefined,
        paymentMethod: newTransaction.paymentMethod,
        notes: newTransaction.notes.trim() || undefined,
      })

      // Resetear formulario
      setNewTransaction({
        date: new Date().toISOString().split('T')[0],
        description: "",
        type: "Ingreso",
        category: "",
        amount: "",
        person: user?.firstName || user?.emailAddresses[0]?.emailAddress || "",
        paymentMethod: "Efectivo",
        notes: "",
      })
      setIsAddDialogOpen(false)
      setErrors({})
    } catch (error) {
      console.error('Error al crear transacción:', error)
      setErrors({ general: 'Error al guardar la transacción. Inténtalo de nuevo.' })
    } finally {
      setIsLoading(false)
    }
  }

  const resetNewTransaction = () => {
    setNewTransaction({
      date: new Date().toISOString().split('T')[0],
      description: "",
      type: "Ingreso",
      category: "",
      amount: "",
      person: user?.firstName || user?.emailAddresses[0]?.emailAddress || "",
      paymentMethod: "Efectivo",
      notes: "",
    })
    setErrors({})
  }

  // Función para extraer datos de la descripción
  const extractDataFromDescription = (description: string) => {
    // Buscar tanto "Proveedor:" como "Persona:" para compatibilidad
    const personMatch = description.match(/\((Proveedor|Persona): ([^)]+)\)/);
    const paymentMatch = description.match(/- Pago: ([^-]+?)(?:\s*-|$)/);
    const notesMatch = description.match(/- Notas: (.+)$/);
    
    // Limpiar la descripción base removiendo los datos adicionales
    let cleanDescription = description;
    
    // Remover datos adicionales paso a paso para mantener la descripción limpia
    if (personMatch) {
      cleanDescription = cleanDescription.replace(` (${personMatch[1]}: ${personMatch[2]})`, '');
    }
    if (paymentMatch) {
      cleanDescription = cleanDescription.replace(` - Pago: ${paymentMatch[1].trim()}`, '');
    }
    if (notesMatch) {
      cleanDescription = cleanDescription.replace(` - Notas: ${notesMatch[1]}`, '');
    }

    return {
      person: personMatch ? personMatch[2].trim() : "",
      paymentMethod: paymentMatch ? paymentMatch[1].trim() : "Efectivo",
      notes: notesMatch ? notesMatch[1].trim() : "",
      cleanDescription: cleanDescription.trim()
    };
  }

  const handleEditTransaction = (transaction: any) => {
    const extractedData = extractDataFromDescription(transaction.description);
    
    setEditingTransaction({
      ...transaction,
      date: transaction.date.split('T')[0], // Format date for input
      amount: transaction.amount.toString(),
      description: extractedData.cleanDescription,
      person: extractedData.person,
      paymentMethod: extractedData.paymentMethod,
      notes: extractedData.notes,
    })
    setErrors({})
    setIsEditDialogOpen(true)
  }

  const validateEditTransaction = (transaction: any) => {
    const newErrors: Record<string, string> = {}

    if (!transaction.description?.trim()) {
      newErrors.description = "La descripción es requerida"
    }

    if (!transaction.category) {
      newErrors.category = "La categoría es requerida"
    }

    if (!transaction.amount || parseFloat(transaction.amount) <= 0) {
      newErrors.amount = "El monto debe ser mayor a 0"
    }

    if (transaction.type === "Egreso" && !transaction.person?.trim()) {
      newErrors.person = "La persona/responsable es requerida para egresos"
    }

    if (!transaction.date) {
      newErrors.date = "La fecha es requerida"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleUpdateTransaction = async () => {
    if (!editingTransaction || !validateEditTransaction(editingTransaction)) {
      return
    }

    setIsLoading(true)
    setErrors({})

    try {
      await updateTransaction({
        id: editingTransaction._id,
        date: editingTransaction.date,
        description: editingTransaction.description.trim(),
        type: editingTransaction.type,
        category: editingTransaction.category,
        amount: parseFloat(editingTransaction.amount),
        supplier: editingTransaction.person?.trim() || undefined,
        paymentMethod: editingTransaction.paymentMethod,
        notes: editingTransaction.notes?.trim() || undefined,
      })

      setIsEditDialogOpen(false)
      setEditingTransaction(null)
      setErrors({})
    } catch (error) {
      console.error('Error al actualizar transacción:', error)
      setErrors({ general: 'Error al actualizar la transacción. Inténtalo de nuevo.' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuspendTransaction = async (transactionId: string) => {
    try {
      await suspendTransaction({ id: transactionId as any })
    } catch (error) {
      console.error('Error al suspender transacción:', error)
    }
  }

  // Funciones memoizadas para evitar re-renders
  const handleNewTransactionChange = useCallback((field: keyof typeof newTransaction, value: string) => {
    setNewTransaction(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleEditTransactionChange = useCallback((field: string, value: string) => {
    setEditingTransaction((prev: any) => ({ ...prev, [field]: value }))
  }, [])

  return (
    <div className="space-y-6">
      {/* Cards de estadísticas financieras con carousel */}
      <FinanceCards />

      {/* Gráfico de resumen mensual */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Resumen Mensual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-green-800">Total Ingresos</p>
                <p className="text-2xl font-bold text-green-600">${totalIngresos.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
            
            <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-red-800">Total Egresos</p>
                <p className="text-2xl font-bold text-red-600">${totalEgresos.toLocaleString()}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500" />
            </div>
            
            <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-blue-800">Ganancia Neta</p>
                <p className={`text-2xl font-bold ${gananciaNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${gananciaNeta.toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Servicios Más Rentables</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {serviceStats.length > 0 ? (
              serviceStats.map((stat, index) => (
                <div key={index} className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">{stat.service}</p>
                    <p className="text-xs text-muted-foreground">{stat.count} servicios</p>
                  </div>
                  <span className="text-lg font-bold text-green-600">
                    ${stat.total.toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500">
                <p>No hay datos de servicios disponibles</p>
                <p className="text-xs">Los datos aparecerán cuando entregues vehículos</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabla de transacciones */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Transacciones Recientes</CardTitle>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva Transacción
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Agregar Transacción</DialogTitle>
                  <DialogDescription>
                    Registra un nuevo ingreso o egreso de dinero
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {errors.general && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-800 flex items-center gap-2">
                        <span className="text-base">❌</span>
                        {errors.general}
                      </p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField id="date" label="Fecha" required error={errors.date}>
                      <Input
                        id="date"
                        type="date"
                        value={newTransaction.date}
                        onChange={(e) => handleNewTransactionChange('date', e.target.value)}
                        className={errors.date ? "border-red-300 focus:border-red-500" : ""}
                      />
                    </FormField>
                    <FormField id="type" label="Tipo" required>
                      <Select 
                        value={newTransaction.type} 
                        onValueChange={(value) => {
                          setNewTransaction({ 
                            ...newTransaction, 
                            type: value as "Ingreso" | "Egreso",
                            category: "", // Reset category when type changes
                            person: "" // Reset person
                          })
                          // Clear relevant errors
                          const newErrors = { ...errors }
                          delete newErrors.category
                          delete newErrors.person
                          setErrors(newErrors)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ingreso">Ingreso</SelectItem>
                          <SelectItem value="Egreso">Egreso</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                  </div>
                  
                  <FormField id="description" label="Descripción" required error={errors.description}>
                    <Input
                      id="description"
                      value={newTransaction.description}
                      onChange={(e) => handleNewTransactionChange('description', e.target.value)}
                      placeholder="Describe la transacción..."
                      className={errors.description ? "border-red-300 focus:border-red-500" : ""}
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField id="category" label="Categoría" required error={errors.category}>
                      <Select 
                        value={newTransaction.category} 
                        onValueChange={(value) => handleNewTransactionChange('category', value)}
                      >
                        <SelectTrigger className={errors.category ? "border-red-300 focus:border-red-500" : ""}>
                          <SelectValue placeholder="Seleccionar categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories && (
                            newTransaction.type === "Ingreso" 
                              ? categories.income.map((cat) => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))
                              : categories.expense.map((cat) => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))
                          )}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField id="amount" label="Monto" required error={errors.amount}>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={newTransaction.amount}
                        onChange={(e) => handleNewTransactionChange('amount', e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="0.00"
                        className={errors.amount ? "border-red-300 focus:border-red-500" : ""}
                      />
                    </FormField>
                  </div>

                  {newTransaction.type === "Egreso" && (
                    <FormField id="person" label="Persona/Responsable" required error={errors.person}>
                      <Input
                        id="person"
                        value={newTransaction.person}
                        onChange={(e) => handleNewTransactionChange('person', e.target.value)}
                        placeholder="Nombre de la persona responsable"
                        className={errors.person ? "border-red-300 focus:border-red-500" : ""}
                      />
                    </FormField>
                  )}

                  <FormField id="paymentMethod" label="Método de Pago">
                    <Select 
                      value={newTransaction.paymentMethod} 
                      onValueChange={(value) => handleNewTransactionChange('paymentMethod', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Efectivo">Efectivo</SelectItem>
                        <SelectItem value="Transferencia">Transferencia</SelectItem>
                        <SelectItem value="Tarjeta de Débito">Tarjeta de Débito</SelectItem>
                        <SelectItem value="Tarjeta de Crédito">Tarjeta de Crédito</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField id="notes" label="Notas (opcional)">
                    <Textarea
                      id="notes"
                      value={newTransaction.notes}
                      onChange={(e) => handleNewTransactionChange('notes', e.target.value)}
                      placeholder="Información adicional sobre la transacción"
                      rows={3}
                    />
                  </FormField>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">ℹ️ Nota:</span> Los detalles adicionales (persona responsable, método de pago, notas) se incluirán en la descripción de la transacción.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsAddDialogOpen(false)
                      resetNewTransaction()
                    }}
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleAddTransaction} disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Guardando...
                      </>
                    ) : (
                      "Guardar Transacción"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        {/* Dialog de Edición */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Editar Transacción</DialogTitle>
              <DialogDescription>
                Modifica los datos de la transacción
              </DialogDescription>
            </DialogHeader>
            {editingTransaction && (
              <div className="grid gap-4 py-4">
                {errors.general && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800 flex items-center gap-2">
                      <span className="text-base">❌</span>
                      {errors.general}
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField id="edit-date" label="Fecha" required error={errors.date}>
                    <Input
                      id="edit-date"
                      type="date"
                      value={editingTransaction.date}
                      onChange={(e) => handleEditTransactionChange('date', e.target.value)}
                      className={errors.date ? "border-red-300 focus:border-red-500" : ""}
                    />
                  </FormField>
                  <FormField id="edit-type" label="Tipo" required>
                    <Select 
                      value={editingTransaction.type} 
                      onValueChange={(value) => handleEditTransactionChange('type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ingreso">Ingreso</SelectItem>
                        <SelectItem value="Egreso">Egreso</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
                
                <FormField id="edit-description" label="Descripción" required error={errors.description}>
                  <Input
                    id="edit-description"
                    value={editingTransaction.description}
                    onChange={(e) => handleEditTransactionChange('description', e.target.value)}
                    placeholder="Describe la transacción..."
                    className={errors.description ? "border-red-300 focus:border-red-500" : ""}
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField id="edit-category" label="Categoría" required error={errors.category}>
                    <Select 
                      value={editingTransaction.category} 
                      onValueChange={(value) => handleEditTransactionChange('category', value)}
                    >
                      <SelectTrigger className={errors.category ? "border-red-300 focus:border-red-500" : ""}>
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories && (
                          editingTransaction.type === "Ingreso" 
                            ? categories.income.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))
                            : categories.expense.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))
                        )}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField id="edit-amount" label="Monto" required error={errors.amount}>
                    <Input
                      id="edit-amount"
                      type="number"
                      step="0.01"
                      value={editingTransaction.amount}
                      onChange={(e) => handleEditTransactionChange('amount', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0.00"
                      className={errors.amount ? "border-red-300 focus:border-red-500" : ""}
                    />
                  </FormField>
                </div>

                {editingTransaction.type === "Egreso" && (
                  <FormField id="edit-person" label="Persona/Responsable" required error={errors.person}>
                    <Input
                      id="edit-person"
                      value={editingTransaction.person}
                      onChange={(e) => handleEditTransactionChange('person', e.target.value)}
                      placeholder="Nombre de la persona responsable"
                      className={errors.person ? "border-red-300 focus:border-red-500" : ""}
                    />
                  </FormField>
                )}

                <FormField id="edit-paymentMethod" label="Método de Pago">
                  <Select 
                    value={editingTransaction.paymentMethod} 
                    onValueChange={(value) => handleEditTransactionChange('paymentMethod', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Efectivo">Efectivo</SelectItem>
                      <SelectItem value="Transferencia">Transferencia</SelectItem>
                      <SelectItem value="Tarjeta de Débito">Tarjeta de Débito</SelectItem>
                      <SelectItem value="Tarjeta de Crédito">Tarjeta de Crédito</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField id="edit-notes" label="Notas (opcional)">
                  <Textarea
                    id="edit-notes"
                    value={editingTransaction.notes}
                    onChange={(e) => handleEditTransactionChange('notes', e.target.value)}
                    placeholder="Información adicional sobre la transacción"
                    rows={3}
                  />
                </FormField>
              </div>
            )}
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditDialogOpen(false)
                  setEditingTransaction(null)
                  setErrors({})
                }}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button onClick={handleUpdateTransaction} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Detalles</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction._id}>
                    <TableCell>
                      <span className="text-sm">
                        {new Date(transaction.date).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="font-medium text-sm truncate">
                          {extractDataFromDescription(transaction.description).cleanDescription}
                        </p>
                        {transaction.description.includes("Notas:") && (
                          <p className="text-xs text-muted-foreground truncate">
                            📝 {transaction.description.match(/- Notas: (.+)$/)?.[1] || ""}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {transaction.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        {transaction.description.includes("🚗") || transaction.description.includes(" - ") || transaction.description.includes("Proveedor:") ? (
                          <div>
                            {(transaction.description.includes("Proveedor:") || transaction.description.includes("Persona:")) && (
                              <p className="text-xs font-medium text-purple-700">
                                👤 {transaction.description.match(/(Proveedor|Persona): ([^)]+)/)?.[2] || "Persona"}
                              </p>
                            )}
                            {transaction.description.includes("Cliente:") && (
                              <p className="text-xs font-medium text-blue-700">
                                👤 Cliente: {transaction.description.match(/Cliente: ([^-]+)/)?.[1]?.trim() || "Cliente"}
                              </p>
                            )}
                            {transaction.description.includes("Pago:") && (
                              <p className="text-xs text-muted-foreground">
                                💳 {transaction.description.match(/Pago: ([^-]+)/)?.[1]?.trim() || "Efectivo"}
                              </p>
                            )}
                            {transaction.type === "Ingreso" && transaction.description.includes("🚗") && (
                              <p className="text-xs text-muted-foreground">
                                🚗 Servicio de vehículo
                              </p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-gray-500">
                              Transacción general
                            </p>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getTypeBadge(transaction.type)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-medium ${
                        transaction.type === "Ingreso" ? "text-green-600" : "text-red-600"
                      }`}>
                        ${Math.abs(transaction.amount).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(transaction.active !== false)}</TableCell>
                    <TableCell>
                      {!transaction.description.includes("🚗") && !transaction.description.includes("Cliente:") ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditTransaction(transaction)}>
                              <Edit3 className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleSuspendTransaction(transaction._id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Suspender
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <div className="text-xs text-gray-400 text-center">
                          Auto
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      <p>No hay transacciones registradas</p>
                      <p className="text-sm">Las transacciones aparecerán cuando entregues vehículos o agregues gastos</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  )
}