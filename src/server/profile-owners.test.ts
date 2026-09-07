import { expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
vi.mock('./db', () => ({ db: {}, databaseConfigured: false }));
vi.mock('./auth', () => ({ auth: {} }));
import { ownerNames } from './profiles';
import { project } from './schema';

it('correlates owner names with the outer project in single-table queries', () => {
  const query = drizzle.mock().select({ displayName: ownerNames }).from(project).toSQL();
  expect(query.sql).toContain('po.project_id = "project"."id"');
});
