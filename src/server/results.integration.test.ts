import { expect, it, vi } from 'vitest';
import { and, eq, gt, lte } from 'drizzle-orm';

// Opt in with DATABASE_TEST_URL. All test records roll back, including on failure.
it.skipIf(!process.env.DATABASE_TEST_URL)('publishes and edits a first update against Postgres without leaving test records', async () => {
  vi.stubEnv('DATABASE_URL', process.env.DATABASE_TEST_URL!);
  const { db } = await import('./db');
  const { user, project, projectOwner, week, commitment, result, comparison } = await import('./schema');
  const { publishResult } = await import('./results');
  const { getReviewState, submitReview } = await import('./ranking');
  const rollback = new Error('rollback-test-records');
  const originalTransaction = db.transaction.bind(db);
  try {
    await originalTransaction(async (tx) => {
      const transactionSpy = vi.spyOn(db, 'transaction').mockImplementation(async (callback) => callback(tx));
      try {
        const now = new Date();
        const [activeWeek] = await tx.select().from(week).where(and(lte(week.startsAt, now), gt(week.submissionClosesAt, now))).limit(1);
        if (!activeWeek) throw new Error('This integration check needs an active submission week.');
        const id = crypto.randomUUID();
        await tx.insert(user).values({ id, name: 'Rollback test', email: `${id}@example.invalid` });
        await tx.insert(project).values({ id: id, handle: `test-${id.slice(0, 12)}`, projectName: 'Rollback project', isPublic: false });
        await tx.insert(projectOwner).values({ projectId: id, userId: id, active: true });
        const input = { userId: id, projectId: id, commitmentId: null, weekId: activeWeek.id, status: 'submitted' as const, summary: 'Published a working prototype', feedbackRequest: '', nextPromise: 'Get feedback from three builders', projectSentence: 'A project for a rollback test', projectUrl: null, projectStage: 'building' as const, proof: { url: null, status: 'self_reported' as const, checkedAt: null } };
        const first = await publishResult(input);
        expect(first.result.commitmentId).toBeGreaterThan(0);
        expect(first.result.status).toBe('submitted');
        const edited = await publishResult({ ...input, commitmentId: first.result.commitmentId, summary: 'Edited the prototype update' });
        expect(edited.result.id).toBe(first.result.id);
        expect(edited.result.publishedAt).toEqual(first.result.publishedAt);
        expect(edited.result.summary).toBe('Edited the prototype update');
        const saved = await tx.select().from(result).where(eq(result.projectId, id));
        expect(saved).toHaveLength(1);
        const plans = await tx.select().from(commitment).where(eq(commitment.projectId, id));
        expect(plans.map((plan) => plan.promise)).toContain(input.nextPromise);
        // A separate voting week exists only inside this uncommitted transaction.
        const [votingWeek] = await tx.insert(week).values({ weekStartDate: '1800-01-01', startsAt: new Date(now.getTime() - 60000), submissionClosesAt: new Date(now.getTime() - 30000), votingClosesAt: new Date(now.getTime() + 86400000) }).returning();
        for (let index = 0; index < 6; index++) {
          const voterId = index === 0 ? id : crypto.randomUUID();
          if (index > 0) {
            await tx.insert(user).values({ id: voterId, name: 'Rollback peer', email: `${voterId}@example.invalid` });
            await tx.insert(project).values({ id: voterId, handle: `test-${voterId.slice(0, 12)}`, projectName: 'Rollback project' });
            await tx.insert(projectOwner).values({ projectId: voterId, userId: voterId, active: true });
          } else await tx.update(project).set({ isPublic: true }).where(eq(project.id, id));
          const [plan] = await tx.insert(commitment).values({ projectId: voterId, weekId: votingWeek.id, promise: '' }).returning();
          await tx.insert(result).values({ projectId: voterId, weekId: votingWeek.id, commitmentId: plan.id, status: 'submitted', summary: 'Built a demo', onTime: true });
        }
        for (let index = 0; index < 10; index++) {
          const pair = await getReviewState(id);
          expect(pair.state).toBe('pair');
          if (pair.state !== 'pair') throw new Error('Expected a comparison');
          expect(pair.reviewed).toBe(index);
          expect(pair.first.projectId).not.toBe(id);
          expect(pair.second.projectId).not.toBe(id);
          const resumed = await getReviewState(id);
          expect(resumed.state === 'pair' && resumed.assignmentId).toBe(pair.assignmentId);
          expect(await submitReview(id, pair.assignmentId, 'first')).toBe(true);
          expect(await submitReview(id, pair.assignmentId, 'first')).toBe(true);
        }
        const completed = await getReviewState(id);
        expect(completed).toMatchObject({ state: 'complete', reviewed: 10 });
        // Moderation preserves pair uniqueness even after votes stop counting.
        await tx.update(comparison).set({ invalidatedAt: now })
          .where(and(eq(comparison.weekId, votingWeek.id), eq(comparison.voterProjectId, id)));
        expect(await getReviewState(id)).toMatchObject({ state: 'exhausted', reviewed: 0 });
        expect(await getReviewState(id)).toMatchObject({ state: 'exhausted', reviewed: 0 });
        const history = await tx.select().from(comparison)
          .where(and(eq(comparison.weekId, votingWeek.id), eq(comparison.voterProjectId, id)));
        expect(history).toHaveLength(10);
        throw rollback;
      } finally { transactionSpy.mockRestore(); }
    });
  } catch (error) { if (error !== rollback) throw error; }
  finally { vi.unstubAllEnvs(); }
}, 30000);
