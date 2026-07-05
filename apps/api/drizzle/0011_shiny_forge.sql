ALTER TABLE "billing_customers" ALTER COLUMN "wallet_balance" SET DATA TYPE bigint USING ROUND("wallet_balance" * 100);--> statement-breakpoint
ALTER TABLE "charges" ALTER COLUMN "gross_amount" SET DATA TYPE bigint USING ROUND("gross_amount" * 100);--> statement-breakpoint
ALTER TABLE "charges" ALTER COLUMN "discount_amount" SET DATA TYPE bigint USING ROUND("discount_amount" * 100);--> statement-breakpoint
ALTER TABLE "charges" ALTER COLUMN "net_amount" SET DATA TYPE bigint USING ROUND("net_amount" * 100);--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "total_spent" SET DATA TYPE bigint USING ROUND("total_spent" * 100);--> statement-breakpoint
ALTER TABLE "inventory_movements" ALTER COLUMN "previous_price" SET DATA TYPE bigint USING ROUND("previous_price" * 100);--> statement-breakpoint
ALTER TABLE "inventory_movements" ALTER COLUMN "new_price" SET DATA TYPE bigint USING ROUND("new_price" * 100);--> statement-breakpoint
ALTER TABLE "partners" ALTER COLUMN "monthly_contribution" SET DATA TYPE bigint USING ROUND("monthly_contribution" * 100);--> statement-breakpoint
ALTER TABLE "partners" ALTER COLUMN "total_contributed" SET DATA TYPE bigint USING ROUND("total_contributed" * 100);--> statement-breakpoint
ALTER TABLE "presupuestos" ALTER COLUMN "subtotal" SET DATA TYPE bigint USING ROUND("subtotal" * 100);--> statement-breakpoint
ALTER TABLE "presupuestos" ALTER COLUMN "total" SET DATA TYPE bigint USING ROUND("total" * 100);--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "price" SET DATA TYPE bigint USING ROUND("price" * 100);--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "amount" SET DATA TYPE bigint USING ROUND("amount" * 100);--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "amount" SET DATA TYPE bigint USING ROUND("amount" * 100);--> statement-breakpoint
ALTER TABLE "vehicle_movements" ALTER COLUMN "previous_cost" SET DATA TYPE bigint USING ROUND("previous_cost" * 100);--> statement-breakpoint
ALTER TABLE "vehicle_movements" ALTER COLUMN "new_cost" SET DATA TYPE bigint USING ROUND("new_cost" * 100);--> statement-breakpoint
ALTER TABLE "vehicle_movements" ALTER COLUMN "cost_change" SET DATA TYPE bigint USING ROUND("cost_change" * 100);--> statement-breakpoint
ALTER TABLE "vehicles" ALTER COLUMN "cost" SET DATA TYPE bigint USING ROUND("cost" * 100);--> statement-breakpoint
ALTER TABLE "wallet_ledger" ALTER COLUMN "amount" SET DATA TYPE bigint USING ROUND("amount" * 100);--> statement-breakpoint
ALTER TABLE "wallet_ledger" ALTER COLUMN "balance_after" SET DATA TYPE bigint USING ROUND("balance_after" * 100);--> statement-breakpoint
ALTER TABLE "work_orders" ALTER COLUMN "labor_cost" SET DATA TYPE bigint USING ROUND("labor_cost" * 100);--> statement-breakpoint
ALTER TABLE "work_orders" ALTER COLUMN "parts_cost" SET DATA TYPE bigint USING ROUND("parts_cost" * 100);--> statement-breakpoint
ALTER TABLE "work_orders" ALTER COLUMN "total" SET DATA TYPE bigint USING ROUND("total" * 100);--> statement-breakpoint
UPDATE "work_orders" SET "parts" = (
  SELECT COALESCE(jsonb_agg(jsonb_set(p, '{unitPrice}', to_jsonb(ROUND((p->>'unitPrice')::numeric * 100)))), '[]'::jsonb)
  FROM jsonb_array_elements("parts") p
) WHERE jsonb_typeof("parts") = 'array' AND jsonb_array_length("parts") > 0;--> statement-breakpoint
UPDATE "presupuestos" SET "items" = (
  SELECT COALESCE(jsonb_agg(jsonb_set(i, '{unitPrice}', to_jsonb(ROUND((i->>'unitPrice')::numeric * 100)))), '[]'::jsonb)
  FROM jsonb_array_elements("items") i
) WHERE jsonb_typeof("items") = 'array' AND jsonb_array_length("items") > 0;--> statement-breakpoint
UPDATE "vehicles" SET "parts" = (
  SELECT COALESCE(jsonb_agg(jsonb_set(p, '{price}', to_jsonb(ROUND((p->>'price')::numeric * 100)))), '[]'::jsonb)
  FROM jsonb_array_elements("parts") p
) WHERE jsonb_typeof("parts") = 'array' AND jsonb_array_length("parts") > 0;--> statement-breakpoint
UPDATE "vehicles" SET "costs" = jsonb_build_object(
  'laborCost', ROUND((("costs"->>'laborCost')::numeric) * 100),
  'partsCost', ROUND((("costs"->>'partsCost')::numeric) * 100),
  'totalCost', ROUND((("costs"->>'totalCost')::numeric) * 100)
) WHERE "costs" IS NOT NULL;
