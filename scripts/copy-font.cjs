#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

try {
  const src = path.join(process.cwd(), 'node_modules', '@fontsource', 'inter', 'files', 'inter-latin-700-normal.woff2');
  if (!fs.existsSync(src)) {
    console.log('[postinstall] @fontsource/inter not found; skipping font copy');
    process.exit(0);
  }
  const destDir = path.join(process.cwd(), 'public', 'fonts');
  ensureDir(destDir);
  const dest = path.join(destDir, 'sr-embedded.woff2');
  fs.copyFileSync(src, dest);
  console.log('[postinstall] Copied Inter 700 WOFF2 to public/fonts/sr-embedded.woff2');
} catch (e) {
  console.warn('[postinstall] Failed to copy font:', e && e.message ? e.message : e);
}
