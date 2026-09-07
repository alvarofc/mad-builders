import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  sql,
} from 'drizzle-orm';
import { db, databaseConfigured } from './db';
import { commitment, comparison, profile, ranking, result, week } from './schema';
import { getDatabaseNow } from './weeks';
import { PAGE_SIZE, pageNumber } from './pagination';

export type CandidateScore = {
  resultId: number;
  wins: number;
  ties: number;
  decisions: number;
};

type ScoredChoice = {
  candidateLowId: number;
  candidateHighId: number;
  choice: string | null;
};

export function scoreCandidateChoices(candidateIds: number[], choices: ScoredChoice[]) {
  const candidates = new Set(candidateIds);
  const scores = new Map<number, CandidateScore>(
    candidateIds.map((resultId) => [resultId, { resultId, wins: 0, ties: 0, decisions: 0 }]),
  );
  for (const choice of choices) {
    if (
      (choice.choice !== 'low' && choice.choice !== 'high' && choice.choice !== 'tie') ||
      !candidates.has(choice.candidateLowId) ||
      !candidates.has(choice.candidateHighId)
    ) {
      continue;
    }
    const low = scores.get(choice.candidateLowId)!;
    const high = scores.get(choice.candidateHighId)!;
    low.decisions += 1;
    high.decisions += 1;
    if (choice.choice === 'low') low.wins += 1;
    if (choice.choice === 'high') high.wins += 1;
    if (choice.choice === 'tie') {
      low.ties += 1;
      high.ties += 1;
    }
  }
  return [...scores.values()];
}

export function rankCandidateScores(scores: CandidateScore[]) {
  const ranked = scores
    .filter((score) => score.decisions >= 8)
    .map((score) => ({
      ...score,
      scoreNumerator: score.wins * 2 + score.ties,
      scoreDenominator: score.decisions * 2,
    }))
    .sort((a, b) => {
      const comparison = b.scoreNumerator * a.scoreDenominator - a.scoreNumerator * b.scoreDenominator;
      return comparison || a.resultId - b.resultId;
    });

  return ranked.reduce<Array<(typeof ranked)[number] & { rank: number }>>((output, score, index) => {
    const previous = output[index - 1];
    const tied =
      previous &&
      previous.scoreNumerator * score.scoreDenominator ===
        score.scoreNumerator * previous.scoreDenominator;
    output.push({ ...score, rank: tied ? previous.rank : index + 1 });
    return output;
  }, []);
}

// Pending pairs reserve coverage briefly; returning voters can still finish older pairs.
const PAIR_RESERVATION_MS = 10 * 60 * 1000;

