import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { renderProfileOg, renderResultOg, summaryLines } from '../server/og';

vi.mock('../styles/global.css?raw', async () => {
  const { readFileSync } = await import('node:fs');
  return { default: readFileSync(new URL('../styles/global.css', import.meta.url), 'utf8') };
});

const component = readFileSync(new URL('../components/ShareButton.astro', import.meta.url), 'utf8');
const script = stripTypeScriptTypes(component.split('<script>')[1].split('</script>')[0]
  .replace(/^\s*import .*;$/gm, ''));

it('shares edited captions through social links and copies posts or links without native sharing', async () => {
  for (const fail of [false, true]) {
    const handlers: Record<string, () => Promise<void>> = {};
    const caption = { value: 'This week I shipped A&B exports. 🚀', addEventListener: vi.fn() };
    const status = { textContent: '' };
    const networks = ['x', 'linkedin', 'whatsapp'].map((social) => ({ dataset: { social }, href: '', addEventListener: vi.fn() }));
    const writeText = vi.fn(async () => { if (fail) throw new Error('Denied'); });
    const track = vi.fn();
    const panel = {
      dataset: { path: '/builders/ana?ref=ana', event: 'builder_profile_shared', handle: 'ana' },
      querySelectorAll: () => networks,
      querySelector: (selector: string) => {
        if (selector === '[data-share-caption]') return caption;
        if (selector === '[data-share-status]') return status;
        return { addEventListener: (_: string, fn: () => Promise<void>) => { handlers[selector] = fn; } };
      },
    };
    runInNewContext(script, {
      document: { querySelectorAll: () => [panel] },
      window: { location: { origin: 'https://mad.builders' } },
      navigator: { clipboard: { writeText } }, URL, track,
    });
    const url = 'https://mad.builders/builders/ana?ref=ana';
    caption.value = 'Edited progress & feedback?';
    caption.addEventListener.mock.calls[0][1]();
    expect(new URL(networks[0].href).searchParams.get('text')).toBe(caption.value);
    expect(new URL(networks[0].href).searchParams.get('url')).toBe(url);
    expect(new URL(networks[1].href).searchParams.get('url')).toBe(url);
    expect(new URL(networks[2].href).searchParams.get('text')).toBe(`${caption.value}\n\n${url}`);
    await handlers['[data-copy-post]']();
    expect(writeText).toHaveBeenLastCalledWith(`${caption.value}\n\n${url}`);
    await handlers['[data-copy-link]']();
    expect(writeText).toHaveBeenLastCalledWith(url);
    if (fail) {
      expect(track).not.toHaveBeenCalled();
      expect(status.textContent).toContain('Could not copy.');
    } else expect(status.textContent).toBe('Link copied.');
  }
});

it('wraps card summaries without losing short text or splitting Unicode characters, and marks overflow', () => {
  const summary = 'This week I added CSV exports and fixed the import bug. Please try it with a messy spreadsheet.';
  expect(summaryLines(summary).join(' ')).toBe(summary);
  expect(summaryLines('  shipped\n\n today  ')).toEqual(['shipped today']);
  expect(summaryLines('')).toEqual([]);
  expect(summaryLines('🚀'.repeat(90)).join('')).toBe('🚀'.repeat(90));
  const long = summaryLines('W'.repeat(300));
  expect(long).toHaveLength(4);
  expect(long.every((line) => Array.from(line).length <= 42)).toBe(true);
  expect(long[3].endsWith('…')).toBe(true);
});


