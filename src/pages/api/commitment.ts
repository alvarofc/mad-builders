import { sql } from 'drizzle-orm';
import type { APIRoute } from 'astro';
import { db } from '../../server/db';
import { getProfileByUserId } from '../../server/profiles';
import { allowWrite } from '../../server/rate-limit';

export const prerender = false;

const fail = (message: string, status = 400) =>
  new Response(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export const POST: APIRoute = async ({ request, locals, redirect, url }) => {
  if (!locals.user) return redirect('/build', 303);
  if (request.headers.get('origin') !== url.origin) return fail('This request could not be verified.', 403);
  if (!(await allowWrite(request, locals.user.id, 'commitment'))) return fail('Too many attempts. Try again in a minute.', 429);
  if (!(await getProfileByUserId(locals.user.id))) return redirect('/build', 303);

  const data = await request.formData();
  const weekId = Number(data.get('weekId'));
  const promise = String(data.get('promise') ?? '').trim();

  if (!Number.isSafeInteger(weekId) || weekId < 1) return fail('That week does not exist.');
  if (promise.length < 5 || promise.length > 280) {
    return fail('Keep the commitment between 5 and 280 characters.');
  }

  const saved = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from app_private.week where id = ${weekId} for update`);
    const rows = await tx.execute<{ id: number }>(sql`
      insert into app_private.commitment (user_id, week_id, promise)
      select ${locals.user!.id}, id, ${promise}
      from app_private.week
      where id = ${weekId} and starts_at > clock_timestamp()
      on conflict (user_id, week_id)
      do update set promise = excluded.promise, updated_at = now()
      returning id
    `);
    if (!rows.length) return false;

    await tx.execute(sql`
      update app_private.profile
      set first_commitment_at = coalesce(first_commitment_at, now()), updated_at = now()
      where user_id = ${locals.user!.id}
    `);
    return true;
  });

  if (!saved) return fail('That week has already started.', 409);
  return redirect('/build', 303);
};
