import { beforeEach, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const { select, execute } = vi.hoisted(() => ({ select: vi.fn(), execute: vi.fn() }));
vi.mock('./db', () => ({ databaseConfigured: true, db: { select, execute } }));
import { getBuildState } from './weeks';

const now = new Date('2026-09-07T12:00:00Z');
const previous = { id: 1, weekStartDate: '2026-08-31', startsAt: new Date('2026-08-30T22:00:00Z'), submissionClosesAt: new Date('2026-09-06T16:00:00Z'), votingClosesAt: new Date('2026-09-07T16:00:00Z') };
const current = { id: 2, weekStartDate: '2026-09-07', startsAt: new Date('2026-09-06T22:00:00Z'), submissionClosesAt: new Date('2026-09-13T16:00:00Z'), votingClosesAt: new Date('2026-09-14T16:00:00Z') };
const next = { ...current, id: 3, startsAt: new Date('2026-09-13T22:00:00Z') };

function reads(rows: unknown[][]) {
  const predicates: Array<{ sql: string; params: unknown[] }> = [];
  select.mockImplementation(() => {
    const value = rows.shift() ?? [];
    const query = {
      from: () => query, innerJoin: () => query, leftJoin: () => query,
      where: (predicate: Parameters<PgDialect['sqlToQuery']>[0]) => {
        predicates.push(new PgDialect().sqlToQuery(predicate)); return query;
      },
      orderBy: () => query, limit: async () => value,
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(value).then(resolve),
    };
    return query;
  });
  return predicates;
}
beforeEach(() => {
  vi.resetAllMocks();
  execute.mockResolvedValue([{ now: now.toISOString() }]);
});

it('keeps Monday on the current week while offering the unfinished previous week', async () => {
  reads([[{ week: previous }], [current], [next], [], []]);
  const state = await getBuildState('owner');
  expect(state).toMatchObject({ currentWeek: current, nextWeek: next, selectedLateWeek: false, late: false, canSetNextPromise: true, unfinishedWeeks: [previous] });
});

it('opens the owned late commitment after rollover without moving its next goal to a later week', async () => {
  const predicates = reads([[{ week: previous }], [current], [{ id: 44, userId: 'owner', promise: 'Ship the prototype' }], [], [{ id: 55, promise: 'This week is already locked' }]]);
  const state = await getBuildState('owner', previous.weekStartDate);
  expect(state).toMatchObject({ currentWeek: previous, currentCommitment: { id: 44 }, currentResult: null, nextWeek: current, selectedLateWeek: true, late: true, canSetNextPromise: false });
  expect(predicates[0].sql).toContain('"commitment"."user_id" =');
  expect(predicates[0].sql).toContain('"result"."id" is null');
  expect(predicates[0].params).toContain('owner');
  expect(predicates[1].params).toEqual([previous.startsAt.toISOString()]);
  expect(predicates[2].params).toEqual(['owner', previous.id]);
});

it.each(['not-a-date', '2026-02-30', '2026-08-24'])('rejects an unavailable or foreign week %s before loading its commitment', async (date) => {
  reads([[{ week: previous }]]);
  expect(await getBuildState('owner', date)).toBeNull();
  expect(select).toHaveBeenCalledOnce();
});

it('rejects a week that another tab published after the unfinished list was loaded', async () => {
  reads([[{ week: previous }], [current], [{ id: 44, userId: 'owner' }], [{ id: 66 }]]);
  expect(await getBuildState('owner', previous.weekStartDate)).toBeNull();
});
