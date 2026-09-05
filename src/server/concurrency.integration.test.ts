import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';

// This suite commits fixtures to exercise separate connections. Never point it at shared data.
const databaseUrl = process.env.DATABASE_CONCURRENCY_TEST_URL;
vi.mock('./db', async () => {
  const url = process.env.DATABASE_CONCURRENCY_TEST_URL;
  if (!url) return vi.importActual('./db');
  const target = new URL(url);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || target.pathname !== '/mad_builders_test') {
    throw new Error('Concurrency tests require a loopback mad_builders_test database');
  }
  const { default: postgres } = await import('postgres');
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const schema = await import('./schema');
  const connection = postgres(url, { max: 8, prepare: false, connect_timeout: 5, onnotice: () => {}, connection: { application_name: 'mad-builders-concurrency-test', statement_timeout: 10000 } });
  return { db: drizzle(connection, { schema }), databaseConfigured: true, testConnection: connection };
});
import { db } from './db';
import { account, commitment, comparison, profile, ranking, result, user, week } from './schema';
import { publishResult } from './results';
import { ensureWeekFinalized, getReviewState, submitReview } from './ranking';
import { allowWrite } from './rate-limit';
import { POST as withdraw } from '../pages/api/result/visibility';
import { POST as moderate } from '../pages/api/moderation';

async function resetFixtures() {
  const [target] = await db.execute<{ name: string }>(sql`select current_database() as name`);
  if (target.name !== 'mad_builders_test') throw new Error('Refusing to reset a non-test database');
  await db.execute(sql`truncate app_private."user", app_private.week, app_private.rate_limit restart identity cascade`);
}
async function builder(id: string) {
  await db.insert(user).values({ id, name: id, email: `${id}@example.invalid` });
  await db.insert(profile).values({ userId: id, handle: id, displayName: id, projectName: `Project ${id}` });
}
async function scheduledWeek(phase: 'building' | 'voting' | 'closed') {
  const [clock] = await db.execute<{ now: string }>(sql`select now() as now`);
  const now = new Date(clock.now).getTime();
  const [created] = await db.insert(week).values({
    weekStartDate: '2000-01-03', startsAt: new Date(now - 3600000),
    submissionClosesAt: new Date(now + (phase === 'building' ? 3600000 : -1800000)),
    votingClosesAt: new Date(now + (phase === 'closed' ? -900000 : 7200000)),
  }).returning();
  return created;
}
const publication = (userId: string, weekId: number) => ({ userId, weekId, commitmentId: null, status: 'submitted' as const, summary: 'Shipped a working prototype', feedbackRequest: '', nextPromise: 'Interview five builders', projectSentence: 'Tools for builders', projectUrl: null, projectStage: 'building' as const, proof: { url: null, status: 'self_reported' as const, checkedAt: null } });

async function votingFixture(phase: 'voting' | 'closed') {
  const targetWeek = await scheduledWeek(phase);
  const candidates = [];
  for (let i = 0; i < 6; i++) {
    const id = `candidate-${i}`;
    await builder(id);
    const [plan] = await db.insert(commitment).values({ userId: id, weekId: targetWeek.id, promise: 'Ship a prototype' }).returning();
    const [published] = await db.insert(result).values({ commitmentId: plan.id, userId: id, weekId: targetWeek.id, status: 'complete', summary: 'Shipped a prototype', onTime: true }).returning();
    candidates.push(published);
  }
  if (phase === 'closed') {
    for (let i = 0; i < 8; i++) {
      await builder(`voter-${i}`);
      await db.insert(comparison).values({ weekId: targetWeek.id, voterUserId: `voter-${i}`, candidateLowId: candidates[0].id, candidateHighId: candidates[1].id, presentedFirstId: candidates[0].id, choice: 'low', decidedAt: new Date() });
    }
  }
  return { targetWeek, candidates };
}
function requestContext(userId: string, fields: Record<string, string>) {
  const url = new URL('https://www.mad.builders/api/test');
  return { url, locals: { user: { id: userId } }, request: new Request(url, { method: 'POST', headers: { origin: url.origin }, body: new URLSearchParams(fields) }), redirect: (path: string, status: number) => new Response(null, { status, headers: { location: path } }) } as Parameters<typeof withdraw>[0];
}

// Queue both real operations behind a held row lock, observing Postgres lock waits
// rather than relying on arbitrary sleeps to determine who runs first.
async function orderedRace(weekId: number, first: () => Promise<unknown>, second: () => Promise<unknown>) {
  let release!: () => void;
  let locked!: () => void;
  const lockReady = new Promise<void>((resolve) => { locked = resolve; });
  const releaseLock = new Promise<void>((resolve) => { release = resolve; });
  const blocker = db.transaction(async (tx) => {
    await tx.select().from(week).where(eq(week.id, weekId)).for('update');
    locked();
    await releaseLock;
  });
  await lockReady;
  const operations: Promise<unknown>[] = [];
  try {
    for (const operation of [first, second]) {
      operations.push(operation());
      await vi.waitFor(async () => {
        const [waiting] = await db.execute<{ count: number }>(sql`select count(*)::int as count from pg_stat_activity where application_name = 'mad-builders-concurrency-test' and wait_event_type = 'Lock'`);
        expect(waiting.count).toBeGreaterThanOrEqual(operations.length);
      }, { timeout: 5000, interval: 20 });
    }
  } finally {
    release();
    await blocker;
  }
  return Promise.all(operations);
}

