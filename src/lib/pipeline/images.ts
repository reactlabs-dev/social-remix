import sharp from 'sharp';
import { buildOverlaySvg } from './overlay';
import fs from 'node:fs/promises';
import path from 'node:path';

export type AspectKey = '1x1' | '9x16' | '16x9';

export const AspectDimensions: Record<AspectKey, { w: number; h: number }> = {
  '1x1': { w: 1080, h: 1080 },
  '9x16': { w: 1080, h: 1920 },
  '16x9': { w: 1920, h: 1080 },
};

export interface RenderOptions {
  aspect: AspectKey;
  message: string;
  locale: string;
  theme: { primary: string; text?: string; bg?: string };
  disclaimer?: string;
  logoPath?: string; // path under public/
  format: 'png' | 'jpeg';
}

export async function renderCreative(
  baseImage: Buffer,
  opts: RenderOptions
): Promise<Buffer> {
  const { w, h } = AspectDimensions[opts.aspect];
  const svg = buildOverlaySvg({
    width: w,
    height: h,
    message: opts.message,
    locale: opts.locale,
    disclaimer: opts.disclaimer,
    theme: opts.theme,
  });
  const svgBuf = Buffer.from(svg, 'utf8');

  // Load logo if provided
  let logoBuf: Buffer | undefined;
  if (opts.logoPath) {
    const abs = path.join(process.cwd(), 'public', opts.logoPath);
    try {
      logoBuf = await fs.readFile(abs);
    } catch {
      // ignore
    }
  }

  const base = sharp(baseImage).resize(w, h, { fit: 'cover', position: 'entropy' });

  const composites: sharp.OverlayOptions[] = [{ input: svgBuf, top: 0, left: 0 }];
  if (logoBuf) {
    // Resize logo for better visibility; target ~160px width
    const resizedLogo = await sharp(logoBuf).resize({ width: 160 }).png().toBuffer();
    composites.push({ input: resizedLogo, top: 24, left: 24 });
  }

  const image = await base.composite(composites)[opts.format]({ quality: 90 }).toBuffer();
  return image;
}
