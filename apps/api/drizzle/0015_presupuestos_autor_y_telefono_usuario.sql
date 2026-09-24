ALTER TABLE "presupuestos" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "presupuestos" ADD COLUMN "created_by_phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;