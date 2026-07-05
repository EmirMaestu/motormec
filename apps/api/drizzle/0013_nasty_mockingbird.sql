ALTER TABLE "presupuestos" ADD COLUMN "discount_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "presupuestos" ADD COLUMN "tax_rate" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "presupuestos" ADD COLUMN "tax_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "subtotal" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "discount_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "tax_rate" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "tax_amount" bigint DEFAULT 0 NOT NULL;