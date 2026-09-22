import { cachedSocialRequest } from './social-cache';
import { and, desc, eq, gte, lte, or } from 'drizzle-orm';
import { db } from './db';
import { socialSnapshot } from './schema';
import { fetchSocialAccount, inSocialWeek, socialAccounts } from './social-posts';
import type { AudienceChange, SocialLinks, SocialPost, SocialSnapshot } from '../lib/socials';

const interactions = (post: SocialPost) => {
  const e = post.engagement;
  return !e || e.likes == null || e.comments == null || e.shares == null ? null : e.likes + e.comments + e.shares;
};

export function socialEvidence(snapshots: SocialSnapshot[], start: Date, now: Date, measurementClosesAt?: Date) {
  const measuredForUpdate = (date: string) => measurementClosesAt
    ? Date.parse(date) >= start.getTime() && Date.parse(date) <= Math.min(now.getTime(), measurementClosesAt.getTime())
    : inSocialWeek(date, start, now);
  const posts = new Map<string, SocialPost>();
  const audience: AudienceChange[] = [];
  const ordered = [...snapshots].filter(s => Date.parse(s.observedAt) <= now.getTime())
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  // Monday check-ins can use Monday measurements, labeled by their actual dates. Catch-up cannot use today's counts.
  const inWeek = ordered.filter(s => measuredForUpdate(s.observedAt));
  for (const snapshot of [...inWeek, ...ordered]) {
    const measuredInWeek = measuredForUpdate(snapshot.observedAt);
    const uniquePosts = [...new Map(snapshot.posts.map(post => [post.url, post])).values()];
    const baseline = uniquePosts.filter(post => !post.isReply && Date.parse(post.publishedAt) < start.getTime()
      && Date.parse(post.publishedAt) >= start.getTime() - 30 * 86400_000)
      .map(interactions).filter((n): n is number => n !== null).sort((a, b) => a - b);
    const median = baseline.length ? (baseline[Math.floor((baseline.length - 1) / 2)] + baseline[Math.floor(baseline.length / 2)]) / 2 : 0;
    for (const post of uniquePosts) {
      if (!inSocialWeek(post.publishedAt, start, now) || posts.has(post.url)) continue;
      const total = interactions(post);
      const performance = measuredInWeek && !post.isReply && baseline.length >= 5 && median > 0 && total !== null && total >= 50 && total >= median * 3
        ? { medianInteractions: median, sampleSize: baseline.length, multiple: Math.round(total / median * 10) / 10 } : undefined;
      posts.set(post.url, { ...post, engagement: measuredInWeek ? post.engagement : undefined, observedAt: measuredInWeek ? snapshot.observedAt : undefined, performance });
    }
  }
  for (const account of new Set(inWeek.map(s => s.account))) {
    const readings = ordered.filter(s => s.account === account && s.followers !== null);
    const latest = readings.find(s => measuredForUpdate(s.observedAt));
    if (!latest?.providerId) continue;
    const earlier = readings.filter(s => s.providerId === latest.providerId && Date.parse(latest.observedAt) - Date.parse(s.observedAt) >= 20 * 3600_000
      && Date.parse(s.observedAt) >= start.getTime() - 14 * 86400_000);
    // Use the first reading this week, or the last earlier check-in. Never assume a missing count was zero.
    const before = earlier.filter(s => measuredForUpdate(s.observedAt)).at(-1) ?? earlier[0];
    if (!before) continue;
    const change = latest.followers! - before.followers!;
    const magnitude = Math.abs(change);
    // ponytail: ignore small count fluctuations; tune these thresholds when real check-ins show useful smaller signals.
    if (magnitude < 100 && (magnitude < 10 || magnitude / Math.max(before.followers!, 1) < 0.05)) continue;
    audience.push({ account, platform: latest.platform, scope: latest.scope, before: before.followers!, after: latest.followers!, change,
      from: before.observedAt, to: latest.observedAt, description: latest.description });
  }
  return { posts: [...posts.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 20), audience: audience.slice(0, 4) };
}

export async function gatherSocialContext(userId: string, projectId: string, personal: SocialLinks, company: SocialLinks, start: Date, now: Date, measurementClosesAt?: Date, refresh = false) {
  const accounts = socialAccounts(personal, company);
  const warnings: string[] = [];
  const snapshots: SocialSnapshot[] = [];
  const day = now.toISOString().slice(0, 10);
  const firstDay = new Date(start.getTime() - 14 * 86400_000).toISOString().slice(0, 10);
  const lastDay = (measurementClosesAt ?? new Date(start.getTime() + 8 * 86400_000)).toISOString().slice(0, 10);
  // Daily snapshots both cache provider reads and retain a real follower baseline. No background polling.
  const results = await Promise.allSettled(accounts.map(async source => {
    const history = await db.select({ payload: socialSnapshot.payload }).from(socialSnapshot).where(and(
      eq(socialSnapshot.userId, userId), eq(socialSnapshot.projectId, projectId), eq(socialSnapshot.account, source.account),
      or(eq(socialSnapshot.observedOn, day), and(gte(socialSnapshot.observedOn, firstDay), lte(socialSnapshot.observedOn, lastDay))),
    )).orderBy(desc(socialSnapshot.observedOn)).limit(32);
    let current = history.find(row => row.payload.observedAt.startsWith(day))?.payload;
    if (!current || refresh) {
      try {
        current = await cachedSocialRequest(refresh ? 'provider-refresh-v1' : 'provider-v1', [source.platform, source.account.toLowerCase()], () => fetchSocialAccount(source, now), now);
        await db.insert(socialSnapshot).values({ userId, projectId, account: source.account, observedOn: day, payload: current })
          .onConflictDoUpdate({ target: [socialSnapshot.userId, socialSnapshot.projectId, socialSnapshot.account, socialSnapshot.observedOn], set: { payload: current } });
      } catch {
        warnings.push(`Could not refresh ${source.scope === 'personal' ? 'your' : 'company'} ${source.platform === 'x' ? 'X' : 'LinkedIn'} activity. You can still write your update.`);
      }
    }
    const scoped = (snapshot: SocialSnapshot) => ({ ...snapshot, ...source, posts: snapshot.posts.map(post => ({ ...post, ...source })) });
    if (current) { snapshots.push(scoped(current)); warnings.push(...current.warnings); }
    snapshots.push(...history.filter(row => row.payload.observedAt !== current?.observedAt).map(row => scoped(row.payload)));
  }));
  if (results.some(result => result.status === 'rejected')) warnings.push('Some social history could not be loaded. You can still write your update.');
  return { ...socialEvidence(snapshots, start, now, measurementClosesAt), warnings, accountCount: accounts.length };
}
