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
  const limits: number[] = [];
  const joins: Array<{ sql: string; params: unknown[] }> = [];
  select.mockImplementation(() => {
    const value = rows.shift() ?? [];
    const query = {
      from: () => query, innerJoin: () => query, leftJoin: (_table: unknown, predicate: Parameters<PgDialect['sqlToQuery']>[0]) => {
        joins.push(new PgDialect().sqlToQuery(predicate)); return query;
      },
      where: (predicate: Parameters<PgDialect['sqlToQuery']>[0]) => {
        predicates.push(new PgDialect().sqlToQuery(predicate)); return query;
      },
      orderBy: () => query, limit: async (count: number) => { limits.push(count); return value; },
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(value).then(resolve),
    };
    return query;
  });
  return Object.assign(predicates, { joins, limits });
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
  const predicates = reads([[{ week: previous }], [current], [{ id: 44, projectId: 'owner', promise: 'Ship the prototype' }], [], [{ id: 55, promise: 'This week is already locked' }]]);
  const state = await getBuildState('owner', previous.weekStartDate);
  expect(state).toMatchObject({ currentWeek: previous, currentCommitment: { id: 44 }, currentResult: null, nextWeek: current, selectedLateWeek: true, late: true, canSetNextPromise: false });
  expect(predicates.joins[0].sql).toContain('"result"."project_id" =');
  expect(predicates[0].sql).toContain('"result"."id" is null');
  expect(predicates.joins[0].params).toContain('owner');
  expect(predicates[1].params).toEqual([previous.startsAt.toISOString()]);
  expect(predicates[2].params).toEqual(['owner', previous.id]);
});

it('keeps an unfinished previous week accessible during a deadline extension', async () => {
  const extended = { ...previous, submissionClosesAt: new Date('2026-09-07T22:00:00Z'), votingClosesAt: new Date('2026-09-08T16:00:00Z') };
  const predicates = reads([[{ week: extended }], [current], [{ id: 44, projectId: 'owner' }], [], []]);
  expect(await getBuildState('owner', extended.weekStartDate)).toMatchObject({
    currentWeek: extended, phase: 'active', late: false, canSetNextPromise: false,
  });
  expect(predicates[0].sql).toContain('or "app_private"."week"."week_start_date" <');
  expect(predicates[0].params).toContain('2026-09-07');
});

it.each(['not-a-date', '2026-02-30', '2026-08-24'])('rejects an unavailable or foreign week %s before loading its commitment', async (date) => {
  reads([[]]);
  expect(await getBuildState('owner', date)).toBeNull();
  expect(select).toHaveBeenCalledTimes(date === '2026-08-24' ? 1 : 0);
});

it('rejects a week that another tab published after the unfinished list was loaded', async () => {
  reads([[{ week: previous }], [current], [{ id: 44, projectId: 'owner' }], [{ id: 66 }]]);
  expect(await getBuildState('owner', previous.weekStartDate)).toBeNull();
});

it.each([-1, 0, 1])('allows next-goal edits only before its start (%i ms from Monday)', async (offset) => {
  execute.mockResolvedValue([{ now: new Date(current.startsAt.getTime() + offset).toISOString() }]);
  reads([[], [previous], [current], [{ id: 44 }], [{ id: 66 }], [{ id: 55, promise: 'Next goal' }]]);
  expect(await getBuildState('owner')).toMatchObject({
    phase: 'voting', currentResult: { id: 66 }, canSetNextPromise: offset < 0,
  });
});

it('opens an unfinished previous week without a saved goal', async () => {
  reads([[{ week: previous }], [current], [], []]);
  expect(await getBuildState('owner', previous.weekStartDate)).toMatchObject({
    currentWeek: previous, currentCommitment: null, currentResult: null,
    selectedLateWeek: true, late: true, canSetNextPromise: false,
  });
});

it('bounds the catch-up list while looking up an older link directly', async () => {
  const list = reads([[], [current], [next], [], []]);
  await getBuildState('owner');
  expect(list.limits[0]).toBe(12);
  const old = { ...previous, weekStartDate: '2025-01-06' };
  const direct = reads([[{ week: old }], [current], [], []]);
  expect(await getBuildState('owner', old.weekStartDate)).toMatchObject({ currentWeek: old });
  expect(direct[0].params).toContain(old.weekStartDate);
  expect(direct.limits[0]).toBe(1);
});
