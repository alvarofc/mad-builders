import { describe, expect, it, vi } from 'vitest';
const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock('./db', () => ({ db: { transaction }, databaseConfigured: false }));
vi.mock('./auth', () => ({ auth: {} }));
import { projectStageLabel, validProjectStage, publishResult } from './results';
import { submitReview } from './ranking';
import { commitment, result } from './schema';

const now = new Date('2026-09-06T15:00:00Z');
const currentWeek = { id: 1, weekStartDate: '2026-08-31', startsAt: new Date('2026-08-30T22:00:00Z'), submissionClosesAt: new Date('2026-09-06T16:00:00Z'), votingClosesAt: new Date('2026-09-07T16:00:00Z') };
const nextWeek = { ...currentWeek, id: 2, startsAt: new Date('2026-09-06T22:00:00Z') };
const input = { userId: 'builder', commitmentId: null, weekId: 1, status: 'submitted' as const, summary: 'Shipped the demo', feedbackRequest: '', nextPromise: 'Test it with five builders', projectSentence: 'Tools for builders', projectUrl: null, projectStage: 'building' as const, proof: { url: null, status: 'self_reported' as const, checkedAt: null } };

function mockTransaction(reads: unknown[][], clock = now) {
  const writes: Array<{ table: unknown; values: any }> = [];
  const tx = {
    execute: vi.fn().mockResolvedValue([{ now: clock.toISOString() }]),
    select: () => {
      const query = { from: () => query, where: () => query, for: () => query, orderBy: () => query, innerJoin: () => query, limit: async () => reads.shift() ?? [] };
      return query;
    },
    insert: (table: unknown) => {
      let values: any;
      const query = { values: (value: any) => { values = value; writes.push({ table, values }); return query; }, onConflictDoUpdate: () => query, onConflictDoNothing: () => query, returning: async () => [{ ...values, id: table === commitment ? 77 : 99 }] };
      return query;
    },
    update: (table: unknown) => {
      let values: any;
      const query = { set: (value: any) => { values = value; writes.push({ table, values }); return query; }, where: () => query, returning: async () => [{ ...values, id: 99 }] };
      return query;
    },
  };
  transaction.mockImplementation((callback) => callback(tx));
  return writes;
}

