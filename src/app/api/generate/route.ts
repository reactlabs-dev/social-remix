import { runPipeline } from '@/lib/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const form = await req.formData();
  const briefFile = form.get('brief');
  const locale = (form.get('locale') as string) || 'en';
  if (!briefFile || !(briefFile instanceof File)) {
    return Response.json({ error: 'brief file is required' }, { status: 400 });
  }
  const briefJson = JSON.parse(await briefFile.text());

  // Collect images
  const files: Record<string, Buffer> = {};
  for (const [key, val] of form.entries()) {
    if (key.startsWith('image_') && val instanceof File) {
      const buf = Buffer.from(await val.arrayBuffer());
      files[val.name] = buf;
    }
  }

  try {
    const manifest = await runPipeline({ brief: briefJson, locale, files });
    return Response.json(manifest, { status: 200 });
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message || 'pipeline failed';
    return Response.json({ error: msg }, { status: 500 });
  }
}

// Helpful for Vercel to confirm the route exists; browsers may hit it accidentally
export async function GET() {
  return Response.json({ error: 'Use POST with multipart/form-data' }, { status: 405 });
}

// Allow OPTIONS so some clients won’t misinterpret routing; not strictly required for same-origin
export async function OPTIONS() {
  return new Response(JSON.stringify({ ok: true, allow: 'POST' }), { status: 200, headers: { 'Allow': 'POST', 'Content-Type': 'application/json' } });
}
