import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { unzipSync } from "fflate";
import { createTenant } from "../db/admin.js";
import { pool } from "../db/client.js";
import { forTenant, type TenantDb } from "../db/scope.js";
import {
  categories,
  conversaciones,
  customers,
  historialTaller,
  inventoryMovements,
  partners,
  products,
  services,
  transactions,
  vehicleMovements,
  vehicles,
} from "../db/schema.js";
import { storage } from "../storage/provider.js";

/**
 * Migrate a single Convex export (dev-export.zip) into Postgres under ONE new
 * tenant. Convex document ids are mapped to fresh uuids while preserving
 * references (customerId, vehicleId, historialId, productId). Photos in
 * _storage are relocated into MEDIA_ROOT and recorded as foto_paths.
 *
 * Usage:
 *   tsx src/scripts/migrate-from-convex.ts <export.zip> <tenant-slug> "<Tenant Name>"
 */

type Doc = Record<string, unknown>;

function arg(i: number, fallback?: string): string {
  return process.argv[i] ?? fallback ?? "";
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function intOrNull(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.trunc(n);
}
function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function dateFrom(v: unknown, creationTime: unknown): Date {
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const ct = num(creationTime);
  return ct ? new Date(ct) : new Date();
}

class Loader {
  private files: Record<string, Uint8Array>;
  constructor(zipPath: string) {
    // fflate handles the data-descriptor zip format Convex exports use.
    this.files = unzipSync(new Uint8Array(readFileSync(zipPath)));
  }
  table(name: string): Doc[] {
    const data = this.files[`${name}/documents.jsonl`];
    if (!data) return [];
    return Buffer.from(data)
      .toString("utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as Doc);
  }
  storageBytes(storageId: string): Buffer | null {
    for (const candidate of [`_storage/${storageId}`, `_storage/${storageId}.jpg`]) {
      const data = this.files[candidate];
      if (data) return Buffer.from(data);
    }
    return null;
  }
}

async function main(): Promise<void> {
  const zipPath = resolve(arg(2, resolve(process.cwd(), "../../dev-export.zip")));
  const slug = arg(3, "taller-migrado");
  const name = arg(4, "Taller Migrado");

  // eslint-disable-next-line no-console
  console.log(`Migrating ${zipPath} → tenant '${slug}'`);
  const loader = new Loader(zipPath);

  const tenant = await createTenant({ name, slug });
  const tdb = forTenant(tenant.id);

  // id maps: convexId -> new uuid
  const customerMap = new Map<string, string>();
  const vehicleMap = new Map<string, string>();
  const productMap = new Map<string, string>();
  const historialMap = new Map<string, string>();

  const counts: Record<string, { source: number; inserted: number }> = {};
  const track = (t: string, source: number, inserted: number) => {
    counts[t] = { source, inserted };
  };

  /* customers */
  const cDocs = loader.table("customers");
  let cIns = 0;
  for (const d of cDocs) {
    const row = await tdb.insertOne(customers, {
      name: str(d.name),
      email: (d.email as string) ?? null,
      phone: str(d.phone),
      address: (d.address as string) ?? null,
      documentType: (d.documentType as string) ?? null,
      documentNumber: (d.documentNumber as string) ?? null,
      notes: (d.notes as string) ?? null,
      active: d.active !== false,
      totalVehicles: intOrNull(d.totalVehicles) ?? 0,
      totalSpent: num(d.totalSpent) ?? 0,
      lastVisit: (d.lastVisit as string) ?? null,
      visitCount: intOrNull(d.visitCount) ?? 0,
      createdAt: dateFrom(d.createdAt, d._creationTime),
    });
    customerMap.set(str(d._id), row.id);
    cIns += 1;
  }
  track("customers", cDocs.length, cIns);

  /* vehicles */
  const vDocs = loader.table("vehicles");
  let vIns = 0;
  for (const d of vDocs) {
    const row = await tdb.insertOne(vehicles, {
      plate: str(d.plate),
      brand: str(d.brand),
      model: str(d.model),
      year: intOrNull(d.year),
      owner: str(d.owner),
      phone: str(d.phone),
      customerId: d.customerId ? (customerMap.get(str(d.customerId)) ?? null) : null,
      status: str(d.status) || "Ingresado",
      entryDate: str(d.entryDate) || new Date().toISOString(),
      exitDate: (d.exitDate as string) ?? null,
      services: Array.isArray(d.services) ? (d.services as string[]) : [],
      cost: num(d.cost) ?? 0,
      description: (d.description as string) ?? null,
      inTaller: d.inTaller as boolean | undefined,
      mileage: intOrNull(d.mileage),
      responsibles: (d.responsibles as never) ?? [],
      costs: (d.costs as never) ?? null,
      parts: (d.parts as never) ?? [],
      lastUpdated: (d.lastUpdated as string) ?? null,
      createdAt: dateFrom(undefined, d._creationTime),
    });
    vehicleMap.set(str(d._id), row.id);
    vIns += 1;
  }
  track("vehicles", vDocs.length, vIns);

  /* products */
  const pDocs = loader.table("products");
  let pIns = 0;
  for (const d of pDocs) {
    const row = await tdb.insertOne(products, {
      name: str(d.name),
      quantity: num(d.quantity) ?? 0,
      unit: str(d.unit) || "unidad",
      type: str(d.type),
      price: num(d.price) ?? 0,
      reorderPoint: num(d.reorderPoint) ?? 0,
      lowStock: d.lowStock === true,
    });
    productMap.set(str(d._id), row.id);
    pIns += 1;
  }
  track("products", pDocs.length, pIns);

  /* transactions */
  const tDocs = loader.table("transactions");
  let tIns = 0;
  for (const d of tDocs) {
    await tdb.insert(transactions, {
      date: str(d.date),
      description: str(d.description),
      type: (str(d.type) === "Egreso" ? "Egreso" : "Ingreso") as "Ingreso" | "Egreso",
      category: str(d.category),
      amount: num(d.amount) ?? 0,
      active: d.active !== false,
      suspendedAt: (d.suspendedAt as string) ?? null,
      vehicleId: d.vehicleId ? (vehicleMap.get(str(d.vehicleId)) ?? null) : null,
      vehicleDetails: (d.vehicleDetails as never) ?? null,
      supplier: (d.supplier as string) ?? null,
      paymentMethod: (d.paymentMethod as string) ?? null,
      notes: (d.notes as string) ?? null,
      createdAt: dateFrom(undefined, d._creationTime),
    });
    tIns += 1;
  }
  track("transactions", tDocs.length, tIns);

  /* partners */
  const paDocs = loader.table("partners");
  let paIns = 0;
  for (const d of paDocs) {
    await tdb.insert(partners, {
      name: str(d.name),
      email: str(d.email),
      phone: str(d.phone),
      investmentPercentage: num(d.investmentPercentage) ?? 0,
      monthlyContribution: num(d.monthlyContribution) ?? 0,
      totalContributed: num(d.totalContributed) ?? 0,
      joinDate: str(d.joinDate) || new Date().toISOString(),
      active: d.active !== false,
    });
    paIns += 1;
  }
  track("partners", paDocs.length, paIns);

  /* services */
  const sDocs = loader.table("services");
  let sIns = 0;
  for (const d of sDocs) {
    await tdb.insert(services, {
      name: str(d.name),
      active: d.active !== false,
      usageCount: intOrNull(d.usageCount) ?? 0,
      createdAt: dateFrom(d.createdAt, d._creationTime),
    });
    sIns += 1;
  }
  track("services", sDocs.length, sIns);

  /* categories */
  const catDocs = loader.table("categories");
  let catIns = 0;
  for (const d of catDocs) {
    await tdb.insert(categories, {
      name: str(d.name),
      type: str(d.type) || "general",
      active: d.active !== false,
    });
    catIns += 1;
  }
  track("categories", catDocs.length, catIns);

  /* historial_taller (+ photos) */
  const hDocs = loader.table("historial_taller");
  let hIns = 0;
  for (const d of hDocs) {
    const row = await tdb.insertOne(historialTaller, {
      waMessageId: str(d.whatsappMessageId) || `migrated-${str(d._id)}`,
      waFrom: str(d.whatsappFrom),
      waTimestamp: str(d.whatsappTimestamp),
      rawMessage: (d.rawMessage as string) ?? null,
      marcaModelo: (d.marca_modelo as string) ?? null,
      kilometraje: (d.kilometraje as string) ?? null,
      patente: (d.patente as string) ?? null,
      tarea: (d.tarea as string) ?? null,
      cliente: (d.cliente as string) ?? null,
      fotoPaths: [],
      vehicleId: d.vehicleId ? (vehicleMap.get(str(d.vehicleId)) ?? null) : null,
      customerId: d.customerId ? (customerMap.get(str(d.customerId)) ?? null) : null,
      status: (str(d.status) || "pending") as "pending" | "processed" | "error" | "linked",
      errorMessage: (d.errorMessage as string) ?? null,
      createdAt: dateFrom(d.createdAt, d._creationTime),
    });
    historialMap.set(str(d._id), row.id);

    // Relocate photos from Convex storage, if present in the export.
    const fotoIds = Array.isArray(d.fotoIds) ? (d.fotoIds as string[]) : [];
    const fotoPaths: string[] = [];
    for (const fid of fotoIds) {
      const bytes = loader.storageBytes(fid);
      if (bytes) fotoPaths.push(await storage.save(tenant.id, row.id, bytes, "jpg"));
    }
    if (fotoPaths.length) {
      await tdb.updateById(historialTaller, row.id, { fotoPaths });
    }
    hIns += 1;
  }
  track("historial_taller", hDocs.length, hIns);

  /* conversaciones */
  const convDocs = loader.table("conversaciones");
  let convIns = 0;
  for (const d of convDocs) {
    await tdb.insert(conversaciones, {
      phone: str(d.phone),
      etapa: str(d.etapa),
      datos: (d.datos as never) ?? {},
      candidatoClienteId: d.candidatoClienteId
        ? (customerMap.get(str(d.candidatoClienteId)) ?? null)
        : null,
      candidatoClienteNombre: (d.candidatoClienteNombre as string) ?? null,
      historialId: d.historialId ? (historialMap.get(str(d.historialId)) ?? null) : null,
    });
    convIns += 1;
  }
  track("conversaciones", convDocs.length, convIns);

  /* vehicleMovements */
  const vmDocs = loader.table("vehicleMovements");
  let vmIns = 0;
  for (const d of vmDocs) {
    await tdb.insert(vehicleMovements, {
      vehicleId: d.vehicleId ? (vehicleMap.get(str(d.vehicleId)) ?? null) : null,
      vehiclePlate: str(d.vehiclePlate),
      vehicleInfo: str(d.vehicleInfo),
      owner: str(d.owner),
      movementType: str(d.movementType) as never,
      previousStatus: (d.previousStatus as string) ?? null,
      newStatus: (d.newStatus as string) ?? null,
      previousCost: num(d.previousCost),
      newCost: num(d.newCost),
      costChange: num(d.costChange),
      assignedUser: (d.assignedUser as string) ?? null,
      assignedUserName: (d.assignedUserName as string) ?? null,
      unassignedUser: (d.unassignedUser as string) ?? null,
      unassignedUserName: (d.unassignedUserName as string) ?? null,
      workDuration: intOrNull(d.workDuration),
      workSessionId: (d.workSessionId as string) ?? null,
      previousServices: (d.previousServices as string[]) ?? null,
      newServices: (d.newServices as string[]) ?? null,
      reason: (d.reason as string) ?? null,
      description: (d.description as string) ?? null,
      timestamp: str(d.timestamp) || new Date().toISOString(),
      userId: (d.userId as string) ?? null,
      userName: (d.userName as string) ?? null,
      details: (d.details as never) ?? null,
    });
    vmIns += 1;
  }
  track("vehicleMovements", vmDocs.length, vmIns);

  /* inventoryMovements */
  const imDocs = loader.table("inventoryMovements");
  let imIns = 0;
  for (const d of imDocs) {
    await tdb.insert(inventoryMovements, {
      productId: d.productId ? (productMap.get(str(d.productId)) ?? null) : null,
      productName: str(d.productName),
      productType: str(d.productType),
      movementType: str(d.movementType) as never,
      previousQuantity: num(d.previousQuantity),
      newQuantity: num(d.newQuantity),
      quantityChange: num(d.quantityChange),
      previousPrice: num(d.previousPrice),
      newPrice: num(d.newPrice),
      reason: (d.reason as string) ?? null,
      timestamp: str(d.timestamp) || new Date().toISOString(),
      userId: (d.userId as string) ?? null,
      userName: (d.userName as string) ?? null,
      details: (d.details as never) ?? null,
    });
    imIns += 1;
  }
  track("inventoryMovements", imDocs.length, imIns);

  // Validation report.
  // eslint-disable-next-line no-console
  console.log("\nMigration counts (source → inserted):");
  let ok = true;
  for (const [t, { source, inserted }] of Object.entries(counts)) {
    const mark = source === inserted ? "✓" : "✗";
    if (source !== inserted) ok = false;
    // eslint-disable-next-line no-console
    console.log(`  ${mark} ${t}: ${source} → ${inserted}`);
  }
  // eslint-disable-next-line no-console
  console.log(`\nTenant '${slug}' (${tenant.id}) — ${ok ? "ALL COUNTS MATCH" : "MISMATCH (review above)"}`);

  await pool.end();
  if (!ok) process.exit(1);
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error("Migration failed:", err);
  await pool.end();
  process.exit(1);
});
