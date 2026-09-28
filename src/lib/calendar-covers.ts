import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Discover originals automatically; generated thumbnails never replace them.
const publicCovers = readdirSync('public/events')
  .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
  .map((name) => ({ key: `/events/${name}`, path: resolve('public/events', name) }));
// Let Vite track added, removed and replaced covers so the calendar updates in dev too.
const communityCoverAssets = import.meta.glob('../assets/events/*/cover.{jpeg,jpg,png}', {
  eager: true,
  import: 'default',
});
const communityCovers = Object.keys(communityCoverAssets).map((file) => ({
  key: `community:${file.split('/').at(-2)}`,
  path: resolve('src/lib', file),
}));

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