export function selectReviewPair(
  candidateIds: number[],
  availableIds: number[],
  used: Set<string>,
  assignments: Array<ScoredChoice & { assignedAt: Date }>,
  now: Date,
) {
  const coverage = new Map(
    scoreCandidateChoices(candidateIds, assignments).map((score) => [score.resultId, score.decisions]),
  );
  const frequency = new Map<string, number>();
  for (const assignment of assignments) {
    const { candidateLowId: low, candidateHighId: high, choice } = assignment;
    if (!coverage.has(low) || !coverage.has(high)) continue;
    const pending = choice === null && now.getTime() - assignment.assignedAt.getTime() < PAIR_RESERVATION_MS;
    if (pending) {
      coverage.set(low, coverage.get(low)! + 1);
      coverage.set(high, coverage.get(high)! + 1);
    }
    if (pending || choice === 'low' || choice === 'high' || choice === 'tie') {
      const key = `${low}:${high}`;
      frequency.set(key, (frequency.get(key) ?? 0) + 1);
    }
  }

  // Shuffle equal-coverage candidates so a new week does not favor low IDs.
  const ordered = [...availableIds];
  for (let i = ordered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  ordered.sort((a, b) => coverage.get(a)! - coverage.get(b)!);
  type Pair = { low: number; high: number; least: number; most: number; frequency: number };
  const compare = (a: Pair, b: Pair) =>
    a.least - b.least || a.most - b.most || a.frequency - b.frequency;
  let best: Pair | null = null;
  let peers = 0;
  // ponytail: a dense pair history can still require O(n²) scanning; index pair
  // availability if weeks approach exhaustive comparisons. No pair array is built.
  for (let left = 0; left < ordered.length; left++) {
    const least = coverage.get(ordered[left])!;
    if (best && least > best.least) break;
    for (let right = left + 1; right < ordered.length; right++) {
      const most = coverage.get(ordered[right])!;
      if (best && least === best.least && most > best.most) break;
      const low = Math.min(ordered[left], ordered[right]);
      const high = Math.max(ordered[left], ordered[right]);
      const key = `${low}:${high}`;
      if (used.has(key)) continue;
      const pair = { low, high, least, most, frequency: frequency.get(key) ?? 0 };
      if (!best || compare(pair, best) < 0) {
        best = pair;
        peers = 1;
      } else if (compare(pair, best) === 0 && Math.random() < 1 / ++peers) {
        best = pair;
      }
      // The lowest possible coverage and frequency cannot be improved.
      if (best.least === coverage.get(ordered[0]) &&
          best.most === coverage.get(ordered[1]) && best.frequency === 0) return best;
    }
  }
  return best;
}

const candidateColumns = {
  id: result.id,
  userId: result.userId,
  projectSentence: result.projectSentence,
  projectStage: result.projectStage,
  promise: commitment.promise,
  status: result.status,
  summary: result.summary,
  feedbackRequest: result.feedbackRequest,
  proofUrl: result.proofUrl,
  proofStatus: result.proofStatus,
};

export async function getReviewState(userId: string) {
  if (!databaseConfigured) return { state: 'closed' as const };

  return db.transaction(async (tx) => {
    // ponytail: the week lock serializes reviews; use coordinated per-voter locks
    // if measured lock waits limit throughput. Publication FKs share this lock.
    const [databaseClock] = await tx.execute<{ now: string }>(sql`select clock_timestamp() as now`);
    const clock = { now: new Date(databaseClock.now) };
    const [votingWeek] = await tx
      .select()
      .from(week)
      .where(and(lte(week.submissionClosesAt, clock.now), gt(week.votingClosesAt, clock.now)))
      .orderBy(desc(week.startsAt))
      .for('update')
      .limit(1);
    if (!votingWeek) {
      const [upcoming] = await tx.select().from(week)
        .where(gt(week.submissionClosesAt, clock.now)).orderBy(asc(week.submissionClosesAt)).limit(1);
      return { state: 'closed' as const, opensAt: upcoming?.submissionClosesAt };
    }

    const [lockedClock] = await tx.execute<{ now: string }>(sql`select clock_timestamp() as now`);
    clock.now = new Date(lockedClock.now);
    if (clock.now < votingWeek.submissionClosesAt || clock.now >= votingWeek.votingClosesAt) {
      return { state: 'closed' as const };
    }

    const [voterResult] = await tx
      .select({ id: result.id })
      .from(result)
      .where(
        and(
          eq(result.weekId, votingWeek.id),
          eq(result.userId, userId),
          eq(result.onTime, true),
          isNull(result.hiddenAt),
          isNull(result.withdrawnAt),
        ),
      )
      .limit(1);
    if (!voterResult) return { state: 'ineligible' as const, week: votingWeek };

    const candidates = await tx
      .select({ id: result.id, userId: result.userId })
      .from(result)
      .innerJoin(profile, eq(result.userId, profile.userId))
      .where(
        and(
          eq(result.weekId, votingWeek.id),
          eq(result.onTime, true),
          inArray(result.status, ['complete', 'partial', 'submitted']),
          isNull(result.hiddenAt),
          isNull(result.withdrawnAt),
          eq(profile.isPublic, true),
          isNull(profile.hiddenAt),
          isNull(profile.withdrawnAt),
        ),
      );
    if (candidates.length < 6) return { state: 'unranked' as const, week: votingWeek };

    const loadCards = (ids: number[]) => tx.select(candidateColumns).from(result)
      .innerJoin(commitment, eq(result.commitmentId, commitment.id))
      .where(inArray(result.id, ids));

    const assignments = await tx
      .select()
      .from(comparison)
      .where(
        and(
          eq(comparison.weekId, votingWeek.id),
          eq(comparison.voterUserId, userId),
        ),
      );
    const activeAssignments = assignments.filter((assignment) => !assignment.invalidatedAt);
    const reviewed = activeAssignments.filter((assignment) => assignment.choice !== null).length;
    if (reviewed >= 10) return { state: 'complete' as const, week: votingWeek, reviewed };

    const unfinished = activeAssignments.find((assignment) => assignment.choice === null);
    if (unfinished) {
      const ids = new Set(candidates.map((card) => card.id));
      const cards = ids.has(unfinished.candidateLowId) && ids.has(unfinished.candidateHighId)
        ? await loadCards([unfinished.candidateLowId, unfinished.candidateHighId]) : [];
      const byId = new Map(cards.map((card) => [card.id, card]));
      const first = byId.get(unfinished.presentedFirstId);
      const second = byId.get(
        unfinished.presentedFirstId === unfinished.candidateLowId
          ? unfinished.candidateHighId
          : unfinished.candidateLowId,
      );
      if (first && second) {
        return {
          state: 'pair' as const,
          week: votingWeek,
          reviewed,
          assignmentId: unfinished.id,
          first,
          second,
        };
      }
      await tx
        .update(comparison)
        .set({ invalidatedAt: clock.now })
        .where(eq(comparison.id, unfinished.id));
    }

    const available = candidates.filter((candidate) => candidate.userId !== userId);
    const used = new Set(
      assignments
        .map((assignment) => `${assignment.candidateLowId}:${assignment.candidateHighId}`),
    );
    const allAssignments = await tx
      .select({
        candidateLowId: comparison.candidateLowId,
        candidateHighId: comparison.candidateHighId,
        choice: comparison.choice,
        assignedAt: comparison.assignedAt,
      })
      .from(comparison)
      .where(and(eq(comparison.weekId, votingWeek.id), isNull(comparison.invalidatedAt)));
    const picked = selectReviewPair(
      candidates.map((candidate) => candidate.id),
      available.map((candidate) => candidate.id),
      used,
      allAssignments,
      clock.now,
    );
    if (!picked) return { state: 'exhausted' as const, week: votingWeek, reviewed };
    const presentedFirstId = Math.random() < 0.5 ? picked.low : picked.high;
    const [assignment] = await tx
      .insert(comparison)
      .values({
        weekId: votingWeek.id,
        voterUserId: userId,
        candidateLowId: picked.low,
        candidateHighId: picked.high,
        presentedFirstId,
      })
      .returning();
    const byId = new Map((await loadCards([picked.low, picked.high])).map((card) => [card.id, card]));

    return {
      state: 'pair' as const,
      week: votingWeek,
      reviewed,
      assignmentId: assignment.id,
      first: byId.get(presentedFirstId)!,
      second: byId.get(presentedFirstId === picked.low ? picked.high : picked.low)!,
    };
  });
}

export function blocksWeeklyUpdate(
  review: Awaited<ReturnType<typeof getReviewState>>,
  startsAt: Date,
  now: Date,
) {
  return review.state === 'pair' && review.week.startsAt < startsAt && now < review.week.votingClosesAt;
}

export async function submitReview(userId: string, assignmentId: number, selected: string) {
  return db.transaction(async (tx) => {
    const [owned] = await tx.select({ weekId: comparison.weekId }).from(comparison)
      .where(and(eq(comparison.id, assignmentId), eq(comparison.voterUserId, userId))).limit(1);
    if (!owned) return false;
    // Moderation and finalization also lock the week before touching its comparisons.
    await tx.select({ id: week.id }).from(week).where(eq(week.id, owned.weekId)).for('update');
    const [assignment] = await tx
      .select({ comparison, week })
      .from(comparison)
      .innerJoin(week, eq(comparison.weekId, week.id))
      .where(
        and(
          eq(comparison.id, assignmentId),
          eq(comparison.voterUserId, userId),
          isNull(comparison.invalidatedAt),
        ),
      )
      .for('update')
      .limit(1);
    if (!assignment) return false;

    const [databaseClock] = await tx.execute<{ now: string }>(sql`select clock_timestamp() as now`);
    const clock = { now: new Date(databaseClock.now) };
    if (clock.now < assignment.week.submissionClosesAt || clock.now >= assignment.week.votingClosesAt) {
      return false;
    }

    const [voterResult] = await tx.select({ id: result.id }).from(result).where(and(
      eq(result.weekId, assignment.week.id),
      eq(result.userId, userId),
      eq(result.onTime, true),
      isNull(result.hiddenAt),
      isNull(result.withdrawnAt),
    )).limit(1);
    if (!voterResult) return false;

    const firstIsLow = assignment.comparison.presentedFirstId === assignment.comparison.candidateLowId;
    const choice =
      selected === 'first'
        ? firstIsLow
          ? 'low'
          : 'high'
        : selected === 'second'
          ? firstIsLow
            ? 'high'
            : 'low'
          : selected === 'tie' || selected === 'pass'
            ? selected
            : null;
    if (!choice) return false;
    if (assignment.comparison.choice) return assignment.comparison.choice === choice;

    await tx
      .update(comparison)
      .set({ choice, decidedAt: clock.now })
      .where(eq(comparison.id, assignmentId));
    return true;
  });
}

export async function ensureWeekFinalized(weekId: number) {
  return db.transaction(async (tx) => {
    const [targetWeek] = await tx.select().from(week).where(eq(week.id, weekId)).for('update').limit(1);
    if (!targetWeek || targetWeek.finalizedAt) return targetWeek ?? null;

    const [databaseClock] = await tx.execute<{ now: string }>(sql`select clock_timestamp() as now`);
    const clock = { now: new Date(databaseClock.now) };
    if (clock.now < targetWeek.votingClosesAt) return targetWeek;

    const candidates = await tx
      .select({ id: result.id })
      .from(result)
      .innerJoin(profile, eq(result.userId, profile.userId))
      .where(
        and(
          eq(result.weekId, weekId),
          eq(result.onTime, true),
          inArray(result.status, ['complete', 'partial', 'submitted']),
          isNull(result.hiddenAt),
          isNull(result.withdrawnAt),
          eq(profile.isPublic, true),
          isNull(profile.hiddenAt),
          isNull(profile.withdrawnAt),
        ),
      );
    if (candidates.length < 6) {
      const [finalized] = await tx
        .update(week)
        .set({ rankingStatus: 'unranked', finalizedAt: clock.now })
        .where(eq(week.id, weekId))
        .returning();
      return finalized;
    }

    const choices = await tx
      .select({ candidateLowId: comparison.candidateLowId, candidateHighId: comparison.candidateHighId, choice: comparison.choice })
      .from(comparison)
      .where(
        and(
          eq(comparison.weekId, weekId),
          isNotNull(comparison.choice),
          isNull(comparison.invalidatedAt),
        ),
      );
    const ranked = rankCandidateScores(
      scoreCandidateChoices(candidates.map((candidate) => candidate.id), choices),
    );
    // Keep each insert below the PostgreSQL bind-parameter limit.
    for (let offset = 0; offset < ranked.length; offset += 1000) {
      await tx.insert(ranking).values(
        ranked.slice(offset, offset + 1000).map((entry) => ({
          weekId,
          resultId: entry.resultId,
          scoreNumerator: entry.scoreNumerator,
          scoreDenominator: entry.scoreDenominator,
          wins: entry.wins,
          ties: entry.ties,
          decisions: entry.decisions,
          rank: entry.rank,
          finalizedAt: clock.now,
        })),
      );
    }
    const [finalized] = await tx
      .update(week)
      .set({ rankingStatus: ranked.length ? 'final' : 'unranked', finalizedAt: clock.now })
      .where(eq(week.id, weekId))
      .returning();
    return finalized;
  });
}

async function getProvisionalLeaderboard(userId: string, now: Date, page: number) {
  const [votingWeek] = await db
    .select()
    .from(week)
    .where(and(lte(week.submissionClosesAt, now), gt(week.votingClosesAt, now)))
    .orderBy(desc(week.startsAt))
    .limit(1);
  if (!votingWeek) return null;

  const reviewed = await db
    .select({ id: comparison.id })
    .from(comparison)
    .where(
      and(
        eq(comparison.weekId, votingWeek.id),
        eq(comparison.voterUserId, userId),
        isNotNull(comparison.choice),
        isNull(comparison.invalidatedAt),
      ),
    )
    .limit(10);
  if (reviewed.length < 10) return null;

  const candidates = await db
    .select({ id: result.id, handle: profile.handle })
    .from(result)
    .innerJoin(profile, eq(result.userId, profile.userId))
    .where(
      and(
        eq(result.weekId, votingWeek.id),
        eq(result.onTime, true),
        inArray(result.status, ['complete', 'partial', 'submitted']),
        isNull(result.hiddenAt),
        isNull(result.withdrawnAt),
        eq(profile.isPublic, true),
        isNull(profile.hiddenAt),
        isNull(profile.withdrawnAt),
      ),
    );
  if (candidates.length < 6) {
    return { week: { ...votingWeek, rankingStatus: 'unranked' }, now, entries: [], provisional: false as const, page, hasNext: false };
  }
  const choices = await db
    .select({ candidateLowId: comparison.candidateLowId, candidateHighId: comparison.candidateHighId, choice: comparison.choice })
    .from(comparison)
    .where(and(eq(comparison.weekId, votingWeek.id), isNotNull(comparison.choice), isNull(comparison.invalidatedAt)));
  const ranked = rankCandidateScores(
    scoreCandidateChoices(candidates.map((candidate) => candidate.id), choices),
  );
  const handles = new Map(candidates.map((candidate) => [candidate.id, candidate.handle]));
  ranked.sort((a, b) => a.rank - b.rank || handles.get(a.resultId)!.localeCompare(handles.get(b.resultId)!));
  const offset = (page - 1) * PAGE_SIZE;
  const selected = ranked.slice(offset, offset + PAGE_SIZE);
  const details = selected.length ? await db.select({
    id: result.id,
    handle: profile.handle,
    displayName: profile.displayName,
    projectName: profile.projectName,
    projectUrl: profile.projectUrl,
    promise: commitment.promise,
    summary: result.summary,
    weekStartDate: week.weekStartDate,
  }).from(result)
    .innerJoin(commitment, eq(result.commitmentId, commitment.id))
    .innerJoin(profile, eq(result.userId, profile.userId))
    .innerJoin(week, eq(result.weekId, week.id))
    .where(and(inArray(result.id, selected.map((entry) => entry.resultId)),
      eq(profile.isPublic, true), isNull(profile.hiddenAt), isNull(profile.withdrawnAt),
      isNull(result.hiddenAt), isNull(result.withdrawnAt))) : [];
  const byId = new Map(details.map((entry) => [entry.id, entry]));
  const entries = selected.flatMap((score) => {
    const detail = byId.get(score.resultId);
    return detail ? [{ ...detail, ...score }] : [];
  });
  return { week: votingWeek, now, entries, provisional: true as const, page, hasNext: ranked.length > offset + PAGE_SIZE };
}

export async function getLatestLeaderboard(userId?: string, requestedPage = 1) {
  const page = pageNumber(requestedPage);
  if (!databaseConfigured) return null;
  const now = await getDatabaseNow();
  if (userId) {
    const provisional = await getProvisionalLeaderboard(userId, now, page);
    if (provisional) return provisional;
  }
  const [latestClosedWeek] = await db
    .select()
    .from(week)
    .where(lte(week.votingClosesAt, now))
    .orderBy(desc(week.startsAt))
    .limit(1);
  const [latestStartedWeek] = latestClosedWeek
    ? []
    : await db
        .select()
        .from(week)
        .where(lte(week.startsAt, now))
        .orderBy(desc(week.startsAt))
        .limit(1);
  const [nextWeek] = latestClosedWeek || latestStartedWeek
    ? []
    : await db.select().from(week).orderBy(asc(week.startsAt)).limit(1);
  const latestWeek = latestClosedWeek ?? latestStartedWeek ?? nextWeek;
  if (!latestWeek) return null;
  const finalWeek = latestClosedWeek && !latestClosedWeek.finalizedAt
    ? await ensureWeekFinalized(latestWeek.id)
    : latestWeek;
  const entries = finalWeek?.rankingStatus === 'final'
    ? await db
        .select({
          rank: ranking.rank,
          wins: ranking.wins,
          ties: ranking.ties,
          decisions: ranking.decisions,
          scoreNumerator: ranking.scoreNumerator,
          scoreDenominator: ranking.scoreDenominator,
          handle: profile.handle,
          displayName: profile.displayName,
          projectName: profile.projectName,
          projectUrl: profile.projectUrl,
          promise: commitment.promise,
          summary: result.summary,
          weekStartDate: week.weekStartDate,
        })
        .from(ranking)
        .innerJoin(result, eq(ranking.resultId, result.id))
        .innerJoin(commitment, eq(result.commitmentId, commitment.id))
        .innerJoin(profile, eq(result.userId, profile.userId))
        .innerJoin(week, eq(ranking.weekId, week.id))
        .where(
          and(
            eq(ranking.weekId, latestWeek.id),
            eq(profile.isPublic, true),
            isNull(profile.hiddenAt),
            isNull(profile.withdrawnAt),
            isNull(result.hiddenAt),
            isNull(result.withdrawnAt),
          ),
        )
        .orderBy(asc(ranking.rank), asc(profile.handle))
        .limit(PAGE_SIZE + 1).offset((page - 1) * PAGE_SIZE)
    : [];

  return { week: finalWeek, now, entries: entries.slice(0, PAGE_SIZE), provisional: false as const, page, hasNext: entries.length > PAGE_SIZE };
}

export async function finalizeLatestClosedWeek() {
  if (!databaseConfigured) return;
  const now = await getDatabaseNow();
  const closedWeeks = await db
    .select({ id: week.id })
    .from(week)
    .where(and(lte(week.votingClosesAt, now), isNull(week.finalizedAt)))
    .orderBy(asc(week.startsAt));
  for (const closedWeek of closedWeeks) {
    await ensureWeekFinalized(closedWeek.id);
  }
}
