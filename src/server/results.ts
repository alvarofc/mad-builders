import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';
import { auth } from './auth';
import { blocksWeeklyUpdate, getReviewState } from './ranking';
import { db } from './db';
import { getProfileByUserId } from './profiles';
import { account, commitment, project, result, week } from './schema';

export type ProofCheck = {
  url: string | null;
  status: 'self_reported' | 'proof_linked' | 'github_account_matched';
  checkedAt: Date | null;
};

export const projectStages = [
  { value: 'idea', label: 'Exploring an idea' },
  { value: 'building', label: 'Building a prototype' },
  { value: 'private_testing', label: 'Privately testing with users' },
  { value: 'launched', label: 'Publicly launched' },
  { value: 'growing', label: 'Growing' },
] as const;

export type ProjectStage = (typeof projectStages)[number]['value'];
export const validProjectStage = (value: string): value is ProjectStage =>
  projectStages.some((stage) => stage.value === value);
export const projectStageLabel = (value: string) =>
  projectStages.find((stage) => stage.value === value)?.label ?? value;

function githubCommit(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com') return null;
  const [owner, repository, kind, sha, ...rest] = url.pathname.split('/').filter(Boolean);
  if (!owner || !repository || kind !== 'commit' || !sha || rest.length) return null;
  if (!/^[a-f0-9]{7,64}$/i.test(sha)) return null;
  return { owner, repository, sha };
}

export async function checkProof(value: string, userId: string, headers: Headers): Promise<ProofCheck> {
  if (!value.trim()) return { url: null, status: 'self_reported', checkedAt: null };

  if (value.trim().length > 2048) throw new Error('invalid_url');
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid_url');
  const normalized = url.toString();
  const commit = githubCommit(normalized);
  if (!commit) return { url: normalized, status: 'proof_linked', checkedAt: null };

  const [githubAccount] = await db
    .select({ id: account.id, accountId: account.accountId })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'github')))
    .limit(1);
  if (!githubAccount) return { url: normalized, status: 'proof_linked', checkedAt: new Date() };

  try {
    const token = await auth.api.getAccessToken({
      body: { accountId: githubAccount.id },
      headers,
    });
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(commit.owner)}/${encodeURIComponent(commit.repository)}/commits/${commit.sha}`,
      {
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${token.accessToken}`,
          'x-github-api-version': '2022-11-28',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) return { url: normalized, status: 'proof_linked', checkedAt: new Date() };

    const payload = (await response.json()) as {
      author?: { id?: number } | null;
      committer?: { id?: number } | null;
    };
    const matched = [payload.author?.id, payload.committer?.id]
      .filter((id): id is number => typeof id === 'number')
      .some((id) => String(id) === githubAccount.accountId);

    return {
      url: normalized,
      status: matched ? 'github_account_matched' : 'proof_linked',
      checkedAt: new Date(),
    };
  } catch {
    return { url: normalized, status: 'proof_linked', checkedAt: new Date() };
  }
}

