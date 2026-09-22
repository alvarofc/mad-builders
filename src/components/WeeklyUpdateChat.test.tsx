// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import WeeklyUpdateChat from './WeeklyUpdateChat';
vi.mock('@vercel/analytics', () => ({ track: vi.fn() }));
const submit = vi.hoisted(() => vi.fn());
vi.mock('../scripts/submit-api-form', () => ({ submitApiForm: submit }));
let container: HTMLDivElement, root: Root;
const initialValues = { projectSentence: 'Stock for cafés', summary: '', status: '', nextPromise: '', feedbackRequest: '', projectUrl: '', projectStage: 'building', proofUrl: '' };
const props = { userId: 'u1', projectId: 'p1', projectName: 'Stock', draftKey: 'weekly:p1:1', weekId: 1, commitmentId: 2, improveEnabled: true,
  promise: 'Interview three owners', canSetNextPromise: true, editing: false, late: false, stages: [{ value: 'building', label: 'Building' }], initialValues };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear(); submit.mockReset();
  // Most cases resume an existing welcome and exercise the subsequent chat.
  localStorage.setItem(`${props.draftKey}:chat:u1`, JSON.stringify({ messages: [], openingReply: 'Your goal: Interview three owners. What did you learn?' }));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const mount = async () => { await act(async () => root.render(<WeeklyUpdateChat {...props} />)); };
it.each([
  { accountCount: 1, warnings: [], ok: true, state: 'ok', label: 'Last check succeeded' },
  { accountCount: 1, warnings: ['LinkedIn unavailable'], ok: true, state: 'error', label: 'Check incomplete' },
  { accountCount: 0, warnings: [], ok: true, state: 'unlinked', label: 'No accounts connected' },
  { accountCount: 1, warnings: [], ok: false, state: 'error', label: 'Check incomplete' },
])('shows accurate social fetch status: $state ($ok, $warnings)', async ({ accountCount, warnings, ok, state, label }) => {
  let finish!: (value: unknown) => void;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; })));
  await mount();
  const status = () => container.querySelector('.coach-social-status')!;
  expect(status().getAttribute('data-state')).toBe('idle');
  await click('Refresh social activity');
  expect(status().getAttribute('data-state')).toBe('loading');
  await act(async () => finish({ ok, json: async () => ({ reply: 'No new relevant posts.', error: 'Could not check social activity.',
    changes: { summary: null, nextPromise: null, feedbackRequest: null }, socialPosts: [], socialAudience: [], socialWarnings: warnings, socialAccountCount: accountCount }) }));
  expect(status().getAttribute('data-state')).toBe(state);
  expect(status().textContent).toContain(label);
  expect(status().getAttribute('role')).toBe('status');
  await act(async () => root.render(<div />));
  await mount();
  expect(status().getAttribute('data-state')).toBe(state);
});

it('does not show a stale successful social check as green', async () => {
  localStorage.setItem(`${props.draftKey}:chat:u1`, JSON.stringify({ messages: [], openingReply: 'Welcome back.', socialStatus: 'ok', socialCheckedKey: 'old-accounts:2020-01-01' }));
  await mount();
  expect(container.querySelector('.coach-social-status')!.getAttribute('data-state')).toBe('idle');
});

