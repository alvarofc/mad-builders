ALTER TABLE "app_private"."profile" ADD COLUMN "project_stage" text DEFAULT 'building' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_private"."result" ADD COLUMN "feedback_request" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_private"."result" ADD COLUMN "project_sentence" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_private"."result" ADD COLUMN "project_url" text;--> statement-breakpoint
ALTER TABLE "app_private"."result" ADD COLUMN "project_stage" text DEFAULT 'building' NOT NULL;--> statement-breakpoint
UPDATE "app_private"."result" AS r
SET "project_sentence" = p."bio", "project_url" = p."project_url", "project_stage" = p."project_stage"
FROM "app_private"."profile" AS p
WHERE r."user_id" = p."user_id";--> statement-breakpoint
ALTER TABLE "app_private"."profile" ADD CONSTRAINT "profile_project_stage_check" CHECK ("app_private"."profile"."project_stage" in ('idea', 'building', 'private_testing', 'launched', 'growing'));--> statement-breakpoint
ALTER TABLE "app_private"."result" ADD CONSTRAINT "result_project_stage_check" CHECK ("app_private"."result"."project_stage" in ('idea', 'building', 'private_testing', 'launched', 'growing'));