export async function publishResult(input: {
  projectId: string;
  userId: string;
  commitmentId: number | null;
  weekId: number | null;
  status: 'complete' | 'partial' | 'missed' | 'submitted';
  summary: string;
  feedbackRequest: string;
  nextPromise: string;
  projectSentence: string;
  projectUrl: string | null;
  projectStage: ProjectStage;
  proof: ProofCheck;
}) {
  return db.transaction(async (tx) => {
    // ponytail: serialize open weeks like membership/moderation; narrow this lock set
    // if publication throughput requires it, preserving ascending order for catch-up updates.
    await tx.select({ id: week.id }).from(week).where(isNull(week.finalizedAt)).orderBy(week.id).for('update');
    const review = await getReviewState(input.userId, input.projectId, tx);
    const ownedProject = await getProfileByUserId(input.userId, tx);
    if (!ownedProject) throw new Error('commitment_not_found');
    const projectId = ownedProject.id;
    if (projectId !== input.projectId) throw new Error('project_changed');
    if (input.commitmentId) {
      const [owned] = await tx.select({ weekId: commitment.weekId }).from(commitment)
        .where(and(eq(commitment.id, input.commitmentId), eq(commitment.projectId, projectId))).limit(1);
      if (!owned) throw new Error('commitment_not_found');
      await tx.select({ id: week.id }).from(week).where(eq(week.id, owned.weekId)).for('update');
    }
    let [record] = input.commitmentId
      ? await tx
          .select({ commitment, week })
          .from(commitment)
          .innerJoin(week, eq(commitment.weekId, week.id))
          .where(and(eq(commitment.id, input.commitmentId), eq(commitment.projectId, projectId)))
          .for('update')
          .limit(1)
      : [];

    if (!input.commitmentId && input.weekId) {
      const [openWeek] = await tx
        .select()
        .from(week)
        .where(eq(week.id, input.weekId))
        .for('update')
        .limit(1);
      if (openWeek) {
        const [createdCommitment] = await tx
          .insert(commitment)
          .values({ projectId, weekId: openWeek.id, promise: '' })
          .onConflictDoUpdate({
            target: [commitment.projectId, commitment.weekId],
            set: { projectId },
          })
          .returning();
        record = { commitment: createdCommitment, week: openWeek };
      }
    }
    if (!record) throw new Error('commitment_not_found');

    const [existing] = await tx
      .select()
      .from(result)
      .where(eq(result.commitmentId, record.commitment.id))
      .limit(1);
    const status = record.commitment.promise ? input.status : 'submitted';
    if (record.commitment.promise && status === 'submitted') throw new Error('status_required');

    const [nextWeek] = await tx
      .select()
      .from(week)
      .where(gt(week.startsAt, record.week.startsAt))
      .orderBy(asc(week.startsAt))
      .for('update')
      .limit(1);
    const [existingNextCommitment] = nextWeek
      ? await tx
          .select({ id: commitment.id })
          .from(commitment)
          .where(and(eq(commitment.projectId, projectId), eq(commitment.weekId, nextWeek.id)))
          .limit(1)
      : [];
    // Read wall time after the week locks, including any wait for the next goal's week.
    const [databaseClock] = await tx.execute<{ now: string }>(sql`select clock_timestamp() as now`);
    const clock = { now: new Date(databaseClock.now) };
    if (clock.now < record.week.startsAt) throw new Error('week_not_started');
    if (blocksWeeklyUpdate(review, record.week.startsAt, clock.now)) throw new Error('voting_required');
    if (existing && clock.now >= record.week.submissionClosesAt) throw new Error('update_locked');
    if (!input.commitmentId && clock.now >= record.week.submissionClosesAt) throw new Error('commitment_not_found');
    if (
      nextWeek &&
      clock.now < nextWeek.startsAt &&
      !existingNextCommitment &&
      (input.nextPromise.length < 5 || input.nextPromise.length > 280)
    ) {
      throw new Error('next_commitment_required');
    }

    const onTime = clock.now < record.week.submissionClosesAt;
    const values = {
        updatedByUserId: input.userId,
        commitmentId: record.commitment.id,
        projectId,
        weekId: record.week.id,
        status,
        summary: input.summary,
        feedbackRequest: input.feedbackRequest,
        projectSentence: input.projectSentence,
        projectUrl: input.projectUrl,
        projectStage: input.projectStage,
        proofUrl: input.proof.url,
        proofStatus: input.proof.status,
        proofCheckedAt: input.proof.checkedAt,
        publishedAt: existing?.publishedAt ?? clock.now,
        onTime,
      };
    const [published] = existing
      ? await tx.update(result).set(values).where(eq(result.id, existing.id)).returning()
      : await tx.insert(result).values(values).returning();

    await tx
      .update(project)
      .set({
        bio: input.projectSentence,
        projectUrl: input.projectUrl,
        projectStage: input.projectStage,
        firstCommitmentAt: sql`coalesce(${project.firstCommitmentAt}, now())`,
        updatedAt: clock.now,
      })
      .where(eq(project.id, projectId));

    if (nextWeek && clock.now < nextWeek.startsAt && !existingNextCommitment) {
      await tx
        .insert(commitment)
        .values({ projectId, weekId: nextWeek.id, promise: input.nextPromise })
        .onConflictDoNothing();
    } else if (nextWeek && existingNextCommitment && input.nextPromise && clock.now < nextWeek.startsAt) {
      if (input.nextPromise.length < 5 || input.nextPromise.length > 280) throw new Error('next_commitment_required');
      await tx.update(commitment).set({ promise: input.nextPromise, updatedAt: clock.now })
        .where(eq(commitment.id, existingNextCommitment.id));
    }

    if (onTime && input.status !== 'missed') {
      await tx
        .update(project)
        .set({ firstOnTimeResultAt: sql`coalesce(${project.firstOnTimeResultAt}, now())` })
        .where(eq(project.id, projectId));
    }

    return { result: published, weekStartDate: record.week.weekStartDate };
  });
}
