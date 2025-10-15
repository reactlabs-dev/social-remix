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
    embeddedFontDataUri: process.env.SR_EMBEDDED_FONT_DATA_URI,
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

  // Resize base with balanced speed/quality; use fast shrink-on-load when possible
  const base = sharp(baseImage, { failOn: 'none' }).resize(w, h, { fit: 'cover', position: 'entropy', fastShrinkOnLoad: true });

  // Rasterize SVG first and force it to the exact canvas size to satisfy Sharp's composite constraints
  const overlayRaster = await sharp(svgBuf)
    .resize(w, h, { fit: 'fill' })
    .png()
    .toBuffer();
  const composites: sharp.OverlayOptions[] = [{ input: overlayRaster, top: 0, left: 0 }];
  if (logoBuf) {
    // Larger logo for stronger brand presence; cap to ~14% of canvas width
    const maxLogoWidth = Math.round(w * 0.14);
    const targetWidth = Math.max(240, Math.min(320, maxLogoWidth));
    const resizedLogo = await sharp(logoBuf).resize({ width: targetWidth }).png().toBuffer();
    composites.push({ input: resizedLogo, top: 20, left: 20 });
  }

  // Proven defaults: let sharp pick sane defaults; we only keep fast resize above
  const image = await base.composite(composites)[opts.format]({ quality: 90 }).toBuffer();
  return image;
}
