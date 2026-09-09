import { expect, it, vi } from 'vitest';

const { files, encode } = vi.hoisted(() => ({
  files: new Map<string, Buffer>(),
  encode: vi.fn(async () => Buffer.from('thumbnail')),
}));
vi.mock('./calendar-covers', () => ({ calendarCovers: [], thumbnailWidths: [], thumbnailUrl: vi.fn() }));
vi.mock('node:fs/promises', () => ({
  readFile: async (path: string) => {
    if (!files.has(path)) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    return files.get(path);
  },
  mkdir: async () => {},
  writeFile: async (path: string, image: Buffer) => { files.set(path, image); },
}));
vi.mock('sharp', () => ({
  default: Object.assign(() => ({
    rotate() { return this; }, resize() { return this; }, png() { return this; }, toBuffer: encode,
  }), { kernel: { lanczos3: 'lanczos3' }, versions: { sharp: 'test' } }),
}));
import { GET } from '../pages/calendar-covers/[cover].png';

it('reuses thumbnails and regenerates them when the source hash or width changes', async () => {
  const render = (id: string, width: number) => GET({ props: { id, width, path: 'cover.jpeg' } } as Parameters<typeof GET>[0]);
  const first = await render('original', 160);
  const cached = await render('original', 160);
  expect(await cached.text()).toBe(await first.text());
  expect(encode).toHaveBeenCalledTimes(1);
  await render('changed', 160);
  await render('original', 320);
  expect(encode).toHaveBeenCalledTimes(3);
});
