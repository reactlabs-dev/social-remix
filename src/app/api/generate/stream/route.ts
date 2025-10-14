import { NextRequest } from 'next/server';
import { runPipeline } from '@/lib/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple SSE stream that generates one product at a time and pushes partial manifests
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const briefFile = form.get('brief');
  const locale = (form.get('locale') as string) || 'en';
  if (!briefFile || !(briefFile instanceof File)) {
    return new Response('bad request', { status: 400 });
  }
  const briefJson = JSON.parse(await (briefFile as File).text());

  // Collect images into a map
  const files: Record<string, Buffer> = {};
  for (const [key, val] of form.entries()) {
    if (key.startsWith('image_') && val instanceof File) {
      const buf = Buffer.from(await val.arrayBuffer());
      files[val.name] = buf;
    }
  }

  // Create readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      function send(event: string, data: unknown) {
        controller.enqueue(enc.encode(`event: ${event}\n`));
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      }
      try {
        const products = Array.isArray(briefJson?.products) ? briefJson.products as Array<{ id: string }> : [];
        send('init', { ok: true });
        for (const p of products) {
          send('progress', { productId: p.id, status: 'started' });
          try {
            const partial = await runPipeline({ brief: briefJson, locale, files, productIds: [p.id] });
            // emit the per-product manifest so the client can render variants immediately
            send('product', { productId: p.id, manifest: partial });
          } catch (e: unknown) {
            const msg = typeof e === 'object' && e && 'message' in e ? String((e as { message?: string }).message) : 'failed';
            send('error', { productId: p.id, message: msg });
          }
        }
      } catch (e: unknown) {
        const msg = typeof e === 'object' && e && 'message' in e ? String((e as { message?: string }).message) : 'stream failed';
        send('error', { message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
