import { expect, it } from 'vitest';
import { demoLeaderboard, demoReview } from './builders-demo';

it('provides six ranked companies and ten distinct preview comparisons', () => {
  expect(demoLeaderboard.entries).toHaveLength(6);
  const pairs = new Set<string>();
  for (let round = 0; round < 10; round++) {
    const review = demoReview(String(round));
    expect(review.state).toBe('pair');
    if (review.state !== 'pair') throw new Error('Expected demo pair');
    expect(review.reviewed).toBe(round);
    expect(review.first.id).not.toBe(review.second.id);
    expect(review.first.summary.length).toBeGreaterThan(50);
    pairs.add(`${review.first.id}:${review.second.id}`);
  }
  expect(pairs.size).toBe(10);
  expect(demoReview('10')).toMatchObject({ state: 'complete', reviewed: 10 });
  for (const invalid of ['NaN', '-1', '1.5', null]) {
    expect(demoReview(invalid)).toMatchObject({ state: 'pair', reviewed: 0 });
  }
});
