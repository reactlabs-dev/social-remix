import { Brief, parseBrief } from './brief';
import type { CheckResult } from './checks';
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
  source: 'uploaded' | 'generated';
}

export interface RunManifest {
  campaignId: string;
  locale: string;
  createdAt: string;
  variants: VariantManifest[];
}

export async function runPipeline(input: {
  brief: unknown;
  locale: string;
  files: Record<string, Buffer>;
}): Promise<RunManifest> {
  const brief: Brief = parseBrief(input.brief);
  if (!brief.locales.includes(input.locale)) {
    throw new Error(`Locale ${input.locale} not in brief.locales`);
  }
  const message: string = (brief.message as Record<string, string>)[input.locale] || brief.message.default;
  const disclaimer: string | undefined = brief.disclaimer;
  const format = brief.outputFormat ?? 'png';

  const aspects: AspectKey[] = ['1x1', '9x16', '16x9'];
  const campaignId = brief.campaignId;

  const variants: VariantManifest[] = [];
  for (const product of brief.products) {
    // Resolve base image: uploaded file, imageUrl (future), or generate
    let baseImage: Buffer | undefined;
    if (product.imageFile && input.files[product.imageFile]) {
      baseImage = input.files[product.imageFile];
    } else if (product.imageUrl) {
      // TODO: fetch imageUrl; for POC we skip to generation if not provided locally
    }
    if (!baseImage) {
      const prompt = `On-brand product hero image in maroon/pink neutrals for ${product.name}. Clean, minimal, social-ad ready.`;
      baseImage = await generateHeroImage(prompt);
    }

    for (const aspect of aspects) {
      const buf = await renderCreative(baseImage, {
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

      const key = `generated/${campaignId}/${product.id}/${aspect}/${safeSlug(product.name)}.${format}`;
      const uploaded = await putObject(key, buf, `image/${format}`);
      variants.push({
        productId: product.id,
        productName: product.name,
        aspect,
        path: uploaded.key,
        url: uploaded.url,
        checks,
        source: product.imageFile ? 'uploaded' : 'generated',
      });
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
