import { Brief, parseBrief } from './brief';
import type { CheckResult } from './checks';
import { checkProhibited } from './checks';
import { putObject } from './storage/s3';
import { renderCreative, AspectDimensions, AspectKey } from './images';
import { getContrastingText } from './overlay';
import { generateHeroImage } from './genai';
import { runChecks } from './checks';

const BRAND: { primary: string; text: string; bg: string; logoPath: string } = {
  primary: '#a13a5a',
  text: 'auto',
  bg: 'transparent',
  logoPath: 'socialremix_logo.svg',
};

export interface VariantManifest {
  productId: string;
  productName: string;
  aspect: '1x1' | '9x16' | '16x9';
  path: string;
  url: string;
  checks: CheckResult;
  source: 'uploaded' | 'generated' | 'url';
}

export interface RunManifest {
  campaignId: string;
  locale: string;
  createdAt: string;
  variants: VariantManifest[];
  precheck?: { legal: { prohibitedWords: Array<{ word: string; index: number }> } };
  skippedGeneration?: boolean;
  skipReason?: 'prohibited-words';
}

export async function runPipeline(input: {
  brief: unknown;
  locale: string;
  files: Record<string, Buffer>;
  productIds?: string[]; // optional: restrict generation to these product IDs
}): Promise<RunManifest> {
  const brief: Brief = parseBrief(input.brief);
  if (!brief.locales.includes(input.locale)) {
    throw new Error(`Locale ${input.locale} not in brief.locales`);
  }
  const campaignId = brief.campaignId;
  const message: string = (brief.message as Record<string, string>)[input.locale] || brief.message.default;
  const disclaimer: string | undefined = brief.disclaimer;
  const format = brief.outputFormat ?? 'png';
  // Precheck: legal/prohibited words prior to any heavy work
  const preProhibited = checkProhibited(message);
  if (preProhibited.length > 0) {
    return {
      campaignId,
      locale: input.locale,
      createdAt: new Date().toISOString(),
      variants: [],
      precheck: { legal: { prohibitedWords: preProhibited } },
      skippedGeneration: true,
      skipReason: 'prohibited-words',
    };
  }

  const aspects: AspectKey[] = ['1x1', '9x16', '16x9'];
  const parallelAspects = String(process.env.PARALLEL_ASPECTS || '').toLowerCase() === 'true';

  const variants: VariantManifest[] = [];
  const products = Array.isArray(input.productIds) && input.productIds.length > 0
    ? brief.products.filter(p => input.productIds!.includes(p.id))
    : brief.products;
  for (const product of products) {
    // Resolve base image: uploaded file, imageUrl (future), or generate
    let baseImage: Buffer | undefined;
    let baseSource: 'uploaded' | 'generated' | 'url' = 'generated';
    if (product.imageFile) {
      const found = findUploadedFile(input.files, product.imageFile);
      if (found) {
        baseImage = found;
        baseSource = 'uploaded';
      }
    } else if (product.imageUrl) {
      try {
        const resp = await fetch(product.imageUrl);
        if (resp.ok) {
          const arr = new Uint8Array(await resp.arrayBuffer());
          baseImage = Buffer.from(arr);
          baseSource = 'url';
        }
      } catch {
        // ignore and fall back to generation
      }
    }
    if (!baseImage) {
      const prompt = `On-brand product hero image in maroon/pink neutrals for ${product.name}. Clean, minimal, social-ad ready.`;
      baseImage = await generateHeroImage(prompt);
      baseSource = 'generated';
    }

    if (parallelAspects) {
      const perAspect = await Promise.all(aspects.map(async (aspect) => {
        const buf = await renderCreative(baseImage!, {
          aspect,
          message,
          locale: input.locale,
          theme: { primary: BRAND.primary, text: BRAND.text, bg: BRAND.bg },
          disclaimer,
          logoPath: BRAND.logoPath,
          format,
        });

        const dims = AspectDimensions[aspect];
        const computedTextColor = BRAND.text === 'auto' ? getContrastingText(BRAND.primary) : BRAND.text;
        const checks = await runChecks(buf, {
          textColor: computedTextColor,
          primary: BRAND.primary,
          width: dims.w,
          height: dims.h,
          message,
        });
        const key = `generated/${campaignId}/${input.locale}/${product.id}/${aspect}/${safeSlug(product.name)}.${format}`;
        const uploaded = await putObject(key, buf, `image/${format}`);
        return {
          productId: product.id,
          productName: product.name,
          aspect,
          path: uploaded.key,
          url: uploaded.url,
          checks,
          source: baseSource as 'uploaded' | 'generated' | 'url',
        } as VariantManifest;
      }));
      variants.push(...perAspect);
    } else {
      for (const aspect of aspects) {
        const buf = await renderCreative(baseImage!, {
          aspect,
          message,
          locale: input.locale,
          theme: { primary: BRAND.primary, text: BRAND.text, bg: BRAND.bg },
          disclaimer,
          logoPath: BRAND.logoPath,
          format,
        });

        const dims = AspectDimensions[aspect];
        const computedTextColor = BRAND.text === 'auto' ? getContrastingText(BRAND.primary) : BRAND.text;
        const checks = await runChecks(buf, {
          textColor: computedTextColor,
          primary: BRAND.primary,
          width: dims.w,
          height: dims.h,
          message,
        });
        const key = `generated/${campaignId}/${input.locale}/${product.id}/${aspect}/${safeSlug(product.name)}.${format}`;
        const uploaded = await putObject(key, buf, `image/${format}`);
        variants.push({
          productId: product.id,
          productName: product.name,
          aspect,
          path: uploaded.key,
          url: uploaded.url,
          checks,
          source: baseSource,
        });
      }
    }
  }

  const manifest: RunManifest = {
    campaignId,
    locale: input.locale,
    createdAt: new Date().toISOString(),
    variants,
  };

  const manifestKey = `generated/${campaignId}/manifest-${input.locale}.json`;
  await putObject(manifestKey, Buffer.from(JSON.stringify(manifest, null, 2)), 'application/json');

  return manifest;
}

function safeSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function findUploadedFile(files: Record<string, Buffer>, desiredName: string): Buffer | undefined {
  // Exact match
  if (files[desiredName]) return files[desiredName];
  const desiredLower = desiredName.toLowerCase();
  if (files[desiredLower]) return files[desiredLower];
  // Try case-insensitive match among keys
  const keys = Object.keys(files);
  const direct = keys.find(k => k.toLowerCase() === desiredLower);
  if (direct) return files[direct];
  // Try base-name match ignoring extension differences
  const base = desiredLower.replace(/\.[^.]+$/, '');
  const baseMatch = keys.find(k => k.toLowerCase().replace(/\.[^.]+$/, '') === base);
  if (baseMatch) return files[baseMatch];
  return undefined;
}
