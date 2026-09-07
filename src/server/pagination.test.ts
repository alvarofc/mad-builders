import { expect, it } from 'vitest';
import { pageNumber } from './pagination';

it('accepts page numbers and rejects unsafe offsets', () => {
  expect(pageNumber('200')).toBe(200);
  for (const value of [null, '', 'oops', '-1', '0', '1.5', 'Infinity', '9007199254740992', '1000001']) {
    expect(pageNumber(value)).toBe(1);
  }
});
