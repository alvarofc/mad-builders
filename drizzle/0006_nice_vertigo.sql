CREATE TABLE "app_private"."email_delivery" (
	"key" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"payload" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"provider_id" text
);
--> statement-breakpoint
ALTER TABLE "app_private"."user" ADD COLUMN "email_unsubscribed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_private"."user" ADD COLUMN "email_unsubscribe_token" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "app_private"."email_delivery" ADD CONSTRAINT "email_delivery_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_private"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_private"."user" ADD CONSTRAINT "user_email_unsubscribe_token_unique" UNIQUE("email_unsubscribe_token");--> statement-breakpoint
REVOKE ALL ON "app_private"."email_delivery" FROM PUBLIC, anon, authenticated;
