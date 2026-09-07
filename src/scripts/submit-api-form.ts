import { track } from '@vercel/analytics';

export async function submitApiForm(form: HTMLFormElement, draftKey?: string, startedAt = Date.now()) {
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const formStatus = form.querySelector<HTMLElement>('[data-form-status]');
  if (submit) submit.disabled = true;
  if (formStatus) formStatus.textContent = 'Saving...';

  try {
    const response = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
    });

    if (response.ok) {
      const sessionExpired = new URL(response.url, window.location.origin).pathname.replace(/\/$/, '') === '/build';
      if (draftKey && !sessionExpired) {
        try { localStorage.removeItem(draftKey); } catch {}
        track('weekly_update_published', { seconds: Math.round((Date.now() - startedAt) / 1000) });
      }
      if (draftKey && sessionExpired) {
        if (formStatus) formStatus.textContent = 'Your session expired. Sign in in another tab, then retry. Your draft is saved here.';
        return;
      }
      window.location.assign(response.url || '/build');
      return;
    }

    if (formStatus) formStatus.textContent = await response.text();
  } catch {
    if (formStatus) formStatus.textContent = 'Could not save. Try again.';
  } finally {
    if (submit) submit.disabled = false;
  }
}
