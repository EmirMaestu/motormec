import { mutation } from "./_generated/server";

export const seedAllData = mutation({
  args: {},
  handler: async (ctx) => {
    // Limpiar datos existentes
    const existingData = await ctx.db.query("dashboardItems").collect();
    for (const item of existingData) {
      await ctx.db.delete(item._id);
    }

    // Configuración de la aplicación
    await ctx.db.insert("appConfig", {
      companyName: "MotorMec",
      companyDescription: "Sistema de Gestión de Taller",
      copyright: "© 2024 MotorMec - Sistema de Gestión",
    });

    // Menú de navegación
    const navItems = [
      { title: "Dashboard", url: "dashboard", icon: "IconHome", color: "text-blue-600", order: 1, active: true },
      { title: "Stock", url: "stock", icon: "IconPackage", color: "text-green-600", order: 2, active: true },
      { title: "Vehículos", url: "vehiculos", icon: "IconCar", color: "text-purple-600", order: 3, active: true },
      { title: "Socios", url: "socios", icon: "IconUsers", color: "text-orange-600", order: 4, active: true },
      { title: "Finanzas", url: "finanzas", icon: "IconCreditCard", color: "text-red-600", order: 5, active: true },
      { title: "Reportes", url: "reportes", icon: "IconChartBar", color: "text-indigo-600", order: 6, active: true },
      { title: "Diagrama", url: "diagrama", icon: "IconGitBranch", color: "text-pink-600", order: 7, active: true },
    ];
    
    for (const item of navItems) {
      await ctx.db.insert("navigationItems", item);
    }

    // Categorías
    const categories = [
      { name: "Servicios", type: "transaction", active: true },
      { name: "Compras", type: "transaction", active: true },
      { name: "Gastos", type: "transaction", active: true },
      { name: "Equipamiento", type: "transaction", active: true },
      { name: "Otros", type: "transaction", active: true },
      { name: "Fluidos", type: "product", active: true },
      { name: "Filtros", type: "product", active: true },
      { name: "Frenos", type: "product", active: true },
      { name: "Encendido", type: "product", active: true },
      { name: "Herramientas", type: "product", active: true },
      { name: "Ingresado", type: "vehicle_status", active: true },
      { name: "En Reparación", type: "vehicle_status", active: true },
      { name: "Listo", type: "vehicle_status", active: true },
      { name: "Entregado", type: "vehicle_status", active: true },
      { name: "unidades", type: "unit", active: true },
      { name: "litros", type: "unit", active: true },
      { name: "juegos", type: "unit", active: true },
      { name: "metros", type: "unit", active: true },
    ];
    
    for (const category of categories) {
      await ctx.db.insert("categories", category);
    }

    // Productos
    const products = [
      { name: "Aceite Motor 5W-30", quantity: 25, unit: "litros", type: "Fluidos", price: 15.50, reorderPoint: 10, lowStock: false },
      { name: "Filtro de Aire", quantity: 8, unit: "unidades", type: "Filtros", price: 12.30, reorderPoint: 15, lowStock: true },
      { name: "Pastillas de Freno", quantity: 12, unit: "juegos", type: "Frenos", price: 45.80, reorderPoint: 8, lowStock: false },
      { name: "Bujías NGK", quantity: 15, unit: "unidades", type: "Encendido", price: 8.90, reorderPoint: 20, lowStock: true },
      { name: "Liquido de Frenos", quantity: 6, unit: "litros", type: "Fluidos", price: 18.20, reorderPoint: 10, lowStock: true },
    ];
    
    for (const product of products) {
      await ctx.db.insert("products", product);
    }

    // Vehículos
    const vehicles = [
      {
        plate: "ABC-123",
        brand: "Toyota",
        model: "Corolla",
        year: 2018,
        owner: "Juan Pérez",
        phone: "123-456-789",
        status: "En Reparación",
        entryDate: "2024-01-15",
        services: ["Cambio de aceite", "Revisión de frenos"],
        cost: 85.50
      },
      {
        plate: "XYZ-456",
        brand: "Honda",
        model: "Civic",
        year: 2020,
        owner: "María García",
        phone: "987-654-321",
        status: "Listo",
        entryDate: "2024-01-14",
        services: ["Alineación", "Balanceo"],
        cost: 120.00
      },
      {
        plate: "DEF-789",
        brand: "Ford",
        model: "Focus",
        year: 2019,
        owner: "Carlos López",
        phone: "456-789-123",
        status: "Ingresado",
        entryDate: "2024-01-16",
        services: ["Diagnóstico general"],
        cost: 0.00
      },
    ];
    
    for (const vehicle of vehicles) {
      await ctx.db.insert("vehicles", vehicle);
    }

    // Socios
    const partners = [
      {
        name: "Juan Pérez",
        email: "juan@email.com",
        phone: "123-456-789",
        investmentPercentage: 40,
        monthlyContribution: 800,
        totalContributed: 15600,
        joinDate: "2023-01-15",
        active: true
      },
      {
        name: "María García",
        email: "maria@email.com",
        phone: "987-654-321",
        investmentPercentage: 35,
        monthlyContribution: 700,
        totalContributed: 13650,
        joinDate: "2023-02-01",
        active: true
      },
      {
        name: "Carlos López",
        email: "carlos@email.com",
        phone: "456-789-123",
        investmentPercentage: 25,
        monthlyContribution: 500,
        totalContributed: 9750,
        joinDate: "2023-03-15",
        active: true
      },
    ];
    
    for (const partner of partners) {
      await ctx.db.insert("partners", partner);
    }

    // Transacciones
    const transactions = [
      { date: "2024-01-15", description: "Reparación Toyota Corolla", type: "Ingreso" as const, category: "Servicios", amount: 85.50 },
      { date: "2024-01-14", description: "Compra de aceite motor", type: "Egreso" as const, category: "Compras", amount: -120.00 },
      { date: "2024-01-13", description: "Alineación Honda Civic", type: "Ingreso" as const, category: "Servicios", amount: 120.00 },
      { date: "2024-01-12", description: "Filtros de aire", type: "Egreso" as const, category: "Compras", amount: -89.50 },
      { date: "2024-01-11", description: "Cambio de pastillas de freno", type: "Ingreso" as const, category: "Servicios", amount: 145.80 },
    ];
    
    for (const transaction of transactions) {
      await ctx.db.insert("transactions", transaction);
    }

    // Métricas
    const metrics = [
      { name: "Total Revenue", value: "$1,250.00", trend: "up", trendValue: "+12.5%", type: "revenue" },
      { name: "Subscriptions", value: "+2,350", trend: "up", trendValue: "+180.1%", type: "subscriptions" },
      { name: "Sales", value: "+12,234", trend: "up", trendValue: "+19%", type: "sales" },
      { name: "Active Now", value: "+573", trend: "down", trendValue: "-7.2%", type: "active" },
    ];
    
    for (const metric of metrics) {
      await ctx.db.insert("metrics", metric);
    }

    // Datos de gráficos
    const chartData = [
      { chartType: "area", month: "January", desktop: 186, mobile: 80 },
      { chartType: "area", month: "February", desktop: 305, mobile: 200 },
      { chartType: "area", month: "March", desktop: 237, mobile: 120 },
      { chartType: "area", month: "April", desktop: 73, mobile: 190 },
      { chartType: "area", month: "May", desktop: 209, mobile: 130 },
      { chartType: "area", month: "June", desktop: 214, mobile: 140 },
      { chartType: "financial", month: "Ene", ingresos: 2500, egresos: 1800, balance: 700 },
      { chartType: "financial", month: "Feb", ingresos: 2800, egresos: 2100, balance: 700 },
      { chartType: "financial", month: "Mar", ingresos: 3200, egresos: 2400, balance: 800 },
      { chartType: "financial", month: "Abr", ingresos: 2900, egresos: 2200, balance: 700 },
      { chartType: "financial", month: "May", ingresos: 3400, egresos: 2600, balance: 800 },
      { chartType: "financial", month: "Jun", ingresos: 3100, egresos: 2300, balance: 800 },
    ];
    
    for (const data of chartData) {
      await ctx.db.insert("chartData", data);
    }

    // Reportes
    const reports = [
      {
        title: "Productos con Stock Bajo",
        description: "Lista de productos que necesitan reposición inmediata",
        type: "stock",
        lastGenerated: "2024-01-17",
        status: "available"
      },
      {
        title: "Historial de Vehículos por Cliente",
        description: "Registro completo de servicios por cliente",
        type: "vehicles",
        lastGenerated: "2024-01-16",
        status: "available"
      },
      {
        title: "Análisis Financiero Mensual",
        description: "Resumen de ingresos, gastos y utilidades",
        type: "financial",
        lastGenerated: "2024-01-15",
        status: "available"
      },
    ];
    
    for (const report of reports) {
      await ctx.db.insert("reports", report);
    }

    return "Todos los datos han sido poblados correctamente";
  },
});