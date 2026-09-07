import type { APIContext } from 'astro';
import { expect, it, vi } from 'vitest';

vi.mock('./profiles', () => ({
  getProfileByUserId: vi.fn().mockResolvedValue({ id: 'startup', handle: 'ana', bio: 'A useful project' }),
  getPublicResult: vi.fn().mockResolvedValue(null),
  normalizeUrl: vi.fn().mockReturnValue(null),
}));
vi.mock('./rate-limit', () => ({ allowWrite: vi.fn().mockResolvedValue(true) }));
vi.mock('./results', () => ({
  checkProof: vi.fn().mockResolvedValue({ url: null, status: 'self_reported', checkedAt: null }),
  publishResult: vi.fn().mockResolvedValue({ weekStartDate: '2026-08-31' }),
  validProjectStage: vi.fn().mockReturnValue(true),
}));
import { POST } from '../pages/api/result/publish';
import { publishResult } from './results';

it('counts multiline answers like textareas and still rejects results outside the limits', async () => {
  for (const length of [4, 5, 1000, 1001]) {
    vi.mocked(publishResult).mockClear();
    const summary = 'a\nb' + 'x'.repeat(length - 3);
    const data = new FormData();
    for (const [name, value] of Object.entries({
      projectId: 'startup', weekId: '1', status: 'submitted', summary,
      projectSentence: 'a\nb' + 'x'.repeat(277),
      feedbackRequest: 'a\nb' + 'x'.repeat(497),
      nextPromise: 'a\nb' + 'x'.repeat(277), projectStage: 'idea',
    })) data.set(name, value);
    const response = await POST({
      request: new Request('https://mad.builders/api/result/publish', {
        method: 'POST', headers: { origin: 'https://mad.builders' }, body: data,
      }),
      url: new URL('https://mad.builders/api/result/publish'),
      locals: { user: { id: 'builder' } },
      redirect: (path: string, status: number) => new Response(null, { status, headers: { location: path } }),
    } as unknown as APIContext);
    if (length >= 5 && length <= 1000) {
      expect(response.status).toBe(303);
      expect(publishResult).toHaveBeenCalledWith(expect.objectContaining({
        summary, projectSentence: 'a\nb' + 'x'.repeat(277),
        feedbackRequest: 'a\nb' + 'x'.repeat(497), nextPromise: 'a\nb' + 'x'.repeat(277),
      }));
    } else {
      expect(response.status).toBe(400);
      expect(publishResult).not.toHaveBeenCalled();
    }
  }
});
