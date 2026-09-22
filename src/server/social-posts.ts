import { z } from 'zod';
import { normalizeSocialUrl, socialPostSchema, type SocialLinks, type SocialAccount, type SocialSnapshot } from '../lib/socials';

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullish();
const linkedinResponse = z.object({
  elements: z.array(z.object({
    content: z.string().nullish(), linkedinUrl: z.string().nullish(),
    postedAt: z.object({ date: z.string().nullish(), timestamp: z.number().nullish() }).nullish(),
    author: z.object({ linkedinUrl: z.string().nullish(), publicIdentifier: z.string().nullish(), universalName: z.string().nullish() }).nullish(),
    repostId: z.string().nullish(), repost: z.unknown().optional(), repostedBy: z.unknown().optional(),
    engagement: z.object({ likes: count, comments: count, shares: count }).nullish(),
  })).max(100),
});
const tweets = z.array(z.object({
  id: z.string(), text: z.string(), createdAt: z.string(), author: z.object({ userName: z.string() }),
  retweeted_tweet: z.unknown().optional(), isReply: z.boolean().optional(),
  likeCount: count, replyCount: count, retweetCount: count, quoteCount: count, viewCount: count,
})).max(100);
const twitterResponse = z.object({ tweets: tweets.optional(), data: z.object({ tweets }).optional() })
  .refine(value => Boolean(value.tweets || value.data?.tweets));

export function socialAccounts(personal: SocialLinks, company: SocialLinks): SocialAccount[] {
  const accounts = (['personal', 'company'] as const).flatMap(scope =>
    (['linkedin', 'x'] as const).flatMap(platform => {
      const value = (scope === 'personal' ? personal : company)[platform];
      const account = value && normalizeSocialUrl(value, platform, scope === 'company');
      return account ? [{ platform, scope, account }] : [];
    }));
  return [...new Map(accounts.map(account => [account.account, account])).values()];
}

export function inSocialWeek(date: string, start: Date, now: Date) {
  const calendar = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' });
  const followingMonday = new Date(`${calendar.format(start)}T00:00:00Z`);
  followingMonday.setUTCDate(followingMonday.getUTCDate() + 7);
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) && timestamp >= start.getTime() && timestamp <= now.getTime()
    && calendar.format(new Date(timestamp)) < followingMonday.toISOString().slice(0, 10);
}

