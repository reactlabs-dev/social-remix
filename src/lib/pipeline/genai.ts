export async function generateHeroImage(prompt: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  const resp = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024'
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI image generation failed: ${resp.status} ${text}`);
  }
  const json = await resp.json();
  const item = json?.data?.[0];
  if (!item) throw new Error('OpenAI image generation failed: empty data array');
  if (item.b64_json) {
    return Buffer.from(item.b64_json as string, 'base64');
  }
  if (item.url) {
    const imgResp = await fetch(item.url as string);
    if (!imgResp.ok) {
      const t = await imgResp.text();
      throw new Error(`OpenAI image download failed: ${imgResp.status} ${t}`);
    }
    const arr = await imgResp.arrayBuffer();
    return Buffer.from(arr);
  }
  throw new Error('OpenAI image generation failed: no b64_json or url in response');
}
