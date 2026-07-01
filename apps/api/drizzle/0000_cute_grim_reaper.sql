CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"etapa" text NOT NULL,
	"datos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"candidato_cliente_id" uuid,
	"candidato_cliente_nombre" text,
	"historial_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text DEFAULT '' NOT NULL,
	"address" text,
	"document_type" text,
	"document_number" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"total_vehicles" integer DEFAULT 0,
	"total_spent" double precision DEFAULT 0,
	"last_visit" text,
	"visit_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historial_taller" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wa_message_id" text NOT NULL,
	"wa_from" text NOT NULL,
	"wa_timestamp" text NOT NULL,
	"raw_message" text,
	"marca_modelo" text,
	"kilometraje" text,
	"patente" text,
	"tarea" text,
	"cliente" text,
	"foto_paths" text[] DEFAULT '{}'::text[] NOT NULL,
	"vehicle_id" uuid,
	"customer_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" text NOT NULL,
	"product_type" text DEFAULT '' NOT NULL,
	"movement_type" text NOT NULL,
	"previous_quantity" double precision,
	"new_quantity" double precision,
	"quantity_change" double precision,
	"previous_price" double precision,
	"new_price" double precision,
	"reason" text,
	"timestamp" text NOT NULL,
	"user_id" text,
	"user_name" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numeros_autorizados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by" text
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"investment_percentage" double precision DEFAULT 0 NOT NULL,
	"monthly_contribution" double precision DEFAULT 0 NOT NULL,
	"total_contributed" double precision DEFAULT 0 NOT NULL,
	"join_date" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" double precision DEFAULT 0 NOT NULL,
	"unit" text DEFAULT 'unidad' NOT NULL,
	"type" text DEFAULT '' NOT NULL,
	"price" double precision DEFAULT 0 NOT NULL,
	"reorder_point" double precision DEFAULT 0 NOT NULL,
	"low_stock" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"role" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan" text DEFAULT 'standard' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"wa_phone_number_id" text,
	"wa_access_token" text,
	"wa_display_number" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"date" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" text NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"suspended_at" text,
	"vehicle_id" uuid,
	"vehicle_details" jsonb,
	"supplier" text,
	"payment_method" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'mecanico' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"vehicle_plate" text NOT NULL,
	"vehicle_info" text DEFAULT '' NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"movement_type" text NOT NULL,
	"previous_status" text,
	"new_status" text,
	"previous_cost" double precision,
	"new_cost" double precision,
	"cost_change" double precision,
	"assigned_user" text,
	"assigned_user_name" text,
	"unassigned_user" text,
	"unassigned_user_name" text,
	"work_duration" integer,
	"work_session_id" text,
	"previous_services" text[],
	"new_services" text[],
	"reason" text,
	"description" text,
	"timestamp" text NOT NULL,
	"user_id" text,
	"user_name" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plate" text NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"year" integer,
	"owner" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"customer_id" uuid,
	"status" text DEFAULT 'Ingresado' NOT NULL,
	"entry_date" text NOT NULL,
	"exit_date" text,
	"services" text[] DEFAULT '{}'::text[] NOT NULL,
	"cost" double precision DEFAULT 0 NOT NULL,
	"description" text,
	"in_taller" boolean DEFAULT true,
	"mileage" integer,
	"responsibles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"costs" jsonb,
	"parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_updated" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_candidato_cliente_id_customers_id_fk" FOREIGN KEY ("candidato_cliente_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_taller" ADD CONSTRAINT "historial_taller_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_taller" ADD CONSTRAINT "historial_taller_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_taller" ADD CONSTRAINT "historial_taller_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numeros_autorizados" ADD CONSTRAINT "numeros_autorizados_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_movements" ADD CONSTRAINT "vehicle_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_movements" ADD CONSTRAINT "vehicle_movements_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_tenant_type_idx" ON "categories" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "conversaciones_tenant_phone_idx" ON "conversaciones" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "customers_tenant_phone_idx" ON "customers" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "customers_tenant_document_idx" ON "customers" USING btree ("tenant_id","document_type","document_number");--> statement-breakpoint
CREATE INDEX "customers_tenant_idx" ON "customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "historial_wa_message_id_uq" ON "historial_taller" USING btree ("wa_message_id");--> statement-breakpoint
CREATE INDEX "historial_tenant_patente_idx" ON "historial_taller" USING btree ("tenant_id","patente");--> statement-breakpoint
CREATE INDEX "historial_tenant_status_idx" ON "historial_taller" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "historial_tenant_idx" ON "historial_taller" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_tenant_product_idx" ON "inventory_movements" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_tenant_idx" ON "inventory_movements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "numeros_tenant_phone_idx" ON "numeros_autorizados" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "partners_tenant_idx" ON "partners" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "products_tenant_idx" ON "products" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "services_tenant_name_idx" ON "services" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_uq" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_wa_phone_number_id_uq" ON "tenants" USING btree ("wa_phone_number_id");--> statement-breakpoint
CREATE INDEX "transactions_tenant_date_idx" ON "transactions" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE INDEX "transactions_tenant_type_idx" ON "transactions" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "transactions_tenant_vehicle_idx" ON "transactions" USING btree ("tenant_id","vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_username_uq" ON "users" USING btree ("tenant_id","username");--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "vehicle_movements_tenant_vehicle_idx" ON "vehicle_movements" USING btree ("tenant_id","vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicle_movements_tenant_idx" ON "vehicle_movements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "vehicles_tenant_plate_idx" ON "vehicles" USING btree ("tenant_id","plate");--> statement-breakpoint
CREATE INDEX "vehicles_tenant_customer_idx" ON "vehicles" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "vehicles_tenant_status_idx" ON "vehicles" USING btree ("tenant_id","status");