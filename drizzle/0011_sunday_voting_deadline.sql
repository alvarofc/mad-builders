UPDATE app_private.week
SET voting_closes_at = (week_start_date::timestamp + interval '14 days') AT TIME ZONE 'Europe/Madrid'
WHERE finalized_at IS NULL
  AND ranking_status = 'pending'
  AND voting_closes_at < (week_start_date::timestamp + interval '14 days') AT TIME ZONE 'Europe/Madrid'
  AND now() < (week_start_date::timestamp + interval '14 days') AT TIME ZONE 'Europe/Madrid';
