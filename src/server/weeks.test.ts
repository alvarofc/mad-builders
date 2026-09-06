import { describe, expect, it } from 'vitest';
import { madridWeekStartDates } from './weeks';

describe('automatic weekly schedule', () => {
  it('uses Madrid Mondays across daylight-saving changes', () => {
    expect(madridWeekStartDates(new Date('2026-09-04T12:00:00Z'))).toEqual(['2026-08-31', '2026-09-07']);
    expect(madridWeekStartDates(new Date('2026-03-29T21:59:59Z'))).toEqual(['2026-03-23', '2026-03-30']);
    expect(madridWeekStartDates(new Date('2026-03-29T22:00:00Z'))).toEqual(['2026-03-30', '2026-04-06']);
  });
});
