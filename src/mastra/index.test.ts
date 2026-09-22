import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ config: vi.fn(), coach: vi.fn(() => ({ id: 'weekly-coach' })) }));
vi.mock('node:fs', () => ({ mkdirSync: vi.fn() }));
vi.mock('@mastra/core/mastra', () => ({ Mastra: class { constructor(config: unknown) { mocks.config(config); } } }));
vi.mock('@mastra/editor', () => ({ MastraEditor: class {} }));
vi.mock('@mastra/libsql', () => ({ LibSQLStore: class {} }));
vi.mock('@mastra/observability', () => ({ Observability: class {}, MastraStorageExporter: class {}, SensitiveDataFilter: class {} }));
vi.mock('../server/weekly-coach', () => ({ createWeeklyCoach: mocks.coach }));
vi.mock('../server/social-review', () => ({ createSocialReviewer: () => ({ id: 'social-reviewer' }) }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); vi.resetModules(); });

it.each([undefined, '', ' \n\t '])('starts Studio without a coach when the key is %j', async key => {
  vi.stubEnv('CEREBRAS_API_KEY', key);
  await import('./index');
  expect(mocks.coach).not.toHaveBeenCalled();
  expect(mocks.config).toHaveBeenCalledWith(expect.objectContaining({ agents: {} }));
});

it('registers the coach with a trimmed key and the selected model', async () => {
  vi.stubEnv('CEREBRAS_API_KEY', ' test-only ');
  vi.stubEnv('CEREBRAS_MODEL', 'qwen-3.8-27b');
  await import('./index');
  expect(mocks.coach).toHaveBeenCalledWith('test-only', 'qwen-3.8-27b');
  expect(mocks.config).toHaveBeenCalledWith(expect.objectContaining({ agents: { weeklyCoach: { id: 'weekly-coach' }, socialReviewer: { id: 'social-reviewer' } } }));
});
