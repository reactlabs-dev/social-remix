// filepath: /Users/jwdev/code/social-remix/src/app/api/ping/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ ok: true, method: 'GET', ts: Date.now() });
}

export async function POST(req: Request) {
  const ct = req.headers.get('content-type') || '';
  let body: unknown = null;
  try {
    if (ct.includes('application/json')) {
      body = await req.json();
    } else if (ct.includes('multipart/form-data')) {
      const fd = await req.formData();
      const entries: Record<string, string> = {};
      for (const [k, v] of fd.entries()) {
        entries[k] = typeof v === 'string' ? v : (v as File).name || 'file';
      }
      body = entries;
    } else {
      body = await req.text();
    }
  } catch {
    body = 'parse-error';
  }
  return Response.json({ ok: true, method: 'POST', ct, body, ts: Date.now() });
}
