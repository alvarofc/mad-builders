import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import * as schema from './schema';

const productionOrigin = 'https://www.mad.builders';
const configuredOrigin = import.meta.env.BETTER_AUTH_URL ?? productionOrigin;

export const authConfigured = Boolean(
  import.meta.env.DATABASE_URL &&
    import.meta.env.BETTER_AUTH_SECRET &&
    import.meta.env.GITHUB_CLIENT_ID &&
    import.meta.env.GITHUB_CLIENT_SECRET,
);

export const auth = betterAuth({
  appName: 'mad.builders proof of work',
  baseURL: configuredOrigin,
  secret: import.meta.env.BETTER_AUTH_SECRET ?? 'not-configured-not-used-not-secret',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
    schemaName: 'app_private',
    transaction: true,
  }),
  socialProviders: {
    github: {
      clientId: import.meta.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: import.meta.env.GITHUB_CLIENT_SECRET ?? '',
      scope: ['read:user', 'user:email'],
    },
  },
  account: {
    encryptOAuthTokens: true,
  },
  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 100,
  },
  trustedOrigins: import.meta.env.DEV
    ? [productionOrigin, configuredOrigin, 'http://localhost:4321']
    : [productionOrigin, configuredOrigin],
  advanced: {
    useSecureCookies: !import.meta.env.DEV,
  },
});
