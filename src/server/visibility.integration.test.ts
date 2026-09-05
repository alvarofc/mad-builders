import { expect, it } from 'vitest';
import postgres from 'postgres';

// Uses committed fixtures so the real Astro process can read them. Only run against a disposable local test DB.
it.skipIf(!process.env.PUBLIC_VISIBILITY_TEST_URL || !process.env.DATABASE_VISIBILITY_TEST_URL)(
  'keeps private profiles and results out of HTML, metadata, discovery, and social previews',
  async () => {
    const server = new URL(process.env.PUBLIC_VISIBILITY_TEST_URL!);
    const database = new URL(process.env.DATABASE_VISIBILITY_TEST_URL!);
    for (const url of [server, database]) {
      if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Visibility tests require loopback URLs.');
    }
    if (database.pathname !== '/mad_builders_privacy_test') throw new Error('Visibility tests require the dedicated mad_builders_privacy_test database.');
    const sql = postgres(database.toString(), { max: 1, prepare: false });
    const id = crypto.randomUUID();
    const handle = `privacy-${id.slice(0, 12)}`;
    const project = `SecretProject${id.slice(0, 8)}`;
    const summary = `PrivateProgress${id.slice(0, 8)}`;
    const weekDate = '1901-01-07';
    const profilePath = `/builders/${handle}`;
    const resultPath = `${profilePath}/weeks/${weekDate}`;
    let weekId: number | undefined;

    const get = (path: string, redirect: RequestRedirect = 'follow') => fetch(new URL(path, server), {
      redirect, signal: AbortSignal.timeout(15000),
    });
    const html = async (path: string, status = 200) => {
      const response = await get(path);
      expect(response.status, path).toBe(status);
      expect(response.headers.get('cache-control'), path).toContain('no-store');
      return response.text();
    };
    const png = async (path: string) => {
      const response = await get(path);
      expect(response.status, path).toBe(200);
      expect(response.headers.get('content-type'), path).toContain('image/png');
      const bytes = Buffer.from(await response.arrayBuffer());
      expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      return bytes;
    };
    const fallback = await png('/og.png');
    const expectPrivateImage = async (path: string) => {
      const response = await get(path, 'manual');
      expect(response.status, path).toBe(302);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(new URL(response.headers.get('location')!, server).pathname).toBe('/og.png');
      expect(await png(path)).toEqual(fallback);
    };

    try {
      await sql`insert into app_private.user (id, name, email) values (${id}, 'Privacy test', ${`${id}@example.invalid`})`;
      await sql`insert into app_private.profile (user_id, handle, display_name, project_name) values (${id}, ${handle}, 'Privacy test', ${project})`;
      const [week] = await sql`insert into app_private.week (week_start_date, starts_at, submission_closes_at, voting_closes_at)
        values (${weekDate}, now() - interval '1 hour', now() + interval '1 hour', now() + interval '2 hours') returning id`;
      weekId = week.id;
      const [commitment] = await sql`insert into app_private.commitment (user_id, week_id, promise) values (${id}, ${weekId!}, 'Ship a demo') returning id`;
      await sql`insert into app_private.result (commitment_id, user_id, week_id, status, summary, on_time)
        values (${commitment.id}, ${id}, ${weekId!}, 'complete', ${summary}, true)`;

      // Positive controls prevent disconnected server/database configuration from passing invisibility checks.
      const visibleProfile = await html(profilePath);
      expect(visibleProfile).toContain(project);
      expect(visibleProfile).toContain(summary);
      expect(visibleProfile.match(/<head[\s\S]*?<\/head>/)?.[0]).toContain(project);
      const visibleResult = await html(resultPath);
      expect(visibleResult).toContain(summary);
      expect(visibleResult.match(/<head[\s\S]*?<\/head>/)?.[0]).toContain(summary);
      expect(await html('/builders')).toContain(project);
      expect(await html('/leaderboard?demo=0')).toContain(summary);
      expect(await png(`/api/og${profilePath}.png`)).not.toEqual(fallback);
      expect(await png(`/api/og${resultPath}.png`)).not.toEqual(fallback);

      // There is no server-side result draft: drafts are localStorage only. is_public=false is the unpublished profile state.
      for (const state of ['draft', 'hidden', 'withdrawn']) {
        await sql`update app_private.profile set is_public = ${state !== 'draft'},
          hidden_at = ${state === 'hidden' ? new Date() : null}, withdrawn_at = ${state === 'withdrawn' ? new Date() : null} where user_id = ${id}`;
        for (const path of [profilePath, resultPath]) {
          const page = await html(path, 404);
          expect(page).not.toContain(project);
          expect(page).not.toContain(summary);
        }
        for (const path of ['/builders', '/leaderboard?demo=0']) {
          const page = await html(path);
          expect(page).not.toContain(project);
          expect(page).not.toContain(summary);
        }
        await expectPrivateImage(`/api/og${profilePath}.png`);
        await expectPrivateImage(`/api/og${resultPath}.png`);
      }

      await sql`update app_private.profile set is_public = true, hidden_at = null, withdrawn_at = null where user_id = ${id}`;
      for (const state of ['hidden', 'withdrawn']) {
        await sql`update app_private.result set hidden_at = ${state === 'hidden' ? new Date() : null},
          withdrawn_at = ${state === 'withdrawn' ? new Date() : null} where user_id = ${id}`;
        expect(await html(resultPath, 404)).not.toContain(summary);
        const page = await html(profilePath);
        expect(page).toContain(project);
        expect(page).not.toContain(summary);
        expect(await html('/leaderboard?demo=0')).not.toContain(summary);
        await expectPrivateImage(`/api/og${resultPath}.png`);
        expect(await png(`/api/og${profilePath}.png`)).not.toEqual(fallback);
      }
    } finally {
      await sql`delete from app_private.result where user_id = ${id}`;
      await sql`delete from app_private.commitment where user_id = ${id}`;
      await sql`delete from app_private.user where id = ${id}`;
      if (weekId !== undefined) await sql`delete from app_private.week where id = ${weekId}`;
      await sql.end();
    }
  },
  120000,
);
