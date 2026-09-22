import { afterEach, expect, it, vi } from 'vitest';
import { normalizeSocialUrl } from '../lib/socials';
import { fetchSocialAccount, inSocialWeek, socialAccounts } from './social-posts';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const now = new Date('2026-09-16T12:00:00Z');
const source = { platform: 'x' as const, scope: 'personal' as const, account: 'https://x.com/builder' };
const tweet = (id: string, extra = {}) => ({ id, text: 'Shipped the beta.', createdAt: '2026-09-15T12:00:00Z', author: { userName: 'builder' },
  likeCount: 80, replyCount: 12, retweetCount: 4, quoteCount: 2, viewCount: 900, ...extra });

it('normalizes links and rejects unsafe or non-profile URLs', () => {
  expect(normalizeSocialUrl(' https://twitter.com/Builder/?s=20 ', 'x')).toBe('https://x.com/builder');
  expect(normalizeSocialUrl('', 'x')).toBeUndefined();
  for (const url of ['http://x.com/builder', 'https://x.com.evil.test/builder', 'https://x.com@evil.test/builder', 'https://x.com/builder/status/1', 'https://x.com/home', 'https://x.com:444/builder', 'javascript:alert(1)']) expect(() => normalizeSocialUrl(url, 'x')).toThrow();
  expect(() => normalizeSocialUrl('https://linkedin.com/company/acme', 'linkedin')).toThrow();
  expect(() => normalizeSocialUrl('https://linkedin.com/in/alice', 'linkedin', true)).toThrow();
  expect(socialAccounts({ x: 'https://twitter.com/Builder' }, { x: 'https://x.com/builder' })).toEqual([{ ...source, scope: 'company' }]);
});

it('reads dated engagement and followers, includes authored replies, and excludes other authors, reposts and future posts', async () => {
  vi.stubEnv('TWITTERAPI_IO_KEY', 'test-key');
  const fetch = vi.fn().mockImplementation(async (url: URL) => ({ ok: true, json: async () => url.pathname.endsWith('/info')
    ? { data: { id: '123', userName: 'Builder', followers: 1100, description: 'Building Stock for cafés.' } }
    : { tweets: [tweet('1'), tweet('2', { isReply: true }), tweet('3', { author: { userName: 'stranger' } }), tweet('4', { retweeted_tweet: {} }),
      tweet('5', { createdAt: '2026-10-01' }), tweet('6', { createdAt: 'not-a-date' })] } }));
  vi.stubGlobal('fetch', fetch);
  const result = await fetchSocialAccount(source, now);
  expect(result.posts).toHaveLength(2);
  expect(result.posts[1].isReply).toBe(true);
  expect(result.posts[0].engagement).toEqual({ likes: 80, comments: 12, shares: 6, views: 900 });
  expect(result).toMatchObject({ providerId: '123', followers: 1100, observedAt: now.toISOString(), warnings: [] });
  expect(fetch.mock.calls.every(([url, options]) => url.origin === 'https://api.twitterapi.io' && options.redirect === 'error' && options.headers['X-API-Key'] === 'test-key')).toBe(true);
});

it('uses the company LinkedIn endpoints and never treats missing counts as zero', async () => {
  vi.stubEnv('HARVESTAPI_KEY', 'test-key');
  const fetch = vi.fn().mockImplementation(async (url: URL) => ({ ok: true, json: async () => url.pathname.endsWith('company-posts')
    ? { status: 200, elements: [{ content: 'Released Stock.', linkedinUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:1',
      author: { universalName: 'stock' }, postedAt: { timestamp: Date.parse('2026-09-15T12:00:00Z') }, engagement: { likes: 20, comments: 3 } }] }
    : { status: 200, element: { id: '1', universalName: 'stock', description: 'Stock for cafés.' } } }));
  vi.stubGlobal('fetch', fetch);
  const result = await fetchSocialAccount({ platform: 'linkedin', scope: 'company', account: 'https://linkedin.com/company/stock' }, now);
  expect(result.followers).toBeNull();
  expect(result.posts[0].engagement).toEqual({ likes: 20, comments: 3, shares: null, views: null });
  expect(fetch.mock.calls[0][0].searchParams.get('company')).toBe('https://linkedin.com/company/stock');
  expect(fetch.mock.calls[1][0].searchParams.get('url')).toBe('https://linkedin.com/company/stock');
});

it('keeps posts when profile lookup fails and does not expose provider errors', async () => {
  vi.stubEnv('TWITTERAPI_IO_KEY', 'test-key');
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: URL) => ({ ok: true, json: async () => url.pathname.endsWith('/info')
    ? { data: { id: 'wrong', userName: 'stranger', followers: 9000 } } : { tweets: [tweet('1')] } })));
  const result = await fetchSocialAccount(source, now);
  expect(result.posts).toHaveLength(1);
  expect(result.followers).toBeNull();
  expect(result.warnings).toHaveLength(1);
  vi.stubEnv('TWITTERAPI_IO_KEY', '');
  await expect(fetchSocialAccount(source, now)).rejects.toThrow('provider_unavailable');
});

it('uses Madrid calendar weeks through daylight saving and excludes future timestamps', () => {
  const start = new Date('2026-10-18T22:00:00Z');
  const after = new Date('2026-10-27');
  expect(inSocialWeek('2026-10-25T22:59:59Z', start, after)).toBe(true);
  expect(inSocialWeek('2026-10-25T23:00:00Z', start, after)).toBe(false);
  expect(inSocialWeek('2026-10-19T12:00:00Z', start, start)).toBe(false);
});

it('reads personal LinkedIn posts and follower counts from HarvestAPI responses', async () => {
  vi.stubEnv('HARVESTAPI_KEY', 'test-key');
  const fetch = vi.fn().mockImplementation(async (url: URL) => ({ ok: true, json: async () => url.pathname.endsWith('profile-posts')
    ? { status: 200, elements: [{ content: 'Launched Stock.', linkedinUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:1',
      author: { publicIdentifier: 'alice' }, postedAt: { date: '2026-09-15T12:00:00Z' }, engagement: { likes: 20, comments: 3, shares: 2 } }] }
    : { status: 200, element: { id: '123', publicIdentifier: 'alice', followerCount: 250, headline: 'Building Stock.' } } }));
  vi.stubGlobal('fetch', fetch);
  const result = await fetchSocialAccount({ platform: 'linkedin', scope: 'personal', account: 'https://linkedin.com/in/alice' }, now);
  expect(result).toMatchObject({ providerId: '123', followers: 250, warnings: [] });
  expect(result.posts).toHaveLength(1);
  expect(fetch.mock.calls[0][0].searchParams.get('profile')).toBe('https://linkedin.com/in/alice');
  expect(fetch.mock.calls[1][0].searchParams.get('main')).toBe('true');
});
