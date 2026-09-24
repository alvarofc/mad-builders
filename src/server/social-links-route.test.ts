import { beforeEach, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
const mocks = vi.hoisted(() => ({ allow: vi.fn(), rows: vi.fn(), sets: vi.fn(), conditions: vi.fn(), transaction: vi.fn() }));
vi.mock('./db', () => ({ db: { transaction: mocks.transaction } }));
vi.mock('./rate-limit', () => ({ allowWrite: mocks.allow }));
import { POST } from '../pages/api/socials';
import { project, user } from './schema';

const request = (fields: Record<string, string> = {}, userId = 'alice', origin = 'https://mad.builders', accept = 'text/html') => POST({
  locals: { user: userId ? { id: userId } : null }, url: new URL('https://mad.builders/api/socials'),
  redirect: (location: string, status: number) => new Response(null, { status, headers: { location } }),
  request: new Request('https://mad.builders/api/socials', { method: 'POST', headers: { origin, accept }, body: new URLSearchParams({ projectId: 'project-a', ...fields }) }),
} as any);
beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
  mocks.allow.mockResolvedValue(true);
  mocks.rows.mockResolvedValue([{ projectId: 'project-a' }]);
  const query = { from: () => query, where: (condition: unknown) => { mocks.conditions(condition); return query; }, for: async () => [], limit: mocks.rows };
  mocks.transaction.mockImplementation(callback => callback({
    select: () => query,
    update: (table: unknown) => ({ set: (values: unknown) => { mocks.sets(table, values); return { where: async (condition: unknown) => { mocks.conditions(condition); } }; } }),
  }));
});

it('requires a session, same origin, valid URLs, and active project ownership before saving', async () => {
  expect((await request({}, '')).status).toBe(401);
  expect((await request({}, 'alice', 'https://evil.test')).status).toBe(403);
  expect((await request({ 'personal.linkedin': 'https://evil.test/alice' })).status).toBe(400);
  expect(mocks.transaction).not.toHaveBeenCalled();
  mocks.rows.mockResolvedValueOnce([]);
  expect((await request({ projectId: 'someone-elses-project' })).status).toBe(409);
  expect(mocks.sets).not.toHaveBeenCalled();
  const query = new PgDialect().sqlToQuery(mocks.conditions.mock.calls.at(-1)![0]);
  expect(query.params).toEqual(['alice', 'someone-elses-project', true]);
});

it('stores personal links only on the current user, company links on the project, and allows removal', async () => {
  const response = await request({ 'personal.x': 'https://twitter.com/Alice?s=20', 'company.linkedin': 'https://www.linkedin.com/company/acme' });
  expect(response.status).toBe(303);
  expect(mocks.sets.mock.calls.map(([table]) => table)).toEqual([user, project]);
  const patches = mocks.sets.mock.calls.map(([, values]) => new PgDialect().sqlToQuery(values.socialLinks));
  expect(patches[0].sql).toContain('jsonb_strip_nulls');
  expect(patches[0].params).toEqual([JSON.stringify({ x: 'https://x.com/alice' })]);
  expect(patches[1].params).toEqual([JSON.stringify({ linkedin: 'https://linkedin.com/company/acme' })]);
  const conditions = mocks.conditions.mock.calls.slice(-2).map(([condition]) => new PgDialect().sqlToQuery(condition).params);
  expect(conditions).toEqual([['alice'], ['project-a']]);
  mocks.sets.mockClear();
  await request({ 'personal.x': '' });
  expect(mocks.sets).toHaveBeenCalledOnce();
  expect(mocks.sets.mock.calls[0][0]).toBe(user);
  expect(new PgDialect().sqlToQuery(mocks.sets.mock.calls[0][1].socialLinks).params).toEqual(['{"x":null}']);
});

it('confirms automatic saves without redirecting', async () => {
  const response = await request({}, 'alice', 'https://mad.builders', 'application/json');
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ saved: true });
});

it('does not replace project links when a stale owner edits a personal account', async () => {
  await request({ 'personal.x': 'https://x.com/alice' });
  expect(mocks.sets).toHaveBeenCalledOnce();
  expect(mocks.sets.mock.calls[0][0]).toBe(user);
  mocks.sets.mockClear();
  await request({ 'company.github': 'https://github.com/acme' });
  const patch = new PgDialect().sqlToQuery(mocks.sets.mock.calls[0][1].socialLinks);
  expect(patch.sql).toContain('"project"."social_links" ||');
  expect(patch.params).toEqual(['{"github":"https://github.com/acme"}']);
});
