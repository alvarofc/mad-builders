import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const appPrivate = pgSchema('app_private');

export const user = appPrivate.table('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  emailUnsubscribedAt: timestamp('email_unsubscribed_at', { withTimezone: true }),
  emailUnsubscribeToken: uuid('email_unsubscribe_token').defaultRandom().notNull().unique(),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const emailDelivery = appPrivate.table('email_delivery', {
  key: text('key').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  payload: text('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  providerId: text('provider_id'),
});

export const session = appPrivate.table(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
);

export const account = appPrivate.table(
  'account',
  {
    id: text('id').primaryKey(),
    issuer: text('issuer').notNull(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('account_user_id_idx').on(table.userId),
    uniqueIndex('account_issuer_account_id_uidx').on(table.issuer, table.accountId),
  ],
);

export const verification = appPrivate.table(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

export const rateLimit = appPrivate.table('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

export const profile = appPrivate.table(
  'profile',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    handle: text('handle').notNull(),
    displayName: text('display_name').notNull(),
    location: text('location').default('').notNull(),
    bio: text('bio').default('').notNull(),
    projectName: text('project_name').notNull(),
    projectUrl: text('project_url'),
    projectStage: text('project_stage').default('building').notNull(),
    referredByUserId: text('referred_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    isPublic: boolean('is_public').default(true).notNull(),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    hiddenReason: text('hidden_reason'),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    firstCommitmentAt: timestamp('first_commitment_at', { withTimezone: true }),
    firstOnTimeResultAt: timestamp('first_on_time_result_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('profile_handle_uidx').on(table.handle),
    index('profile_referred_by_user_id_idx').on(table.referredByUserId),
    index('profile_public_created_at_idx').on(table.isPublic, table.createdAt),
    index('profile_directory_idx').on(table.createdAt, table.userId)
      .where(sql`${table.isPublic} = true and ${table.hiddenAt} is null and ${table.withdrawnAt} is null`),
    check('profile_handle_check', sql`${table.handle} ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'`),
    check(
      'profile_project_stage_check',
      sql`${table.projectStage} in ('idea', 'building', 'private_testing', 'launched', 'growing')`,
    ),
  ],
);

export const week = appPrivate.table(
  'week',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    weekStartDate: date('week_start_date', { mode: 'string' }).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    submissionClosesAt: timestamp('submission_closes_at', { withTimezone: true }).notNull(),
    votingClosesAt: timestamp('voting_closes_at', { withTimezone: true }).notNull(),
    rankingStatus: text('ranking_status').default('pending').notNull(),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('week_start_date_uidx').on(table.weekStartDate),
    index('week_window_idx').on(table.startsAt, table.votingClosesAt),
    check(
      'week_window_check',
      sql`${table.startsAt} < ${table.submissionClosesAt} and ${table.submissionClosesAt} < ${table.votingClosesAt}`,
    ),
    check('week_ranking_status_check', sql`${table.rankingStatus} in ('pending', 'final', 'unranked')`),
  ],
);

export const commitment = appPrivate.table(
  'commitment',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    weekId: bigint('week_id', { mode: 'number' })
      .notNull()
      .references(() => week.id, { onDelete: 'restrict' }),
    promise: text('promise').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('commitment_user_week_uidx').on(table.userId, table.weekId),
    index('commitment_week_id_idx').on(table.weekId),
  ],
);

export const result = appPrivate.table(
  'result',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    commitmentId: bigint('commitment_id', { mode: 'number' })
      .notNull()
      .references(() => commitment.id, { onDelete: 'restrict' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    weekId: bigint('week_id', { mode: 'number' })
      .notNull()
      .references(() => week.id, { onDelete: 'restrict' }),
    status: text('status').notNull(),
    summary: text('summary').notNull(),
    feedbackRequest: text('feedback_request').default('').notNull(),
    projectSentence: text('project_sentence').default('').notNull(),
    projectUrl: text('project_url'),
    projectStage: text('project_stage').default('building').notNull(),
    proofUrl: text('proof_url'),
    proofStatus: text('proof_status').default('self_reported').notNull(),
    proofCheckedAt: timestamp('proof_checked_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow().notNull(),
    onTime: boolean('on_time').notNull(),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    hiddenReason: text('hidden_reason'),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('result_commitment_id_uidx').on(table.commitmentId),
    uniqueIndex('result_user_week_uidx').on(table.userId, table.weekId),
    index('result_week_candidate_idx').on(table.weekId, table.onTime, table.status),
    index('result_user_published_at_idx').on(table.userId, table.publishedAt),
    index('result_recent_public_idx').on(table.publishedAt)
      .where(sql`${table.hiddenAt} is null and ${table.withdrawnAt} is null`),
    check('result_status_check', sql`${table.status} in ('complete', 'partial', 'missed', 'submitted')`),
    check(
      'result_project_stage_check',
      sql`${table.projectStage} in ('idea', 'building', 'private_testing', 'launched', 'growing')`,
    ),
    check(
      'result_proof_status_check',
      sql`${table.proofStatus} in ('self_reported', 'proof_linked', 'github_account_matched')`,
    ),
  ],
);

export const comparison = appPrivate.table(
  'comparison',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    weekId: bigint('week_id', { mode: 'number' })
      .notNull()
      .references(() => week.id, { onDelete: 'restrict' }),
    voterUserId: text('voter_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    candidateLowId: bigint('candidate_low_id', { mode: 'number' })
      .notNull()
      .references(() => result.id, { onDelete: 'restrict' }),
    candidateHighId: bigint('candidate_high_id', { mode: 'number' })
      .notNull()
      .references(() => result.id, { onDelete: 'restrict' }),
    presentedFirstId: bigint('presented_first_id', { mode: 'number' })
      .notNull()
      .references(() => result.id, { onDelete: 'restrict' }),
    choice: text('choice'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
    invalidationReason: text('invalidation_reason'),
  },
  (table) => [
    uniqueIndex('comparison_voter_pair_uidx').on(
      table.voterUserId,
      table.weekId,
      table.candidateLowId,
      table.candidateHighId,
    ),
    uniqueIndex('comparison_unfinished_voter_week_uidx')
      .on(table.voterUserId, table.weekId)
      .where(sql`${table.choice} is null and ${table.invalidatedAt} is null`),
    index('comparison_week_candidate_low_idx').on(table.weekId, table.candidateLowId),
    index('comparison_week_candidate_high_idx').on(table.weekId, table.candidateHighId),
    check('comparison_candidate_order_check', sql`${table.candidateLowId} < ${table.candidateHighId}`),
    check(
      'comparison_presented_candidate_check',
      sql`${table.presentedFirstId} in (${table.candidateLowId}, ${table.candidateHighId})`,
    ),
    check(
      'comparison_choice_check',
      sql`${table.choice} is null or ${table.choice} in ('low', 'high', 'tie', 'pass')`,
    ),
  ],
);

export const ranking = appPrivate.table(
  'ranking',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    weekId: bigint('week_id', { mode: 'number' })
      .notNull()
      .references(() => week.id, { onDelete: 'restrict' }),
    resultId: bigint('result_id', { mode: 'number' })
      .notNull()
      .references(() => result.id, { onDelete: 'restrict' }),
    scoreNumerator: integer('score_numerator').notNull(),
    scoreDenominator: integer('score_denominator').notNull(),
    wins: integer('wins').notNull(),
    ties: integer('ties').notNull(),
    decisions: integer('decisions').notNull(),
    rank: integer('rank').notNull(),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('ranking_week_result_uidx').on(table.weekId, table.resultId),
    index('ranking_week_rank_idx').on(table.weekId, table.rank),
    index('ranking_result_id_idx').on(table.resultId),
    check('ranking_denominator_check', sql`${table.scoreDenominator} > 0`),
    check('ranking_rank_check', sql`${table.rank} > 0`),
  ],
);
