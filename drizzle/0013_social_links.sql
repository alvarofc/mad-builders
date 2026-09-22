ALTER TABLE app_private."user" ADD COLUMN social_links jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE app_private.project ADD COLUMN social_links jsonb NOT NULL DEFAULT '{}'::jsonb;
