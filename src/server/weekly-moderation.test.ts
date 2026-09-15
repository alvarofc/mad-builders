import { afterEach, expect, it, vi } from 'vitest';
import { Agent } from '@mastra/core/agent';
import { ModerationProcessor } from '@mastra/core/processors';

afterEach(() => vi.restoreAllMocks());

it.each(['provider error', 'missing output'])('blocks when native moderation fails: %s', async failure => {
  const generate = vi.spyOn(Agent.prototype, 'generate');
  if (failure === 'provider error') generate.mockRejectedValue(new Error('private provider details'));
  else generate.mockResolvedValue({ object: undefined } as never);
  const processor = new ModerationProcessor({
    model: {
      specificationVersion: 'v2', provider: 'test', modelId: 'test', supportedUrls: {},
      doGenerate: async () => { throw new Error('No network in this test'); },
      doStream: async () => { throw new Error('No network in this test'); },
    },
    categories: ['off_topic'], strategy: 'block', errorStrategy: 'strict',
  });
  const abort = vi.fn((reason?: string): never => { throw new Error(reason); });
  await expect(processor.processInput({
    messages: [{ id: 'test', role: 'user', createdAt: new Date(), content: { format: 2, parts: [{ type: 'text', text: 'Help me write my update.' }] } }],
    abort,
  })).rejects.toThrow('Moderation failed');
  expect(generate).toHaveBeenCalledOnce();
  expect(abort).toHaveBeenCalled();
  expect(abort.mock.calls[0][0]).not.toContain('private provider details');
});
