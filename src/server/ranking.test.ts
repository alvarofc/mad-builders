import { afterEach, describe, expect, it, vi } from 'vitest';
import { rankCandidateScores, reviewCandidateIds, scoreCandidateChoices, selectReviewPair } from './ranking';

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
    // Prefer including 1 even though its opponent has more coverage.
    const history = [assignment(1, 2), ...Array.from({ length: 4 }, () => assignment(2, 5)),
      assignment(3, 5), assignment(3, 5), assignment(4, 5), assignment(4, 5)];
    expect(selectReviewPair([1, 2, 3, 4, 5], [1, 2, 3, 4],
      new Set(), history, now)).toMatchObject({ low: 1, least: 1, most: 2 });
  });

  it('ignores expired reservations and decisions involving removed participants', () => {
    const history = [assignment(3, 4),
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
        for (const previous of used.get(voter)!) {
          const seen = previous.split(':').map(Number);
          expect(seen).not.toContain(pair.low);
          expect(seen).not.toContain(pair.high);
        }
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

it('assigns a pair from 5,000 equally covered projects without enumerating pairs', () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.25);
  try {
    const ids = Array.from({ length: 5000 }, (_, index) => index + 1);
    const pair = selectReviewPair(ids, ids, new Set(), [], new Date())!;
    expect(pair.low).toBeLessThan(pair.high);
    expect(pair.least).toBe(0);
    expect(pair.frequency).toBe(0);
    // One shuffle and the first optimal pair, rather than millions of pair ties.
    expect(random.mock.calls.length).toBeLessThan(5010);
  } finally {
    random.mockRestore();
  }
});

it('matches exhaustive coverage and frequency priorities across mixed histories', () => {
  let seed = 137;
  const random = vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  });
  try {
    const now = new Date();
    const ids = Array.from({ length: 12 }, (_, index) => index + 1);
    for (let trial = 0; trial < 100; trial++) {
      const assignments = Array.from({ length: 60 }, () => {
        const a = 1 + Math.floor(Math.random() * 12);
        const b = a % 12 + 1;
        return { candidateLowId: Math.min(a, b), candidateHighId: Math.max(a, b), choice: 'tie', assignedAt: now };
      });
      const coverage = new Map(scoreCandidateChoices(ids, assignments).map((score) => [score.resultId, score.decisions]));
      const used = new Set<string>();
      const priorities: number[][] = [];
      for (const low of ids) for (const high of ids) {
        if (low >= high) continue;
        if (Math.random() < 0.03) used.add(`${low}:${high}`);
      }
      const seen = new Set([...used].flatMap((key) => key.split(':').map(Number)));
      for (const low of ids) for (const high of ids) {
        if (low >= high || seen.has(low) || seen.has(high)) continue;
        priorities.push([
          Math.min(coverage.get(low)!, coverage.get(high)!),
          Math.max(coverage.get(low)!, coverage.get(high)!),
          assignments.filter((pair) => pair.candidateLowId === low && pair.candidateHighId === high).length,
        ]);
      }
      priorities.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
      const pair = selectReviewPair(ids, ids, used, assignments, now);
      if (!priorities.length) expect(pair).toBeNull();
      else {
        expect(pair).not.toBeNull();
        expect(used.has(`${pair!.low}:${pair!.high}`)).toBe(false);
        expect([pair!.least, pair!.most, pair!.frequency]).toEqual(priorities[0]);
      }
    }
  } finally {
    random.mockRestore();
  }
});

it('excludes both results from previous votes and stops with one unseen result', () => {
  const now = new Date();
  expect(selectReviewPair([1, 2, 3, 4], [1, 2, 3, 4], new Set(['1:2']), [], now))
    .toMatchObject({ low: 3, high: 4 });
  expect(selectReviewPair([1, 2, 3], [1, 2, 3], new Set(['1:2']), [], now)).toBeNull();
});

it.each([6, 7, 26, 27])('finishes all pairs with equal exposure and no repeats for %i updates', (count) => {
  const ids = Array.from({ length: count }, (_, index) => index + 1);
  const now = new Date();
  const history: Array<{ candidateLowId: number; candidateHighId: number; choice: string; assignedAt: Date }> = [];
  const appearances = new Map(ids.map((id) => [id, 0]));
  for (const voter of ids) {
    const available = reviewCandidateIds(ids, new Set([voter]), voter);
    const used = new Set<string>();
    const seen = new Set<number>();
    for (let round = 0; round < Math.floor((count - 1) / 2); round++) {
      const pair = selectReviewPair(ids, available, used, history, now)!;
      expect(pair).not.toBeNull();
      for (const id of [pair.low, pair.high]) {
        expect(id).not.toBe(voter);
        expect(seen.has(id)).toBe(false);
        seen.add(id);
        appearances.set(id, appearances.get(id)! + 1);
      }
      used.add(`${pair.low}:${pair.high}`);
      history.push({ candidateLowId: pair.low, candidateHighId: pair.high, choice: 'tie', assignedAt: now });
    }
    expect(selectReviewPair(ids, available, used, history, now)).toBeNull();
  }
  expect(new Set(appearances.values())).toEqual(new Set([2 * Math.floor((count - 1) / 2)]));
});

it('counts skipped comparisons as exposure without counting them as ranking decisions', () => {
  const now = new Date();
  const history = [{ candidateLowId: 1, candidateHighId: 2, choice: 'pass', assignedAt: now }];
  expect(selectReviewPair([1, 2, 3, 4], [1, 2, 3, 4], new Set(), history, now))
    .toMatchObject({ low: 3, high: 4 });
  expect(scoreCandidateChoices([1, 2], history).every((score) => score.decisions === 0)).toBe(true);
});

it('ranks a small week using its attainable coverage threshold', () => {
  expect(rankCandidateScores([
    { resultId: 1, wins: 3, ties: 0, decisions: 4 },
    { resultId: 2, wins: 2, ties: 0, decisions: 3 },
  ], 4).map((score) => score.resultId)).toEqual([1]);
});

it('keeps shared-owner results out and leaves an even number of candidates', () => {
  const available = reviewCandidateIds([1, 2, 3, 4, 5, 6, 7], new Set([1, 2]), 1);
  expect(available).toEqual([4, 5, 6, 7]);
  expect(reviewCandidateIds([1, 2], new Set([1, 2]), 1)).toEqual([]);
  expect(reviewCandidateIds([1, 2], new Set([1]), 1)).toEqual([]);
});
