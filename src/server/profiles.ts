import { and, asc, desc, eq, gt, isNull, lte, sql } from 'drizzle-orm';
import { db, databaseConfigured } from './db';
import { commitment, project, projectOwner, ranking, result, user, week } from './schema';
import { getDatabaseNow } from './weeks';
import { PAGE_SIZE, pageNumber } from './pagination';

export const reservedHandles = new Set([
  'api',
  'brand',
  'build',
  'builders',
  'events',
  'leaderboard',
  'madrid',
  'settings',
  'vote',
]);

export const normalizeHandle = (value: string) => value.trim().toLowerCase();

export const validHandle = (value: string) =>
  /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(value) && !reservedHandles.has(value);

export function normalizeUrl(value: string) {
  if (!value.trim()) return null;
  if (value.trim().length > 2048) throw new Error('invalid_url');
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid_url');
  return url.toString();
}

export const ownerNames = sql<string>`coalesce((select string_agg(u.name, ', ' order by u.name, u.id) from app_private.project_owner po join app_private.user u on u.id = po.user_id where po.project_id = ${project.id}), '')`;

const publicColumns = {
  id: project.id,
  referrerUserId: sql<string | null>`(select po.user_id from app_private.project_owner po where po.project_id = ${project.id} order by po.user_id limit 1)`,
  handle: project.handle,
  displayName: ownerNames,
  location: project.location,
  bio: project.bio,
  projectName: project.projectName,
  projectUrl: project.projectUrl,
  projectStage: project.projectStage,
  image: sql<string | null>`null`,
  joinedAt: project.createdAt,
};

export async function getProfileByUserId(userId: string, connection: Pick<typeof db, 'select'> = db) {
  if (!databaseConfigured) return null;
  const [record] = await connection.select({ project }).from(project)
    .innerJoin(projectOwner, eq(project.id, projectOwner.projectId))
    .where(and(eq(projectOwner.userId, userId), eq(projectOwner.active, true))).limit(1);
  return record?.project ?? null;
}

export async function getPublicProfileByHandle(handle: string) {
  if (!databaseConfigured) return null;
  const [result] = await db
    .select(publicColumns)
    .from(project)
    .where(
      and(
        eq(project.handle, normalizeHandle(handle)),
        eq(project.isPublic, true),
        isNull(project.hiddenAt),
        isNull(project.withdrawnAt),
      ),
    )
    .limit(1);
  return result ?? null;
}

export async function listPublicProfiles(page = 1) {
  if (!databaseConfigured) return [];
  return db
    .select(publicColumns)
    .from(project)
    .where(
      and(eq(project.isPublic, true), isNull(project.hiddenAt), isNull(project.withdrawnAt)),
    )
    .orderBy(asc(project.createdAt), asc(project.id))
    .limit(PAGE_SIZE + 1).offset((pageNumber(page) - 1) * PAGE_SIZE);
}

const publicResultColumns = {
  id: result.id,
  projectId: result.projectId,
  weekStartDate: week.weekStartDate,
  promise: commitment.promise,
  status: result.status,
  summary: result.summary,
  feedbackRequest: result.feedbackRequest,
  projectSentence: result.projectSentence,
  projectUrlAtPublish: result.projectUrl,
  projectStage: result.projectStage,
  proofUrl: result.proofUrl,
  proofStatus: result.proofStatus,
  proofCheckedAt: result.proofCheckedAt,
  publishedAt: result.publishedAt,
  onTime: result.onTime,
  submissionClosesAt: week.submissionClosesAt,
  weekFinalizedAt: week.finalizedAt,
  nextPromise: sql<string | null>`(select c.promise from app_private.commitment c join app_private.week w on w.id = c.week_id where c.project_id = ${result.projectId} and w.week_start_date = ${week.weekStartDate} + 7 limit 1)`,
  rank: ranking.rank,
};

const visibleResult = and(isNull(result.hiddenAt), isNull(result.withdrawnAt));

export async function listRecentUpdates() {
  if (!databaseConfigured) return [];
  return db.select({ ...publicColumns, ...publicResultColumns }).from(result)
    .innerJoin(project, eq(result.projectId, project.id))
    .innerJoin(commitment, eq(result.commitmentId, commitment.id))
    .innerJoin(week, eq(result.weekId, week.id))
    .leftJoin(ranking, eq(result.id, ranking.resultId))
    .where(and(visibleResult, eq(project.isPublic, true), isNull(project.hiddenAt), isNull(project.withdrawnAt)))
    .orderBy(desc(result.publishedAt)).limit(5);
}

export async function listPublicResultsByProjectId(projectId: string) {
  if (!databaseConfigured) return [];
  return db
    .select(publicResultColumns)
    .from(result)
    .innerJoin(commitment, eq(result.commitmentId, commitment.id))
    .innerJoin(week, eq(result.weekId, week.id))
    .leftJoin(ranking, eq(result.id, ranking.resultId))
    .where(and(eq(result.projectId, projectId), visibleResult))
    .orderBy(desc(week.weekStartDate));
}

