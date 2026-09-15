import { beforeEach, expect, it, vi } from 'vitest';
const execute = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({ db: { execute } }));
import { allowWrite } from './rate-limit';
beforeEach(() => execute.mockReset());
it('uses the caller limit without changing the existing default', async () => {
  execute.mockResolvedValue([{ count: 11 }]);
  expect(await allowWrite(new Request('https://test.local'), 'builder', 'weekly-chat', 10)).toBe(false);
  expect(await allowWrite(new Request('https://test.local'), 'builder', 'publish')).toBe(true);
  execute.mockResolvedValue([{ count: 31 }]);
  expect(await allowWrite(new Request('https://test.local'), 'builder', 'publish')).toBe(false);
});
it('fails closed on missing counts and preserves the separate IP limit', async () => {
  const request = new Request('https://test.local', { headers: { 'x-forwarded-for': '192.0.2.1, 192.0.2.2' } });
  execute.mockResolvedValueOnce([]);
  expect(await allowWrite(request, 'builder', 'weekly-chat', 10)).toBe(false);
  expect(execute).toHaveBeenCalledOnce();
  execute.mockResolvedValueOnce([{ count: 10 }]).mockResolvedValueOnce([{ count: 121 }]);
  expect(await allowWrite(request, 'builder', 'weekly-chat', 10)).toBe(false);
  execute.mockResolvedValueOnce([{ count: 10 }]).mockResolvedValueOnce([{ count: 120 }]);
  expect(await allowWrite(request, 'builder', 'weekly-chat', 10)).toBe(true);
});
