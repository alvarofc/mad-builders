import { afterEach, describe, expect, it, vi } from 'vitest';
import { rankCandidateScores, scoreCandidateChoices, selectReviewPair } from './ranking';

describe('weekly ranking', () => {
  it('uses exact ratios, ignores thin coverage, and assigns competition ranks', () => {
    const ranked = rankCandidateScores([
      { resultId: 1, wins: 6, ties: 0, decisions: 8 },
      { resultId: 2, wins: 5, ties: 2, decisions: 8 },
      { resultId: 3, wins: 3, ties: 0, decisions: 4 },
      { resultId: 4, wins: 4, ties: 0, decisions: 8 },
    ]);

    expect(ranked.map(({ resultId, rank }) => ({ resultId, rank }))).toEqual([
      { resultId: 1, rank: 1 },
      { resultId: 2, rank: 1 },
      { resultId: 4, rank: 3 },
    ]);
  });

  it('counts ties, ignores passes, and drops choices involving removed candidates', () => {
    expect(
      scoreCandidateChoices([1, 2], [
        { candidateLowId: 1, candidateHighId: 2, choice: 'tie' },
        { candidateLowId: 1, candidateHighId: 2, choice: 'pass' },
        { candidateLowId: 1, candidateHighId: 3, choice: 'low' },
      ]),
    ).toEqual([
      { resultId: 1, wins: 0, ties: 1, decisions: 1 },
      { resultId: 2, wins: 0, ties: 1, decisions: 1 },
    ]);
  });
});

describe('review coverage', () => {
  const now = new Date('2026-09-07T12:00:00Z');
  const assignment = (low: number, high: number, choice: string | null = 'tie', age = 0) => ({
    candidateLowId: low, candidateHighId: high, choice,
    assignedAt: new Date(now.getTime() - age),
  });
  afterEach(() => vi.restoreAllMocks());

  it('prioritizes the least-reviewed participant over new pairs and combined exposure', () => {
    // 1 has one decision, 2 has five, and 3/4 have two each.
    // Only 1:2 and 3:4 remain; the old selector preferred the unseen 3:4 pair.
    const history = [assignment(1, 2), ...Array.from({ length: 4 }, () => assignment(2, 5)),
      assignment(3, 5), assignment(3, 5), assignment(4, 5), assignment(4, 5)];
    expect(selectReviewPair([1, 2, 3, 4, 5], [1, 2, 3, 4],
      new Set(['1:3', '1:4', '2:3', '2:4']), history, now)).toMatchObject({ low: 1, high: 2 });
  });

  it('ignores skips, expired reservations, and decisions involving removed participants', () => {
    const history = [assignment(3, 4), assignment(1, 2, 'pass'),
      assignment(1, 2, null, 10 * 60 * 1000), assignment(1, 99), assignment(2, 99)];
    expect(selectReviewPair([1, 2, 3, 4], [1, 2, 3, 4], new Set(), history, now))
      .toMatchObject({ low: 1, high: 2 });
  });

  it('reserves fresh pending pairs so concurrent voters spread out', () => {
    expect(selectReviewPair([1, 2, 3, 4], [1, 2, 3, 4], new Set(),
      [assignment(1, 2, null)], now)).toMatchObject({ low: 3, high: 4 });
  });

  it('prefers new pairs when coverage is equal and handles exhaustion', () => {
    const history = [assignment(1, 2), assignment(3, 4)];
    const pair = selectReviewPair([1, 2, 3, 4], [1, 2, 3, 4], new Set(), history, now)!;
    expect(['1:2', '3:4']).not.toContain(`${pair.low}:${pair.high}`);
    expect(selectReviewPair([1, 2, 3], [2, 3], new Set(['2:3']), [], now)).toBeNull();
  });

  it('covers a thirty-participant week despite skips and abandoned pairs', () => {
    let seed = 42;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    });
    const ids = Array.from({ length: 30 }, (_, index) => index + 1);
    const history: ReturnType<typeof assignment>[] = [];
    const used = new Map(ids.map((id) => [id, new Set<string>()]));
    const abandonedVoters = new Set<number>();
    for (let round = 0; round < 10; round++) {
      const roundTime = new Date(now.getTime() + round * 10 * 60 * 1000);
      for (const voter of ids) {
        if (abandonedVoters.has(voter)) continue;
        const pair = selectReviewPair(ids, ids.filter((id) => id !== voter), used.get(voter)!, history, roundTime)!;
        expect(pair).not.toBeNull();
        expect([pair.low, pair.high]).not.toContain(voter);
        const key = `${pair.low}:${pair.high}`;
        expect(used.get(voter)!.has(key)).toBe(false);
        used.get(voter)!.add(key);
        const skipped = (round + voter) % 5 === 0;
        const abandoned = round === 0 && voter % 3 === 0;
        if (abandoned) abandonedVoters.add(voter);
        history.push({ ...assignment(pair.low, pair.high, abandoned ? null : skipped ? 'pass' : 'tie'),
          assignedAt: roundTime });
      }
    }
    expect(scoreCandidateChoices(ids, history).every((score) => score.decisions >= 8)).toBe(true);
  });
});
