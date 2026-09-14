WITH extended AS (
UPDATE app_private.week
SET submission_closes_at = TIMESTAMP '2026-09-15 00:00:00' AT TIME ZONE 'Europe/Madrid',
    voting_closes_at = TIMESTAMP '2026-09-18 18:00:00' AT TIME ZONE 'Europe/Madrid'
WHERE week_start_date = DATE '2026-09-07'
  AND finalized_at IS NULL
  AND ranking_status = 'pending'
  AND submission_closes_at < TIMESTAMP '2026-09-15 00:00:00' AT TIME ZONE 'Europe/Madrid'
  AND now() < TIMESTAMP '2026-09-15 00:00:00' AT TIME ZONE 'Europe/Madrid'
RETURNING id, submission_closes_at
), corrected AS (
  UPDATE app_private.result AS r
  SET on_time = true
  FROM extended AS w
  WHERE r.week_id = w.id AND NOT r.on_time AND r.published_at < w.submission_closes_at
  RETURNING r.project_id, r.published_at, r.status
)
UPDATE app_private.project AS p
SET first_on_time_result_at = least(p.first_on_time_result_at, corrected.published_at)
FROM corrected
WHERE p.id = corrected.project_id AND corrected.status <> 'missed';
