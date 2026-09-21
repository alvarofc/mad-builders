// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

it('closes the mobile navigation on same-page links without preventing navigation', () => {
  document.body.innerHTML = '<details class="product-nav-menu" open><summary>Menu</summary><a href="#this-week">This week</a></details>';
  const source = readFileSync('src/layouts/ProductLayout.astro', 'utf8');
  const script = source.split('<script>')[1].split('</script>')[0];
  runInNewContext(stripTypeScriptTypes(script), { document });
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  document.querySelector('a')!.dispatchEvent(click);
  expect(document.querySelector('details')!.open).toBe(false);
  expect(click.defaultPrevented).toBe(false);
  document.body.innerHTML = '';
});
