CREATE TABLE IF NOT EXISTS "messages_archive" (
	"id" uuid PRIMARY KEY NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_id" text,
	"chatbot_id" uuid,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"tool_calls" jsonb,
	"tool_results" jsonb,
	"status" varchar(16),
	"finish_reason" varchar(32),
	"tokens_in" integer,
	"tokens_out" integer,
	"cost_usd" real,
	"model_id" varchar(64),
	"prompt_version" integer,
	"original_created_at" timestamp with time zone NOT NULL,
	"archived_at" timestamp with time zone DEFAULT now() NOT NULL
);
