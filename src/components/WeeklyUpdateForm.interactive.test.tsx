// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import WeeklyUpdateForm from './WeeklyUpdateForm';

vi.mock('@vercel/analytics', () => ({ track: vi.fn() }));
let container: HTMLDivElement;
let root: Root;
const draftKey = 'weekly:test';
const initialValues = { projectSentence: 'A useful project', summary: 'Shipped a demo', status: 'complete', nextPromise: 'Launch the demo', feedbackRequest: '', projectUrl: '', projectStage: 'idea', proofUrl: '' };

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function mount(values = initialValues) {
  await act(async () => root.render(<WeeklyUpdateForm draftKey={draftKey} commitmentId={2} promise="Ship the demo" canSetNextPromise editing={false} late={false} stages={[{ value: 'idea', label: 'Exploring an idea' }, { value: 'launched', label: 'Launched' }]} initialValues={values} />));
}
function active() { return container.querySelector<HTMLFieldSetElement>('fieldset[data-active]')!; }
function progress() { return container.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow'); }
async function click(label: string) {
  const button = [...container.querySelectorAll('button')].find(button => button.textContent === label && !button.hidden)!;
  expect(button, `visible ${label} button`).toBeTruthy();
  await act(async () => { button.click(); await new Promise(resolve => setTimeout(resolve, 5)); });
}
async function type(value: string) {
  const input = active().querySelector<HTMLInputElement | HTMLTextAreaElement>('textarea, input:not([type="radio"])')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
   
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
  return input;
}

it('restores drafts and preserves edited text and radio answers when navigating', async () => {
  localStorage.setItem(draftKey, JSON.stringify({ ...initialValues, projectSentence: 'Restored project' }));
  await mount();
  expect(active().querySelector('textarea')!.value).toBe('Restored project');
  const input = await type('Updated project');
  await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  expect(progress()).toBe('1');
  await click('Next');
  await type('First line\nSecond line');
  await click('Next');
  await act(async () => { active().querySelector<HTMLInputElement>('input[value="partial"]')!.click(); await new Promise(resolve => setTimeout(resolve, 5)); });
  await click('Previous');
  expect(active().querySelector('textarea')!.value).toBe('First line\nSecond line');
  await click('Previous');
  expect(active().querySelector('textarea')!.value).toBe('Updated project');
  await click('Next');
  await click('Next');
  expect(active().querySelector<HTMLInputElement>('input[value="partial"]')!.checked).toBe(true);
  expect(JSON.parse(localStorage.getItem(draftKey)!)).toMatchObject({ projectSentence: 'Updated project', summary: 'First line\nSecond line', status: 'partial' });
});

it('blocks missing required answers and malformed URLs before advancing', async () => {
  await mount({ ...initialValues, projectSentence: '' });
  await click('Next');
  expect(progress()).toBe('1');
  expect(active().querySelector('[role="alert"]')).toBeTruthy();
  await type('A useful project');
  for (let i = 0; i < 4; i++) await click('Next');
  await click('Skip');
  expect(progress()).toBe('6');
  const url = await type('not-a-url');
  expect(url.validity.typeMismatch).toBe(true);
  await click('Next');
  expect(progress()).toBe('6');
  await type('https://example.com');
  await click('Next');
  expect(progress()).toBe('7');
});

it('skips optional answers and publishes the original fields, retaining drafts after server failure', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, text: async () => 'Please retry.' });
  vi.stubGlobal('fetch', fetchMock);
  await mount();
  await type('Updated project');
  for (let i = 0; i < 4; i++) await click('Next');
  await type('Discard this feedback');
  await click('Skip');
  await click('Skip');
  await click('Next');
  expect(progress()).toBe('8');
  await click('Skip and publish update');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const body = fetchMock.mock.calls[0][1].body as FormData;
  expect(Object.fromEntries(body)).toEqual({ commitmentId: '2', projectSentence: 'Updated project', summary: 'Shipped a demo', status: 'complete', nextPromise: 'Launch the demo', projectStage: 'idea' });
  expect(container.querySelector('[data-form-status]')!.textContent).toBe('Please retry.');
  expect(JSON.parse(localStorage.getItem(draftKey)!)).toMatchObject({ feedbackRequest: '', projectSentence: 'Updated project' });
});

it('keeps the initial answers usable when the saved draft is malformed', async () => {
  localStorage.setItem(draftKey, '{broken json');
  await mount();
  expect(active().querySelector('textarea')!.value).toBe(initialValues.projectSentence);
  expect(container.querySelector('[role="status"]')!.textContent).toBe('Draft saving is unavailable. Keep this tab open.');
  await type('Recovered project');
  expect(JSON.parse(localStorage.getItem(draftKey)!)).toMatchObject({ projectSentence: 'Recovered project' });
  await click('Next');
  expect(progress()).toBe('2');
});

it('allows editing and navigation when browser storage is unavailable', async () => {
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  try {
    await mount();
    expect(container.querySelector('[role="status"]')!.textContent).toBe('Draft saving is unavailable. Keep this tab open.');
    await type('Unsaved project');
    expect(container.querySelector('[role="status"]')!.textContent).toBe('Draft could not be saved. Keep this tab open.');
    await click('Next');
    await click('Previous');
    expect(active().querySelector('textarea')!.value).toBe('Unsaved project');
  } finally {
    get.mockRestore();
    set.mockRestore();
  }
});
