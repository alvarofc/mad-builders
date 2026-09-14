import { expect, it } from 'vitest';
import sharp from 'sharp';
import { readLogo } from './project-logo';

it('preserves, resets, validates and resizes uploaded logos', async () => {
  const data = new FormData();
  expect(await readLogo(data)).toBeUndefined();
  data.set('logo', new Blob([]), '');
  expect(await readLogo(data)).toBeUndefined();
  data.set('resetLogo', '1');
  expect(await readLogo(data)).toBeNull();
  data.delete('resetLogo');
  const bytes = await sharp({ create: { width: 400, height: 200, channels: 4, background: '#ff000080' } }).png().toBuffer();
  data.set('logo', new Blob([new Uint8Array(bytes)], { type: 'image/png' }), 'logo.png');
  const logo = await readLogo(data);
  expect(logo).toMatch(/^data:image\/webp;base64,/);
  expect(await sharp(Buffer.from(logo!.split(',')[1], 'base64')).metadata()).toMatchObject({ format: 'webp', width: 128, height: 64 });
  data.set('resetLogo', '1');
  await expect(readLogo(data)).rejects.toThrow('not both');
  data.delete('resetLogo');
  for (const [body, type] of [['broken', 'image/png'], ['<svg></svg>', 'image/svg+xml'], ['x'.repeat(2 * 1024 * 1024 + 1), 'image/png']]) {
    data.set('logo', new Blob([body], { type }), 'logo');
    await expect(readLogo(data)).rejects.toThrow();
  }
  data.set('logo', 'https://example.com/logo.png');
  await expect(readLogo(data)).rejects.toThrow('Choose an image file');
});

it('accepts JPEG and WebP without upscaling and rejects disguised formats and excessive dimensions', async () => {
  const data = new FormData();
  for (const format of ['jpeg', 'webp'] as const) {
    const bytes = await sharp({ create: { width: 32, height: 16, channels: 3, background: '#ff0000' } })[format]().toBuffer();
    data.set('logo', new Blob([new Uint8Array(bytes)], { type: `image/${format}` }), `logo.${format}`);
    const logo = await readLogo(data);
    expect(await sharp(Buffer.from(logo!.split(',')[1], 'base64')).metadata()).toMatchObject({ format: 'webp', width: 32, height: 16 });
  }
  for (const bytes of [
    await sharp({ create: { width: 1, height: 1, channels: 3, background: '#ff0000' } }).gif().toBuffer(),
    await sharp({ create: { width: 4097, height: 4096, channels: 3, background: '#ff0000' } }).png().toBuffer(),
  ]) {
    data.set('logo', new Blob([new Uint8Array(bytes)], { type: 'image/png' }), 'disguised.png');
    await expect(readLogo(data)).rejects.toThrow('Could not read that image');
  }
});
