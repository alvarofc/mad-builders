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
import { commitment, comparison, profile, ranking, result, user, week } from './schema';
import { getDatabaseNow } from './weeks';

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
    await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('update');
    const [databaseClock] = await tx.execute<{ now: string }>(sql`select now() as now`);
    const clock = { now: new Date(databaseClock.now) };
    const [votingWeek] = await tx
      .select()
      .from(week)
      .where(and(lte(week.submissionClosesAt, clock.now), gt(week.votingClosesAt, clock.now)))
      .orderBy(desc(week.startsAt))
      .limit(1);
    if (!votingWeek) {
      const [upcoming] = await tx.select().from(week)
        .where(gt(week.submissionClosesAt, clock.now)).orderBy(asc(week.submissionClosesAt)).limit(1);
      return { state: 'closed' as const, opensAt: upcoming?.submissionClosesAt };
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
      .select(candidateColumns)
      .from(result)
      .innerJoin(commitment, eq(result.commitmentId, commitment.id))
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
      const byId = new Map(candidates.map((card) => [card.id, card]));
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
      .select({ low: comparison.candidateLowId, high: comparison.candidateHighId })
      .from(comparison)
      .where(and(eq(comparison.weekId, votingWeek.id), isNull(comparison.invalidatedAt)));
    const exposure = new Map<number, number>();
    const frequency = new Map<string, number>();
    for (const assignment of allAssignments) {
      exposure.set(assignment.low, (exposure.get(assignment.low) ?? 0) + 1);
      exposure.set(assignment.high, (exposure.get(assignment.high) ?? 0) + 1);
      const key = `${assignment.low}:${assignment.high}`;
      frequency.set(key, (frequency.get(key) ?? 0) + 1);
    }

    const pairs: Array<{ low: number; high: number; weight: number; frequency: number }> = [];
    for (let left = 0; left < available.length; left += 1) {
      for (let right = left + 1; right < available.length; right += 1) {
        const low = Math.min(available[left].id, available[right].id);
        const high = Math.max(available[left].id, available[right].id);
        const key = `${low}:${high}`;
        if (used.has(key)) continue;
        pairs.push({
          low,
          high,
          weight: (exposure.get(low) ?? 0) + (exposure.get(high) ?? 0),
          frequency: frequency.get(key) ?? 0,
        });
      }
    }
    pairs.sort((a, b) => a.frequency - b.frequency || a.weight - b.weight);
    const best = pairs[0];
    if (!best) return { state: 'exhausted' as const, week: votingWeek, reviewed };
    const peers = pairs.filter(
      (pair) => pair.frequency === best.frequency && pair.weight === best.weight,
    );
    const picked = peers[Math.floor(Math.random() * peers.length)];
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
    const byId = new Map(available.map((card) => [card.id, card]));

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

export async function submitReview(userId: string, assignmentId: number, selected: string) {
  return db.transaction(async (tx) => {
    await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('update');
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

    const [databaseClock] = await tx.execute<{ now: string }>(sql`select now() as now`);
    const clock = { now: new Date(databaseClock.now) };
    if (clock.now < assignment.week.submissionClosesAt || clock.now >= assignment.week.votingClosesAt) {
      return false;
    }

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

    const [databaseClock] = await tx.execute<{ now: string }>(sql`select now() as now`);
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
      .select()
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
    if (ranked.length) {
      await tx.insert(ranking).values(
        ranked.map((entry) => ({
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

async function getProvisionalLeaderboard(userId: string, now: Date) {
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
    .select({
      id: result.id,
      handle: profile.handle,
      displayName: profile.displayName,
      projectName: profile.projectName,
      projectUrl: profile.projectUrl,
      promise: commitment.promise,
      summary: result.summary,
      weekStartDate: week.weekStartDate,
    })
    .from(result)
    .innerJoin(commitment, eq(result.commitmentId, commitment.id))
    .innerJoin(profile, eq(result.userId, profile.userId))
    .innerJoin(week, eq(result.weekId, week.id))
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
  const choices = await db
    .select()
    .from(comparison)
    .where(
      and(
        eq(comparison.weekId, votingWeek.id),
        isNotNull(comparison.choice),
        isNull(comparison.invalidatedAt),
      ),
    );
  const ranked = rankCandidateScores(
    scoreCandidateChoices(candidates.map((candidate) => candidate.id), choices),
  );
  const scores = new Map(ranked.map((entry) => [entry.resultId, entry]));
  const entries = candidates
    .flatMap((candidate) => {
      const score = scores.get(candidate.id);
      return score ? [{ ...candidate, ...score }] : [];
    })
    .sort((a, b) => a.rank - b.rank || a.handle.localeCompare(b.handle));

  return { week: votingWeek, now, entries, provisional: true as const };
}

export async function getLatestLeaderboard(userId?: string) {
  if (!databaseConfigured) return null;
  const now = await getDatabaseNow();
  if (userId) {
    const provisional = await getProvisionalLeaderboard(userId, now);
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
  const finalWeek = latestClosedWeek ? await ensureWeekFinalized(latestWeek.id) : latestWeek;
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
    : [];

  return { week: finalWeek, now, entries, provisional: false as const };
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
