// =============================================================
// MOTORMEC — Sync Worker: Convex → PostgreSQL
// Importa clientes, vehículos, transacciones, productos,
// servicios y socios desde Convex a la DB beta en PostgreSQL.
//
// Uso:
//   node src/worker.js          → loop continuo (SYNC_INTERVAL_MS)
//   node src/worker.js --once   → un ciclo y sale (importación inicial)
// =============================================================

"use strict";

const { Pool } = require("pg");

// ── Config desde variables de entorno ────────────────────────
const CONVEX_URL      = process.env.CONVEX_URL?.replace(/\/$/, "");
const DATABASE_URL    = process.env.DATABASE_URL;
const TENANT_ID       = process.env.BETA_TENANT_ID;
const INTERVAL_MS     = parseInt(process.env.SYNC_INTERVAL_MS || "300000"); // 5 min
const RUN_ONCE        = process.argv.includes("--once");

if (!CONVEX_URL)   throw new Error("Falta CONVEX_URL");
if (!DATABASE_URL) throw new Error("Falta DATABASE_URL");
if (!TENANT_ID)    throw new Error("Falta BETA_TENANT_ID");

// ── Pool de PostgreSQL ────────────────────────────────────────
const pool = new Pool({ connectionString: DATABASE_URL });

// =============================================================
// CONVEX HTTP CLIENT
// Llama a funciones públicas de Convex via HTTP API
// =============================================================
async function convexQuery(path, args = {}) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ path, args, format: "json" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Convex error [${path}] ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.status !== "success") {
    throw new Error(`Convex query falló [${path}]: ${JSON.stringify(json)}`);
  }

  return json.value;
}

// =============================================================
// MAPEOS DE VALORES
// =============================================================
function mapVehicleStatus(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("trabajo") || s.includes("progress") || s === "en_progreso") return "in_progress";
  if (s.includes("entreg")  || s === "delivered")  return "delivered";
  if (s.includes("suspend") || s === "suspended")  return "suspended";
  return "waiting"; // Ingresado y cualquier otro
}

function parseDate(str) {
  if (!str) return null;
  try { return new Date(str); } catch { return null; }
}

function parseDecimal(val) {
  if (val === null || val === undefined) return 0;
  return parseFloat(val) || 0;
}

// =============================================================
// SYNC: CLIENTES
// =============================================================
async function syncCustomers() {
  const rows = await convexQuery("customers:getActiveCustomers");
  if (!rows?.length) return { synced: 0 };

  let synced = 0;
  for (const c of rows) {
    await pool.query(`
      INSERT INTO customers (
        tenant_id, convex_id,
        name, email, phone, address,
        document_type, document_number, notes,
        is_active, total_vehicles, total_spent,
        last_visit_at, visit_count, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
      ON CONFLICT (convex_id) DO UPDATE SET
        name            = EXCLUDED.name,
        email           = EXCLUDED.email,
        phone           = EXCLUDED.phone,
        address         = EXCLUDED.address,
        document_type   = EXCLUDED.document_type,
        document_number = EXCLUDED.document_number,
        notes           = EXCLUDED.notes,
        is_active       = EXCLUDED.is_active,
        total_vehicles  = EXCLUDED.total_vehicles,
        total_spent     = EXCLUDED.total_spent,
        last_visit_at   = EXCLUDED.last_visit_at,
        visit_count     = EXCLUDED.visit_count,
        updated_at      = NOW()
    `, [
      TENANT_ID,
      c._id,
      c.name         || "Sin nombre",
      c.email        || null,
      c.phone        || "",
      c.address      || null,
      c.documentType || null,
      c.documentNumber || null,
      c.notes        || null,
      c.active !== false,
      c.totalVehicles || 0,
      parseDecimal(c.totalSpent),
      parseDate(c.lastVisit),
      c.visitCount   || 0,
      parseDate(c.createdAt) || new Date(),
    ]);
    synced++;
  }
  return { synced };
}