export async function listResultsForProject(projectId: string) {
  if (!databaseConfigured) return [];
  return db
    .select({ ...publicResultColumns, withdrawnAt: result.withdrawnAt })
    .from(result)
    .innerJoin(commitment, eq(result.commitmentId, commitment.id))
    .innerJoin(week, eq(result.weekId, week.id))
    .leftJoin(ranking, eq(result.id, ranking.resultId))
    .where(eq(result.projectId, projectId))
    .orderBy(desc(week.weekStartDate));
}

export async function getPublicResult(handle: string, weekStartDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)) return null;
  const date = new Date(`${weekStartDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== weekStartDate || weekStartDate.startsWith('0000')) return null;
  if (!databaseConfigured) return null;
  const [published] = await db
    .select({
      ...publicColumns,
      ...publicResultColumns,
    })
    .from(result)
    .innerJoin(project, eq(result.projectId, project.id))
    .innerJoin(commitment, eq(result.commitmentId, commitment.id))
    .innerJoin(week, eq(result.weekId, week.id))
    .leftJoin(ranking, eq(result.id, ranking.resultId))
    .where(
      and(
        eq(project.handle, normalizeHandle(handle)),
        eq(week.weekStartDate, weekStartDate),
        eq(project.isPublic, true),
        isNull(project.hiddenAt),
        isNull(project.withdrawnAt),
        visibleResult,
      ),
    )
    .limit(1);
  return published ?? null;
}

export async function getPublicProjectActivity(projectId: string) {
  if (!databaseConfigured) return { commitment: null, streak: 0, now: new Date(0) };

  const now = await getDatabaseNow();
  const [currentCommitment] = await db
    .select({
      promise: commitment.promise,
      weekStartDate: week.weekStartDate,
      startsAt: week.startsAt,
    })
    .from(commitment)
    .innerJoin(week, eq(commitment.weekId, week.id))
    .where(and(
      eq(commitment.projectId, projectId),
      gt(week.votingClosesAt, now),
      // Voting can overlap a newer building week; never label that older goal current.
      sql`${week.startsAt} >= coalesce((select max(w.starts_at) from app_private.week w where w.starts_at <= ${now.toISOString()}), ${now.toISOString()}::timestamptz)`,
      sql`length(${commitment.promise}) > 0`,
    ))
    .orderBy(asc(week.startsAt))
    .limit(1);
  const closedWeeks = await db
    .select({ status: result.status, onTime: result.onTime })
    .from(week)
    .leftJoin(
      result,
      and(
        eq(result.weekId, week.id),
        eq(result.projectId, projectId),
        isNull(result.hiddenAt),
        isNull(result.withdrawnAt),
      ),
    )
    .where(lte(week.submissionClosesAt, now))
    .orderBy(desc(week.startsAt))
    .limit(52);

  let streak = 0;
  for (const published of closedWeeks) {
    if (!published.onTime || !['complete', 'partial', 'submitted'].includes(published.status ?? '')) break;
    streak += 1;
  }
  return { commitment: currentCommitment ?? null, streak, now };
}

export async function createProfile(input: {
  userId: string;
  handle: string;
  displayName: string;
  location: string;
  bio: string;
  projectName: string;
  projectUrl: string | null;
  referredByUserId: string | null;
}) {
  return db.transaction(async (tx) => {
    // Serialize creation and switching for this account.
    await tx.select({ id: user.id }).from(user).where(eq(user.id, input.userId)).for('update');
    const [existing] = await tx.select().from(projectOwner).where(eq(projectOwner.userId, input.userId)).limit(1);
    if (existing) throw new Error('project_already_exists');
    const { userId, displayName, ...fields } = input;
    const [created] = await tx.insert(project).values({ ...fields, id: crypto.randomUUID() }).returning();
    await tx.update(user).set({ name: displayName }).where(eq(user.id, userId));
    await tx.insert(projectOwner).values({ projectId: created.id, userId, active: true });
    return created;
  });
}

export async function updateProfile(input: {
  projectId: string;
  userId: string;
  displayName: string;
  location: string;
  bio: string;
  projectName: string;
  projectUrl: string | null;
}) {
  const current = await getProfileByUserId(input.userId);
  if (!current || current.id !== input.projectId) return null;
  return db.transaction(async (tx) => {
    await tx.update(user).set({ name: input.displayName }).where(eq(user.id, input.userId));
    const [updated] = await tx.update(project).set({
      location: input.location, bio: input.bio, projectName: input.projectName,
      projectUrl: input.projectUrl, updatedAt: new Date(),
    }).where(eq(project.id, current.id)).returning();
    return updated;
  });
}
