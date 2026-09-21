-- Wait for publications before taking the correction statement's snapshot.
SELECT id FROM app_private.week
WHERE finalized_at IS NULL AND ranking_status = 'pending'
  AND submission_closes_at = (week_start_date::timestamp + interval '8 days') AT TIME ZONE 'Europe/Madrid'
ORDER BY id FOR UPDATE;
--> statement-breakpoint
WITH corrected AS (
  UPDATE app_private.result AS r
  SET on_time = true
  FROM app_private.week AS w
  WHERE r.week_id = w.id AND NOT r.on_time
    AND w.finalized_at IS NULL AND w.ranking_status = 'pending'
    AND w.submission_closes_at = (w.week_start_date::timestamp + interval '8 days') AT TIME ZONE 'Europe/Madrid'
    AND r.published_at < w.submission_closes_at
  RETURNING r.project_id, r.published_at, r.status
)
UPDATE app_private.project AS p
SET first_on_time_result_at = least(p.first_on_time_result_at, corrected.published_at)
FROM (
  SELECT project_id, min(published_at) AS published_at
  FROM corrected WHERE status <> 'missed' GROUP BY project_id
) AS corrected
WHERE p.id = corrected.project_id;
