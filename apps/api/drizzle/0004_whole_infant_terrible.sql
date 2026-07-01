ALTER TABLE "usage_counters" ADD COLUMN "ia_input_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_counters" ADD COLUMN "ia_output_tokens" integer DEFAULT 0 NOT NULL;