CREATE TABLE IF NOT EXISTS "wcx_monthly_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upload_id" uuid NOT NULL,
	"sbu_code" varchar(32) NOT NULL,
	"metric_key" varchar(64) NOT NULL,
	"month" varchar(7) NOT NULL,
	"value" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wcx_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upload_id" uuid NOT NULL,
	"sbu_code" varchar(32) NOT NULL,
	"sheet" varchar(48) NOT NULL,
	"record_index" integer NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wcx_sbus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upload_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(96) NOT NULL,
	"pillar" varchar(64),
	"display_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wcx_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upload_id" uuid NOT NULL,
	"sbu_code" varchar(32) NOT NULL,
	"target_inventory" double precision,
	"target_ar" double precision,
	"target_contract_assets" double precision,
	"target_ap" double precision,
	"target_dio" double precision,
	"target_dso" double precision,
	"target_dpo" double precision,
	"target_cash_released" double precision,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wcx_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" varchar(255) NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"parse_error" text,
	"period_start" varchar(7),
	"period_end" varchar(7),
	"facts_count" integer DEFAULT 0 NOT NULL,
	"records_count" integer DEFAULT 0 NOT NULL,
	"qa_report" jsonb,
	"is_active" boolean DEFAULT false NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wcx_monthly_facts" ADD CONSTRAINT "wcx_monthly_facts_upload_id_wcx_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."wcx_uploads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wcx_records" ADD CONSTRAINT "wcx_records_upload_id_wcx_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."wcx_uploads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wcx_sbus" ADD CONSTRAINT "wcx_sbus_upload_id_wcx_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."wcx_uploads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wcx_targets" ADD CONSTRAINT "wcx_targets_upload_id_wcx_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."wcx_uploads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wcx_uploads" ADD CONSTRAINT "wcx_uploads_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wcx_facts_cell_idx" ON "wcx_monthly_facts" USING btree ("upload_id","sbu_code","metric_key","month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wcx_facts_metric_idx" ON "wcx_monthly_facts" USING btree ("upload_id","metric_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wcx_facts_month_idx" ON "wcx_monthly_facts" USING btree ("upload_id","month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wcx_records_sheet_idx" ON "wcx_records" USING btree ("upload_id","sheet");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wcx_records_sbu_idx" ON "wcx_records" USING btree ("upload_id","sbu_code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wcx_sbus_upload_code_idx" ON "wcx_sbus" USING btree ("upload_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wcx_targets_upload_sbu_idx" ON "wcx_targets" USING btree ("upload_id","sbu_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wcx_uploads_status_idx" ON "wcx_uploads" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wcx_uploads_active_idx" ON "wcx_uploads" USING btree ("created_at") WHERE "wcx_uploads"."is_active" = true;