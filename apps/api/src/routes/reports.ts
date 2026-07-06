import type { FastifyInstance } from "fastify";
import { and, eq, gte, lte } from "drizzle-orm";
import {
  customers,
  partners,
  products,
  inventoryMovements,
  transactions,
  vehicles,
} from "../db/schema.js";
import { authed, requireAuth, requireRole } from "../auth/middleware.js";
import { argMonth } from "../lib/time.js";
import { env } from "../config/env.js";

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  // ---- Financial ----
  app.get("/api/reports/financial", {
    preHandler: requireRole("admin"),
    config: { rateLimit: { max: env.NODE_ENV === "production" ? 20 : 100000, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const q = request.query as {
      startDate?: string;
      endDate?: string;
      category?: string;
      paymentMethod?: string;
    };
    const conds = [eq(transactions.active, true)];
    if (q.startDate) conds.push(gte(transactions.date, q.startDate));
    if (q.endDate) conds.push(lte(transactions.date, q.endDate));
    if (q.category) conds.push(eq(transactions.category, q.category));
    if (q.paymentMethod) conds.push(eq(transactions.paymentMethod, q.paymentMethod));
    const rows = await tenantDb.select(transactions, and(...conds) as ReturnType<typeof and>);

    const ingresos = rows.filter((t) => t.type === "Ingreso").reduce((s, t) => s + t.amount, 0);
    const egresos = rows.filter((t) => t.type === "Egreso").reduce((s, t) => s + Math.abs(t.amount), 0);
    const ingresoCount = rows.filter((t) => t.type === "Ingreso").length;

    const porCategoria = new Map<string, { ingresos: number; egresos: number; count: number }>();
    const porMetodoPago = new Map<string, { total: number; count: number }>();
    const tendencia = new Map<string, { ingresos: number; egresos: number }>();
    for (const t of rows) {
      const c = porCategoria.get(t.category) ?? { ingresos: 0, egresos: 0, count: 0 };
      if (t.type === "Ingreso") c.ingresos += t.amount;
      else c.egresos += Math.abs(t.amount);
      c.count += 1;
      porCategoria.set(t.category, c);

      const m = t.paymentMethod || "No especificado";
      const pm = porMetodoPago.get(m) ?? { total: 0, count: 0 };
      pm.total += t.amount;
      pm.count += 1;
      porMetodoPago.set(m, pm);

      const mes = t.date.substring(0, 7);
      const tm = tendencia.get(mes) ?? { ingresos: 0, egresos: 0 };
      if (t.type === "Ingreso") tm.ingresos += t.amount;
      else tm.egresos += Math.abs(t.amount);
      tendencia.set(mes, tm);
    }

    return reply.send({
      resumen: {
        ingresos,
        egresos,
        balance: ingresos - egresos,
        cantidadTransacciones: rows.length,
        ticketPromedio: ingresoCount ? ingresos / ingresoCount : 0,
      },
      porCategoria: [...porCategoria.entries()].map(([categoria, v]) => ({ categoria, ...v })),
      porMetodoPago: [...porMetodoPago.entries()].map(([metodo, v]) => ({ metodo, ...v })),
      tendenciaMensual: [...tendencia.entries()]
        .map(([mes, v]) => ({ mes, ...v, balance: v.ingresos - v.egresos }))
        .sort((a, b) => (a.mes < b.mes ? -1 : 1)),
    });
  });

  // ---- Customers ----
  app.get("/api/reports/customers", {
    preHandler: requireRole("admin"),
    config: { rateLimit: { max: env.NODE_ENV === "production" ? 20 : 100000, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const q = request.query as { startDate?: string; endDate?: string; customerId?: string };
    let active = await tenantDb.select(customers, eq(customers.active, true));
    if (q.customerId) active = active.filter((c) => c.id === q.customerId);

    const result = [];
    for (const c of active) {
      let cv = await tenantDb.select(vehicles, eq(vehicles.customerId, c.id));
      if (q.startDate) cv = cv.filter((v) => v.entryDate >= q.startDate!);
      if (q.endDate) cv = cv.filter((v) => v.entryDate <= q.endDate!);
      const serviceCounts = new Map<string, number>();
      for (const v of cv) for (const s of v.services) serviceCounts.set(s, (serviceCounts.get(s) ?? 0) + 1);
      result.push({
        ...c,
        totalGastado: cv.reduce((s, v) => s + (v.cost ?? 0), 0),
        cantidadVehiculos: cv.length,
        vehiculosEntregados: cv.filter((v) => v.status === "Entregado").length,
        vehiculosEnTaller: cv.filter((v) => v.inTaller).length,
        serviciosMasFrecuentes: [...serviceCounts.entries()]
          .map(([servicio, count]) => ({ servicio, count }))
          .sort((a, b) => b.count - a.count),
        vehiculos: cv,
      });
    }
    result.sort((a, b) => b.totalGastado - a.totalGastado);
    const ingresosTotal = result.reduce((s, c) => s + c.totalGastado, 0);
    return reply.send({
      clientes: result,
      resumen: {
        totalClientes: result.length,
        ingresosTotal,
        promedioPorCliente: result.length ? ingresosTotal / result.length : 0,
        clientesActivos: result.filter((c) => c.vehiculosEnTaller > 0).length,
      },
    });
  });

  // ---- Inventory ----
  app.get("/api/reports/inventory", {
    preHandler: requireRole("admin"),
    config: { rateLimit: { max: env.NODE_ENV === "production" ? 20 : 100000, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const q = request.query as { startDate?: string; endDate?: string; productType?: string };
    const prods = await tenantDb.select(products);
    let movs = await tenantDb.select(inventoryMovements);
    if (q.startDate) movs = movs.filter((m) => m.timestamp >= q.startDate!);
    if (q.endDate) movs = movs.filter((m) => m.timestamp <= q.endDate!);
    if (q.productType) movs = movs.filter((m) => m.productType === q.productType);

    const porTipo = new Map<string, { count: number; productos: Set<string> }>();
    for (const m of movs) {
      const e = porTipo.get(m.movementType) ?? { count: 0, productos: new Set<string>() };
      e.count += 1;
      e.productos.add(m.productName);
      porTipo.set(m.movementType, e);
    }
    const utilizados = new Map<string, { cantidad: number; veces: number }>();
    for (const m of movs.filter((x) => x.movementType === "stock_decrease")) {
      const e = utilizados.get(m.productName) ?? { cantidad: 0, veces: 0 };
      e.cantidad += Math.abs(m.quantityChange ?? 0);
      e.veces += 1;
      utilizados.set(m.productName, e);
    }
    return reply.send({
      resumen: {
        totalProductos: prods.length,
        valorTotalInventario: prods.reduce((s, p) => s + p.price * p.quantity, 0),
        productosBajoStock: prods.filter((p) => p.lowStock).length,
        productosSinStock: prods.filter((p) => p.quantity === 0).length,
        totalMovimientos: movs.length,
      },
      movimientosPorTipo: [...porTipo.entries()].map(([tipo, v]) => ({
        tipo,
        count: v.count,
        productosUnicos: v.productos.size,
      })),
      productosUtilizados: [...utilizados.entries()]
        .map(([nombre, v]) => ({ nombre, ...v }))
        .sort((a, b) => b.cantidad - a.cantidad),
    });
  });

  // ---- Mechanics ----
  app.get("/api/reports/mechanics", {
    preHandler: requireRole("admin"),
    config: { rateLimit: { max: env.NODE_ENV === "production" ? 20 : 100000, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const all = await tenantDb.select(vehicles);
    const map = new Map<
      string,
      { userId: string; nombre: string; vehiculos: Set<string>; tiempoTotal: number; sesionesTotal: number; ingresosGenerados: number }
    >();
    for (const v of all) {
      const resp = v.responsibles ?? [];
      for (const r of resp) {
        const key = r.userId ?? r.name;
        const e = map.get(key) ?? {
          userId: r.userId ?? "",
          nombre: r.name,
          vehiculos: new Set<string>(),
          tiempoTotal: 0,
          sesionesTotal: 0,
          ingresosGenerados: 0,
        };
        e.vehiculos.add(v.id);
        e.tiempoTotal += r.totalWorkTime ?? 0;
        e.sesionesTotal += (r.workSessions ?? []).length;
        if (v.status === "Entregado" && resp.length > 0) {
          e.ingresosGenerados += (v.cost ?? 0) / resp.length;
        }
        map.set(key, e);
      }
    }
    const mecanicos = [...map.values()]
      .map((m) => ({
        userId: m.userId,
        nombre: m.nombre,
        vehiculosAtendidos: m.vehiculos.size,
        tiempoTotal: m.tiempoTotal,
        sesionesTotal: m.sesionesTotal,
        ingresosGenerados: m.ingresosGenerados,
        tiempoPromedio: m.vehiculos.size ? m.tiempoTotal / m.vehiculos.size : 0,
      }))
      .sort((a, b) => b.ingresosGenerados - a.ingresosGenerados);
    return reply.send({
      mecanicos,
      resumen: {
        totalMecanicos: mecanicos.length,
        tiempoTotalTrabajado: mecanicos.reduce((s, m) => s + m.tiempoTotal, 0),
        ingresosTotales: mecanicos.reduce((s, m) => s + m.ingresosGenerados, 0),
      },
    });
  });

  // ---- Partners ----
  app.get("/api/reports/partners", {
    preHandler: requireRole("admin"),
    config: { rateLimit: { max: env.NODE_ENV === "production" ? 20 : 100000, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const q = request.query as { startDate?: string; endDate?: string };
    const socios = await tenantDb.select(partners, eq(partners.active, true));
    const conds = [eq(transactions.active, true)];
    if (q.startDate) conds.push(gte(transactions.date, q.startDate));
    if (q.endDate) conds.push(lte(transactions.date, q.endDate));
    const txs = await tenantDb.select(transactions, and(...conds) as ReturnType<typeof and>);
    const ingresos = txs.filter((t) => t.type === "Ingreso").reduce((s, t) => s + t.amount, 0);
    const egresos = txs.filter((t) => t.type === "Egreso").reduce((s, t) => s + Math.abs(t.amount), 0);
    const ganancias = ingresos - egresos;
    return reply.send({
      socios: socios.map((s) => ({
        ...s,
        gananciaPeriodo: (ganancias * s.investmentPercentage) / 100,
        porcentajeInversion: s.investmentPercentage,
      })),
      resumen: {
        totalSocios: socios.length,
        inversionTotal: socios.reduce((s, p) => s + p.totalContributed, 0),
        gananciasPeriodo: ganancias,
        ingresosPeriodo: ingresos,
        egresosPeriodo: egresos,
      },
    });
  });

  // ---- Operational ----
  app.get("/api/reports/operational", {
    preHandler: requireRole("admin"),
    config: { rateLimit: { max: env.NODE_ENV === "production" ? 20 : 100000, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const q = request.query as { startDate?: string; endDate?: string };
    let all = await tenantDb.select(vehicles);
    if (q.startDate) all = all.filter((v) => v.entryDate >= q.startDate!);
    if (q.endDate) all = all.filter((v) => v.entryDate <= q.endDate!);

    const porEstado = new Map<string, number>();
    const servicios = new Map<string, { count: number; ingresos: number }>();
    const tiempos = new Map<string, { totalDias: number; count: number }>();
    for (const v of all) {
      porEstado.set(v.status, (porEstado.get(v.status) ?? 0) + 1);
      const perService = v.services.length ? (v.cost ?? 0) / v.services.length : 0;
      for (const s of v.services) {
        const e = servicios.get(s) ?? { count: 0, ingresos: 0 };
        e.count += 1;
        e.ingresos += perService;
        servicios.set(s, e);
      }
      const exit = v.exitDate ? new Date(v.exitDate) : new Date();
      const dias = daysBetween(new Date(v.entryDate), exit);
      const t = tiempos.get(v.status) ?? { totalDias: 0, count: 0 };
      t.totalDias += dias;
      t.count += 1;
      tiempos.set(v.status, t);
    }
    return reply.send({
      resumen: {
        totalVehiculos: all.length,
        vehiculosEnTaller: all.filter((v) => v.inTaller).length,
        vehiculosEntregados: all.filter((v) => v.status === "Entregado").length,
        ingresosTotales: all.reduce((s, v) => s + (v.cost ?? 0), 0),
      },
      porEstado: [...porEstado.entries()].map(([estado, cantidad]) => ({ estado, cantidad })),
      serviciosMasFrecuentes: [...servicios.entries()]
        .map(([servicio, v]) => ({ servicio, ...v }))
        .sort((a, b) => b.count - a.count),
      tiemposPromedio: [...tiempos.entries()].map(([estado, v]) => ({
        estado,
        promedioDias: v.count ? Math.round(v.totalDias / v.count) : 0,
      })),
    });
  });

  // ---- Strategic ----
  app.get("/api/reports/strategic", {
    preHandler: requireRole("admin"),
    config: { rateLimit: { max: env.NODE_ENV === "production" ? 20 : 100000, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const active = await tenantDb.select(customers, eq(customers.active, true));
    const all = await tenantDb.select(vehicles);
    const txs = await tenantDb.select(transactions, eq(transactions.active, true));
    const now = new Date();

    const clientesRentables = [...active]
      .sort((a, b) => (b.totalSpent ?? 0) - (a.totalSpent ?? 0))
      .slice(0, 10)
      .map((c) => ({ ...c, totalGastado: c.totalSpent ?? 0, cantidadVehiculos: c.totalVehicles ?? 0 }));

    const clientesEnRiesgo = active.filter((c) => {
      if (!c.lastVisit) return false;
      return daysBetween(new Date(c.lastVisit), now) > 90 && (c.visitCount ?? 0) > 1;
    }).length;

    const servicios = new Map<string, { ingresoTotal: number; cantidad: number }>();
    for (const v of all.filter((x) => x.status === "Entregado")) {
      const per = v.services.length ? (v.cost ?? 0) / v.services.length : 0;
      for (const s of v.services) {
        const e = servicios.get(s) ?? { ingresoTotal: 0, cantidad: 0 };
        e.ingresoTotal += per;
        e.cantidad += 1;
        servicios.set(s, e);
      }
    }

    const tresMesesAtras = new Date(now);
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
    const isoCut = tresMesesAtras.toISOString().split("T")[0]!;
    const ingresosRecientes = txs
      .filter((t) => t.type === "Ingreso" && t.date >= isoCut)
      .reduce((s, t) => s + t.amount, 0);
    const clientesNuevos = active.filter(
      (c) => c.createdAt.toISOString().split("T")[0]! >= isoCut,
    ).length;

    return reply.send({
      clientesRentables,
      clientesEnRiesgo,
      serviciosRentables: [...servicios.entries()]
        .map(([servicio, v]) => ({
          servicio,
          ingresoTotal: v.ingresoTotal,
          cantidad: v.cantidad,
          promedio: v.cantidad ? v.ingresoTotal / v.cantidad : 0,
        }))
        .sort((a, b) => b.ingresoTotal - a.ingresoTotal),
      kpis: {
        tasaRetencion: active.length
          ? ((active.filter((c) => (c.visitCount ?? 0) > 1).length / active.length) * 100).toFixed(2)
          : "0.00",
        ticketPromedio: all.length ? all.reduce((s, v) => s + (v.cost ?? 0), 0) / all.length : 0,
        clientesNuevos,
        prediccionIngresosMensual: ingresosRecientes / 3,
      },
    });
  });

  // ---- Calendario de ingresos: qué vehículos entraron cada día de un mes ----
  app.get("/api/reports/intake-calendar", {
    preHandler: requireAuth,
    config: { rateLimit: { max: env.NODE_ENV === "production" ? 20 : 100000, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { tenantDb } = authed(request);
    const q = request.query as { month?: string };
    // month = "YYYY-MM"; por defecto el mes actual en hora AR (UTC-3).
    const month =
      q.month && /^\d{4}-\d{2}$/.test(q.month) ? q.month : argMonth();
    const start = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
    const end = `${month}-${String(lastDay).padStart(2, "0")}`;

    const rows = await tenantDb.select(
      vehicles,
      and(gte(vehicles.entryDate, start), lte(vehicles.entryDate, end)) as ReturnType<typeof and>,
    );

    const byDay = new Map<
      string,
      { plate: string; brand: string; model: string; owner: string; status: string }[]
    >();
    for (const v of rows) {
      const day = v.entryDate.slice(0, 10);
      const list = byDay.get(day) ?? [];
      list.push({
        plate: v.plate,
        brand: v.brand,
        model: v.model,
        owner: v.owner,
        status: v.status,
      });
      byDay.set(day, list);
    }
    const days = [...byDay.entries()]
      .map(([date, items]) => ({ date, count: items.length, vehicles: items }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    return reply.send({ month, total: rows.length, days });
  });
}
