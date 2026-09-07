import { expect, it, vi } from 'vitest';
import { requestTiming } from './timing';

it('preserves operation results and errors while recording elapsed time', async () => {
  const now = vi.spyOn(performance, 'now')
    .mockReturnValueOnce(10).mockReturnValueOnce(22.5)
    .mockReturnValueOnce(30).mockReturnValueOnce(34);
  try {
    const timing = requestTiming();
    const result = { id: 'builder' };
    const error = new Error('database unavailable');
    expect(await timing.measure('profile', async () => result)).toBe(result);
    await expect(timing.measure('query', async () => { throw error; })).rejects.toBe(error);
    expect(timing.header()).toBe('profile;dur=12.5, query;dur=4.0');
  } finally {
    now.mockRestore();
  }
});
