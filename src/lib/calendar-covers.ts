import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Discover originals automatically; generated thumbnails never replace them.
const publicCovers = readdirSync('public/events')
  .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
  .map((name) => ({ key: `/events/${name}`, path: resolve('public/events', name) }));
const communityCovers = readdirSync('src/assets/events', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap(({ name: slug }) => readdirSync(`src/assets/events/${slug}`)
    .filter((name) => /^cover\.(jpe?g|png)$/i.test(name))
    .map((name) => ({ key: `community:${slug}`, path: resolve('src/assets/events', slug, name) })));

export const calendarCovers = [...publicCovers, ...communityCovers].map((cover) => ({
  ...cover,
  id: createHash('sha256').update(readFileSync(cover.path)).digest('hex').slice(0, 20),
}));

export const thumbnailWidths = [160, 320, 480];
export const thumbnailUrl = (id: string, width: number) => `/calendar-covers/${id}-${width}.png`;

export function calendarThumbnail(key?: string) {
  const cover = calendarCovers.find((entry) => entry.key === key);
  if (!cover) return undefined; // Remote images retain their original URL.
  return {
    src: thumbnailUrl(cover.id, thumbnailWidths[0]),
    srcset: thumbnailWidths.map((width, index) => `${thumbnailUrl(cover.id, width)} ${index + 1}x`).join(', '),
  };
}
