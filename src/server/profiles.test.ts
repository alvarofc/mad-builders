import { describe, expect, it } from 'vitest';
import { normalizeHandle, normalizeUrl, validHandle } from './profiles';

describe('profile input', () => {
  it('keeps public handles and URLs inside their expected boundaries', () => {
    expect(normalizeHandle('  Ana-Builds ')).toBe('ana-builds');
    expect(validHandle('ana-builds')).toBe(true);
    expect(validHandle('api')).toBe(false);
    expect(normalizeUrl('https://example.com/project')).toBe('https://example.com/project');
    expect(() => normalizeUrl('http://example.com/project')).toThrow('invalid_url');
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow('invalid_url');
  });
});
