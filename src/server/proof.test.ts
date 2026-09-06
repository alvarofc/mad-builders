import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { accounts, getAccessToken } = vi.hoisted(() => ({ accounts: vi.fn(), getAccessToken: vi.fn() }));
vi.mock('./db', () => ({ db: { select: () => {
  const query = { from: () => query, where: () => query, limit: accounts };
  return query;
} } }));
vi.mock('./auth', () => ({ auth: { api: { getAccessToken } } }));
import { checkProof } from './results';

const commit = 'https://github.com/builders/demo/commit/abcdef1234';
const headers = new Headers();

beforeEach(() => {
  accounts.mockReset().mockResolvedValue([{ id: 'account', accountId: '42' }]);
  getAccessToken.mockReset().mockResolvedValue({ accessToken: 'test-token' });
});
afterEach(() => vi.unstubAllGlobals());

describe('proof verification', () => {
  it('keeps an omitted proof self-reported without accessing an account', async () => {
    expect(await checkProof('  ', 'builder', headers)).toEqual({ url: null, status: 'self_reported', checkedAt: null });
    expect(accounts).not.toHaveBeenCalled();
  });

  it('rejects non-HTTPS, credentials, and oversized proof links', async () => {
    for (const url of ['http://example.com', 'https://user:secret@example.com', `https://example.com/${'a'.repeat(2048)}`]) {
      await expect(checkProof(url, 'builder', headers)).rejects.toThrow('invalid_url');
    }
    expect(accounts).not.toHaveBeenCalled();
  });

  it('does not verify arbitrary links, lookalike hosts, or malformed commit paths', async () => {
    for (const url of ['https://example.com/demo', 'https://github.com.evil.test/u/r/commit/abcdef1', `${commit}/extra`, 'https://github.com/u/r/commit/not-a-sha']) {
      expect(await checkProof(url, 'builder', headers)).toEqual({ url, status: 'proof_linked', checkedAt: null });
    }
    expect(accounts).not.toHaveBeenCalled();
  });

  it('leaves a commit unverified when no GitHub account is connected', async () => {
    accounts.mockResolvedValue([]);
    expect(await checkProof(commit, 'builder', headers)).toMatchObject({ status: 'proof_linked', checkedAt: expect.any(Date) });
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it('matches either GitHub author or committer to the connected account', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const payload of [{ author: { id: 42 } }, { author: null, committer: { id: 42 } }]) {
      fetchMock.mockResolvedValue(new Response(JSON.stringify(payload)));
      expect(await checkProof(commit, 'builder', headers)).toMatchObject({ status: 'github_account_matched', checkedAt: expect.any(Date) });
    }
    expect(fetchMock).toHaveBeenCalledWith('https://api.github.com/repos/builders/demo/commits/abcdef1234', expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }));
  });

  it('never marks another account or a missing author as matched', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const payload of [{ author: { id: 99 } }, { author: null, committer: null }]) {
      fetchMock.mockResolvedValue(new Response(JSON.stringify(payload)));
      expect(await checkProof(commit, 'builder', headers)).toMatchObject({ status: 'proof_linked' });
    }
  });

  it('falls back to a linked proof after an API failure or network error', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 404 })).mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(await checkProof(commit, 'builder', headers)).toMatchObject({ status: 'proof_linked', checkedAt: expect.any(Date) });
    }
  });

  it('preserves the proof link if the access token cannot be recovered', async () => {
    getAccessToken.mockRejectedValue(new Error('expired'));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await checkProof(commit, 'builder', headers)).toMatchObject({ status: 'proof_linked' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