it('generates a welcome from restored context, preserves edits and reuses it on reload', async () => {
  localStorage.removeItem(`${props.draftKey}:chat:u1`);
  localStorage.setItem(props.draftKey, JSON.stringify({ ...initialValues, summary: 'I interviewed two owners.' }));
  let finish!: (value: unknown) => void;
  const fetch = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  vi.stubGlobal('fetch', fetch);
  await mount();
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ opening: true, draft: { summary: 'I interviewed two owners.' } });
  expect(container.textContent).toContain('Let me catch up on your week');
  await type('.coach-composer textarea', 'They both count stock on paper.');
  await click('Review & edit draft →');
  await type('textarea[name="summary"]', 'My corrected notes.');
  await act(async () => finish({ ok: true, json: async () => ({ reply: 'Two café conversations already. What surprised you?',
    changes: { summary: 'Do not replace notes.', nextPromise: 'Do not set a goal', feedbackRequest: 'Do not add this' } }) }));
  await click('Back to chat');
  expect(container.querySelector('[data-message-id="welcome"]')!.textContent).toContain('Two café conversations already.');
  expect(container.querySelector<HTMLTextAreaElement>('.coach-composer textarea')!.value).toBe('They both count stock on paper.');
  expect(JSON.parse(localStorage.getItem(props.draftKey)!)).toMatchObject({ summary: 'My corrected notes.', nextPromise: '', feedbackRequest: '' });
  expect(JSON.parse(localStorage.getItem(`${props.draftKey}:chat:u1`)!)).toMatchObject({ messages: [], openingReply: 'Two café conversations already. What surprised you?' });
  await act(async () => root.render(<div />));
  await mount();
  expect(fetch).toHaveBeenCalledOnce();
  fetch.mockResolvedValue({ ok: true, json: async () => ({ reply: 'That sounds useful.', changes: { summary: null, nextPromise: null, feedbackRequest: null } }) });
  await click('Send ↑');
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ openingReply: 'Two café conversations already. What surprised you?' });
});

it('uses the automatic social review to generate one welcome with sources and no synthetic chat turns', async () => {
  localStorage.removeItem(`${props.draftKey}:chat:u1`);
  const posts = [{ platform: 'x', scope: 'personal', account: 'https://x.com/alice', text: 'Released the beta.',
    url: 'https://x.com/alice/status/1', publishedAt: '2026-09-15T10:00:00Z' }];
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: 'Your post says the café beta is out. What have the first users told you?',
    changes: { summary: null, nextPromise: null, feedbackRequest: null }, socialPosts: posts, socialAudience: [], socialWarnings: [] }) });
  vi.stubGlobal('fetch', fetch);
  await act(async () => root.render(<WeeklyUpdateChat {...props} socialEnabled />));
  expect(fetch).toHaveBeenCalledOnce();
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ opening: true, includeSocialPosts: true });
  expect(container.querySelector('[data-message-id="welcome"]')!.textContent).toContain('Your post says the café beta is out.');
  expect(container.querySelector('[data-message-id="0"]')).toBeNull();
  expect(container.querySelector('.coach-source a')!.getAttribute('href')).toBe(posts[0].url);
  expect(JSON.parse(localStorage.getItem(props.draftKey)!)).toEqual(initialValues);
});

