CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"vehicle_id" uuid,
	"customer_id" uuid,
	"vehicle_plate" text DEFAULT '' NOT NULL,
	"vehicle_info" text DEFAULT '' NOT NULL,
	"customer_name" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'Pendiente' NOT NULL,
	"services" text[] DEFAULT '{}'::text[] NOT NULL,
	"parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"labor_cost" double precision DEFAULT 0 NOT NULL,
	"parts_cost" double precision DEFAULT 0 NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"mileage" integer,
	"notes" text,
	"entry_date" text NOT NULL,
	"estimated_date" text,
	"delivery_date" text,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "work_orders_tenant_number_uq" ON "work_orders" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX "work_orders_tenant_vehicle_idx" ON "work_orders" USING btree ("tenant_id","vehicle_id");--> statement-breakpoint
CREATE INDEX "work_orders_tenant_customer_idx" ON "work_orders" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "work_orders_tenant_status_idx" ON "work_orders" USING btree ("tenant_id","status");