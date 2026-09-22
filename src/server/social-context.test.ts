vi.mock('./social-cache', () => ({ cachedSocialRequest: async (_kind: string, _input: unknown, run: () => Promise<unknown>) => run() }));
import { beforeEach, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SocialPost, SocialSnapshot } from '../lib/socials';
const mocks = vi.hoisted(() => ({ history: vi.fn(), write: vi.fn(), fetch: vi.fn(), where: vi.fn() }));
vi.mock('./db', () => ({ db: {
  select: () => { const query = { from: () => query, where: (condition: unknown) => { mocks.where(condition); return query; }, orderBy: () => query, limit: mocks.history }; return query; },
  insert: () => ({ values: (data: unknown) => { mocks.write(data); return { onConflictDoUpdate: async () => [] }; } }),
} }));
vi.mock('./social-posts', async original => ({ ...await original<typeof import('./social-posts')>(), fetchSocialAccount: mocks.fetch }));
import { gatherSocialContext, socialEvidence } from './social-context';

const start = new Date('2026-09-13T22:00:00Z');
const now = new Date('2026-09-16T12:00:00Z');
const post = (id: number, publishedAt = '2026-09-15T12:00:00Z', likes = 100): SocialPost => ({
  platform: 'x', scope: 'company', account: 'https://x.com/stock', url: `https://x.com/stock/status/${id}`, text: 'Launched Stock for cafés.',
  publishedAt, engagement: { likes, comments: 0, shares: 0, views: 1000 },
});
const snapshot = (observedAt: string, followers: number | null, posts: SocialPost[] = []): SocialSnapshot => ({
  platform: 'x', scope: 'company', account: 'https://x.com/stock', providerId: '1', observedAt, followers, description: 'Stock for cafés.', posts, warnings: [],
});
beforeEach(() => Object.values(mocks).forEach(mock => mock.mockReset()));

it('never invents growth from a first reading, missing counts, small fluctuations, or a reassigned handle', () => {
  const current = snapshot(now.toISOString(), 1100);
  expect(socialEvidence([current], start, now).audience).toEqual([]);
  expect(socialEvidence([current, snapshot('2026-09-14T12:00:00Z', null)], start, now).audience).toEqual([]);
  expect(socialEvidence([current, snapshot('2026-09-14T12:00:00Z', 1098)], start, now).audience).toEqual([]);
  expect(socialEvidence([current, { ...snapshot('2026-09-14T12:00:00Z', 1000), providerId: 'other-account' }], start, now).audience).toEqual([]);
});

it('calculates signed changes with their actual observation interval and ignores today for a past week', () => {
  const before = snapshot('2026-09-12T12:00:00Z', 1000);
  const current = snapshot(now.toISOString(), 1100);
  expect(socialEvidence([current, before], start, now).audience[0]).toMatchObject({ before: 1000, after: 1100, change: 100, from: before.observedAt, to: current.observedAt });
  expect(socialEvidence([snapshot(now.toISOString(), 800), before], start, now).audience[0].change).toBe(-200);
  expect(socialEvidence([current, before], new Date('2026-09-06T22:00:00Z'), now).audience).toEqual([]);
});

it('allows Monday check-in metrics through the submission deadline, without relabeling them as Sunday counts', () => {
  const monday = new Date('2026-09-21T12:00:00Z');
  const closes = new Date('2026-09-21T22:00:00Z');
  const before = snapshot('2026-09-14T12:00:00Z', 1000);
  const current = snapshot(monday.toISOString(), 1100, [post(1)]);
  const evidence = socialEvidence([current, before], start, monday, closes);
  expect(evidence.posts[0].observedAt).toBe(monday.toISOString());
  expect(evidence.audience[0]).toMatchObject({ change: 100, from: before.observedAt, to: current.observedAt });
  const future = snapshot('2026-09-23T12:00:00Z', 2000, [post(1)]);
  expect(socialEvidence([future, current, before], start, new Date('2026-09-24'), closes).audience[0].after).toBe(1100);
});

