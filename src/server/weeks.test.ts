import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('./db', () => ({ databaseConfigured: true, db: { execute } }));
import { ensureWeeklySchedule, madridWeekStartDates } from './weeks';

describe('automatic weekly schedule', () => {
  it('uses Madrid Mondays across daylight-saving changes', () => {
    expect(madridWeekStartDates(new Date('2026-09-04T12:00:00Z'))).toEqual(['2026-08-31', '2026-09-07']);
    expect(madridWeekStartDates(new Date('2026-03-29T21:59:59Z'))).toEqual(['2026-03-23', '2026-03-30']);
    expect(madridWeekStartDates(new Date('2026-03-29T22:00:00Z'))).toEqual(['2026-03-30', '2026-04-06']);
  });
});

it('schedules updates through Monday and voting through Tuesday in Madrid time', async () => {
  execute.mockResolvedValueOnce([{ now: '2026-09-21T12:00:00Z' }]).mockResolvedValueOnce([]);
  await ensureWeeklySchedule();
  const schedule = new PgDialect().sqlToQuery(execute.mock.calls[1][0]);
  expect(schedule.sql).toContain("interval '8 days') at time zone 'Europe/Madrid'");
  expect(schedule.sql).toContain("interval '9 days') at time zone 'Europe/Madrid'");
  expect(schedule.params).toEqual(['2026-09-21', '2026-09-28']);
});
