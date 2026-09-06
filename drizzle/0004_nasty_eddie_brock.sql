ALTER TABLE "app_private"."result" DROP CONSTRAINT "result_status_check";--> statement-breakpoint
ALTER TABLE "app_private"."result" ADD CONSTRAINT "result_status_check" CHECK ("app_private"."result"."status" in ('complete', 'partial', 'missed', 'submitted'));--> statement-breakpoint
UPDATE app_private.week
SET voting_closes_at = (week_start_date::timestamp + interval '7 days 18 hours') AT TIME ZONE 'Europe/Madrid'
WHERE ranking_status = 'pending' AND submission_closes_at > now();
