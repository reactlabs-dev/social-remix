#!/usr/bin/env tsx
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
// Load env first so downstream modules read correct values
dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    args.set(process.argv[i], process.argv[i + 1]);
  }
  // Optional: custom env file path
  const envPath = args.get('--env');
  if (envPath) {
    dotenv.config({ path: envPath });
  }
  const briefPath = args.get('--brief') || 'briefs/sample.campaign.json';
  const assetsDir = args.get('--assets');
  const locale = args.get('--locale') || 'en';

  const briefJson = JSON.parse(await fs.readFile(briefPath, 'utf8'));

  const files: Record<string, Buffer> = {};
  if (assetsDir) {
    const full = path.resolve(assetsDir);
    const entries = await fs.readdir(full);
    for (const e of entries) {
      const stat = await fs.stat(path.join(full, e));
      if (stat.isFile()) {
        files[e] = await fs.readFile(path.join(full, e));
      }
    }
  }

  // Import after dotenv so env vars are available during module init
  const { runPipeline } = await import('../src/lib/pipeline');
  const manifest = await runPipeline({ brief: briefJson, locale, files });
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((e) => {
  console.error('[pipeline] failed', e);
  process.exit(1);
});
