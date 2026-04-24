-- =============================================================
-- MIGRACIÓN 001 — Agregar convex_id a tablas sincronizadas
-- Permite upserts idempotentes: ON CONFLICT (convex_id)
-- Ejecutar UNA sola vez en la DB beta antes del primer sync
-- =============================================================

ALTER TABLE customers     ADD COLUMN IF NOT EXISTS convex_id TEXT UNIQUE;
ALTER TABLE vehicles      ADD COLUMN IF NOT EXISTS convex_id TEXT UNIQUE;
ALTER TABLE transactions  ADD COLUMN IF NOT EXISTS convex_id TEXT UNIQUE;
ALTER TABLE products      ADD COLUMN IF NOT EXISTS convex_id TEXT UNIQUE;
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS convex_id TEXT UNIQUE;
ALTER TABLE partners      ADD COLUMN IF NOT EXISTS convex_id TEXT UNIQUE;

-- Índices para búsquedas rápidas por convex_id (usados en el sync)
CREATE INDEX IF NOT EXISTS idx_customers_convex_id    ON customers(convex_id)    WHERE convex_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_convex_id     ON vehicles(convex_id)     WHERE convex_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_convex_id ON transactions(convex_id) WHERE convex_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_convex_id     ON products(convex_id)     WHERE convex_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_services_convex_id     ON service_catalog(convex_id) WHERE convex_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partners_convex_id     ON partners(convex_id)     WHERE convex_id IS NOT NULL;
