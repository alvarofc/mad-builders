import { readFile, readdir } from 'node:fs/promises';
import { expect, it } from 'vitest';
import postgres from 'postgres';

it.skipIf(!process.env.DATABASE_MIGRATION_TEST_URL)('migrates legacy profiles and history into owned projects without losing account email settings', async () => {
  const url = new URL(process.env.DATABASE_MIGRATION_TEST_URL!);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/mad_builders_migration_test') {
    throw new Error('Migration tests require a loopback mad_builders_migration_test database');
  }
  const connection = postgres(url.toString(), { max: 1, prepare: false });
  const rollback = new Error('rollback migration fixtures and schema');
  try {
    await connection.begin(async (tx) => {
      const [existing] = await tx`select to_regnamespace('app_private') as schema`;
      if (existing.schema) throw new Error('Migration test requires an empty database');
      const directory = new URL('../../drizzle/', import.meta.url);
      const migrations = (await readdir(directory)).filter((file) => /^000[0-6]_.*\.sql$/.test(file)).sort();
      expect(migrations).toHaveLength(7);
      for (const file of migrations) await tx.unsafe(await readFile(new URL(file, directory), 'utf8'));
      const [week] = await tx`insert into app_private.week (week_start_date, starts_at, submission_closes_at, voting_closes_at)
        values ('2000-01-03', '2000-01-03T00:00:00Z', '2000-01-09T17:00:00Z', '2000-01-10T17:00:00Z') returning id`;
      for (const id of ['legacy-owner', 'legacy-peer']) {
        await tx`insert into app_private."user" (id, name, email, email_unsubscribed_at)
          values (${id}, 'OAuth name', ${`${id}@example.invalid`}, '2000-01-01T00:00:00Z')`;
        await tx`insert into app_private.profile (user_id, handle, display_name, project_name, bio, project_url)
          values (${id}, ${id}, 'Chosen name', ${`Startup ${id}`}, 'Project description', 'https://example.invalid')`;
        const [commitment] = await tx`insert into app_private.commitment (user_id, week_id, promise)
          values (${id}, ${week.id}, 'Ship the prototype') returning id`;
        await tx`insert into app_private.result (commitment_id, user_id, week_id, status, summary, on_time)
          values (${commitment.id}, ${id}, ${week.id}, 'submitted', 'Prototype shipped', true)`;
      }
      const results = await tx`select * from app_private.result order by id`;
      await tx`insert into app_private.comparison (week_id, voter_user_id, candidate_low_id, candidate_high_id, presented_first_id, choice)
        values (${week.id}, 'legacy-owner', ${results[0].id}, ${results[1].id}, ${results[0].id}, 'low')`;
      await tx`insert into app_private.ranking (week_id, result_id, score_numerator, score_denominator, wins, ties, decisions, rank, finalized_at)
        values (${week.id}, ${results[0].id}, 1, 1, 1, 0, 1, 1, now())`;
      await tx`insert into app_private.email_delivery (key, user_id, payload, sent_at)
        values ('welcome:legacy-owner', 'legacy-owner', '{"subject":"Welcome"}', now())`;
      const users = await tx`select * from app_private."user" order by id`;
      const profiles = await tx`select * from app_private.profile order by user_id`;
      const commitments = await tx`select * from app_private.commitment order by id`;
      const comparisons = await tx`select * from app_private.comparison order by id`;
      const rankings = await tx`select * from app_private.ranking order by id`;
      const deliveries = await tx`select * from app_private.email_delivery order by key`;
      await tx.unsafe(await readFile(new URL('0007_shared_projects.sql', directory), 'utf8'));
      expect(await tx`select * from app_private.project order by id`).toEqual(profiles.map(({ user_id, display_name, ...fields }) => ({ ...fields, id: user_id })));
      expect(await tx`select * from app_private.project_owner order by project_id`).toEqual([
        { project_id: 'legacy-owner', user_id: 'legacy-owner', active: true },
        { project_id: 'legacy-peer', user_id: 'legacy-peer', active: true },
      ]);
      expect(await tx`select * from app_private.commitment order by id`).toEqual(commitments.map(({ user_id, ...fields }) => ({ ...fields, project_id: user_id })));
      expect(await tx`select * from app_private.result order by id`).toEqual(results.map(({ user_id, ...fields }) => ({ ...fields, project_id: user_id, updated_by_user_id: user_id })));
      expect(await tx`select * from app_private.comparison order by id`).toEqual(comparisons.map(({ voter_user_id, ...fields }) => ({ ...fields, voter_project_id: voter_user_id })));
      expect(await tx`select * from app_private.ranking order by id`).toEqual(rankings);
      expect(await tx`select * from app_private."user" order by id`).toEqual(users.map((account) => ({ ...account, name: 'Chosen name' })));
      expect(await tx`select * from app_private.email_delivery order by key`).toEqual(deliveries);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await connection.end();
  }
}, 30000);