it('embeds a project logo in both cards and still renders when the logo service fails', async () => {
  const logo = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#ff0000' } }).png().toBuffer();
  const fetchLogo = vi.fn(async (_url: string, _options: RequestInit) => new Response(new Uint8Array(logo)));
  vi.stubGlobal('fetch', fetchLogo);
  try {
    const project = { displayName: 'Ana', projectName: 'Example', handle: 'ana' };
    const cards = [
      await renderProfileOg({ ...project, projectUrl: 'https://example.com/private?token=hidden' }),
      await renderResultOg({ ...project, summary: 'Shipped exports.', status: 'complete', weekStartDate: '2026-09-07', proofStatus: 'proof_linked', streak: 1, projectUrlAtPublish: 'https://example.com' }),
    ];
    expect(fetchLogo.mock.calls[0][0]).toBe('https://www.google.com/s2/favicons?domain=example.com&sz=128');
    for (const card of cards) {
      const pixel = await sharp(card).extract({ left: 1088, top: 464, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
      expect([...pixel]).toEqual([255, 0, 0]);
    }
    fetchLogo.mockRejectedValueOnce(new Error('Offline'));
    const fallback = await renderProfileOg({ ...project, projectUrl: 'https://example.com' });
    expect(await sharp(fallback).metadata()).toMatchObject({ width: 1200, height: 630, format: 'png' });
  } finally {
    vi.unstubAllGlobals();
  }
});

it('puts company descriptions in both OG cards', async () => {
  const builder = { displayName: 'Ana', projectName: 'Example', handle: 'ana' };
  const result = { ...builder, summary: 'Shipped exports.', status: 'complete', weekStartDate: '2026-09-07', proofStatus: 'proof_linked', streak: 1 };
  const description = 'A simple way to export your invoices.';
  for (const [withDescription, withoutDescription] of [
    [await renderProfileOg({ ...builder, bio: description }), await renderProfileOg(builder)],
    [await renderResultOg({ ...result, projectSentence: description }), await renderResultOg(result)],
  ]) {
    const region = { left: 72, top: 245, width: 1000, height: 160 };
    const actual = await sharp(withDescription).extract(region).raw().toBuffer();
    const empty = await sharp(withoutDescription).extract(region).raw().toBuffer();
    expect(actual.equals(empty)).toBe(false);
  }
});

it('positions the popover above a low trigger and keeps it inside the viewport', () => {
  let toggle!: () => void;
  const popover = {
    style: {} as Record<string, string>, offsetWidth: 480, offsetHeight: 400,
    matches: () => true,
    addEventListener: (_: string, callback: () => void) => { toggle = callback; },
  };
  const trigger = { getBoundingClientRect: () => ({ left: 900, top: 650, bottom: 694 }) };
  const positioning = script.slice(script.indexOf('const popover ='), script.indexOf('const caption ='));
  runInNewContext(positioning, {
    panel: { querySelector: (selector: string) => selector === '[popover]' ? popover : trigger },
    window: { innerWidth: 1024, innerHeight: 768, addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
  toggle();
  expect(popover.style.left).toBe('532px');
  expect(popover.style.top).toBe('242px');
  expect(popover.style.maxHeight).toBe('634px');
});

it('positions below a high trigger and removes viewport listeners when closed', () => {
  let toggle!: () => void;
  let open = true;
  const popover = {
    style: {} as Record<string, string>, offsetWidth: 340, offsetHeight: 300,
    matches: () => open,
    addEventListener: (_: string, callback: () => void) => { toggle = callback; },
  };
  const trigger = { getBoundingClientRect: () => ({ left: 4, top: 40, bottom: 84 }) };
  const viewport = { innerWidth: 1024, innerHeight: 768, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const positioning = script.slice(script.indexOf('const popover ='), script.indexOf('const caption ='));
  runInNewContext(positioning, {
    panel: { querySelector: (selector: string) => selector === '[popover]' ? popover : trigger },
    window: viewport,
  });
  toggle();
  expect(popover.style.left).toBe('12px');
  expect(popover.style.top).toBe('92px');
  expect(popover.style.maxHeight).toBe('668px');
  expect(viewport.addEventListener.mock.calls.map(([event]) => event)).toEqual(['resize', 'scroll']);
  open = false;
  toggle();
  expect(viewport.removeEventListener.mock.calls).toEqual(viewport.addEventListener.mock.calls);
});
