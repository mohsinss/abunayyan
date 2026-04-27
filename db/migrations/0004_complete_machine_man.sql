CREATE TABLE IF NOT EXISTS "wc_groups" (
	"id" smallint PRIMARY KEY NOT NULL,
	"fiscal_year" varchar(16) DEFAULT 'FY-2025' NOT NULL,
	"group_revenue" real NOT NULL,
	"nwc_target_release" real DEFAULT 540 NOT NULL,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wc_narrative" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot" varchar(64) NOT NULL,
	"title" varchar(160),
	"body" text NOT NULL,
	"display_order" smallint DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "wc_narrative_slot_unique" UNIQUE("slot")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wc_sbus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(16) NOT NULL,
	"name" varchar(64) NOT NULL,
	"share_text" varchar(64),
	"posture" varchar(160),
	"display_order" smallint DEFAULT 0 NOT NULL,
	"inv" real DEFAULT 0 NOT NULL,
	"ar" real DEFAULT 0 NOT NULL,
	"ca" real DEFAULT 0 NOT NULL,
	"ap" real DEFAULT 0 NOT NULL,
	"dio" real DEFAULT 0 NOT NULL,
	"dso" real DEFAULT 0 NOT NULL,
	"dpo" real DEFAULT 0 NOT NULL,
	"t_inv" real DEFAULT 0 NOT NULL,
	"t_ar" real DEFAULT 0 NOT NULL,
	"t_ca" real DEFAULT 0 NOT NULL,
	"t_ap" real DEFAULT 0 NOT NULL,
	"t_dio" real DEFAULT 0 NOT NULL,
	"t_dso" real DEFAULT 0 NOT NULL,
	"t_dpo" real DEFAULT 0 NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "wc_sbus_key_unique" UNIQUE("key")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wc_groups" ADD CONSTRAINT "wc_groups_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wc_narrative" ADD CONSTRAINT "wc_narrative_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wc_sbus" ADD CONSTRAINT "wc_sbus_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wc_narrative_display_order_idx" ON "wc_narrative" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wc_sbus_display_order_idx" ON "wc_sbus" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wc_sbus_archived_idx" ON "wc_sbus" USING btree ("archived_at");