import { expect, it, vi } from 'vitest';

vi.mock('./db', () => ({ databaseConfigured: true, db: {} }));
vi.mock('./profiles', () => ({ getProfileByUserId: async () => ({ id: 'project' }), ownerNames: {} }));
import { getReviewState } from './ranking';

it('returns the scheduled closing time for an extended voting window and handles no schedule', async () => {
  const upcoming = {
    submissionClosesAt: new Date('2026-09-14T22:00:00Z'),
    votingClosesAt: new Date('2026-09-18T16:00:00Z'),
  };
  for (const scheduled of [upcoming, undefined]) {
    const rows = [[], scheduled ? [scheduled] : []];
    const connection = {
      execute: async () => [{ now: '2026-09-14T12:00:00Z' }],
      select: () => {
        const query = {
          from: () => query, where: () => query, orderBy: () => query,
          for: () => query, limit: async () => rows.shift(),
        };
        return query;
      },
    };
    expect(await getReviewState('owner', undefined, connection as Parameters<typeof getReviewState>[2]))
      .toEqual({ state: 'closed', opensAt: scheduled?.submissionClosesAt, closesAt: scheduled?.votingClosesAt });
  }
});
