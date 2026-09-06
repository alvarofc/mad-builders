import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { APIRoute } from 'astro';
import { db } from '../../server/db';
import { isOrganizer } from '../../server/organizers';
import { allowWrite } from '../../server/rate-limit';
import { comparison, profile, result, week } from '../../server/schema';

export const prerender = false;

const fail = (message: string, status = 400) => new Response(message, { status });

export const POST: APIRoute = async ({ request, locals, url }) => {
  if (!locals.user) return fail('Sign in first.', 401);
  if (request.headers.get('origin') !== url.origin) return fail('This request could not be verified.', 403);
  if (!(await isOrganizer(locals.user.id))) return fail('Not found.', 404);
  if (!(await allowWrite(request, locals.user.id, 'moderation'))) return fail('Too many attempts. Try again in a minute.', 429);

  const data = await request.formData();
  const kind = String(data.get('kind') ?? '');
  const handle = String(data.get('handle') ?? '').trim().toLowerCase();
  const weekStartDate = String(data.get('week') ?? '');
  const action = String(data.get('action') ?? 'hide');
  const reason = String(data.get('reason') ?? '').trim();
  if ((action !== 'restore' && !reason) || reason.length > 500) {
    return fail('Give a reason under 500 characters.');
  }

  const changed = await db.transaction(async (tx) => {
    if (kind === 'profile' && (action === 'hide' || action === 'restore')) {
      await tx
        .select({ id: week.id })
        .from(week)
        .where(isNull(week.finalizedAt))
        .orderBy(week.id)
        .for('update');
      const rows = await tx
        .update(profile)
        .set({
          hiddenAt: action === 'hide' ? sql`now()` : null,
          hiddenReason: action === 'hide' ? reason : null,
          updatedAt: sql`now()`,
        })
        .where(eq(profile.handle, handle))
        .returning({ id: profile.userId });
      return rows.length;
    }

    if (kind === 'result' && (action === 'hide' || action === 'restore')) {
      const [target] = await tx
        .select({ id: result.id, weekId: result.weekId })
        .from(result)
        .innerJoin(profile, eq(result.userId, profile.userId))
        .innerJoin(week, eq(result.weekId, week.id))
        .where(and(eq(profile.handle, handle), eq(week.weekStartDate, weekStartDate)))
        .limit(1);
      if (!target) return 0;
      await tx.select({ id: week.id }).from(week).where(eq(week.id, target.weekId)).for('update');
      const rows = await tx
        .update(result)
        .set({
          hiddenAt: action === 'hide' ? sql`now()` : null,
          hiddenReason: action === 'hide' ? reason : null,
        })
        .where(eq(result.id, target.id))
        .returning({ id: result.id });
      return rows.length;
    }

    if (kind === 'voter' && action === 'invalidate') {
      const [target] = await tx.select({ userId: profile.userId }).from(profile).where(eq(profile.handle, handle)).limit(1);
      if (!target) return 0;
      const openWeeks = await tx
        .select({ id: week.id })
        .from(week)
        .where(isNull(week.finalizedAt))
        .orderBy(week.id)
        .for('update');
      if (!openWeeks.length) return 0;
      const rows = await tx
        .update(comparison)
        .set({ invalidatedAt: sql`now()`, invalidationReason: reason })
        .where(
          and(
            eq(comparison.voterUserId, target.userId),
            inArray(comparison.weekId, openWeeks.map((openWeek) => openWeek.id)),
            isNull(comparison.invalidatedAt),
          ),
        )
        .returning({ id: comparison.id });
      return rows.length;
    }

    return -1;
  });

  if (changed === -1) return fail('Unknown moderation action.');
  if (!changed) return fail('Nothing matched.', 404);
  return new Response('Saved.');
};
