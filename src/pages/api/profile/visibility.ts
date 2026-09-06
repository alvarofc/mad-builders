import { eq, isNull, sql } from 'drizzle-orm';
import type { APIRoute } from 'astro';
import { db } from '../../../server/db';
import { allowWrite } from '../../../server/rate-limit';
import { profile, week } from '../../../server/schema';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect, url }) => {
  if (!locals.user) return redirect('/build', 303);
  if (request.headers.get('origin') !== url.origin) {
    return new Response('This request could not be verified.', { status: 403 });
  }
  if (!(await allowWrite(request, locals.user.id, 'visibility'))) {
    return new Response('Too many attempts. Try again in a minute.', { status: 429 });
  }

  const action = String((await request.formData()).get('action') ?? '');
  if (action !== 'withdraw' && action !== 'restore') {
    return new Response('Unknown action.', { status: 400 });
  }

  await db.transaction(async (tx) => {
    await tx
      .select({ id: week.id })
      .from(week)
      .where(isNull(week.finalizedAt))
      .orderBy(week.id)
      .for('update');
    await tx
      .update(profile)
      .set({ withdrawnAt: action === 'withdraw' ? sql`now()` : null, updatedAt: sql`now()` })
      .where(eq(profile.userId, locals.user!.id));
  });
  return redirect('/settings', 303);
};
