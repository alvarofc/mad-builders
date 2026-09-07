/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly DATABASE_URL?: string;
  readonly DATABASE_MIGRATION_URL?: string;
  readonly BETTER_AUTH_URL?: string;
  readonly BETTER_AUTH_SECRET?: string;
  readonly GITHUB_CLIENT_ID?: string;
  readonly GITHUB_CLIENT_SECRET?: string;
  readonly ORGANIZER_GITHUB_IDS?: string;
  readonly ABUSE_REPORT_EMAIL?: string;
  readonly RESEND_API_KEY?: string;
  readonly CRON_SECRET?: string;
  readonly EMAIL_AUTOMATION_START_AT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    timing: ReturnType<typeof import('./server/timing').requestTiming>;
    user: {
      id: string;
      name: string;
      email: string;
      emailVerified: boolean;
      image?: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    session: {
      id: string;
      userId: string;
      expiresAt: Date;
      token: string;
      createdAt: Date;
      updatedAt: Date;
      ipAddress?: string | null;
      userAgent?: string | null;
    } | null;
  }
}
