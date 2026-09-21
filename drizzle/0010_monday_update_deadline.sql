WITH extended AS (
  UPDATE app_private.week
  SET submission_closes_at = (week_start_date::timestamp + interval '8 days') AT TIME ZONE 'Europe/Madrid',
      voting_closes_at = greatest(voting_closes_at, (week_start_date::timestamp + interval '9 days') AT TIME ZONE 'Europe/Madrid')
  WHERE finalized_at IS NULL
    AND ranking_status = 'pending'
    AND submission_closes_at < (week_start_date::timestamp + interval '8 days') AT TIME ZONE 'Europe/Madrid'
    AND now() < (week_start_date::timestamp + interval '8 days') AT TIME ZONE 'Europe/Madrid'
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
FROM (
  SELECT project_id, min(published_at) AS published_at
  FROM corrected WHERE status <> 'missed' GROUP BY project_id
) AS corrected
WHERE p.id = corrected.project_id;
