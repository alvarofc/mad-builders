import sharp from 'sharp';

export async function readLogo(data: FormData): Promise<string | null | undefined> {
  const file = data.get('logo');
  if (file !== null && typeof file === 'string') throw new Error('Choose an image file for your logo.');
  if (file?.size) {
    if (data.get('resetLogo') === '1') throw new Error('Choose an upload or the website favicon, not both.');
    if (file.size > 2 * 1024 * 1024) throw new Error('Keep your logo under 2 MB.');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      throw new Error('Upload a PNG, JPEG or WebP image.');
    }
    try {
      const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 16 * 1024 * 1024 });
      const metadata = await image.metadata();
      if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '')) throw new Error('invalid_image');
      // ponytail: store a bounded thumbnail inline; use object storage if logos need larger sizes.
      const logo = await image.rotate().resize(128, 128, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
      return `data:image/webp;base64,${logo.toString('base64')}`;
    } catch {
      throw new Error('Could not read that image. Upload a PNG, JPEG or WebP up to 16 megapixels.');
    }
  }
  return data.get('resetLogo') === '1' ? null : undefined;
}
