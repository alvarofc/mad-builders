import type { APIRoute } from 'astro';
import { and, asc, desc, eq, gt, lt } from 'drizzle-orm';
import { db } from '../../../server/db';
import { getProfileByUserId } from '../../../server/profiles';
import { allowWrite } from '../../../server/rate-limit';
import { commitment, result, week } from '../../../server/schema';
import { getDatabaseNow } from '../../../server/weeks';
import { chatWithWeeklyCoach } from '../../../server/weekly-coach';
import { coachRequestSchema } from '../../../lib/weekly-chat';

export const prerender = false;
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export const POST: APIRoute = async ({ request, locals, url }) => {
  if (!locals.user) return reply({ error: 'Sign in to continue this conversation.' }, 401);
  if (request.headers.get('origin') !== url.origin) return reply({ error: 'This request could not be verified.' }, 403);
  if (!import.meta.env.CEREBRAS_API_KEY) return reply({ error: 'Chat is unavailable. You can still edit and publish your draft.' }, 503);
  const text = await request.text();
  if (text.length > 50_000) return reply({ error: 'This conversation is too long. Start a new conversation with your current draft.' }, 400);
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
    if (now >= selectedWeek.submissionClosesAt && (published || !pledge)) return reply({ error: 'This update is no longer editable.' }, 409);
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
    const response = await chatWithWeeklyCoach({
      project: { name: project.projectName, description: project.bio, stage: project.projectStage, website: project.projectUrl },
      week: selectedWeek.weekStartDate, goal: pledge?.promise ?? '', nextWeek: nextWeek?.weekStartDate ?? null,
      canSetNextGoal, existingNextGoal: nextGoal?.promise ?? '', previousUpdates,
    }, body.messages, body.draft);
    return reply({ ...response, historyCount: previousUpdates.length });
  } catch {
    return reply({ error: 'Could not reply just now. Retry your message or continue editing the draft.' }, 502);
  }
};
