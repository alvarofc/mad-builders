import { describe, expect, it } from 'vitest';
import { rankCandidateScores, scoreCandidateChoices } from './ranking';

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
