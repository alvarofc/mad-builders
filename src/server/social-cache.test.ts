import { beforeEach, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
const state = vi.hoisted(() => ({ rows: new Map<string, any>() }));
vi.mock('./db', () => ({ db: {
  insert: () => ({ values: (row: any) => ({ onConflictDoNothing: () => ({ returning: async () => {
    if (state.rows.has(row.key)) return [];
    state.rows.set(row.key, row); return [{ key: row.key }];
  } }) }) }),
  select: () => ({ from: () => ({ where: async (condition: any) => {
    const key = new PgDialect().sqlToQuery(condition).params[0] as string;
    return [state.rows.get(key)];
  } }) }),
  update: () => ({ set: (values: any) => ({ where: async (condition: any) => {
    const key = new PgDialect().sqlToQuery(condition).params[0] as string;
    Object.assign(state.rows.get(key), values);
  } }) }),
} }));
import { cachedSocialRequest } from './social-cache';
beforeEach(() => state.rows.clear());
const today = new Date('2026-09-22T12:00:00Z');
it('claims once across concurrent callers, reuses partial results, and refreshes the next UTC day', async () => {
  let release!: (value: unknown) => void;
  const run = vi.fn(() => new Promise(resolve => { release = resolve; }));
  const first = cachedSocialRequest('provider', 'account', run, today);
  await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
  await expect(cachedSocialRequest('provider', 'account', run, today)).rejects.toThrow('already attempted');
  release({ warnings: ['Partial data'], posts: [] });
  await first;
  expect(await cachedSocialRequest('provider', 'account', run, today)).toEqual({ warnings: ['Partial data'], posts: [] });
  expect(run).toHaveBeenCalledOnce();
  const next = vi.fn().mockResolvedValue('fresh');
  expect(await cachedSocialRequest('provider', 'account', next, new Date('2026-09-23'))).toBe('fresh');
});
it('does not retry failed paid calls and separates AI inputs', async () => {
  const failed = vi.fn().mockRejectedValue(new Error('Provider failed'));
  await expect(cachedSocialRequest('provider', 'account', failed, today)).rejects.toThrow();
  await expect(cachedSocialRequest('provider', 'account', failed, today)).rejects.toThrow();
  expect(failed).toHaveBeenCalledOnce();
  const review = vi.fn().mockResolvedValue({ posts: [] });
  await cachedSocialRequest('review', ['project-a', 'draft'], review, today);
  await cachedSocialRequest('review', ['project-a', 'draft'], review, today);
  await cachedSocialRequest('review', ['project-b', 'draft'], review, today);
  expect(review).toHaveBeenCalledTimes(2);
});

it('allows only one extra manual refresh per daily account key', async () => {
  const run = vi.fn().mockResolvedValue({ posts: [] });
  await cachedSocialRequest('provider-v1', ['linkedin', 'account'], run, today);
  await cachedSocialRequest('provider-refresh-v1', ['linkedin', 'account'], run, today);
  await cachedSocialRequest('provider-refresh-v1', ['linkedin', 'account'], run, today);
  expect(run).toHaveBeenCalledTimes(2);
});
