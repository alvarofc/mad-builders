import { expect, it, vi } from 'vitest';
import { sql, type SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const proxy = vi.hoisted(() => ({ execute: (_query: SQL): Promise<unknown> => Promise.resolve([]) }));
vi.mock('./db', () => ({ databaseConfigured: true, db: proxy }));
import { getReminderRecipients } from './email-recipients';

it.skipIf(!process.env.DATABASE_EMAIL_TEST_URL)('selects only actionable reminders, respects deadlines, preferences, and exhausted deliveries', async () => {
  const url = new URL(process.env.DATABASE_EMAIL_TEST_URL!);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/mad_builders_test') {
    throw new Error('Email tests require a loopback mad_builders_test database');
  }
  const connection = postgres(url.toString(), { max: 1, prepare: false });
  const rollback = new Error('roll back email fixtures');
  try {
    await drizzle(connection).transaction(async (db) => {
      proxy.execute = (query) => db.execute(query);
      const prefix = crypto.randomUUID();
      const owner = `${prefix}-0`;
      const [w] = await db.execute<{ id: number }>(sql`
        insert into app_private.week (week_start_date, starts_at, submission_closes_at, voting_closes_at)
        values ('1902-01-06', '1902-01-06T00:00:00Z', '1902-01-12T17:00:00Z', '1902-01-13T17:00:00Z') returning id`);
      const [next] = await db.execute<{ id: number }>(sql`
        insert into app_private.week (week_start_date, starts_at, submission_closes_at, voting_closes_at)
        values ('1902-01-13', '1902-01-13T00:00:00Z', '1902-01-19T17:00:00Z', '1902-01-20T17:00:00Z') returning id`);
      const sunday = new Date('1902-01-12T13:00:00Z');
      const monday = new Date('1902-01-13T13:00:00Z');
      const ids: number[] = [];
      for (let index = 0; index < 6; index++) {
        const id = `${prefix}-${index}`;
        await db.execute(sql`insert into app_private."user" (id, name, email) values (${id}, 'Test', ${`${id}@example.invalid`})`);
        await db.execute(sql`insert into app_private.project (id, handle, project_name)
          values (${id}, ${`email-${prefix.slice(0, 8)}-${index}`}, 'Test project')`);
        await db.execute(sql`insert into app_private.project_owner (project_id, user_id, active) values (${id}, ${id}, true)`);
        const [c] = await db.execute<{ id: number }>(sql`insert into app_private.commitment (project_id, week_id, promise)
          values (${id}, ${w.id}, 'Ship') returning id`);
        if (index === 0) {
          expect(await getReminderRecipients('checkin', new Date(sunday.getTime() - 1))).toEqual([]);
          expect(await getReminderRecipients('checkin', sunday)).toEqual([
            { userId: owner, email: `${owner}@example.invalid`, weekId: Number(w.id), needsResult: true, needsPromise: true },
          ]);
        }
        const [r] = await db.execute<{ id: number }>(sql`insert into app_private.result (commitment_id, project_id, week_id, status, summary, on_time)
          values (${c.id}, ${id}, ${w.id}, 'submitted', 'Shipped', true) returning id`);
        ids.push(Number(r.id));
      }
      const recipients = (kind: 'checkin' | 'voting') => getReminderRecipients(kind, kind === 'checkin' ? sunday : monday);
      expect((await recipients('checkin'))[0]).toMatchObject({ needsResult: false, needsPromise: true });
      await db.execute(sql`update app_private.result set hidden_at = now() where project_id = ${owner}`);
      expect((await recipients('checkin')).find((r) => r.userId === owner)?.needsResult).toBe(false);
      expect(await recipients('voting')).toEqual([]); // Only five candidates remain.
      await db.execute(sql`update app_private.result set hidden_at = null where project_id = ${owner}`);
      await db.execute(sql`insert into app_private.commitment (project_id, week_id, promise) values (${owner}, ${next.id}, 'Next')`);
      expect((await recipients('checkin')).some((r) => r.userId === owner)).toBe(false);
      expect(await recipients('voting')).toHaveLength(6);
      expect(await getReminderRecipients('voting', monday, owner)).toHaveLength(1);
      expect(await getReminderRecipients('voting', monday, 'missing-user')).toEqual([]);
      expect(await getReminderRecipients('checkin', sunday, owner)).toEqual([]);
      expect(await getReminderRecipients('checkin', sunday, `${prefix}-1`)).toHaveLength(1);
      expect(await db.execute(sql`select id from app_private.comparison where week_id = ${w.id}`)).toHaveLength(0);
      await db.execute(sql`update app_private.project set is_public = false where id = ${owner}`);
      expect((await recipients('checkin')).some((r) => r.userId === owner)).toBe(false);
      expect(await recipients('voting')).toEqual([]);
      await db.execute(sql`update app_private.project set is_public = true where id = ${owner}`);
      expect(await getReminderRecipients('voting', new Date('1902-01-13T17:00:00Z'))).toEqual([]);
      await db.execute(sql`update app_private."user" set email_unsubscribed_at = now() where id = ${owner}`);
      expect((await recipients('voting')).some((r) => r.userId === owner)).toBe(false);
      await db.execute(sql`update app_private."user" set email_unsubscribed_at = null where id = ${owner}`);
      // Invalidated historical pairs stay used; a valid pending pair remains actionable.
      for (let low = 1; low < 6; low++) {
        for (let high = low + 1; high < 6; high++) {
          await db.execute(sql`insert into app_private.comparison
            (week_id, voter_project_id, candidate_low_id, candidate_high_id, presented_first_id, choice, invalidated_at)
            values (${w.id}, ${owner}, ${ids[low]}, ${ids[high]}, ${ids[low]}, 'pass', now())`);
        }
      }
      expect((await recipients('voting')).some((r) => r.userId === owner)).toBe(false);
      await db.execute(sql`update app_private.comparison set choice = null, invalidated_at = null
        where voter_project_id = ${owner} and candidate_low_id = ${ids[1]} and candidate_high_id = ${ids[2]}`);
      expect((await recipients('voting')).some((r) => r.userId === owner)).toBe(true);
      await db.execute(sql`update app_private.comparison set choice = 'pass', invalidated_at = null where voter_project_id = ${owner}`);
      expect((await recipients('voting')).some((r) => r.userId === owner)).toBe(false);
      // Co-owners receive reminders for their active project and share completed voting work.
      const teammate = `${prefix}-teammate`;
      await db.execute(sql`insert into app_private."user" (id, name, email)
        values (${teammate}, 'Teammate', ${`${teammate}@example.invalid`})`);
      await db.execute(sql`insert into app_private.project_owner (project_id, user_id, active)
        values (${owner}, ${teammate}, true)`);
      expect(await getReminderRecipients('checkin', sunday, teammate)).toEqual([]);
      expect(await getReminderRecipients('voting', monday, teammate)).toEqual([]);
      await db.execute(sql`update app_private.comparison set choice = null
        where voter_project_id = ${owner} and candidate_low_id = ${ids[1]} and candidate_high_id = ${ids[2]}`);
      expect(await getReminderRecipients('voting', monday, teammate)).toHaveLength(1);
      // Even an inactive ownership excludes that project for every co-owner.
      await db.execute(sql`insert into app_private.project_owner (project_id, user_id, active)
        values (${`${prefix}-1`}, ${teammate}, false)`);
      expect(await getReminderRecipients('voting', monday, owner)).toEqual([]);
      expect(await getReminderRecipients('voting', monday, teammate)).toEqual([]);
      const key = `voting:${prefix}-1:${w.id}`;
      await db.execute(sql`insert into app_private.email_delivery (key, user_id, payload, created_at, sent_at)
        values (${key}, ${`${prefix}-1`}, '{}', ${monday.toISOString()}, ${monday.toISOString()})`);
      expect((await recipients('voting')).some((r) => r.userId === `${prefix}-1`)).toBe(false);
      await db.execute(sql`update app_private.email_delivery set sent_at = null, locked_until = ${monday.toISOString()}::timestamptz + interval '1 minute' where key = ${key}`);
      expect(await getReminderRecipients('voting', monday, `${prefix}-1`)).toEqual([]);
      await db.execute(sql`update app_private.email_delivery set locked_until = ${monday.toISOString()} where key = ${key}`);
      expect(await getReminderRecipients('voting', monday, `${prefix}-1`)).toHaveLength(1);
      await db.execute(sql`update app_private.email_delivery set sent_at = null, created_at = ${monday.toISOString()}::timestamptz - interval '23 hours' where key = ${key}`);
      expect((await recipients('voting')).some((r) => r.userId === `${prefix}-1`)).toBe(false);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await connection.end();
  }
});
