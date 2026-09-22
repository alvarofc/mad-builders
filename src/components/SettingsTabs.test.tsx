// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import SettingsTabs from './SettingsTabs';

it('opens linked sections, isolates danger actions and preserves edits across tabs', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState(null, '', '#socials');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<SettingsTabs profile={<input defaultValue="Project" />} socials="Accounts" team="Owners" updates="History" danger={<button>take project offline</button>} />));
    const visible = () => container.querySelector('[role="tabpanel"]:not([hidden])')!;
    expect(visible().textContent).toBe('Accounts');
    expect(visible().textContent).not.toContain('take project offline');
    const input = container.querySelector('input')!;
    input.value = 'Unsaved edit';
    const danger = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(el => el.textContent === 'Danger zone')!;
    await act(async () => { danger.focus(); });
    expect(visible().textContent).toBe('take project offline');
    expect(window.location.hash).toBe('#danger');
    await act(async () => {
      window.location.hash = '#profile';
      window.dispatchEvent(new Event('hashchange'));
    });
    expect(visible().querySelector('input')?.value).toBe('Unsaved edit');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    window.history.replaceState(null, '', '/');
  }
});
