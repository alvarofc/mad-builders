ALTER TABLE "app_private"."comparison" ADD COLUMN "invalidation_reason" text;--> statement-breakpoint
ALTER TABLE "app_private"."profile" ADD COLUMN "location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_private"."profile" ADD COLUMN "hidden_reason" text;--> statement-breakpoint
ALTER TABLE "app_private"."result" ADD COLUMN "hidden_reason" text;