describe('Pioneer update fields', () => {
  it('accepts only supported project stages', () => {
    expect(validProjectStage('launched')).toBe(true);
    expect(validProjectStage('profitable')).toBe(false);
    expect(projectStageLabel('private_testing')).toBe('Privately testing with users');
  });

  it('publishes a first update with its created commitment ID and a neutral status', async () => {
    const writes = mockTransaction([[currentWeek], [], [nextWeek], []]);
    await publishResult(input);
    expect(writes.find((write) => write.table === result)?.values).toMatchObject({ commitmentId: 77, status: 'submitted' });
    expect(writes.filter((write) => write.table === commitment).map((write) => write.values.promise)).toEqual(['', input.nextPromise]);
  });

  it('preserves an existing plan when a stale first-update form is submitted', async () => {
    mockTransaction([[{ commitment: { id: 77, promise: 'Ship the demo' }, week: currentWeek }]]);
    await expect(publishResult({ ...input, commitmentId: 77 })).rejects.toThrow('status_required');
  });

  it('allows edits before voting and preserves the publication time', async () => {
    const publishedAt = new Date('2026-09-04T10:00:00Z');
    const writes = mockTransaction([[{ commitment: { id: 77, promise: '' }, week: currentWeek }], [{ id: 99, publishedAt }], [nextWeek], [{ id: 88 }]]);
    await publishResult({ ...input, commitmentId: 77 });
    expect(writes.find((write) => write.table === result)?.values.publishedAt).toEqual(publishedAt);
    expect(writes.find((write) => write.table === commitment)?.values.promise).toBe(input.nextPromise);
  });

  it('rejects edits exactly when voting opens without writing anything', async () => {
    const writes = mockTransaction([[{ commitment: { id: 77, promise: '' }, week: currentWeek }], [{ id: 99 }]], currentWeek.submissionClosesAt);
    await expect(publishResult({ ...input, commitmentId: 77 })).rejects.toThrow('update_locked');
    expect(writes).toEqual([]);
  });

  it('rejects another user’s nonexistent commitment instead of creating a replacement', async () => {
    const writes = mockTransaction([[]]);
    await expect(publishResult({ ...input, commitmentId: 12 })).rejects.toThrow('commitment_not_found');
    expect(writes).toEqual([]);
  });

  it('accepts a repeated vote after a lost response without counting it twice', async () => {
    const writes = mockTransaction([[{ comparison: { choice: 'low', presentedFirstId: 1, candidateLowId: 1 }, week: currentWeek }]], new Date('2026-09-06T17:00:00Z'));
    expect(await submitReview('builder', 1, 'first')).toBe(true);
    expect(writes).toEqual([]);
  });

  it('does not publish a future week', async () => {
    const writes = mockTransaction([[{ commitment: { id: 77, promise: '' }, week: nextWeek }]]);
    await expect(publishResult({ ...input, commitmentId: 77 })).rejects.toThrow('week_not_started');
    expect(writes).toEqual([]);
  });

  it('requires a next goal when the next week has no commitment', async () => {
    const writes = mockTransaction([[{ commitment: { id: 77, promise: '' }, week: currentWeek }], [], [nextWeek], []]);
    await expect(publishResult({ ...input, commitmentId: 77, nextPromise: '' })).rejects.toThrow('next_commitment_required');
    expect(writes).toEqual([]);
  });

  it('retains a late first result without marking it on time', async () => {
    const writes = mockTransaction([[{ commitment: { id: 77, promise: 'Ship a demo' }, week: currentWeek }], [], [], []], currentWeek.submissionClosesAt);
    await publishResult({ ...input, commitmentId: 77, status: 'partial' });
    expect(writes.find((write) => write.table === result)?.values).toMatchObject({ status: 'partial', onTime: false });
  });

  it('publishes late without requiring or creating a goal once the following week starts', async () => {
    for (const clock of [nextWeek.startsAt, new Date(nextWeek.startsAt.getTime() + 1)]) {
      for (const nextPromise of ['', input.nextPromise]) {
        const writes = mockTransaction([[{ commitment: { id: 77, promise: 'Ship a demo' }, week: currentWeek }], [], [nextWeek], []], clock);
        await publishResult({ ...input, commitmentId: 77, status: 'partial', nextPromise });
        expect(writes.find((write) => write.table === result)?.values.onTime).toBe(false);
        expect(writes.filter((write) => write.table === commitment)).toEqual([]);
      }
    }
  });

  it('rejects a missing vote assignment without writing', async () => {
    const writes = mockTransaction([[]]);
    expect(await submitReview('builder', 999, 'first')).toBe(false);
    expect(writes).toEqual([]);
  });

  it('rejects voting before opening and exactly at closing', async () => {
    for (const clock of [now, currentWeek.votingClosesAt]) {
      const writes = mockTransaction([[{ comparison: { choice: null }, week: currentWeek }]], clock);
      expect(await submitReview('builder', 1, 'first')).toBe(false);
      expect(writes).toEqual([]);
    }
  });

  it('does not change a previously saved choice', async () => {
    const writes = mockTransaction([[{ comparison: { choice: 'low', presentedFirstId: 1, candidateLowId: 1 }, week: currentWeek }]], new Date('2026-09-06T17:00:00Z'));
    expect(await submitReview('builder', 1, 'second')).toBe(false);
    expect(writes).toEqual([]);
  });

  it('rejects invalid choices without writing', async () => {
    const writes = mockTransaction([[{ comparison: { choice: null }, week: currentWeek }]], new Date('2026-09-06T17:00:00Z'));
    expect(await submitReview('builder', 1, 'invalid')).toBe(false);
    expect(writes).toEqual([]);
  });

  it('maps presented order to stored choices including ties and skips', async () => {
    for (const [first, selected, choice] of [[1, 'first', 'low'], [2, 'first', 'high'], [1, 'second', 'high'], [2, 'second', 'low'], [1, 'tie', 'tie'], [1, 'pass', 'pass']] as const) {
      const writes = mockTransaction([[{ comparison: { choice: null, presentedFirstId: first, candidateLowId: 1 }, week: currentWeek }]], new Date('2026-09-06T17:00:00Z'));
      expect(await submitReview('builder', 1, selected)).toBe(true);
      expect(writes).toHaveLength(1);
      expect(writes[0].values.choice).toBe(choice);
    }
  });
});
