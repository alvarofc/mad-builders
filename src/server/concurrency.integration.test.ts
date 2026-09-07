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
import { getBuildState } from './weeks';
import { getPublicBuilderActivity, listPublicProfiles } from './profiles';
import { ensureWeekFinalized, getLatestLeaderboard, getReviewState, submitReview } from './ranking';
import { allowWrite } from './rate-limit';
import { POST as withdraw } from '../pages/api/result/visibility';
import { POST as moderate } from '../pages/api/moderation';
import { POST as saveCommitment } from '../pages/api/commitment';

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

async function votingFixture(phase: 'voting' | 'closed', count = 6) {
  const targetWeek = await scheduledWeek(phase);
  const candidates = [];
  for (let i = 0; i < count; i++) {
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

async function crossDeadline(weekId: number, field: 'startsAt' | 'submissionClosesAt' | 'votingClosesAt', operation: () => Promise<unknown>) {
  let outcome!: Promise<unknown>;
  await db.transaction(async (tx) => {
    await tx.select().from(week).where(eq(week.id, weekId)).for('update');
    outcome = operation().catch((error) => error);
    await vi.waitFor(async () => {
      const [waiting] = await db.execute<{ count: number }>(sql`select count(*)::int as count from pg_stat_activity where application_name = 'mad-builders-concurrency-test' and wait_event_type = 'Lock'`);
      expect(waiting.count).toBeGreaterThan(0);
    }, { timeout: 5000, interval: 20 });
    // The operation has started; move its deadline just ahead, then hold the lock past it.
    await tx.update(week).set({ [field]: sql`clock_timestamp() + interval '100 milliseconds'` }).where(eq(week.id, weekId));
    await tx.execute(sql`select pg_sleep(0.15)`);
  });
  return outcome;
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

  it('paginates tied ranks and the public directory without duplicates', async () => {
    const { targetWeek, candidates } = await votingFixture('voting', 103);
    await db.insert(comparison).values(candidates.flatMap((candidate, index) => {
      const neighbor = candidates[(index + 1) % candidates.length];
      const low = Math.min(candidate.id, neighbor.id);
      const high = Math.max(candidate.id, neighbor.id);
      return candidates.slice(0, 8).map((voter) => ({
        weekId: targetWeek.id, voterUserId: voter.userId, candidateLowId: low,
        candidateHighId: high, presentedFirstId: low, choice: 'tie', decidedAt: new Date(),
      }));
    }));
    const provisional = await Promise.all([1, 2, 3, 4].map((page) => getLatestLeaderboard('candidate-0', page)));
    expect(provisional.map((board) => board!.entries.length)).toEqual([50, 50, 3, 0]);
    expect(provisional.map((board) => board!.hasNext)).toEqual([true, true, false, false]);
    expect(provisional.every((board) => board!.provisional)).toBe(true);
    expect(new Set(provisional.flatMap((board) => board!.entries.map((entry) => entry.handle))).size).toBe(103);
    expect(provisional.flatMap((board) => board!.entries).every((entry) => entry.rank === 1)).toBe(true);
    const finalizedAt = new Date();
    await db.update(week).set({
      votingClosesAt: new Date(finalizedAt.getTime() - 1000),
      rankingStatus: 'final', finalizedAt,
    }).where(eq(week.id, targetWeek.id));
    await db.insert(ranking).values(candidates.map((candidate) => ({
      weekId: targetWeek.id, resultId: candidate.id, scoreNumerator: 8,
      scoreDenominator: 16, wins: 4, ties: 0, decisions: 8, rank: 1, finalizedAt,
    })));
    const boards = await Promise.all([1, 2, 3, 4].map((page) => getLatestLeaderboard(undefined, page)));
    expect(boards.map((board) => board!.entries.length)).toEqual([50, 50, 3, 0]);
    expect(boards.map((board) => board!.hasNext)).toEqual([true, true, false, false]);
    const entries = boards.flatMap((board) => board!.entries);
    expect(new Set(entries.map((entry) => entry.handle)).size).toBe(103);
    expect(entries.every((entry) => entry.rank === 1)).toBe(true);
    const directory = await Promise.all([1, 2, 3].map((page) => listPublicProfiles(page)));
    expect(directory.map((rows) => rows.length)).toEqual([51, 51, 3]);
    expect(new Set(directory.flatMap((rows) => rows.slice(0, 50).map((row) => row.handle))).size).toBe(103);
    await db.update(profile).set({ hiddenAt: new Date() }).where(eq(profile.userId, 'candidate-0'));
    const visible = await Promise.all([1, 2, 3].map((page) => getLatestLeaderboard(undefined, page)));
    expect(visible.flatMap((board) => board!.entries)).toHaveLength(102);
    expect(visible.flatMap((board) => board!.entries).some((entry) => entry.handle === 'candidate-0')).toBe(false);
  });

  it('finalizes more than one ranking batch without losing or duplicating projects', async () => {
    const targetWeek = await scheduledWeek('closed');
    const builders = Array.from({ length: 1001 }, (_, index) => ({
      id: `batch-${index}`, name: `Builder ${index}`, email: `batch-${index}@example.invalid`,
    }));
    await db.insert(user).values(builders);
    await db.insert(profile).values(builders.map(({ id, name }) => ({
      userId: id, handle: id, displayName: name, projectName: name,
    })));
    const plans = await db.insert(commitment).values(builders.map(({ id }) => ({
      userId: id, weekId: targetWeek.id, promise: 'Ship a prototype',
    }))).returning();
    const candidates = await db.insert(result).values(plans.map((plan) => ({
      commitmentId: plan.id, userId: plan.userId, weekId: targetWeek.id,
      status: 'complete' as const, summary: 'Shipped a prototype', onTime: true,
    }))).returning();
    // Four decisions on each edge give every project eight counted decisions.
    await db.insert(comparison).values(candidates.flatMap((candidate, index) => {
      const neighbor = candidates[(index + 1) % candidates.length];
      const low = Math.min(candidate.id, neighbor.id);
      const high = Math.max(candidate.id, neighbor.id);
      return candidates.slice(0, 6).filter((voter) => voter.id !== low && voter.id !== high).slice(0, 4).map((voter) => ({
        weekId: targetWeek.id, voterUserId: voter.userId, candidateLowId: low,
        candidateHighId: high, presentedFirstId: low, choice: 'tie', decidedAt: new Date(),
      }));
    }));

    expect(await ensureWeekFinalized(targetWeek.id)).toMatchObject({ rankingStatus: 'final' });
    const ranks = await db.select().from(ranking).where(eq(ranking.weekId, targetWeek.id));
    expect(ranks).toHaveLength(1001);
    expect(new Set(ranks.map((entry) => entry.resultId))).toEqual(new Set(candidates.map((entry) => entry.id)));
    expect(ranks.every((entry) => entry.rank === 1 && entry.decisions === 8 && entry.ties === 8)).toBe(true);
    await ensureWeekFinalized(targetWeek.id);
    expect(await db.select().from(ranking).where(eq(ranking.weekId, targetWeek.id))).toHaveLength(1001);
  }, 15000);

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

  it('keeps an owned unfinished update reachable after rollover without changing the new week goal', async () => {
    await builder('publisher');
    const prior = await scheduledWeek('voting');
    const [current] = await db.insert(week).values({ weekStartDate: '2000-01-10', startsAt: new Date(prior.submissionClosesAt.getTime() + 1000), submissionClosesAt: new Date(prior.votingClosesAt.getTime() + 3600000), votingClosesAt: new Date(prior.votingClosesAt.getTime() + 7200000) }).returning();
    const [oldGoal] = await db.insert(commitment).values({ userId: 'publisher', weekId: prior.id, promise: 'Ship the old prototype' }).returning();
    await db.insert(commitment).values({ userId: 'publisher', weekId: current.id, promise: 'Keep the new week goal' });
    const normal = await getBuildState('publisher');
    expect(normal?.currentWeek?.id).toBe(current.id);
    expect(normal?.unfinishedWeeks.map((entry) => entry.id)).toContain(prior.id);
    const late = await getBuildState('publisher', prior.weekStartDate);
    expect(late).toMatchObject({ currentWeek: { id: prior.id }, currentCommitment: { id: oldGoal.id }, nextWeek: { id: current.id }, selectedLateWeek: true, late: true, canSetNextPromise: false });
    expect(await getBuildState('another-user', prior.weekStartDate)).toBeNull();
    expect(await getBuildState('publisher', 'not-a-date')).toBeNull();
    const published = await publishResult({ ...publication('publisher', prior.id), commitmentId: oldGoal.id, status: 'complete', nextPromise: '' });
    expect(published.result.onTime).toBe(false);
    expect(await getBuildState('publisher', prior.weekStartDate)).toBeNull();
    expect((await getBuildState('publisher'))?.currentCommitment?.promise).toBe('Keep the new week goal');
  });

  it('shows the current building goal during overlapping voting, then the next goal as fallback', async () => {
    await builder('publisher');
    const prior = await scheduledWeek('voting');
    const [current] = await db.insert(week).values({ weekStartDate: '2000-01-10', startsAt: new Date(prior.submissionClosesAt.getTime() + 1000), submissionClosesAt: new Date(prior.votingClosesAt.getTime() + 3600000), votingClosesAt: new Date(prior.votingClosesAt.getTime() + 7200000) }).returning();
    const [next] = await db.insert(week).values({ weekStartDate: '2000-01-17', startsAt: new Date(current.votingClosesAt.getTime() + 1000), submissionClosesAt: new Date(current.votingClosesAt.getTime() + 3600000), votingClosesAt: new Date(current.votingClosesAt.getTime() + 7200000) }).returning();
    await db.insert(commitment).values([
      { userId: 'publisher', weekId: prior.id, promise: 'Old goal' },
      { userId: 'publisher', weekId: current.id, promise: 'Current goal' },
      { userId: 'publisher', weekId: next.id, promise: 'Next goal' },
    ]);
    expect((await getPublicBuilderActivity('publisher')).commitment?.promise).toBe('Current goal');
    await db.update(commitment).set({ promise: '' }).where(eq(commitment.weekId, current.id));
    expect((await getPublicBuilderActivity('publisher')).commitment?.promise).toBe('Next goal');
    await db.delete(commitment).where(eq(commitment.weekId, next.id));
    expect((await getPublicBuilderActivity('publisher')).commitment).toBeNull();
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

  it.each(['open', 'submit'] as const)('does not deadlock publication FK locks while waiting to %s voting', async (action) => {
    const { targetWeek } = await votingFixture('voting');
    const pair = await getReviewState('candidate-0');
    if (pair.state !== 'pair') throw new Error('Expected pair');
    let pending!: Promise<unknown>;
    await db.transaction(async (tx) => {
      await tx.select().from(week).where(eq(week.id, targetWeek.id)).for('update');
      pending = (action === 'open'
        ? getReviewState('candidate-0')
        : submitReview('candidate-0', pair.assignmentId, 'first')).catch((error) => error);
      await vi.waitFor(async () => {
        const [waiting] = await db.execute<{ count: number }>(sql`select count(*)::int as count from pg_stat_activity where application_name = 'mad-builders-concurrency-test' and wait_event_type = 'Lock'`);
        expect(waiting.count).toBeGreaterThan(0);
      }, { timeout: 5000, interval: 20 });
      // Publication inserts request this same FK lock after acquiring the week.
      // A waiting review must not hold a conflicting user FOR UPDATE lock.
      await tx.select().from(user).where(eq(user.id, 'candidate-0')).for('key share');
    });
    const outcome = await pending;
    if (action === 'open') expect(outcome).toMatchObject({ state: 'pair', assignmentId: pair.assignmentId });
    else expect(outcome).toBe(true);
  });

  it.each(['withdraw', 'hide'] as const)('rejects a pending vote after the voter result is %s', async (action) => {
    const { targetWeek, candidates } = await votingFixture('voting');
    const pair = await getReviewState('candidate-0');
    if (pair.state !== 'pair') throw new Error('Expected a voting pair');
    await db.insert(account).values({ id: 'organizer-account', issuer: 'github', providerId: 'github', accountId: '999', userId: 'candidate-0' });
    const responses = await orderedRace(targetWeek.id,
      () => action === 'withdraw'
        ? withdraw(requestContext('candidate-0', { resultId: String(candidates[0].id), action }))
        : moderate(requestContext('candidate-0', { kind: 'result', handle: 'candidate-0', week: targetWeek.weekStartDate, action, reason: 'Test hide' })),
      () => submitReview('candidate-0', pair.assignmentId, 'first'));
    expect((responses[0] as Response).status).toBe(action === 'withdraw' ? 303 : 200);
    expect(responses[1]).toBe(false);
    expect((await db.select().from(comparison).where(eq(comparison.id, pair.assignmentId)))[0].choice).toBeNull();
    expect(await getReviewState('candidate-0')).toMatchObject({ state: 'ineligible' });
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

  it.each([2, 6])('reads a finalized leaderboard with %i candidates without another locking transaction', async (count) => {
    await votingFixture('closed', count);
    const first = await getLatestLeaderboard();
    expect(first?.week?.finalizedAt).not.toBeNull();
    const transaction = vi.spyOn(db, 'transaction');
    try {
      const repeated = await getLatestLeaderboard();
      expect(repeated?.week).toEqual(first?.week);
      expect(repeated?.entries).toEqual(first?.entries);
      expect(transaction).not.toHaveBeenCalled();
    } finally {
      transaction.mockRestore();
    }
  });

  it.each(['edit', 'late', 'first'] as const)('uses post-lock wall time for %s publication', async (mode) => {
    await builder('publisher');
    const current = await scheduledWeek('building');
    const original = mode === 'edit' ? await publishResult(publication('publisher', current.id)) : null;
    const [plan] = mode === 'late' ? await db.insert(commitment).values({ userId: 'publisher', weekId: current.id, promise: 'Ship a prototype' }).returning() : [];
    const input = { ...publication('publisher', current.id), commitmentId: original?.result.commitmentId ?? plan?.id ?? null, status: mode === 'late' ? 'complete' as const : 'submitted' as const };
    const outcome = await crossDeadline(current.id, 'submissionClosesAt', () => publishResult(input));
    if (mode === 'late') {
      expect(outcome).toMatchObject({ result: { onTime: false } });
    } else {
      expect(outcome).toBeInstanceOf(Error);
      expect((outcome as Error).message).toBe(mode === 'edit' ? 'update_locked' : 'commitment_not_found');
      expect(await db.select().from(result)).toEqual(original ? [original.result] : []);
    }
  });

  it('rejects a vote that waited past voting close', async () => {
    const { targetWeek } = await votingFixture('voting');
    const pair = await getReviewState('candidate-0');
    if (pair.state !== 'pair') throw new Error('Expected pair');
    expect(await crossDeadline(targetWeek.id, 'votingClosesAt', () => submitReview('candidate-0', pair.assignmentId, 'first'))).toBe(false);
    expect((await db.select().from(comparison))[0].choice).toBeNull();
  });

  it('does not assign a pair after waiting past voting close', async () => {
    const { targetWeek } = await votingFixture('voting');
    expect(await crossDeadline(targetWeek.id, 'votingClosesAt', () => getReviewState('candidate-0'))).toMatchObject({ state: 'closed' });
    expect(await db.select().from(comparison)).toHaveLength(0);
  });

  it.each([true, false])('serializes replacement pairs and invalidation (moderation first: %s)', async (moderationFirst) => {
    const { targetWeek } = await votingFixture('voting', 7);
    const pair = await getReviewState('candidate-0');
    if (pair.state !== 'pair') throw new Error('Expected pair');
    await db.update(result).set({ hiddenAt: new Date() }).where(eq(result.id, pair.first.id));
    await db.insert(account).values({ id: 'organizer-account', issuer: 'github', providerId: 'github', accountId: '999', userId: 'candidate-1' });
    const invalidate = () => moderate(requestContext('candidate-1', { kind: 'voter', handle: 'candidate-0', action: 'invalidate', reason: 'Test invalidation' }));
    const replace = () => getReviewState('candidate-0');
    const outcomes = await orderedRace(targetWeek.id, moderationFirst ? invalidate : replace, moderationFirst ? replace : invalidate);
    expect((outcomes[moderationFirst ? 0 : 1] as Response).status).toBe(200);
    const replacement = outcomes[moderationFirst ? 1 : 0] as Awaited<ReturnType<typeof getReviewState>>;
    expect(replacement.state).toBe('pair');
    if (replacement.state === 'pair') {
      expect(replacement.assignmentId).not.toBe(pair.assignmentId);
      expect([replacement.first.id, replacement.second.id]).not.toContain(pair.first.id);
    }
    expect((await db.select().from(comparison).where(eq(comparison.id, pair.assignmentId)))[0].invalidatedAt).not.toBeNull();
  });

  it.each(['profile', 'result'] as const)('removes provisional ranks below six candidates after hiding a %s, and restores them', async (kind) => {
    const { targetWeek, candidates } = await votingFixture('voting');
    for (let i = 0; i < 8; i++) {
      const voter = `extra-voter-${i}`;
      await builder(voter);
      await db.insert(comparison).values({ weekId: targetWeek.id, voterUserId: voter, candidateLowId: candidates[0].id, candidateHighId: candidates[1].id, presentedFirstId: candidates[0].id, choice: 'low', decidedAt: new Date() });
    }
    for (let i = 0; i < 10; i++) {
      const pair = await getReviewState('candidate-0');
      if (pair.state !== 'pair') throw new Error('Expected pair');
      expect(await submitReview('candidate-0', pair.assignmentId, 'pass')).toBe(true);
    }
    expect((await getLatestLeaderboard('candidate-0'))?.entries).toHaveLength(2);
    const table = kind === 'profile' ? profile : result;
    await db.update(table).set({ hiddenAt: new Date() }).where(eq(table.userId, 'candidate-5'));
    expect(await getLatestLeaderboard('candidate-0')).toMatchObject({ week: { rankingStatus: 'unranked' }, provisional: false, entries: [] });
    expect((await db.select().from(week))[0].finalizedAt).toBeNull();
    await db.update(table).set({ hiddenAt: null }).where(eq(table.userId, 'candidate-5'));
    expect(await getLatestLeaderboard('candidate-0')).toMatchObject({ provisional: true });
    expect((await getLatestLeaderboard('candidate-0'))?.entries).toHaveLength(2);
  });

  it('rejects a commitment that waited past the week start', async () => {
    await builder('publisher');
    const current = await scheduledWeek('building');
    await db.update(week).set({ startsAt: sql`clock_timestamp() + interval '10 minutes'` }).where(eq(week.id, current.id));
    const outcome = await crossDeadline(current.id, 'startsAt', () => saveCommitment(requestContext('publisher', { weekId: String(current.id), promise: 'Ship a prototype' })));
    expect(outcome).toBeInstanceOf(Response);
    expect((outcome as Response).status).toBe(409);
    expect(await db.select().from(commitment)).toHaveLength(0);
  });

  it.each([true, false])('serializes voter invalidation and submission without deadlock (moderation first: %s)', async (moderationFirst) => {
    const { targetWeek } = await votingFixture('voting');
    await db.insert(account).values({ id: 'organizer-account', issuer: 'github', providerId: 'github', accountId: '999', userId: 'candidate-1' });
    const pair = await getReviewState('candidate-0');
    if (pair.state !== 'pair') throw new Error('Expected pair');
    const invalidate = () => moderate(requestContext('candidate-1', { kind: 'voter', handle: 'candidate-0', action: 'invalidate', reason: 'Test invalidation' }));
    const vote = () => submitReview('candidate-0', pair.assignmentId, 'first');
    const outcomes = await orderedRace(targetWeek.id, moderationFirst ? invalidate : vote, moderationFirst ? vote : invalidate);
    expect(outcomes[moderationFirst ? 1 : 0]).toBe(!moderationFirst);
    expect((outcomes[moderationFirst ? 0 : 1] as Response).status).toBe(200);
    expect((await db.select().from(comparison))[0].invalidatedAt).not.toBeNull();
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
