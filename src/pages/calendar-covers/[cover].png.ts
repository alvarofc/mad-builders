import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import { calendarCovers, thumbnailUrl, thumbnailWidths } from '../../lib/calendar-covers';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = () => {
  const uniqueCovers = [...new Map(calendarCovers.map((cover) => [cover.id, cover])).values()];
  return uniqueCovers.flatMap(({ id, path }) => thumbnailWidths.map((width) => ({
    params: { cover: thumbnailUrl(id, width).split('/').pop()!.replace(/\.png$/, '') },
    props: { path, width },
  })));
};

export const GET: APIRoute = async ({ props }) => {
  const image = await sharp(props.path)
    .rotate()
    .resize({ width: props.width, kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  return new Response(new Uint8Array(image), { headers: { 'Content-Type': 'image/png' } });
};
