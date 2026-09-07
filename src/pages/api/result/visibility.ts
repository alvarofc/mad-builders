import { getProfileByUserId } from '../../../server/profiles';
import { and, eq, sql } from 'drizzle-orm';
import type { APIRoute } from 'astro';
import { db } from '../../../server/db';
import { allowWrite } from '../../../server/rate-limit';
import { result, week } from '../../../server/schema';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect, url }) => {
  if (!locals.user) return redirect('/build', 303);
  if (request.headers.get('origin') !== url.origin) {
    return new Response('This request could not be verified.', { status: 403 });
  }
  if (!(await allowWrite(request, locals.user.id, 'visibility'))) {
    return new Response('Too many attempts. Try again in a minute.', { status: 429 });
  }

  const current = await getProfileByUserId(locals.user.id);
  if (!current) return redirect('/build', 303);

  const data = await request.formData();
  if (data.get('projectId') !== current.id) return new Response('Your active project changed. Reload before saving.', { status: 409 });
  const resultId = Number(data.get('resultId'));
  const action = String(data.get('action') ?? '');
  if (!Number.isSafeInteger(resultId) || resultId < 1) {
    return new Response('That result does not exist.', { status: 400 });
  }
  if (action !== 'withdraw' && action !== 'restore') {
    return new Response('Unknown action.', { status: 400 });
  }

  await db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ weekId: result.weekId })
      .from(result)
      .where(and(eq(result.id, resultId), eq(result.projectId, current.id)))
      .limit(1);
    if (!owned) return;
    await tx.select({ id: week.id }).from(week).where(eq(week.id, owned.weekId)).for('update');
    await tx
      .update(result)
      .set({ withdrawnAt: action === 'withdraw' ? sql`now()` : null })
      .where(and(eq(result.id, resultId), eq(result.projectId, current.id)));
  });
  return redirect('/settings', 303);
};