async function type(selector: string, value: string) {
  const input = container.querySelector<HTMLTextAreaElement>(selector)!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function click(text: string) {
  const button = [...container.querySelectorAll('button')].find(button => button.textContent === text)!;
  expect(button).toBeTruthy(); await act(async () => button.click());
}
it('keeps a failed message, retries once, updates the draft and requires a separate review before publishing', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValue({ ok: true, json: async () => ({ reply: 'What surprised you?', changes: { summary: 'I spoke to three café owners.', nextPromise: null, feedbackRequest: null }, historyCount: 2 }) });
  vi.stubGlobal('fetch', fetch);
  await mount();
  expect(container.textContent).toContain('Interview three owners');
  expect(container.querySelector('[type="submit"]')!.textContent).toBe('Send ↑');
  await type('.coach-composer textarea', 'I spoke to three café owners.');
  await click('Send ↑');
  expect(container.querySelector<HTMLTextAreaElement>('.coach-composer textarea')!.value).toBe('I spoke to three café owners.');
  expect(container.querySelector('[role="alert"]')!.textContent).toContain('Connection lost');
  await click('Send ↑');
  expect(JSON.parse(fetch.mock.calls[1][1].body).messages).toHaveLength(1);
  expect(container.textContent).toContain('What surprised you?');
  expect(container.querySelector('[data-message-id="0"]')!.getAttribute('data-scroll-anchor')).toBe('true');
  expect(container.querySelector('[data-message-id="1"]')!.getAttribute('data-scroll-anchor')).toBe('false');
  expect(JSON.parse(localStorage.getItem(props.draftKey)!)).toMatchObject({ summary: 'I spoke to three café owners.', nextPromise: '' });
  expect(submit).not.toHaveBeenCalled();
  await click('Review & edit draft →');
  expect(container.querySelector('select[name="status"]')!.getAttribute('required')).not.toBeNull();
  expect(container.querySelector<HTMLSelectElement>('select[name="status"]')!.value).toBe('');
  await type('textarea[name="summary"]', 'I interviewed three owners and learned they count stock on paper.');
  await type('textarea[name="nextPromise"]', 'Test the counter with one owner');
  const status = container.querySelector<HTMLSelectElement>('select[name="status"]')!;
  await act(async () => { status.value = 'complete'; status.dispatchEvent(new Event('change', { bubbles: true })); });
  await click('Publish update');
  expect(submit).toHaveBeenCalledTimes(1);
  const data = new FormData(submit.mock.calls[0][0]);
  expect(data.get('summary')).toContain('count stock on paper');
  expect(data.get('nextPromise')).toBe('Test the counter with one owner');
  expect(data.get('commitmentId')).toBe('2');
});
it('restores drafts and unsent messages and sends manual draft edits on the next turn', async () => {
  localStorage.setItem(props.draftKey, JSON.stringify({ ...initialValues, summary: 'Saved progress' }));
  localStorage.setItem(`${props.draftKey}:chat:u1`, JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'What changed?' }], input: 'Unsent note' }));
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: 'Thanks for clarifying.', changes: { summary: null, nextPromise: null, feedbackRequest: null }, historyCount: 0 }) });
  vi.stubGlobal('fetch', fetch);
  await mount();
  expect(JSON.parse(localStorage.getItem(props.draftKey)!)).toMatchObject({ summary: 'Saved progress' });
  expect(container.querySelector<HTMLTextAreaElement>('.coach-composer textarea')!.value).toBe('Unsent note');
  await click('Review & edit draft →');
  await type('textarea[name="summary"]', 'Manually corrected facts');
  await click('Back to chat');
  await click('Send ↑');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ draft: { summary: 'Manually corrected facts' } });
  expect(JSON.parse(fetch.mock.calls[0][1].body).messages).toHaveLength(3);
  expect(JSON.parse(localStorage.getItem(props.draftKey)!)).toMatchObject({ summary: 'Manually corrected facts' });
  expect(submit).not.toHaveBeenCalled();
});

it('allows only one pending request and preserves the draft and input after invalid output', async () => {
  let finish!: (value: unknown) => void;
  const fetch = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  vi.stubGlobal('fetch', fetch);
  await mount();
  await type('.coach-composer textarea', 'I tested the counter.');
  const form = container.querySelector('.coach-composer')!;
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(fetch).toHaveBeenCalledOnce();
  expect(container.querySelector<HTMLTextAreaElement>('.coach-composer textarea')!.disabled).toBe(true);
  expect([...container.querySelectorAll('button')].find(button => button.textContent === 'Review & edit draft →')!.disabled).toBe(true);
  await act(async () => finish({ ok: true, json: async () => ({ reply: 'Done', changes: { summary: 'x'.repeat(1001), nextPromise: null, feedbackRequest: null } }) }));
  expect(container.querySelector('[role="alert"]')!.textContent).toContain('Your message and draft are still here');
  expect(container.querySelector<HTMLTextAreaElement>('.coach-composer textarea')!.value).toBe('I tested the counter.');
  expect(JSON.parse(localStorage.getItem(props.draftKey)!)).toEqual(initialValues);
  expect(JSON.parse(localStorage.getItem(`${props.draftKey}:chat:u1`)!).messages).toEqual([]);
});

