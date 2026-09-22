import { cachedSocialRequest } from '../../../server/social-cache';
import type { APIRoute } from 'astro';
import { and, asc, desc, eq, gt, lt } from 'drizzle-orm';
import { db } from '../../../server/db';
import { getProfileByUserId, getUserSocialLinks } from '../../../server/profiles';
import { allowWrite } from '../../../server/rate-limit';
import { commitment, result, week } from '../../../server/schema';
import { getDatabaseNow } from '../../../server/weeks';
import { chatWithWeeklyCoach } from '../../../server/weekly-coach';
import { coachRequestSchema } from '../../../lib/weekly-chat';
import { gatherSocialContext } from '../../../server/social-context';
import { reviewSocialContext } from '../../../server/social-review';

export const prerender = false;
// ponytail: coalesce identical welcomes within a worker; shared coordination only if cross-worker duplication becomes costly.
const openings = new Map<string, ReturnType<typeof chatWithWeeklyCoach>>();
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export const POST: APIRoute = async ({ request, locals, url }) => {
  if (!locals.user) return reply({ error: 'Sign in to continue this conversation.' }, 401);
  if (request.headers.get('origin') !== url.origin) return reply({ error: 'This request could not be verified.' }, 403);
  if (!import.meta.env.CEREBRAS_API_KEY) return reply({ error: 'Chat is unavailable. You can still edit and publish your draft.' }, 503);
  const text = await request.text();
  // Fits 40 x 3,000 characters plus draft fields, even with six-character JSON escapes.
  if (text.length > 750_000) return reply({ error: 'This conversation is too long. Start a new conversation with your current draft.' }, 400);
  let body;
  try { body = coachRequestSchema.parse(JSON.parse(text)); }
  catch { return reply({ error: 'Could not read this message. Keep messages under 3,000 characters.' }, 400); }
  if (!(await allowWrite(request, locals.user.id, 'weekly-chat', 10))) return reply({ error: 'Give it a moment, then send your message again.' }, 429);
  try {
    const project = await getProfileByUserId(locals.user.id);
    if (!project || project.id !== body.projectId) return reply({ error: 'Your active project changed. Reload before continuing.' }, 409);
    const [selectedWeek] = await db.select().from(week).where(eq(week.id, body.weekId)).limit(1);
    const now = await getDatabaseNow();
    if (!selectedWeek || selectedWeek.startsAt > now) return reply({ error: 'That week has not started.' }, 400);
    const [pledge] = await db.select().from(commitment)
      .where(and(eq(commitment.projectId, project.id), eq(commitment.weekId, selectedWeek.id))).limit(1);
    const [published] = await db.select({ id: result.id }).from(result)
      .where(and(eq(result.projectId, project.id), eq(result.weekId, selectedWeek.id))).limit(1);
    if (now >= selectedWeek.submissionClosesAt && published) return reply({ error: 'This update is no longer editable.' }, 409);
    const [nextWeek] = await db.select().from(week).where(gt(week.startsAt, selectedWeek.startsAt)).orderBy(asc(week.startsAt)).limit(1);
    const canSetNextGoal = Boolean(nextWeek && now < nextWeek.startsAt);
    const [nextGoal] = nextWeek ? await db.select({ promise: commitment.promise }).from(commitment)
      .where(and(eq(commitment.projectId, project.id), eq(commitment.weekId, nextWeek.id))).limit(1) : [];
    // ponytail: four recent updates keep context bounded; add retrieval if longer history proves useful.
    const previousUpdates = await db.select({ week: week.weekStartDate, goal: commitment.promise,
      summary: result.summary, outcome: result.status, feedback: result.feedbackRequest }).from(result)
      .innerJoin(week, eq(result.weekId, week.id)).innerJoin(commitment, eq(result.commitmentId, commitment.id))
      .where(and(eq(result.projectId, project.id), lt(week.startsAt, selectedWeek.startsAt)))
      .orderBy(desc(week.startsAt)).limit(4);
    let social: Awaited<ReturnType<typeof gatherSocialContext>>;
    if (body.includeSocialPosts) {
      if (!(await allowWrite(request, locals.user.id, 'social-import', 2))) return reply({ error: 'Give it a minute before checking social activity again.' }, 429);
      const personal = await getUserSocialLinks(locals.user.id);
      social = await gatherSocialContext(locals.user.id, project.id, personal, project.socialLinks ?? {}, selectedWeek.startsAt, now, selectedWeek.submissionClosesAt, body.refreshSocialPosts === true);
      const reviewProject = { name: project.projectName, description: project.bio, website: project.projectUrl };
      const relevant = await cachedSocialRequest('review-v1', [locals.user.id, project.id, selectedWeek.weekStartDate, reviewProject, pledge?.promise, body.draft.summary, previousUpdates, social.posts, social.audience, import.meta.env.CEREBRAS_MODEL], () => reviewSocialContext({ name: project.projectName, description: project.bio, website: project.projectUrl },
        pledge?.promise ?? '', body.draft.summary, previousUpdates, social!), now);
      social = { ...social, ...relevant };
      if (!body.opening && !social.posts.length && !social.audience.length) return reply({
        reply: !social.accountCount ? 'Add your LinkedIn or X accounts in settings to use social activity.'
          : social.warnings.length ? 'Some social activity was unavailable. I found nothing relevant to add from what I could check.'
          : 'I found no new social activity clearly relevant to this update. What else moved forward this week?',
        changes: { summary: null, nextPromise: null, feedbackRequest: null },
        socialPosts: [], socialAudience: [], socialWarnings: social.warnings, socialAccountCount: social.accountCount, historyCount: previousUpdates.length,
      });
    } else {
      const personal = await getUserSocialLinks(locals.user.id);
      social = await gatherSocialContext(locals.user.id, project.id, personal, project.socialLinks ?? {}, selectedWeek.startsAt, now, selectedWeek.submissionClosesAt, false, true);
    }
    const coachContext = {
      project: { name: project.projectName, description: project.bio, stage: project.projectStage, website: project.projectUrl },
      week: selectedWeek.weekStartDate, goal: pledge?.promise ?? '', nextWeek: nextWeek?.weekStartDate ?? null,
      canSetNextGoal, existingNextGoal: nextGoal?.promise ?? '', previousUpdates,
      socialPosts: social.posts, socialAudience: social.audience, socialWarnings: social.warnings,
      socialAccountCount: social.accountCount, socialOnly: Boolean(body.includeSocialPosts && !body.opening),
      ...(body.opening ? { opening: true } : {}),
      ...(body.openingReply ? { openingReply: body.openingReply } : {}),
    };
    const generate = () => chatWithWeeklyCoach(coachContext, body.opening
      ? [{ role: 'user', content: 'Help me start my weekly check-in using the context already available.' }]
      : body.includeSocialPosts ? [{ role: 'user', content: 'Suggest relevant new social evidence for this draft.' }] : body.messages, body.draft);
    const generateOpening = () => {
      const key = JSON.stringify([locals.user!.id, project.id, coachContext, body.draft, import.meta.env.CEREBRAS_MODEL]);
      let pending = openings.get(key);
      if (!pending) {
        pending = generate().finally(() => openings.delete(key));
        openings.set(key, pending);
      }
      return pending;
    };
    const response = body.includeSocialPosts && !body.opening
      ? await cachedSocialRequest('social-draft-v1', [locals.user.id, project.id, coachContext, body.draft, import.meta.env.CEREBRAS_MODEL], generate, now)
      : body.opening ? await generateOpening() : await generate();
    if (body.opening) response.changes = { summary: null, nextPromise: null, feedbackRequest: null };
    // Importing evidence is not agreement to a new goal.
    if (body.includeSocialPosts) { response.changes.nextPromise = null; response.changes.feedbackRequest = null; }
    return reply({ ...response, historyCount: previousUpdates.length,
      socialPosts: social.posts, socialAudience: social.audience, socialWarnings: social.warnings, socialAccountCount: social.accountCount,
    });
  } catch {
    return reply({ error: 'Could not reply just now. Retry your message or continue editing the draft.' }, 502);
  }
};