it('requires five older posts and a meaningful relative breakout, and strips modern metrics from catch-up evidence', () => {
  const older = Array.from({ length: 5 }, (_, i) => post(i + 10, `2026-09-${String(7 + i).padStart(2, '0')}T12:00:00Z`, 10));
  const current = snapshot(now.toISOString(), 1000, [post(1), ...older]);
  expect(socialEvidence([current], start, now).posts[0].performance).toEqual({ medianInteractions: 10, sampleSize: 5, multiple: 10 });
  expect(socialEvidence([{ ...current, posts: [post(1), ...older.slice(1)] }], start, now).posts[0].performance).toBeUndefined();
  const late = { ...current, observedAt: '2026-09-22T12:00:00Z' };
  const evidence = socialEvidence([late], start, new Date('2026-09-23'));
  expect(evidence.posts[0].engagement).toBeUndefined();
  expect(evidence.posts[0].performance).toBeUndefined();
  expect(evidence.audience).toEqual([]);
  expect(socialEvidence([late, current], start, new Date('2026-09-23')).posts[0].observedAt).toBe(current.observedAt);
});

it('reuses a successful daily snapshot, isolates account history, and collects only configured URLs', async () => {
  const current = snapshot(now.toISOString(), 1100, [post(1)]);
  mocks.history.mockResolvedValue([{ payload: current }]);
  const evidence = await gatherSocialContext('alice', 'stock-project', {}, { x: 'https://x.com/stock' }, start, now);
  expect(evidence.posts).toHaveLength(1);
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.write).not.toHaveBeenCalled();
  expect(new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]).params).toEqual(['alice', 'stock-project', 'https://x.com/stock', '2026-09-16', '2026-08-30', '2026-09-21']);
});

it('persists new observations and keeps old evidence if a provider is unavailable', async () => {
  const before = snapshot('2026-09-14T12:00:00Z', 1000, [post(1)]);
  mocks.history.mockResolvedValue([{ payload: before }]);
  mocks.fetch.mockResolvedValueOnce(snapshot(now.toISOString(), 1100, [post(1)]));
  const evidence = await gatherSocialContext('alice', 'stock-project', {}, { x: 'https://x.com/stock' }, start, now);
  expect(evidence.audience[0].change).toBe(100);
  expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({ userId: 'alice', projectId: 'stock-project', observedOn: '2026-09-16' }));
  mocks.fetch.mockRejectedValueOnce(new Error('secret provider error'));
  const partial = await gatherSocialContext('alice', 'stock-project', {}, { x: 'https://x.com/stock' }, start, now);
  expect(partial.posts).toHaveLength(1);
  expect(partial.warnings).toHaveLength(1);
  expect(partial.warnings.join()).not.toContain('secret');
});

it('manual refresh bypasses the daily snapshot and preserves it when refresh fails', async () => {
  const current = snapshot(now.toISOString(), 1100, [post(1)]);
  mocks.history.mockResolvedValue([{ payload: current }]);
  mocks.fetch.mockResolvedValueOnce({ ...current, followers: 1200 });
  await gatherSocialContext('alice', 'stock-project', {}, { x: 'https://x.com/stock' }, start, now, undefined, true);
  expect(mocks.fetch).toHaveBeenCalledOnce();
  mocks.fetch.mockRejectedValueOnce(new Error('Unavailable'));
  const result = await gatherSocialContext('alice', 'stock-project', {}, { x: 'https://x.com/stock' }, start, now, undefined, true);
  expect(result.posts).toHaveLength(1);
  expect(result.warnings).toHaveLength(1);
});

it('binds cached posts to the requesting project scope', async () => {
  mocks.history.mockResolvedValue([]);
  mocks.fetch.mockResolvedValue({ ...snapshot(now.toISOString(), 1100, [{ ...post(1), scope: 'personal' }]), scope: 'personal' });
  const evidence = await gatherSocialContext('co-owner', 'project-b', {}, { x: 'https://x.com/stock' }, start, now);
  expect(evidence.posts[0].scope).toBe('company');
});