it('preserves catch-up goals and can reset the conversation without discarding the draft', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: 'Here is your update.', changes: { summary: 'I tested the counter.', nextPromise: 'An unauthorized new goal', feedbackRequest: null }, historyCount: 0 }) }));
  await act(async () => root.render(<WeeklyUpdateChat {...props} canSetNextPromise={false} initialValues={{ ...initialValues, nextPromise: 'Previously saved goal' }} />));
  await type('.coach-composer textarea', 'I tested the counter.');
  await click('Send ↑');
  expect(JSON.parse(localStorage.getItem(props.draftKey)!)).toMatchObject({ summary: 'I tested the counter.', nextPromise: 'Previously saved goal' });
  await click('New conversation, keep draft');
  expect(container.textContent).not.toContain('Here is your update.');
  expect(JSON.parse(localStorage.getItem(props.draftKey)!)).toMatchObject({ summary: 'I tested the counter.' });
  expect(JSON.parse(localStorage.getItem(`${props.draftKey}:chat:u1`)!).messages).toEqual([]);
  await click('Review & edit draft →');
  expect(container.querySelector('[name="nextPromise"]')).toBeNull();
});

it('keeps manual writing available when AI is disabled or browser storage is blocked', async () => {
  await act(async () => root.render(<WeeklyUpdateChat {...props} improveEnabled={false} />));
  expect(container.querySelector('.coach-composer')).toBeNull();
  expect(container.querySelector('textarea')).not.toBeNull();
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  try {
    await mount();
    await click('Review & edit draft →');
    await type('textarea[name="summary"]', 'I can still write my update.');
    expect(container.querySelector<HTMLTextAreaElement>('[name="summary"]')!.value).toBe('I can still write my update.');
    expect(container.textContent).toContain('Could not save on this browser');
  } finally { get.mockRestore(); set.mockRestore(); }
});

it('requires a new conversation at the history limit and keeps saved draft fields', async () => {
  localStorage.setItem(props.draftKey, JSON.stringify({ ...initialValues, summary: 'Keep this progress.' }));
  localStorage.setItem(`${props.draftKey}:chat:u1`, JSON.stringify({ messages: Array.from({ length: 40 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `Message ${index}` })), input: 'One more detail' }));
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  await mount();
  await click('Send ↑');
  expect(fetch).not.toHaveBeenCalled();
  expect(container.textContent).toContain('start a new conversation');
  await click('New conversation, keep draft');
  expect([...container.querySelectorAll('button')].find(button => button.textContent === 'Send ↑')!.disabled).toBe(false);
  expect(JSON.parse(localStorage.getItem(props.draftKey)!)).toMatchObject({ summary: 'Keep this progress.' });
});

it('aborts an in-flight message when the builder leaves the conversation', async () => {
  const fetch = vi.fn().mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  vi.stubGlobal('fetch', fetch);
  await mount();
  await type('.coach-composer textarea', 'I tested the counter.');
  await click('Send ↑');
  await act(async () => root.render(<div>Another page</div>));
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  expect(JSON.parse(localStorage.getItem(`${props.draftKey}:chat:u1`)!).input).toBe('I tested the counter.');
});

it('ignores incomplete saved conversations and preserves the message on an expired session', async () => {
  localStorage.setItem(`${props.draftKey}:chat:u1`, JSON.stringify({ messages: [{ role: 'user', content: 'Incomplete turn' }], input: 'Stale input' }));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Sign in to continue this conversation.' }) }));
  await mount();
  expect(container.textContent).not.toContain('Incomplete turn');
  expect(container.querySelector<HTMLTextAreaElement>('.coach-composer textarea')!.value).toBe('');
  await type('.coach-composer textarea', 'My new progress.');
  await click('Send ↑');
  expect(container.querySelector('[role="alert"]')!.textContent).toBe('Sign in to continue this conversation.');
  expect(container.querySelector<HTMLTextAreaElement>('.coach-composer textarea')!.value).toBe('My new progress.');
});

