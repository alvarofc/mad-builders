import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { expect, it } from 'vitest';

// Only temporary tables are touched; the real migration runs with a fixed clock.
it.skipIf(!process.env.DATABASE_MIGRATION_TEST_URL).each(['open', 'finalized', 'expired'])(
  'extends deadlines and corrects eligible results only when %s', async (scenario) => {
    const url = new URL(process.env.DATABASE_MIGRATION_TEST_URL!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/mad_builders_test') {
      throw new Error('Deadline migration tests require a disposable local mad_builders_test database');
    }
    const sql = postgres(process.env.DATABASE_MIGRATION_TEST_URL!, { max: 1 });
    const migration = readFileSync(new URL('../../drizzle/0008_extend_september_update.sql', import.meta.url), 'utf8')
      .replaceAll('app_private.', 'pg_temp.')
      .replaceAll('now()', `TIMESTAMPTZ '${scenario === 'expired' ? '2026-09-14 22:00:00+00' : '2026-09-14 12:00:00+00'}'`);
    try {
      await sql`create temporary table week (id int, week_start_date date, submission_closes_at timestamptz, voting_closes_at timestamptz, finalized_at timestamptz, ranking_status text)`;
      await sql`create temporary table project (id int, first_on_time_result_at timestamptz)`;
      await sql`create temporary table result (project_id int, week_id int, published_at timestamptz, status text, on_time boolean)`;
      await sql`insert into week values (1, '2026-09-07', '2026-09-13 16:00Z', '2026-09-14 16:00Z', null, 'pending'), (2, '2026-08-31', '2026-09-06 16:00Z', '2026-09-07 16:00Z', null, 'pending')`;
      if (scenario === 'finalized') await sql`update week set finalized_at = '2026-09-14 10:00Z', ranking_status = 'final' where id = 1`;
      await sql`insert into project values (1, null), (2, null), (3, null), (4, null)`;
      await sql`insert into result values (1, 1, '2026-09-14 10:00Z', 'submitted', false), (2, 1, '2026-09-14 11:00Z', 'missed', false), (3, 2, '2026-09-14 10:00Z', 'submitted', false), (4, 1, '2026-09-14 22:00Z', 'submitted', false)`;
      await sql.unsafe(migration);
      const snapshot = async () => ({
        weeks: await sql`select * from week order by id`,
        results: await sql`select * from result order by project_id`,
        projects: await sql`select * from project order by id`,
      });
      const saved = await snapshot();
      const extended = scenario === 'open';
      expect(saved.weeks[0].submission_closes_at.toISOString()).toBe(extended ? '2026-09-14T22:00:00.000Z' : '2026-09-13T16:00:00.000Z');
      expect(saved.weeks[0].voting_closes_at.toISOString()).toBe(extended ? '2026-09-18T16:00:00.000Z' : '2026-09-14T16:00:00.000Z');
      expect(saved.weeks[1].submission_closes_at.toISOString()).toBe('2026-09-06T16:00:00.000Z');
      expect(saved.results.map((row) => row.on_time)).toEqual([extended, extended, false, false]);
      expect(saved.projects.map((row) => row.first_on_time_result_at?.toISOString() ?? null)).toEqual([extended ? '2026-09-14T10:00:00.000Z' : null, null, null, null]);
      await sql.unsafe(migration);
      expect(await snapshot()).toEqual(saved);
    } finally {
      await sql.end();
    }
  },
);