describe.skipIf(!databaseUrl)('committed multi-connection Postgres mutations', () => {
  beforeAll(async () => {
    vi.stubEnv('ORGANIZER_GITHUB_IDS', '999');
    await resetFixtures();
    const pids = await Promise.all(Array.from({ length: 8 }, () => db.execute<{ pid: number }>(sql`select pg_backend_pid() as pid, pg_sleep(0.05)`)));
    expect(new Set(pids.map(([row]) => row.pid)).size).toBeGreaterThan(1);
  });
  beforeEach(resetFixtures);
  afterAll(async () => {
    await resetFixtures();
    const module = await import('./db') as typeof import('./db') & { testConnection: { end: () => Promise<void> } };
    await module.testConnection.end();
    vi.unstubAllEnvs();
  });

  it('serializes simultaneous first publications and next goals without duplicates', async () => {
    await builder('publisher');
    const current = await scheduledWeek('building');
    await db.insert(week).values({ weekStartDate: '2000-01-10', startsAt: new Date(current.votingClosesAt.getTime() + 3600000), submissionClosesAt: new Date(current.votingClosesAt.getTime() + 7200000), votingClosesAt: new Date(current.votingClosesAt.getTime() + 10800000) });
    const published = await Promise.all(Array.from({ length: 8 }, () => publishResult(publication('publisher', current.id))));
    expect(new Set(published.map((entry) => entry.result.id)).size).toBe(1);
    expect(new Set(published.map((entry) => entry.result.publishedAt.toISOString())).size).toBe(1);
    expect(await db.select().from(result)).toHaveLength(1);
    const goals = await db.select().from(commitment);
    expect(goals).toHaveLength(2);
    expect(goals.map((goal) => goal.promise).sort()).toEqual(['', 'Interview five builders']);
  });

  it('rolls back result and profile edits when updating the next goal fails', async () => {
    await builder('publisher');
    const current = await scheduledWeek('building');
    await db.insert(week).values({ weekStartDate: '2000-01-10', startsAt: new Date(current.votingClosesAt.getTime() + 3600000), submissionClosesAt: new Date(current.votingClosesAt.getTime() + 7200000), votingClosesAt: new Date(current.votingClosesAt.getTime() + 10800000) });
    const original = await publishResult(publication('publisher', current.id));
    const before = await db.select().from(profile);
    await expect(publishResult({ ...publication('publisher', current.id), commitmentId: original.result.commitmentId, summary: 'Should roll back this edit', projectSentence: 'Should roll back this description', nextPromise: 'bad' })).rejects.toThrow('next_commitment_required');
    expect(await db.select().from(result)).toEqual([original.result]);
    expect(await db.select().from(profile)).toEqual(before);
    expect((await db.select().from(commitment)).map((row) => row.promise).sort()).toEqual(['', 'Interview five builders']);
  });

  it('resumes one assignment under concurrent requests and saves one immutable vote', async () => {
    await votingFixture('voting');
    const pairs = await Promise.all(Array.from({ length: 8 }, () => getReviewState('candidate-0')));
    const ids = pairs.map((pair) => {
      if (pair.state !== 'pair') throw new Error(`Expected pair, received ${pair.state}`);
      expect(pair.first.userId).not.toBe('candidate-0');
      expect(pair.second.userId).not.toBe('candidate-0');
      return pair.assignmentId;
    });
    expect(new Set(ids).size).toBe(1);
    expect(await Promise.all(Array.from({ length: 8 }, () => submitReview('candidate-0', ids[0], 'first')))).toEqual(Array(8).fill(true));
    expect(await submitReview('candidate-0', ids[0], 'second')).toBe(false);
    expect(await db.select().from(comparison)).toHaveLength(1);
    const resumed = await getReviewState('candidate-0');
    expect(resumed).toMatchObject({ state: 'pair', reviewed: 1 });
    if (resumed.state === 'pair') expect(resumed.assignmentId).not.toBe(ids[0]);
  });

  it('finalizes once under simultaneous finalizers with exact immutable scores', async () => {
    const { targetWeek } = await votingFixture('closed');
    const finals = await Promise.all(Array.from({ length: 8 }, () => ensureWeekFinalized(targetWeek.id)));
    expect(finals.every((entry) => entry?.rankingStatus === 'final')).toBe(true);
    const ranks = await db.select().from(ranking).orderBy(ranking.rank);
    expect(ranks).toHaveLength(2);
    expect(ranks.map(({ rank, scoreNumerator, scoreDenominator }) => ({ rank, scoreNumerator, scoreDenominator }))).toEqual([{ rank: 1, scoreNumerator: 16, scoreDenominator: 16 }, { rank: 2, scoreNumerator: 0, scoreDenominator: 16 }]);
    await ensureWeekFinalized(targetWeek.id);
    expect(await db.select().from(ranking).orderBy(ranking.rank)).toEqual(ranks);
  });

  it('excludes a withdrawal queued before finalization without a torn snapshot', async () => {
    const { targetWeek, candidates } = await votingFixture('closed');
    const responses = await orderedRace(targetWeek.id,
      () => withdraw(requestContext('candidate-0', { resultId: String(candidates[0].id), action: 'withdraw' })),
      () => ensureWeekFinalized(targetWeek.id));
    expect((responses[0] as Response).status).toBe(303);
    expect(responses[1]).toMatchObject({ rankingStatus: 'unranked' });
    expect(await db.select().from(ranking)).toHaveLength(0);
    expect((await db.select().from(result).where(eq(result.id, candidates[0].id)))[0].withdrawnAt).not.toBeNull();
  });

  it('excludes invalidated votes queued before finalization', async () => {
    const { targetWeek } = await votingFixture('closed');
    await db.insert(account).values({ id: 'organizer-account', issuer: 'github', providerId: 'github', accountId: '999', userId: 'candidate-0' });
    const responses = await orderedRace(targetWeek.id,
      () => moderate(requestContext('candidate-0', { kind: 'voter', handle: 'voter-0', action: 'invalidate', reason: 'Test invalidation' })),
      () => ensureWeekFinalized(targetWeek.id));
    expect((responses[0] as Response).status).toBe(200);
    expect(responses[1]).toMatchObject({ rankingStatus: 'unranked' });
    expect(await db.select().from(ranking)).toHaveLength(0);
    expect((await db.select().from(comparison).where(eq(comparison.voterUserId, 'voter-0')))[0].invalidatedAt).not.toBeNull();
  });

  it('allows a later withdrawal without rewriting already finalized scores', async () => {
    const { targetWeek, candidates } = await votingFixture('closed');
    const responses = await orderedRace(targetWeek.id,
      () => ensureWeekFinalized(targetWeek.id),
      () => withdraw(requestContext('candidate-0', { resultId: String(candidates[0].id), action: 'withdraw' })));
    expect(responses[0]).toMatchObject({ rankingStatus: 'final' });
    expect((responses[1] as Response).status).toBe(303);
    const snapshot = await db.select().from(ranking).orderBy(ranking.rank);
    expect(snapshot).toHaveLength(2);
    expect((await db.select().from(result).where(eq(result.id, candidates[0].id)))[0].withdrawnAt).not.toBeNull();
    await ensureWeekFinalized(targetWeek.id);
    expect(await db.select().from(ranking).orderBy(ranking.rank)).toEqual(snapshot);
  });

  it('keeps finalized results immutable when invalidation queues after finalization', async () => {
    const { targetWeek } = await votingFixture('closed');
    await db.insert(account).values({ id: 'organizer-account', issuer: 'github', providerId: 'github', accountId: '999', userId: 'candidate-0' });
    const responses = await orderedRace(targetWeek.id,
      () => ensureWeekFinalized(targetWeek.id),
      () => moderate(requestContext('candidate-0', { kind: 'voter', handle: 'voter-0', action: 'invalidate', reason: 'Too late for final scores' })));
    expect(responses[0]).toMatchObject({ rankingStatus: 'final' });
    expect((responses[1] as Response).status).toBe(404);
    expect(await db.select().from(ranking)).toHaveLength(2);
    expect((await db.select().from(comparison).where(eq(comparison.voterUserId, 'voter-0')))[0].invalidatedAt).toBeNull();
  });

  it('enforces user and IP limits atomically and resets expired windows', async () => {
    const request = new Request('https://www.mad.builders');
    const users = await Promise.all(Array.from({ length: 40 }, () => allowWrite(request, 'rate-user', 'test-user')));
    expect(users.filter(Boolean)).toHaveLength(30);
    await db.execute(sql`update app_private.rate_limit set last_request = floor(extract(epoch from now()) * 1000) - 61000`);
    expect(await allowWrite(request, 'rate-user', 'test-user')).toBe(true);
    const ipRequest = new Request('https://www.mad.builders', { headers: { 'x-forwarded-for': '192.0.2.1' } });
    const ips = await Promise.all(Array.from({ length: 130 }, (_, i) => allowWrite(ipRequest, `ip-user-${i}`, 'test-ip')));
    expect(ips.filter(Boolean)).toHaveLength(120);
  });
});
