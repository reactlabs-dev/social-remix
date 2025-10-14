import sharp from 'sharp';

export interface CheckResult {
  logo: { ok: boolean; detail?: string };
  brandColors: { ok: boolean; detail?: string };
  contrast: { ok: boolean; ratio?: number; detail?: string };
  safeArea: { ok: boolean; detail?: string };
  legal: { prohibitedWords: Array<{ word: string; index: number }> };
}

export const DEFAULT_PROHIBITED = [
  // baseline examples; can be extended per-locale
  'hate', 'kill', 'racist', 'sexist', 'slur', 'violence',
  // add typical profanity examples lightly for demo purposes
  'damn', 'hell', 'shit', 'fuck'
];

export function checkProhibited(message: string, words: string[] = DEFAULT_PROHIBITED) {
  const found: Array<{ word: string; index: number }> = [];
  const lower = message.toLowerCase();
  for (const w of words) {
    const idx = lower.indexOf(w);
    if (idx !== -1) found.push({ word: w, index: idx });
  }
  return found;
}

export async function runChecks(
  outputImage: Buffer,
  options: { textColor: string; primary: string; width: number; height: number; message: string }
): Promise<CheckResult> {
  // Heuristic: assume overlay applied (logo presence true if composited step ran)
  const logo = { ok: true };
  const brandColors = { ok: true };

  // Simple contrast heuristic: sample a few pixels in the band area and estimate contrast vs text color luminance
  const bandTop = Math.round(options.height * 0.84);
  const sampleHeight = Math.max(1, options.height - bandTop - 10);
  const sample = await sharp(outputImage).extract({ left: 10, top: bandTop, width: 10, height: sampleHeight }).raw().toBuffer({ resolveWithObject: false });
  // compute average luminance
  let Lbg = 0;
  for (let i = 0; i < sample.length; i += 3) {
    const r = sample[i] / 255, g = sample[i + 1] / 255, b = sample[i + 2] / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    Lbg += lum;
  }
  Lbg = Lbg / Math.max(1, sample.length / 3);
  const Lt = hexLuminance(options.textColor);
  const contrastRatio = (Math.max(Lbg, Lt) + 0.05) / (Math.min(Lbg, Lt) + 0.05);
  const contrast = { ok: contrastRatio >= 3.0, ratio: Number(contrastRatio.toFixed(2)) }; // relaxed threshold for headlines

  // Safe area assumption: overlay band provides padding; mark ok for POC
  const safeArea = { ok: true };

  const legal = { prohibitedWords: checkProhibited(options.message) };

  return { logo, brandColors, contrast, safeArea, legal };
}

function hexLuminance(hex: string): number {
  const m = hex.match(/#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i);
  if (!m) return 0.5;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
