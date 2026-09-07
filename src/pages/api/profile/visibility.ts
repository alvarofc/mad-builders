import { getProfileByUserId } from '../../../server/profiles';
import { eq, isNull, sql } from 'drizzle-orm';
import type { APIRoute } from 'astro';
import { db } from '../../../server/db';
import { allowWrite } from '../../../server/rate-limit';
import { project, week } from '../../../server/schema';

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
  const action = String(data.get('action') ?? '');
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
      .update(project)
      .set({ withdrawnAt: action === 'withdraw' ? sql`now()` : null, updatedAt: sql`now()` })
      .where(eq(project.id, current.id));
  });
  return redirect('/settings', 303);
};
