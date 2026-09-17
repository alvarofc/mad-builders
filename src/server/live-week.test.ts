import { beforeEach, expect, it, vi } from 'vitest';

const { getDatabaseNow, getProfileByUserId, select } = vi.hoisted(() => ({
  getDatabaseNow: vi.fn(),
  getProfileByUserId: vi.fn(),
  select: vi.fn(),
}));

vi.mock('./db', () => ({ databaseConfigured: true, db: { select } }));
vi.mock('./profiles', () => ({ getProfileByUserId, ownerNames: {} }));
vi.mock('./weeks', () => ({ getDatabaseNow }));

import { getLiveWeek } from './ranking';

const now = new Date('2026-09-07T12:00:00Z');
const week = {
  id: 2,
  startsAt: new Date('2026-09-06T22:00:00Z'),
  submissionClosesAt: new Date('2026-09-13T16:00:00Z'),
  votingClosesAt: new Date('2026-09-14T16:00:00Z'),
};
const upcomingWeek = { ...week, id: 3, startsAt: new Date('2026-09-13T22:00:00Z') };

function reads(rows: unknown[][]) {
  select.mockImplementation(() => {
    const value = rows.shift() ?? [];
    const query = {
      from: () => query,
      where: () => query,
      orderBy: () => query,
      limit: async () => value,
    };
    return query;
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  getDatabaseNow.mockResolvedValue(now);
});

it('reports the current phase, upcoming week, and no-schedule fallback', async () => {
  getProfileByUserId.mockResolvedValue({ id: 'project' });
  reads([[week], [{ id: 10 }]]);
  expect(await getLiveWeek('user')).toMatchObject({ week, phase: 'shipping', published: true });

  reads([[], [upcomingWeek]]);
  expect(await getLiveWeek()).toMatchObject({ week: upcomingWeek, phase: 'opens soon', published: false });

  reads([[], []]);
  expect(await getLiveWeek()).toBeNull();
});
