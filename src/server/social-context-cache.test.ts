import { beforeEach, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SocialSnapshot } from '../lib/socials';

const state = vi.hoisted(() => ({
  cache: new Map<string, any>(), snapshots: new Map<string, any>(), fetch: vi.fn(),
}));
vi.mock('./db', async () => {
  const { socialCache } = await import('./schema');
  const params = (condition: any) => new PgDialect().sqlToQuery(condition).params;
  const snapshotKey = (row: any) => JSON.stringify([row.userId, row.projectId, row.account, row.observedOn]);
  return { db: {
    select: () => ({ from: (table: unknown) => ({ where: (condition: any) => {
      const values = params(condition);
      if (table === socialCache) return Promise.resolve([state.cache.get(values[0] as string)]);
      return { orderBy: () => ({ limit: async () => [...state.snapshots.values()]
        .filter(row => row.userId === values[0] && row.projectId === values[1] && row.account === values[2])
        .map(row => ({ payload: row.payload })) }) };
    } }) }),
    insert: () => ({ values: (row: any) => ({
      onConflictDoNothing: () => ({ returning: async () => {
        if (state.cache.has(row.key)) return [];
        state.cache.set(row.key, { ...row }); return [{ key: row.key }];
      } }),
      onConflictDoUpdate: async () => { state.snapshots.set(snapshotKey(row), row); },
    }) }),
    update: () => ({ set: (values: any) => ({ where: async (condition: any) => {
      Object.assign(state.cache.get(params(condition)[0] as string), values);
    } }) }),
  } };
});
vi.mock('./social-posts', async original => ({
  ...await original<typeof import('./social-posts')>(), fetchSocialAccount: state.fetch,
}));
import { gatherSocialContext } from './social-context';

beforeEach(() => { state.cache.clear(); state.snapshots.clear(); state.fetch.mockReset(); });

it('shares provider claims across users and caps manual refreshes even across concurrent callers', async () => {
  const now = new Date('2026-09-16T12:00:00Z');
  const account = 'https://x.com/stock';
  const snapshot: SocialSnapshot = {
    platform: 'x', scope: 'company', account, providerId: '1', observedAt: now.toISOString(),
    followers: 1000, description: 'Stock for cafés.', warnings: [], posts: [{
      platform: 'x', scope: 'company', account, url: `${account}/status/1`, text: 'Released Stock.',
      publishedAt: '2026-09-15T12:00:00Z',
    }],
  };
  const gather = (user: string, refresh = false) => gatherSocialContext(
    user, 'stock-project', {}, { x: account }, new Date('2026-09-13T22:00:00Z'), now, undefined, refresh,
  );
  let release!: (value: SocialSnapshot) => void;
  state.fetch.mockImplementationOnce(() => new Promise<SocialSnapshot>(resolve => { release = resolve; }));
  const first = gather('alice');
  await vi.waitFor(() => expect(state.fetch).toHaveBeenCalledOnce());
  await gather('bob');
  expect(state.fetch).toHaveBeenCalledOnce();
  release(snapshot);
  expect((await first).posts).toHaveLength(1);
  expect((await gather('bob')).posts).toHaveLength(1);
  expect(state.fetch).toHaveBeenCalledOnce();
  expect([...state.snapshots.values()].map(row => row.userId).sort()).toEqual(['alice', 'bob']);

  state.fetch.mockImplementationOnce(() => new Promise<SocialSnapshot>(resolve => { release = resolve; }));
  const refreshed = gather('alice', true);
  await vi.waitFor(() => expect(state.fetch).toHaveBeenCalledTimes(2));
  expect((await gather('bob', true)).posts).toHaveLength(1);
  expect(state.fetch).toHaveBeenCalledTimes(2);
  release({ ...snapshot, followers: 1200 });
  await refreshed;
  await gather('bob', true);
  await gather('alice', true);
  await gather('charlie', true);
  expect(state.fetch).toHaveBeenCalledTimes(2);
  expect([...state.snapshots.values()].every(row => row.payload.followers === 1200)).toBe(true);
});