it('submits an unplanned week with the week id and submitted outcome', async () => {
  await act(async () => root.render(<WeeklyUpdateChat {...props} commitmentId={undefined} promise="" canSetNextPromise={false} initialValues={{ ...initialValues, summary: 'I tested the counter.' }} />));
  await click('Review & edit draft →');
  expect(container.querySelector('select[name="status"]')).toBeNull();
  await click('Publish update');
  expect(submit).toHaveBeenCalledOnce();
  const data = new FormData(submit.mock.calls[0][0]);
  expect(data.get('weekId')).toBe('1');
  expect(data.get('status')).toBe('submitted');
  expect(data.has('commitmentId')).toBe(false);
  expect(data.has('nextPromise')).toBe(false);
});

it('focuses the screen on chat and opens the draft only for review', async () => {
  await mount();
  expect(container.querySelector<HTMLElement>('.coach-draft')!.hidden).toBe(true);
  expect(container.querySelector('.coach-review')).toBeNull();
  expect(container.querySelector<HTMLDetailsElement>('.coach-context')!.open).toBe(false);
  await click('Review & edit draft →');
  expect(container.querySelector<HTMLElement>('.coach-conversation')!.hidden).toBe(true);
  expect(container.querySelector<HTMLElement>('.coach-draft')!.hidden).toBe(false);
  expect(document.activeElement).toBe(container.querySelector('.coach-draft h3'));
  await click('Back to chat');
  expect(container.querySelector<HTMLElement>('.coach-draft')!.hidden).toBe(true);
  expect(document.activeElement).toBe(container.querySelector('.coach-composer textarea'));
});

it('waits for saved history before opening the message scroller and does not autofocus on load', async () => {
  localStorage.setItem(`${props.draftKey}:chat:u1`, JSON.stringify({ messages: [
    { role: 'user', content: 'First turn' }, { role: 'assistant', content: 'First reply' },
    { role: 'user', content: 'Last turn' }, { role: 'assistant', content: 'Last reply' },
  ] }));
  const initial = renderToString(<WeeklyUpdateChat {...props} />);
  expect(initial).toContain('Loading your conversation');
  expect(initial).not.toContain('data-message-id');
  await mount();
  expect(container.querySelectorAll('[data-scroll-anchor="true"]')).toHaveLength(2);
  expect(container.querySelector('[data-message-id="2"]')!.textContent).toContain('Last turn');
  expect(document.activeElement).not.toBe(container.querySelector('.coach-composer textarea'));
});

it('imports on demand, keeps unsent notes, shows sources during review, and never publishes automatically', async () => {
  const posts = [{ platform: 'x', scope: 'personal', account: 'https://x.com/alice', text: 'Released the beta.', url: 'https://x.com/alice/status/1', publishedAt: '2026-09-15T10:00:00Z' }];
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: 'Check the draft.', changes: { summary: 'I released the beta.', nextPromise: null, feedbackRequest: null }, socialPosts: posts, socialWarnings: ['Company LinkedIn unavailable'] }) });
  vi.stubGlobal('fetch', fetch);
  await mount();
  expect(fetch).not.toHaveBeenCalled();
  await type('.coach-composer textarea', 'Keep my unsent notes.');
  await click('Refresh social activity');
  expect(JSON.parse(fetch.mock.calls.at(-1)![1].body).refreshSocialPosts).toBe(true);
  expect(JSON.parse(fetch.mock.calls[0][1].body).includeSocialPosts).toBe(true);
  expect(container.querySelector<HTMLTextAreaElement>('.coach-composer textarea')!.value).toBe('Keep my unsent notes.');
  expect(container.querySelector('.coach-source a')!.getAttribute('href')).toBe(posts[0].url);
  expect(container.textContent).toContain('Company LinkedIn unavailable');
  expect(JSON.parse(localStorage.getItem(`${props.draftKey}:chat:u1`)!).socialPosts).toEqual(posts);
  expect(submit).not.toHaveBeenCalled();
  await click('Use as proof link');
  await click('Review & edit draft →');
  expect(container.querySelector('.coach-socials')!.closest('[hidden]')).toBeNull();
  expect(container.querySelector<HTMLTextAreaElement>('textarea[name="summary"]')!.value).toBe('I released the beta.');
  expect(container.querySelector<HTMLSelectElement>('select[name="status"]')!.value).toBe('');
  expect(container.querySelector<HTMLInputElement>('input[name="proofUrl"]')!.value).toBe(posts[0].url);
});

