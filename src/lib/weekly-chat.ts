import { z } from 'zod';

export const coachDraftSchema = z.object({
  summary: z.string().max(1000),
  nextPromise: z.string().max(280),
  feedbackRequest: z.string().max(500),
});
export const conversationSchema = z.array(z.object({
  role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(3000),
})).max(40);
export const coachRequestSchema = z.object({
  projectId: z.string().min(1).max(100), weekId: z.number().int().positive(),
  messages: conversationSchema.min(1).refine(messages => messages.every((message, i) => message.role === (i % 2 ? 'assistant' : 'user')) && messages.at(-1)?.role === 'user'),
  draft: coachDraftSchema,
  includeSocialPosts: z.boolean().optional(),
  refreshSocialPosts: z.boolean().optional(),
  opening: z.boolean().optional(),
  openingReply: z.string().trim().min(1).max(3000).optional(),
});
export const coachResponseSchema = z.object({
  reply: z.string().trim().min(1).max(3000),
  changes: z.object({
    summary: z.string().trim().min(5).max(1000).nullable(),
    nextPromise: z.string().trim().min(5).max(280).nullable(),
    feedbackRequest: z.string().trim().max(500).nullable(),
  }),
});
export type CoachMessage = z.infer<typeof conversationSchema>[number];
export type CoachDraft = z.infer<typeof coachDraftSchema>;
