import { sql } from 'drizzle-orm';
import { db, databaseConfigured } from './db';

export type ReminderRecipient = {
  userId: string;
  email: string;
  weekId: number;
  needsResult: boolean;
  needsPromise: boolean;
};

export async function getReminderRecipients(kind: 'checkin' | 'voting', now: Date, userId?: string): Promise<ReminderRecipient[]> {
  if (!databaseConfigured) return [];
  const clock = now.toISOString();
  const deadline = kind === 'checkin' ? sql`w.submission_closes_at` : sql`w.voting_closes_at`;
  const window = sql`${clock}::timestamptz >= ${deadline} - interval '4 hours'
    and ${clock}::timestamptz < ${deadline}`;
  const active = sql`p.is_public = true and p.hidden_at is null and p.withdrawn_at is null
    and u.email_unsubscribed_at is null
    and ${userId === undefined ? sql`true` : sql`u.id = ${userId}`}
    and not exists (
      select 1 from app_private.email_delivery d
      where d.key = ${kind} || ':' || u.id || ':' || w.id::text
        and (d.sent_at is not null or d.created_at <= ${clock}::timestamptz - interval '23 hours'
          or d.locked_until > ${clock}::timestamptz)
    )`;

  if (kind === 'checkin') {
    return [...await db.execute<ReminderRecipient>(sql`
      select u.id as "userId", u.email, w.id::integer as "weekId",
        r.id is null as "needsResult", nc.id is null as "needsPromise"
      from app_private.week w
      cross join app_private."user" u
      join app_private.project_owner owner on owner.user_id = u.id and owner.active = true
      join app_private.project p on p.id = owner.project_id
      left join app_private.commitment c on c.project_id = p.id and c.week_id = w.id
      left join app_private.result r on r.project_id = p.id and r.week_id = w.id
      left join app_private.week nw on nw.week_start_date = w.week_start_date + 7
      left join app_private.commitment nc on nc.project_id = p.id and nc.week_id = nw.id
      where ${window} and ${active}
        and (c.id is not null or r.id is not null)
        and (r.id is null or nc.id is null)
      order by w.id, u.id limit 100
    `)];
  }

  return [...await db.execute<ReminderRecipient>(sql`
    with voting_week as (
      select w.* from app_private.week w where ${window}
        and w.submission_closes_at <= ${clock}::timestamptz
      order by w.starts_at desc limit 1
    ), candidates as (
      select r.id, r.project_id from app_private.result r
      join voting_week w on w.id = r.week_id
      join app_private.project p on p.id = r.project_id
      where r.on_time = true and r.status in ('complete', 'partial', 'submitted')
        and r.hidden_at is null and r.withdrawn_at is null
        and p.is_public = true and p.hidden_at is null and p.withdrawn_at is null
    )
    select u.id as "userId", u.email, w.id::integer as "weekId",
      false as "needsResult", false as "needsPromise"
    from voting_week w
    join app_private.result r on r.week_id = w.id
    join app_private.project p on p.id = r.project_id
    join app_private.project_owner owner on owner.project_id = p.id and owner.active = true
    join app_private."user" u on u.id = owner.user_id
    where ${active} and r.on_time = true and r.hidden_at is null and r.withdrawn_at is null
      and (select count(*) from candidates) >= 6
      and (select count(*) from app_private.comparison c
        where c.week_id = w.id and c.voter_project_id = p.id
          and c.invalidated_at is null and c.choice is not null) < 10
      and exists (
        select 1 from candidates low join candidates high on low.id < high.id
        where not exists (
          select 1 from app_private.project_owner voter_owner
          join app_private.project_owner candidate_owner on candidate_owner.user_id = voter_owner.user_id
          where voter_owner.project_id = p.id
            and candidate_owner.project_id in (low.project_id, high.project_id)
        )
          and (
            not exists (
              select 1 from app_private.comparison c where c.week_id = w.id
                and c.voter_project_id = p.id and c.candidate_low_id = low.id and c.candidate_high_id = high.id
            ) or exists (
              select 1 from app_private.comparison c where c.week_id = w.id
                and c.voter_project_id = p.id and c.candidate_low_id = low.id and c.candidate_high_id = high.id
                and c.choice is null and c.invalidated_at is null
            )
          )
      )
    order by w.id, u.id limit 100
  `)];
}