export async function fetchSocialAccount(source: SocialAccount, now: Date): Promise<SocialSnapshot> {
  const { platform, scope } = source;
  const account = normalizeSocialUrl(source.account, platform, scope === 'company')!;
  const key = platform === 'linkedin' ? import.meta.env.HARVESTAPI_KEY : import.meta.env.TWITTERAPI_IO_KEY;
  if (!key) throw new Error('provider_unavailable');
  const signal = AbortSignal.timeout(20_000);
  const companyPage = scope === 'company';
  const handle = new URL(account).pathname.split('/').at(-1)!;
  const postsUrl = platform === 'linkedin'
    ? new URL(`https://api.harvestapi.io/linkedin/${companyPage ? 'company' : 'profile'}-posts`)
    : new URL('https://api.twitterapi.io/twitter/user/last_tweets');
  const profileUrl = platform === 'linkedin'
    ? new URL(`https://api.harvestapi.io/linkedin/${companyPage ? 'company' : 'profile'}`)
    : new URL('https://api.twitterapi.io/twitter/user/info');
  if (platform === 'linkedin') {
    postsUrl.searchParams.set(companyPage ? 'company' : 'profile', account);
    profileUrl.searchParams.set('url', account);
    if (!companyPage) profileUrl.searchParams.set('main', 'true');
  } else {
    postsUrl.searchParams.set('userName', handle); postsUrl.searchParams.set('includeReplies', 'true');
    profileUrl.searchParams.set('userName', handle);
  }
  const get = async (url: URL) => {
    const response = await fetch(url, { headers: { 'X-API-Key': key }, signal, redirect: 'error' });
    if (!response.ok) throw new Error('provider_unavailable');
    const raw = await response.json();
    if (!raw || raw.error || (raw.status && raw.status !== 'success' && raw.status !== 200)) throw new Error('provider_unavailable');
    return raw;
  };
  // ponytail: one recent page bounds cost and latency; paginate if busy accounts need more coverage.
  const [postResult, profileResult] = await Promise.allSettled([
    get(postsUrl).then(raw => platform === 'linkedin'
      ? linkedinResponse.parse(raw).elements.flatMap(post => {
        const author = post.author?.[companyPage ? 'universalName' : 'publicIdentifier'];
        const authorUrl = post.author?.linkedinUrl?.replace(/\/$/, '').replace('https://www.', 'https://');
        if (post.repostId || post.repost || post.repostedBy ||
          (author?.toLowerCase() !== handle.toLowerCase() && authorUrl?.toLowerCase() !== account.toLowerCase())) return [];
        return [{ text: post.content, url: post.linkedinUrl, date: post.postedAt?.date ?? post.postedAt?.timestamp,
          isReply: false, engagement: { likes: post.engagement?.likes ?? null, comments: post.engagement?.comments ?? null, shares: post.engagement?.shares ?? null, views: null } }];
      })
      : (() => {
        const data = twitterResponse.parse(raw);
        return (data.tweets ?? data.data!.tweets).filter(post => !post.retweeted_tweet
          && post.author.userName.toLowerCase() === handle.toLowerCase() && /^\d+$/.test(post.id))
          .map(post => ({ text: post.text, url: `https://x.com/${handle}/status/${post.id}`, date: post.createdAt, isReply: post.isReply ?? false,
            engagement: { likes: post.likeCount ?? null, comments: post.replyCount ?? null,
              shares: post.retweetCount == null || post.quoteCount == null ? null : post.retweetCount + post.quoteCount, views: post.viewCount ?? null } }));
      })()),
    get(profileUrl).then(raw => {
      if (platform === 'x') {
        const data = z.object({ data: z.object({ id: z.string().optional(), userName: z.string(), followers: count, description: z.string().nullish(), unavailable: z.boolean().optional() }) }).parse(raw).data;
        if (data.unavailable || data.userName.toLowerCase() !== handle.toLowerCase()) throw new Error('wrong_account');
        return { providerId: data.id ?? null, followers: data.followers ?? null, description: data.description ?? '' };
      }
      const data = z.object({ element: z.object({ id: z.string().optional(), publicIdentifier: z.string().optional(), universalName: z.string().optional(),
        linkedinUrl: z.string().optional(), followerCount: count, headline: z.string().nullish(), about: z.string().nullish(), description: z.string().nullish() }) }).parse(raw).element;
      const identifier = companyPage ? data.universalName : data.publicIdentifier;
      if (identifier?.toLowerCase() !== handle.toLowerCase() && data.linkedinUrl?.replace('https://www.', 'https://').replace(/\/$/, '').toLowerCase() !== account.toLowerCase()) throw new Error('wrong_account');
      return { providerId: data.id ?? null, followers: data.followerCount ?? null, description: [data.headline, data.about, data.description].filter(Boolean).join('\n') };
    }),
  ]);
  if (postResult.status === 'rejected' && profileResult.status === 'rejected') throw new Error('provider_unavailable');
  const observedAt = now.toISOString();
  const posts = postResult.status === 'fulfilled' ? postResult.value.flatMap(post => {
    const date = post.date == null ? NaN : new Date(post.date).getTime();
    if (!Number.isFinite(date) || date > now.getTime() || date < now.getTime() - 35 * 86400_000) return [];
    const parsed = socialPostSchema.safeParse({ ...source, account, text: post.text?.trim().slice(0, 3000), url: post.url,
      publishedAt: new Date(date).toISOString(), observedAt, engagement: post.engagement, isReply: post.isReply });
    return parsed.success ? [parsed.data] : [];
  }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 40) : [];
  return { ...source, account, observedAt, posts,
    providerId: profileResult.status === 'fulfilled' ? profileResult.value.providerId : null,
    followers: profileResult.status === 'fulfilled' ? profileResult.value.followers : null,
    description: profileResult.status === 'fulfilled' ? profileResult.value.description.slice(0, 2000) : '',
    warnings: [postResult.status === 'rejected' ? `Could not read posts from ${account}.` : '',
      profileResult.status === 'rejected' ? `Could not read follower counts from ${account}.` : ''].filter(Boolean),
  };
}
