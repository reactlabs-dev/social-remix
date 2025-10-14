# Social Remix

Creative automation pipeline that generates social-ready ad creatives from a structured JSON brief, renders three aspect ratios (1:1, 9:16, 16:9), applies branding overlays, runs basic compliance checks, uploads assets to S3, and shows results in a small Next.js UI. The final manifest JSON is also available beneath the results.

Tech: Next.js (App Router), React, TypeScript, Sharp, AWS S3 (SDK v3), Zod, minimal Tailwind.

---

## 1) How to run it

Prereqs
- Node 18+ (macOS/Windows/Linux). On macOS Intel or Apple Silicon, `npm install` is sufficient; sharp is pinned for deterministic installs.
- Env vars in `.env.local` for S3 and OpenAI (OpenAI only needed if you want AI-generated base images when a product image is missing):

```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-2
AWS_S3_BUCKET=soluna-pmc-pdfs

# Optional for AI generation fallback
OPENAI_API_KEY=...
```

Install and run (dev):
```
npm install
npm run dev
```
Open http://localhost:3000

Build (prod) and start:
```
npm run build
npm start
```

---

## 2) Example input and output

Example brief: `briefs/sample.campaign.json`
```
{
	"campaignId": "spring-launch",
	"targetRegion": "US",
	"audience": "Gen Z, mobile-first",
	"locales": ["en", "es"],
	"message": {
		"default": "Fresh drop. Minimal style. Big impact.",
		"en": "Fresh drop. Minimal style. Big impact.",
		"es": "Nueva colección. Estilo minimalista. Gran impacto."
	},
	"outputFormat": "png",
	"products": [
		{ "id": "p1", "name": "Aero Runner", "imageFile": "runner.jpg" },
		{ "id": "p2", "name": "Mono Hoodie" }
	],
	"disclaimer": "Terms apply. See website for details."
}
```

How to run a campaign in the UI
1. Choose your locale from the dropdown (en/es).
2. Select the brief JSON file (e.g., the sample above).
3. Optionally attach product images (filenames must match products[].imageFile).
4. Click “Run pipeline”.

Output
- Three images per product (1:1, 9:16, 16:9), uploaded to S3 with public URLs, and displayed as thumbnails.
- A locale badge (EN/ES) appears top-right on each image; the message text is localized and rendered in the bottom band.
- A manifest JSON is written to S3 and also shown beneath the results in the UI. It contains product IDs/names, aspect, S3 path, URL, basic compliance checks, and whether the base image was uploaded or generated.

---

## 3) Key design decisions

- Results visualization over device mockups: I considered rendering device/mockup frames, but preferred showing the same creative across distinct aspect ratios for clearer comparative review. The overlay and placement are tuned per aspect, and this demonstrates cross-format consistency.
- Manifest-first outputs: The UI is for quick inspection; the pipeline always emits a structured manifest (per-locale) that downstream systems can consume.
- Info icon for new users: The UI includes an info/help modal explaining inputs, processing, outputs, and locale behavior so first‑time users know what to expect.
- Overlay rendering: Pure SVG text/tspan (no foreignObject) to ensure Sharp rasterizes text reliably. The band uses auto-contrast for legible text, with a subtle stroke for readability.
- Generate-only-if-missing: If a product image is not uploaded or available via URL, the pipeline uses OpenAI Images to create a base hero image (optional, only if `OPENAI_API_KEY` is provided).
- PNG default: Outputs PNG by default for quality; JPEG can be selected in the brief (`outputFormat`).

---

## 4) Assumptions

- Locales: English and Spanish are supported out of the box. To add a new locale, include the language code in `locales` and provide a `message["<locale>"]` string in the brief; the overlay will render the localized message and show the locale badge.
- S3: Bucket is configured public-read so thumbnails/links work in the UI. Credentials must be provided via `.env.local`.
- Compliance checks: Baseline-only (contrast heuristic, prohibited-words scan, safe area assumption, brand presence heuristic). These are placeholders for real policy.
- Branding: A brand color band with auto-contrast text and optional disclaimer.

---

## Architectural overview

High-level flow
1. UI (Next.js App Router) uploads a brief.json and optional product images to `/api/generate?locale=en|es`.
2. API validates the brief (Zod), resolves base images (uploaded or AI-generated fallback), renders creatives in three aspect ratios using Sharp and an SVG overlay, runs basic checks, uploads images+manifest to S3, and returns the manifest.
3. UI shows thumbnails, a locale chip, and check summaries; the full manifest is viewable beneath the results.

Main components
- API route: `src/app/api/generate/route.ts` – accepts multipart form (brief + images), orchestrates the pipeline, returns manifest.
- Pipeline orchestrator: `src/lib/pipeline/index.ts` – iterates products/aspects, ensures base image, renders overlays, runs checks, uploads to S3, writes manifest.
- Overlay: `src/lib/pipeline/overlay.ts` – builds an SVG overlay with a branded band, auto-contrast headline, optional disclaimer, and a small locale badge.
- Image rendering: `src/lib/pipeline/images.ts` – resizes/crops base image per aspect, composites overlay, optional logo.
- S3 storage: `src/lib/pipeline/storage/s3.ts` – `putObject` and `publicUrl` utilities.
- Brief parsing: `src/lib/pipeline/brief.ts` – Zod schema and `parseBrief`.
- Compliance checks: `src/lib/pipeline/checks.ts` – simple heuristics (contrast, prohibited words, etc.).
- UI: `src/app/page.tsx`, `src/components/ResultsGrid.tsx`, `src/components/InfoHelp.tsx` – upload form, results grid (with locale chip), info modal.

Data contract (brief)
- `campaignId`: string
- `targetRegion`: string
- `audience`: string
- `locales`: string[] (e.g., ["en","es"])
- `message`: { default: string, [localeCode: string]: string }
- `disclaimer?`: string (optional)
- `outputFormat?`: "png" | "jpeg" (default "png")
- `products`: Array<{ id: string; name: string; description?; imageFile?; imageUrl? }>

Returned manifest (shape)
- `campaignId`: string
- `locale`: string
- `createdAt`: ISO string
- `variants`: Array<{
	productId, productName, aspect: "1x1"|"9x16"|"16x9", path, url, source: "uploaded"|"generated",
	checks: { contrast: { ok, ratio }, legal: { prohibitedWords: [...] }, ... }
}>

---

## Tips

- If you don’t attach product images, the pipeline will generate base images using OpenAI (when `OPENAI_API_KEY` is set). Otherwise, it uses your uploads.
- The locale dropdown controls which message is rendered and which manifest is written.
- You can change the brand color band in `src/lib/pipeline/index.ts` (BRAND.primary). Text color auto-adjusts.

---

## Scripts

- `npm run dev` – Start the dev server
- `npm run build` – Build for production
- `npm start` – Start the production server
- `npm run generate` – Run the pipeline via CLI script (optional; see `scripts/generate.ts`)
- `npm run check:s3` – Check S3 bucket public status (optional)
