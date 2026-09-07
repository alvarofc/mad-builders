-- Run in the production Supabase SQL editor after migration and deployment.
-- Enable pg_cron and pg_net in the dashboard first. Store the production
-- CRON_SECRET in Vault as mad_builders_cron_secret (at least 32 characters).
-- Re-running this replaces the schedule of the same named job.
select cron.schedule(
  'mad-builders-email-reminders',
  '17 * * * *',
  $$
    select net.http_get(
      url := 'https://www.mad.builders/api/email/cron',
      headers := jsonb_build_object('Authorization', 'Bearer ' || decrypted_secret),
      timeout_milliseconds := 90000
    )
    from vault.decrypted_secrets
    where name = 'mad_builders_cron_secret' and length(decrypted_secret) >= 32;
  $$
);
