import { and, asc, desc, eq, gt, isNull, lte, sql } from 'drizzle-orm';
import { db, databaseConfigured } from './db';
import { commitment, profile, ranking, result, user, week } from './schema';
import { getDatabaseNow } from './weeks';

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

const publicColumns = {
  userId: profile.userId,
  handle: profile.handle,
  displayName: profile.displayName,
  location: profile.location,
  bio: profile.bio,
  projectName: profile.projectName,
  projectUrl: profile.projectUrl,
  projectStage: profile.projectStage,
  image: user.image,
  joinedAt: profile.createdAt,
};

export async function getProfileByUserId(userId: string) {
  if (!databaseConfigured) return null;
  const [result] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1);
  return result ?? null;
}

export async function getPublicProfileByHandle(handle: string) {
  if (!databaseConfigured) return null;
  const [result] = await db
    .select(publicColumns)
    .from(profile)
    .innerJoin(user, eq(profile.userId, user.id))
    .where(
      and(
        eq(profile.handle, normalizeHandle(handle)),
        eq(profile.isPublic, true),
        isNull(profile.hiddenAt),
        isNull(profile.withdrawnAt),
      ),
    )
    .limit(1);
  return result ?? null;
}

export async function listPublicProfiles() {
  if (!databaseConfigured) return [];
  // ponytail: load the full pilot directory; paginate when response size becomes a problem.
  return db
    .select(publicColumns)
    .from(profile)
    .innerJoin(user, eq(profile.userId, user.id))
    .where(
      and(eq(profile.isPublic, true), isNull(profile.hiddenAt), isNull(profile.withdrawnAt)),
    )
    .orderBy(asc(profile.createdAt));
}

const publicResultColumns = {
  id: result.id,
  userId: result.userId,
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
  nextPromise: sql<string | null>`(select c.promise from app_private.commitment c join app_private.week w on w.id = c.week_id where c.user_id = ${result.userId} and w.week_start_date = ${week.weekStartDate} + 7 limit 1)`,
  rank: ranking.rank,
};

const visibleResult = and(isNull(result.hiddenAt), isNull(result.withdrawnAt));

export async function listRecentUpdates() {
  if (!databaseConfigured) return [];
  return db.select({ ...publicColumns, ...publicResultColumns }).from(result)
    .innerJoin(profile, eq(result.userId, profile.userId))
    .innerJoin(user, eq(profile.userId, user.id))
    .innerJoin(commitment, eq(result.commitmentId, commitment.id))
    .innerJoin(week, eq(result.weekId, week.id))
    .leftJoin(ranking, eq(result.id, ranking.resultId))
    .where(and(visibleResult, eq(profile.isPublic, true), isNull(profile.hiddenAt), isNull(profile.withdrawnAt)))
    .orderBy(desc(result.publishedAt)).limit(5);
}

export async function listPublicResultsByUserId(userId: string) {
  if (!databaseConfigured) return [];
  return db
    .select(publicResultColumns)
    .from(result)
    .innerJoin(commitment, eq(result.commitmentId, commitment.id))
    .innerJoin(week, eq(result.weekId, week.id))
    .leftJoin(ranking, eq(result.id, ranking.resultId))
    .where(and(eq(result.userId, userId), visibleResult))
    .orderBy(desc(week.weekStartDate));
}

export async function listResultsForOwner(userId: string) {
  if (!databaseConfigured) return [];
  return db
    .select({ ...publicResultColumns, withdrawnAt: result.withdrawnAt })
    .from(result)
    .innerJoin(commitment, eq(result.commitmentId, commitment.id))
    .innerJoin(week, eq(result.weekId, week.id))
    .leftJoin(ranking, eq(result.id, ranking.resultId))
    .where(eq(result.userId, userId))
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
    .innerJoin(profile, eq(result.userId, profile.userId))
    .innerJoin(user, eq(result.userId, user.id))
    .innerJoin(commitment, eq(result.commitmentId, commitment.id))
    .innerJoin(week, eq(result.weekId, week.id))
    .leftJoin(ranking, eq(result.id, ranking.resultId))
    .where(
      and(
        eq(profile.handle, normalizeHandle(handle)),
        eq(week.weekStartDate, weekStartDate),
        eq(profile.isPublic, true),
        isNull(profile.hiddenAt),
        isNull(profile.withdrawnAt),
        visibleResult,
      ),
    )
    .limit(1);
  return published ?? null;
}

export async function getPublicBuilderActivity(userId: string) {
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
    .where(and(eq(commitment.userId, userId), gt(week.votingClosesAt, now), sql`length(${commitment.promise}) > 0`))
    .orderBy(asc(week.startsAt))
    .limit(1);
  const closedWeeks = await db
    .select({ status: result.status, onTime: result.onTime })
    .from(week)
    .leftJoin(
      result,
      and(
        eq(result.weekId, week.id),
        eq(result.userId, userId),
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
  const [created] = await db.insert(profile).values(input).returning();
  return created;
}

export async function updateProfile(input: {
  userId: string;
  displayName: string;
  location: string;
  bio: string;
  projectName: string;
  projectUrl: string | null;
}) {
  const [updated] = await db
    .update(profile)
    .set({
      displayName: input.displayName,
      location: input.location,
      bio: input.bio,
      projectName: input.projectName,
      projectUrl: input.projectUrl,
      updatedAt: new Date(),
    })
    .where(eq(profile.userId, input.userId))
    .returning();
  return updated ?? null;
}