// =============================================================
// SYNC: VEHÍCULOS
// =============================================================
async function syncVehicles() {
  const rows = await convexQuery("vehicles:getVehicles");
  if (!rows?.length) return { synced: 0 };

  // Mapa convex_id → UUID de PostgreSQL para clientes
  const { rows: pgCustomers } = await pool.query(
    "SELECT id, convex_id FROM customers WHERE tenant_id = $1 AND convex_id IS NOT NULL",
    [TENANT_ID]
  );
  const customerMap = Object.fromEntries(pgCustomers.map(r => [r.convex_id, r.id]));

  let synced = 0;
  for (const v of rows) {
    const customerId = v.customerId ? customerMap[v.customerId] || null : null;

    await pool.query(`
      INSERT INTO vehicles (
        tenant_id, convex_id, customer_id,
        plate, brand, model, year,
        owner_name, owner_phone, status,
        is_in_workshop, description, current_mileage,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)
      ON CONFLICT (convex_id) DO UPDATE SET
        customer_id     = EXCLUDED.customer_id,
        plate           = EXCLUDED.plate,
        brand           = EXCLUDED.brand,
        model           = EXCLUDED.model,
        year            = EXCLUDED.year,
        owner_name      = EXCLUDED.owner_name,
        owner_phone     = EXCLUDED.owner_phone,
        status          = EXCLUDED.status,
        is_in_workshop  = EXCLUDED.is_in_workshop,
        description     = EXCLUDED.description,
        current_mileage = EXCLUDED.current_mileage,
        updated_at      = NOW()
    `, [
      TENANT_ID,
      v._id,
      customerId,
      (v.plate  || "").toUpperCase().replace(/[\s\-]/g, ""),
      v.brand   || "Desconocida",
      v.model   || "Desconocido",
      v.year    || null,
      v.owner   || "Sin nombre",
      v.phone   || "",
      mapVehicleStatus(v.status),
      v.inTaller !== false,
      v.description || null,
      v.mileage     || null,
      parseDate(v.entryDate) || new Date(),
    ]);
    synced++;
  }
  return { synced };
}

// =============================================================
// SYNC: TRANSACCIONES
// =============================================================
async function syncTransactions() {
  const rows = await convexQuery("transactions:getAllTransactions");
  if (!rows?.length) return { synced: 0 };

  // Mapa convex_id → UUID de PostgreSQL para vehículos
  const { rows: pgVehicles } = await pool.query(
    "SELECT id, convex_id FROM vehicles WHERE tenant_id = $1 AND convex_id IS NOT NULL",
    [TENANT_ID]
  );
  const vehicleMap = Object.fromEntries(pgVehicles.map(r => [r.convex_id, r.id]));

  let synced = 0;
  for (const t of rows) {
    const vehicleId = t.vehicleId ? vehicleMap[t.vehicleId] || null : null;
    const type = t.type === "Ingreso" ? "income" : "expense";

    await pool.query(`
      INSERT INTO transactions (
        tenant_id, convex_id, vehicle_id,
        date, description, type, category, amount,
        payment_method, supplier, notes,
        is_active, suspended_at, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)
      ON CONFLICT (convex_id) DO UPDATE SET
        vehicle_id     = EXCLUDED.vehicle_id,
        date           = EXCLUDED.date,
        description    = EXCLUDED.description,
        type           = EXCLUDED.type,
        category       = EXCLUDED.category,
        amount         = EXCLUDED.amount,
        payment_method = EXCLUDED.payment_method,
        supplier       = EXCLUDED.supplier,
        notes          = EXCLUDED.notes,
        is_active      = EXCLUDED.is_active,
        suspended_at   = EXCLUDED.suspended_at,
        updated_at     = NOW()
    `, [
      TENANT_ID,
      t._id,
      vehicleId,
      t.date    ? new Date(t.date) : new Date(),
      t.description || "",
      type,
      t.category    || "General",
      parseDecimal(t.amount),
      t.paymentMethod || null,
      t.supplier      || null,
      t.notes         || null,
      t.active !== false,
      t.suspendedAt ? new Date(t.suspendedAt) : null,
      new Date(),
    ]);
    synced++;
  }
  return { synced };
}

// =============================================================
// SYNC: PRODUCTOS / INVENTARIO
// =============================================================
async function syncProducts() {
  const rows = await convexQuery("products:getProducts");
  if (!rows?.length) return { synced: 0 };

  let synced = 0;
  for (const p of rows) {
    await pool.query(`
      INSERT INTO products (
        tenant_id, convex_id, name, quantity,
        unit, type, price, reorder_point,
        is_active, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
      ON CONFLICT (convex_id) DO UPDATE SET
        name          = EXCLUDED.name,
        quantity      = EXCLUDED.quantity,
        unit          = EXCLUDED.unit,
        type          = EXCLUDED.type,
        price         = EXCLUDED.price,
        reorder_point = EXCLUDED.reorder_point,
        is_active     = EXCLUDED.is_active,
        updated_at    = NOW()
    `, [
      TENANT_ID,
      p._id,
      p.name         || "Sin nombre",
      parseDecimal(p.quantity),
      p.unit         || null,
      p.type         || null,
      parseDecimal(p.price),
      p.reorderPoint ? parseDecimal(p.reorderPoint) : null,
      true,
      new Date(),
    ]);
    synced++;
  }
  return { synced };
}

