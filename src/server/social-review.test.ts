import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ generate: vi.fn(), options: vi.fn() }));
vi.mock('@mastra/core/agent', () => ({ Agent: class { constructor(options: unknown) { mocks.options(options); } generate = mocks.generate; } }));
import { reviewSocialContext } from './social-review';
const project = { name: 'Stock', description: 'Stock counts for cafés', website: 'https://stock.example' };
const posts = [
  { platform: 'x' as const, scope: 'personal' as const, account: 'https://x.com/alice', url: 'https://x.com/alice/status/1', text: 'My unrelated joke got a million views.', publishedAt: '2026-09-15T12:00:00Z' },
  { platform: 'x' as const, scope: 'personal' as const, account: 'https://x.com/alice', url: 'https://x.com/alice/status/2', text: 'Launched Stock with two café owners.', publishedAt: '2026-09-15T12:00:00Z' },
];
afterEach(() => vi.resetAllMocks());
it('passes evidence as untrusted data and returns only model-selected, existing sources with reasons', async () => {
  mocks.generate.mockResolvedValue({ object: { posts: [{ index: 1, reason: 'Names Stock and describes a concrete launch with its target users.' }, { index: 99, reason: 'An invented source.' }], audience: [] } });
  const selected = await reviewSocialContext(project, 'Launch Stock', '', [], { posts, audience: [] });
  expect(selected.posts).toEqual([{ ...posts[1], relevance: 'Names Stock and describes a concrete launch with its target users.' }]);
  expect(JSON.parse(mocks.generate.mock.calls[0][0]).posts).toEqual(posts);
  expect(mocks.options.mock.calls[0][0]).not.toHaveProperty('tools');
});
it('omits everything when relevance is uncertain and fails closed on invalid model output', async () => {
  mocks.generate.mockResolvedValueOnce({ object: { posts: [], audience: [] } });
  expect(await reviewSocialContext(project, '', '', [], { posts, audience: [] })).toEqual({ posts: [], audience: [] });
  mocks.generate.mockResolvedValueOnce({ object: { posts: [{ index: -1, reason: 'bad' }], audience: [] } });
  await expect(reviewSocialContext(project, '', '', [], { posts, audience: [] })).rejects.toThrow();
});
it('skips the model when there is no evidence', async () => {
  expect(await reviewSocialContext(project, '', '', [], { posts: [], audience: [] })).toEqual({ posts: [], audience: [] });
  expect(mocks.generate).not.toHaveBeenCalled();
});
