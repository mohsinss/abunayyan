CREATE TABLE IF NOT EXISTS "dataset_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"parse_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dataset_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"sheet" varchar(128),
	"row_index" integer NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(96) NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text,
	"kind" varchar(16) NOT NULL,
	"config" jsonb NOT NULL,
	"chatbot_id" uuid,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"share_enabled" boolean DEFAULT false NOT NULL,
	"share_token" text,
	"shared_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "datasets_slug_unique" UNIQUE("slug"),
	CONSTRAINT "datasets_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "dataset_id" uuid;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "dataset_max_file_bytes" integer DEFAULT 26214400 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "dataset_max_files_per_dataset" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "dataset_max_datasets" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "dataset_max_rows_per_dataset" integer DEFAULT 100000 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "default_chatbot_model_id" varchar(64);--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "default_chatbot_temperature" real DEFAULT 0.3 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "public_share_rate_limit_tokens" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "public_share_rate_limit_window" varchar(16) DEFAULT '1 h' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "public_share_daily_cost_cap_usd" real DEFAULT 2 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dataset_files" ADD CONSTRAINT "dataset_files_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dataset_rows" ADD CONSTRAINT "dataset_rows_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dataset_rows" ADD CONSTRAINT "dataset_rows_file_id_dataset_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."dataset_files"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "datasets" ADD CONSTRAINT "datasets_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "datasets" ADD CONSTRAINT "datasets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dataset_files_dataset_idx" ON "dataset_files" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dataset_files_status_idx" ON "dataset_files" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dataset_rows_dataset_idx" ON "dataset_rows" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dataset_rows_file_idx" ON "dataset_rows" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "datasets_slug_idx" ON "datasets" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "datasets_kind_idx" ON "datasets" USING btree ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "datasets_active_idx" ON "datasets" USING btree ("created_at") WHERE "datasets"."deleted_at" IS NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_dataset_idx" ON "documents" USING btree ("dataset_id");