// =============================================================
// SYNC: CATÁLOGO DE SERVICIOS
// =============================================================
async function syncServices() {
  const rows = await convexQuery("services:getAllServices");
  if (!rows?.length) return { synced: 0 };

  let synced = 0;
  for (const s of rows) {
    await pool.query(`
      INSERT INTO service_catalog (
        tenant_id, convex_id, name, is_active, usage_count, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (convex_id) DO UPDATE SET
        name        = EXCLUDED.name,
        is_active   = EXCLUDED.is_active,
        usage_count = EXCLUDED.usage_count
    `, [
      TENANT_ID,
      s._id,
      s.name        || "Sin nombre",
      s.active !== false,
      s.usageCount  || 0,
      parseDate(s.createdAt) || new Date(),
    ]);
    synced++;
  }
  return { synced };
}

// =============================================================
// SYNC: SOCIOS / PARTNERS
// =============================================================
async function syncPartners() {
  const rows = await convexQuery("partners:getActivePartners");
  if (!rows?.length) return { synced: 0 };

  let synced = 0;
  for (const p of rows) {
    await pool.query(`
      INSERT INTO partners (
        tenant_id, convex_id, name, email, phone,
        investment_pct, monthly_contribution, total_contributed,
        join_date, is_active, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (convex_id) DO UPDATE SET
        name                 = EXCLUDED.name,
        email                = EXCLUDED.email,
        phone                = EXCLUDED.phone,
        investment_pct       = EXCLUDED.investment_pct,
        monthly_contribution = EXCLUDED.monthly_contribution,
        total_contributed    = EXCLUDED.total_contributed,
        join_date            = EXCLUDED.join_date,
        is_active            = EXCLUDED.is_active
    `, [
      TENANT_ID,
      p._id,
      p.name                || "Sin nombre",
      p.email               || null,
      p.phone               || null,
      parseDecimal(p.investmentPercentage),
      parseDecimal(p.monthlyContribution),
      parseDecimal(p.totalContributed),
      p.joinDate ? new Date(p.joinDate) : null,
      p.active !== false,
      new Date(),
    ]);
    synced++;
  }
  return { synced };
}

// =============================================================
// CICLO PRINCIPAL DE SYNC
// =============================================================
async function runSync() {
  const start = Date.now();
  console.log(`\n[${new Date().toISOString()}] ▶ Iniciando ciclo de sync...`);

  const results = {};

  try { results.customers    = await syncCustomers();    } catch (e) { results.customers    = { error: e.message }; }
  try { results.vehicles     = await syncVehicles();     } catch (e) { results.vehicles     = { error: e.message }; }
  try { results.transactions = await syncTransactions(); } catch (e) { results.transactions = { error: e.message }; }
  try { results.products     = await syncProducts();     } catch (e) { results.products     = { error: e.message }; }
  try { results.services     = await syncServices();     } catch (e) { results.services     = { error: e.message }; }
  try { results.partners     = await syncPartners();     } catch (e) { results.partners     = { error: e.message }; }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`[${new Date().toISOString()}] ✅ Sync completado en ${elapsed}s`);
  console.table(
    Object.entries(results).map(([table, r]) => ({
      tabla: table,
      resultado: r.error ? `❌ ${r.error}` : `✅ ${r.synced} registros`,
    }))
  );
}

// =============================================================
// ENTRYPOINT
// =============================================================
async function main() {
  console.log("=".repeat(55));
  console.log(" MOTORMEC Sync Worker — Convex → PostgreSQL");
  console.log(`  Convex:   ${CONVEX_URL}`);
  console.log(`  Tenant:   ${TENANT_ID}`);
  console.log(`  Modo:     ${RUN_ONCE ? "una sola vez (--once)" : `loop cada ${INTERVAL_MS / 1000}s`}`);
  console.log("=".repeat(55));

  // Verifica conexión a PostgreSQL
  try {
    await pool.query("SELECT 1");
    console.log("✅ PostgreSQL conectado.");
  } catch (e) {
    console.error("❌ No se pudo conectar a PostgreSQL:", e.message);
    process.exit(1);
  }

  await runSync();

  if (RUN_ONCE) {
    await pool.end();
    process.exit(0);
  }

  // Loop continuo
  setInterval(async () => {
    try { await runSync(); }
    catch (e) { console.error("❌ Error en ciclo de sync:", e.message); }
  }, INTERVAL_MS);
}

main().catch(err => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});
