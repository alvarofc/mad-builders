import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { calendarCovers, thumbnailUrl, thumbnailWidths } from '../../lib/calendar-covers';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = () => {
  const uniqueCovers = [...new Map(calendarCovers.map((cover) => [cover.id, cover])).values()];
  return uniqueCovers.flatMap(({ id, path }) => thumbnailWidths.map((width) => ({
    params: { cover: thumbnailUrl(id, width).split('/').pop()!.replace(/\.png$/, '') },
    props: { id, path, width },
  })));
};

export const GET: APIRoute = async ({ props }) => {
  // Reuse Vercel's restored Astro cache. Bump v1 when the transform changes.
  const directory = 'node_modules/.astro/calendar-covers';
  const cache = `${directory}/${props.id}-${props.width}-${sharp.versions.sharp}-v1.png`;
  let image: Buffer;
  try {
    image = await readFile(cache);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    image = await sharp(props.path)
      .rotate()
      .resize({ width: props.width, kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
    await mkdir(directory, { recursive: true });
    await writeFile(cache, image);
  }
  return new Response(new Uint8Array(image), { headers: { 'Content-Type': 'image/png' } });
};
