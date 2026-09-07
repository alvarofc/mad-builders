import { expect, it, vi } from 'vitest';

vi.mock('../styles/global.css?raw', async () => {
  const { readFileSync } = await import('node:fs');
  return { default: readFileSync(new URL('../styles/global.css', import.meta.url), 'utf8') };
});
import { renderEmail } from './email-templates';

const unsubscribeUrl = 'https://www.mad.builders/api/email/unsubscribe?token=test';

it('renders the approved messages with working destinations and an unsubscribe footer', () => {
  for (const kind of ['welcome', 'checkin', 'voting'] as const) {
    const email = renderEmail(kind, { unsubscribeUrl });
    const destination = `https://www.mad.builders/${kind === 'voting' ? 'vote' : 'build'}`;
    expect(email.html).toContain(`href="${destination}"`);
    expect(email.text).toContain(destination);
    expect(email.html).toContain(`href="${unsubscribeUrl}"`);
    expect(email.text).toContain(`Unsubscribe: ${unsubscribeUrl}`);
    expect(email.html).not.toContain('Test preview');
    expect(email.html).not.toContain('{escape(');
  }
});

it('asks only for missing check-in actions', () => {
  const both = renderEmail('checkin', { unsubscribeUrl, needsResult: true, needsPromise: true });
  expect(both.text).toContain('Post what you got done and set next week’s goals.');
  const result = renderEmail('checkin', { unsubscribeUrl, needsResult: true, needsPromise: false });
  expect(result.text).toContain('Post what you got done.');
  expect(result.text).not.toContain('next week');
  const promise = renderEmail('checkin', { unsubscribeUrl, needsResult: false, needsPromise: true });
  expect(promise.text).toContain('Set next week’s goals.');
  expect(promise.text).not.toContain('Post what you got done');
  expect(promise.text).not.toContain('this week’s ranking');
  expect(() => renderEmail('checkin', { unsubscribeUrl, needsResult: false, needsPromise: false })).toThrow('No check-in action needed');
});

it('escapes unsubscribe URLs in HTML while preserving the plain-text URL', () => {
  const url = `${unsubscribeUrl}&value="<tag>'`;
  const email = renderEmail('welcome', { unsubscribeUrl: url });
  expect(email.html).toContain('token=test&amp;value=&quot;&lt;tag&gt;&#39;');
  expect(email.html).not.toContain(url);
  expect(email.text).toContain(url);
  expect(() => renderEmail('welcome', { unsubscribeUrl: 'javascript:alert(1)' })).toThrow('HTTPS');
});
