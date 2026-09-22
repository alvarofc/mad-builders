CREATE TABLE "app_private"."social_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"status" text NOT NULL,
	"payload" jsonb
);
--> statement-breakpoint
ALTER TABLE "app_private"."social_cache" ENABLE ROW LEVEL SECURITY;