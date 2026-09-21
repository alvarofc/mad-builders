// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

it('dismisses mobile navigation on links, Escape and outside clicks while preserving focus', () => {
  document.body.innerHTML = '<details class="product-nav-menu" open><summary>Menu</summary><a href="#this-week">This week</a></details>';
  const source = readFileSync('src/layouts/ProductLayout.astro', 'utf8');
  expect(source).toContain('<details class="product-nav-menu">');
  const script = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).find(script => script.includes("'.product-nav-menu'"));
  expect(script).toBeDefined();
  runInNewContext(stripTypeScriptTypes(script!), { document });
  document.querySelector('a')!.focus();
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  document.querySelector('a')!.dispatchEvent(click);
  expect(document.querySelector('details')!.open).toBe(false);
  expect(click.defaultPrevented).toBe(false);
  expect(document.activeElement).toBe(document.querySelector('summary'));
  const menu = document.querySelector('details')!;
  menu.open = true;
  document.querySelector('a')!.focus();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
  expect(menu.open).toBe(false);
  expect(document.activeElement).toBe(document.querySelector('summary'));
  menu.open = true;
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  outside.click();
  expect(menu.open).toBe(false);
  expect(document.activeElement).toBe(outside);
  document.body.innerHTML = '';
});