it('checks socials automatically once per day and fills an empty draft without publishing or changing goals', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: 'I found a relevant launch.',
    changes: { summary: 'We launched the café beta.', nextPromise: 'Unapproved goal', feedbackRequest: 'Unapproved question' }, socialPosts: [], socialAudience: [], socialWarnings: [] }) });
  vi.stubGlobal('fetch', fetch);
  await act(async () => root.render(<WeeklyUpdateChat {...props} socialEnabled socialVersion="accounts-v1" />));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetch.mock.calls[0][1].body).includeSocialPosts).toBe(true);
  expect(JSON.parse(localStorage.getItem(props.draftKey)!)).toMatchObject({ summary: 'We launched the café beta.', nextPromise: '', feedbackRequest: '', status: '' });
  expect(submit).not.toHaveBeenCalled();
  await act(async () => root.render(<div />));
  await act(async () => root.render(<WeeklyUpdateChat {...props} socialEnabled socialVersion="accounts-v1" />));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(document.activeElement).not.toBe(container.querySelector('.coach-composer textarea'));
});

it('preserves restored notes during automatic review and appends only when the builder chooses', async () => {
  localStorage.setItem(props.draftKey, JSON.stringify({ ...initialValues, summary: 'My saved work.' }));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: 'There is a relevant launch.',
    changes: { summary: 'We launched the café beta.', nextPromise: null, feedbackRequest: null }, socialPosts: [], socialWarnings: [] }) }));
  await act(async () => root.render(<WeeklyUpdateChat {...props} socialEnabled />));
  expect(JSON.parse(localStorage.getItem(props.draftKey)!)).toMatchObject({ summary: 'My saved work.' });
  expect(container.textContent).toContain('Suggested addition');
  await click('Add to draft');
  expect(JSON.parse(localStorage.getItem(props.draftKey)!)).toMatchObject({ summary: 'My saved work.\n\nWe launched the café beta.' });
  expect(submit).not.toHaveBeenCalled();
});

it('allows typing and reviewing during an automatic check and does not refill a field the builder cleared', async () => {
  let finish!: (result: unknown) => void;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; })));
  await act(async () => root.render(<WeeklyUpdateChat {...props} socialEnabled />));
  expect(container.querySelector<HTMLTextAreaElement>('.coach-composer textarea')!.disabled).toBe(false);
  await type('.coach-composer textarea', 'Unsent context.');
  await click('Review & edit draft →');
  await type('textarea[name="summary"]', 'I am still deciding what to write.');
  await type('textarea[name="summary"]', '');
  await act(async () => finish({ ok: true, json: async () => ({ reply: 'A suggestion is ready.', changes: { summary: 'We launched the beta.', nextPromise: null, feedbackRequest: null }, socialPosts: [], socialWarnings: [] }) }));
  expect(container.querySelector<HTMLTextAreaElement>('textarea[name="summary"]')!.value).toBe('');
  expect(JSON.parse(localStorage.getItem(`${props.draftKey}:chat:u1`)!).input).toBe('Unsent context.');
  expect(container.textContent).toContain('Suggested addition');
});
