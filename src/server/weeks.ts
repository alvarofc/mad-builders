import { and, asc, desc, eq, gt, lte, sql } from 'drizzle-orm';
import { db, databaseConfigured } from './db';
import { commitment, result, week } from './schema';

export async function getDatabaseNow() {
  const [clock] = await db.execute<{ now: string }>(sql`select now() as now`);
  return new Date(clock.now);
}

export function madridWeekStartDates(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .map(({ type, value }) => [type, value]),
  );
  const monday = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);

  return [monday.toISOString().slice(0, 10), nextMonday.toISOString().slice(0, 10)] as const;
}

let scheduleRefresh: Promise<void> | null = null;
let scheduleFreshUntil = 0;

export async function ensureWeeklySchedule() {
  if (!databaseConfigured || Date.now() < scheduleFreshUntil) return;
  if (!scheduleRefresh) {
    scheduleRefresh = refreshWeeklySchedule().finally(() => {
      scheduleRefresh = null;
    });
  }
  await scheduleRefresh;
}

async function refreshWeeklySchedule() {
  const [currentMonday, nextMonday] = madridWeekStartDates(await getDatabaseNow());
  await db.execute(sql`
    insert into app_private.week
      (week_start_date, starts_at, submission_closes_at, voting_closes_at)
    select
      scheduled_date,
      scheduled_date::timestamp at time zone 'Europe/Madrid',
      (scheduled_date::timestamp + interval '6 days 18 hours') at time zone 'Europe/Madrid',
      (scheduled_date::timestamp + interval '7 days 18 hours') at time zone 'Europe/Madrid'
    from (values (${currentMonday}::date), (${nextMonday}::date)) as schedule(scheduled_date)
    on conflict (week_start_date) do nothing
  `);
  // ponytail: one check per warm instance per minute; use a scheduled job if cold-start traffic makes this noisy.
  scheduleFreshUntil = Date.now() + 60_000;
}

export async function getBuildState(userId: string) {
  if (!databaseConfigured) return null;

  const now = await getDatabaseNow();
  const [currentWeek] = await db
    .select()
    .from(week)
    .where(and(lte(week.startsAt, now), gt(week.votingClosesAt, now)))
    .orderBy(desc(week.startsAt))
    .limit(1);
  const [nextWeek] = await db
    .select()
    .from(week)
    .where(gt(week.startsAt, now))
    .orderBy(asc(week.startsAt))
    .limit(1);

  const [currentCommitment] = currentWeek
    ? await db
        .select()
        .from(commitment)
        .where(and(eq(commitment.userId, userId), eq(commitment.weekId, currentWeek.id)))
        .limit(1)
    : [];
  const [currentResult] = currentCommitment
    ? await db
        .select()
        .from(result)
        .where(eq(result.commitmentId, currentCommitment.id))
        .limit(1)
    : [];
  const [nextCommitment] = nextWeek
    ? await db
        .select()
        .from(commitment)
        .where(and(eq(commitment.userId, userId), eq(commitment.weekId, nextWeek.id)))
        .limit(1)
    : [];

  return {
    now,
    currentWeek: currentWeek ?? null,
    currentCommitment: currentCommitment ?? null,
    currentResult: currentResult ?? null,
    nextWeek: nextWeek ?? null,
    nextCommitment: nextCommitment ?? null,
    phase: currentWeek
      ? now < currentWeek.submissionClosesAt
        ? ('active' as const)
        : ('voting' as const)
      : ('between' as const),
  };
}

export const madridDate = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).format(date);
