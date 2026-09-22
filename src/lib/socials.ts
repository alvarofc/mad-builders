import { z } from 'zod';

export const socialPlatforms = [
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/in/your-name' },
  { key: 'x', label: 'X', placeholder: 'https://x.com/yourname' },
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/yourname' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/yourname' },
  { key: 'website', label: 'Website', placeholder: 'https://' },
] as const;
export type SocialPlatform = typeof socialPlatforms[number]['key'];
export type SocialLinks = Partial<Record<SocialPlatform, string>>;

export function normalizeSocialUrl(value: string, platform: SocialPlatform, company = false) {
  if (!value.trim()) return undefined;
  const url = new URL(value.trim());
  if (value.length > 2048 || url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('invalid_social_url');
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const path = url.pathname.replace(/\/$/, '');
  const valid = platform === 'website'
    || (platform === 'linkedin' && host === 'linkedin.com' && new RegExp(`^/${company ? 'company' : 'in'}/[a-zA-Z0-9_%.-]+$`).test(path))
    || (platform === 'x' && ['x.com', 'twitter.com'].includes(host) && /^\/[a-zA-Z0-9_]{1,15}$/.test(path) && !/^\/(home|search|explore|intent|settings|i)$/i.test(path))
    || (platform === 'github' && host === 'github.com' && /^\/[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(path))
    || (platform === 'instagram' && host === 'instagram.com' && /^\/[a-zA-Z0-9_.]{1,30}$/.test(path));
  if (!valid) throw new Error('invalid_social_url');
  if (platform === 'website') return url.href;
  return `https://${platform === 'x' ? 'x.com' : host}${platform === 'x' ? path.toLowerCase() : path}`;
}

export const socialPostSchema = z.object({
  platform: z.enum(['linkedin', 'x']),
  account: z.string().max(2048),
  scope: z.enum(['personal', 'company']),
  url: z.string().url().max(2048).refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && ['linkedin.com', 'www.linkedin.com', 'x.com', 'twitter.com'].includes(url.hostname);
  }),
  text: z.string().min(1).max(3000),
  publishedAt: z.iso.datetime(),
  isReply: z.boolean().optional(),
  engagement: z.object({
    likes: z.number().int().nonnegative().nullable(), comments: z.number().int().nonnegative().nullable(),
    shares: z.number().int().nonnegative().nullable(), views: z.number().int().nonnegative().nullable(),
  }).optional(),
  observedAt: z.iso.datetime().optional(),
  performance: z.object({ medianInteractions: z.number().nonnegative(), sampleSize: z.number().int().min(5), multiple: z.number().positive() }).optional(),
  relevance: z.string().max(500).optional(),
});
export const socialPostsSchema = z.array(socialPostSchema).max(20);
export type SocialPost = z.infer<typeof socialPostSchema>;

export type SocialAccount = Pick<SocialPost, 'platform' | 'scope' | 'account'>;
export type SocialSnapshot = SocialAccount & {
  observedAt: string; providerId: string | null; followers: number | null; description: string; posts: SocialPost[]; warnings: string[];
};
export const audienceChangeSchema = z.object({
  account: socialPostSchema.shape.url, platform: socialPostSchema.shape.platform, scope: socialPostSchema.shape.scope,
  before: z.number().int().nonnegative(), after: z.number().int().nonnegative(), change: z.number().int(),
  from: z.iso.datetime(), to: z.iso.datetime(), description: z.string().max(2000), relevance: z.string().max(500).optional(),
});
export const audienceChangesSchema = z.array(audienceChangeSchema).max(4);
export type AudienceChange = z.infer<typeof audienceChangeSchema>;
