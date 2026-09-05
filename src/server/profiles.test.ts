import { describe, expect, it, vi } from 'vitest';
const { select } = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock('./db', () => ({ databaseConfigured: true, db: { select } }));
import { getPublicResult, normalizeHandle, normalizeUrl, validHandle } from './profiles';

describe('profile input', () => {
  it('rejects malformed calendar dates before sending them to Postgres', async () => {
    for (const date of ['not-a-date', '2026-02-30', '2026-02-29', '2026-13-01', '2026-01-00', '0000-01-01', '2026-1-1']) {
      expect(await getPublicResult('ana-builds', date)).toBeNull();
    }
    expect(select).not.toHaveBeenCalled();
    const query = { from: () => query, innerJoin: () => query, leftJoin: () => query, where: () => query, limit: async () => [] };
    select.mockReturnValue(query);
    expect(await getPublicResult('ana-builds', '2024-02-29')).toBeNull();
    expect(select).toHaveBeenCalledOnce();
  });
  it('keeps public handles and URLs inside their expected boundaries', () => {
    expect(normalizeHandle('  Ana-Builds ')).toBe('ana-builds');
    expect(validHandle('ana-builds')).toBe(true);
    expect(validHandle('api')).toBe(false);
    expect(normalizeUrl('https://example.com/project')).toBe('https://example.com/project');
    expect(() => normalizeUrl('http://example.com/project')).toThrow('invalid_url');
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow('invalid_url');
  });
});
