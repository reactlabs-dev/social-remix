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
  const embeddedFontDataUri = await getEmbeddedFontDataUri();
  const svg = buildOverlaySvg({
    width: w,
    height: h,
    message: opts.message,
    locale: opts.locale,
    disclaimer: opts.disclaimer,
    theme: opts.theme,
    embeddedFontDataUri,
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

  // Rasterize SVG with resvg for robust text rendering regardless of system fonts
  let overlayRaster: Buffer;
  try {
    const { Resvg } = await import('@resvg/resvg-js');
    const resvg = new Resvg(svg, { fitTo: { mode: 'original' } });
    const pngData = resvg.render().asPng();
    overlayRaster = Buffer.from(pngData);
  } catch {
    // Fallback to sharp-based rasterization if resvg is unavailable
    overlayRaster = await sharp(svgBuf)
      .resize(w, h, { fit: 'fill' })
      .png()
      .toBuffer();
  }
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

// Cache for embedded font to avoid repeated disk reads
let CACHED_EMBEDDED_FONT_DATA_URI: string | undefined | null = null;

async function getEmbeddedFontDataUri(): Promise<string | undefined> {
  if (CACHED_EMBEDDED_FONT_DATA_URI !== null) return CACHED_EMBEDDED_FONT_DATA_URI || undefined;
  // 1) Prefer explicit env var if provided
  const fromEnv = process.env.SR_EMBEDDED_FONT_DATA_URI;
  if (fromEnv && fromEnv.startsWith('data:')) {
    CACHED_EMBEDDED_FONT_DATA_URI = fromEnv;
    return fromEnv;
  }
  // 2) Otherwise, try reading a font from disk if present
  const candidatePath = process.env.SR_EMBEDDED_FONT_PATH || path.join(process.cwd(), 'public', 'fonts', 'sr-embedded.woff2');
  try {
    const buf = await fs.readFile(candidatePath);
    const base64 = buf.toString('base64');
    const dataUri = `data:font/woff2;base64,${base64}`;
    CACHED_EMBEDDED_FONT_DATA_URI = dataUri;
    return dataUri;
  } catch {
    // Not found in public/. Next, try a bundled font from node_modules (via @fontsource)
    try {
      const nmPath = path.join(process.cwd(), 'node_modules', '@fontsource', 'inter', 'files', 'inter-latin-700-normal.woff2');
      const buf = await fs.readFile(nmPath);
      const base64 = buf.toString('base64');
      const dataUri = `data:font/woff2;base64,${base64}`;
      CACHED_EMBEDDED_FONT_DATA_URI = dataUri;
      return dataUri;
    } catch {}
    // 3) Last resort: fetch a small, open font from CDN and embed (cached per cold start)
    try {
      const url = process.env.SR_EMBEDDED_FONT_URL || 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.0/files/inter-latin-700-normal.woff2';
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 4000);
      const resp = await fetch(url, { signal: ac.signal });
      clearTimeout(t);
      if (resp.ok) {
        const arr = new Uint8Array(await resp.arrayBuffer());
        const base64 = Buffer.from(arr).toString('base64');
        const dataUri = `data:font/woff2;base64,${base64}`;
        CACHED_EMBEDDED_FONT_DATA_URI = dataUri;
        return dataUri;
      }
    } catch {}
    CACHED_EMBEDDED_FONT_DATA_URI = '';
    return undefined;
  }
}
