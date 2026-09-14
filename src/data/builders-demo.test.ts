import { expect, it } from 'vitest';
import { demoLeaderboard, demoReview } from './builders-demo';

it('provides six ranked companies without repeating preview results', () => {
  expect(demoLeaderboard.entries).toHaveLength(6);
  const seen = new Set<number>();
  for (let round = 0; round < 3; round++) {
    const review = demoReview(String(round));
    expect(review.state).toBe('pair');
    if (review.state !== 'pair') throw new Error('Expected demo pair');
    expect(review.reviewed).toBe(round);
    expect(review.first.id).not.toBe(review.second.id);
    expect(review.first.summary.length).toBeGreaterThan(50);
    for (const candidate of [review.first, review.second]) {
      expect(seen.has(candidate.id)).toBe(false);
      seen.add(candidate.id);
    }
  }
  expect(seen.size).toBe(6);
  expect(demoReview('3')).toMatchObject({ state: 'complete', reviewed: 3, total: 3 });
  expect(demoReview('10')).toMatchObject({ state: 'complete', reviewed: 3, total: 3 });
  for (const invalid of ['NaN', '-1', '1.5', null]) {
    expect(demoReview(invalid)).toMatchObject({ state: 'pair', reviewed: 0 });
  }
});
