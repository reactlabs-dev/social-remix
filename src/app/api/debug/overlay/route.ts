import { NextRequest } from 'next/server';
import { buildOverlaySvg } from '@/lib/pipeline/overlay';
import { AspectDimensions } from '@/lib/pipeline/images';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const aspect = (searchParams.get('aspect') || '1x1') as '1x1' | '9x16' | '16x9';
  const msg = searchParams.get('msg') || 'Hello from Social Remix';
  const disclaimer = searchParams.get('disc') || 'debug overlay';
  const format = (searchParams.get('format') || 'svg').toLowerCase();
  const { w, h } = AspectDimensions[aspect] || AspectDimensions['1x1'];

  // Attempt to reuse our embedded font logic by following the same env conventions
  const embeddedFontDataUri = process.env.SR_EMBEDDED_FONT_DATA_URI;

  const svg = buildOverlaySvg({
    width: w,
    height: h,
    message: msg,
    locale: 'en',
    disclaimer,
    theme: { primary: '#a13a5a', text: 'auto', bg: 'transparent' },
    embeddedFontDataUri,
  });

  if (format === 'png') {
    const { Resvg } = await import('@resvg/resvg-js');
    const resvg = new Resvg(svg, { fitTo: { mode: 'original' } });
    const png = resvg.render().asPng();
    return new Response(Buffer.from(png), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    });
  }

  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
