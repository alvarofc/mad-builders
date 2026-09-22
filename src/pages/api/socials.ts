import type { APIRoute } from 'astro';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../server/db';
import { project, projectOwner, user } from '../../server/schema';
import { allowWrite } from '../../server/rate-limit';
import { normalizeSocialUrl, socialPlatforms } from '../../lib/socials';

export const prerender = false;
const fail = (message: string, status = 400) => new Response(message, { status });

export const POST: APIRoute = async ({ request, locals, url, redirect }) => {
  if (!locals.user) return fail('Sign in to save your social links.', 401);
  if (request.headers.get('origin') !== url.origin) return fail('This request could not be verified.', 403);
  if (!(await allowWrite(request, locals.user.id, 'social-links'))) return fail('Try again in a minute.', 429);
  const text = await request.text();
  if (text.length > 150_000) return fail('These links are too long.', 413);
  const form = new URLSearchParams(text);
  const personal: Record<string, string | null> = {};
  const company: Record<string, string | null> = {};
  for (const { key, label } of socialPlatforms) {
    for (const [scope, links] of [['personal', personal], ['company', company]] as const) {
      if (scope === 'company' && key === 'website') continue;
      if (!form.has(`${scope}.${key}`)) continue;
      try {
        const link = normalizeSocialUrl(form.get(`${scope}.${key}`) ?? '', key, scope === 'company');
        links[key] = link ?? null;
      } catch { return fail(`Enter a full https:// URL for ${scope === 'personal' ? 'your' : 'the company’s'} ${label} profile.`); }
    }
  }
  const saved = await db.transaction(async tx => {
    // Switching projects takes the same lock, so a stale settings tab cannot save to another project.
    await tx.select({ id: user.id }).from(user).where(eq(user.id, locals.user!.id)).for('update');
    const [owner] = await tx.select().from(projectOwner).where(and(
      eq(projectOwner.userId, locals.user!.id), eq(projectOwner.projectId, form.get('projectId') ?? ''), eq(projectOwner.active, true),
    )).limit(1);
    if (!owner) return false;
    if (Object.keys(personal).length) await tx.update(user).set({ socialLinks: sql`jsonb_strip_nulls(${user.socialLinks} || ${JSON.stringify(personal)}::jsonb)`, updatedAt: new Date() }).where(eq(user.id, locals.user!.id));
    if (Object.keys(company).length) await tx.update(project).set({ socialLinks: sql`jsonb_strip_nulls(${project.socialLinks} || ${JSON.stringify(company)}::jsonb)`, updatedAt: new Date() }).where(eq(project.id, owner.projectId));
    return true;
  });
  if (!saved) return fail('Your active project changed. Reload before saving.', 409);
  if (request.headers.get('accept')?.includes('application/json')) return Response.json({ saved: true });
  return redirect('/settings?socials=saved#socials', 303);
};
