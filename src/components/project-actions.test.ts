import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const page = readFileSync(new URL('../pages/builders/[handle].astro', import.meta.url), 'utf8');

it('keeps writing, editing, and sharing inside the project owner guard', () => {
  const actions = page.match(/\{currentProfile\?\.handle === builder\.handle && \(\s*(<div class="work-actions">[\s\S]*?<\/div>)\s*\)\}/)?.[1];
  expect(actions).toBeDefined();
  for (const control of ['href="/build#this-week"', 'href="/settings"', '<ShareButton']) {
    expect(actions).toContain(control);
    expect(page.replace(actions!, '')).not.toContain(control);
  }
});
