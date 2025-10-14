"use client";
import Image from "next/image";

export type Variant = {
  productId: string;
  productName: string;
  aspect: "1x1" | "9x16" | "16x9";
  url: string;
  checks: { contrast?: { ok: boolean; ratio?: number }, legal?: { prohibitedWords?: Array<{ word: string; index: number }> } };
  source: "uploaded" | "generated" | "url";
};

export function ResultsGrid({ variants, locale }: { variants: Variant[]; locale?: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {variants.map((v, i) => (
        <div key={`${v.productId}-${v.aspect}-${i}`} className="border rounded p-3 space-y-2">
          <div className="text-sm font-medium flex items-center justify-between">
            <span>{v.productName} • {v.aspect}</span>
            <div className="flex items-center gap-2">
              {locale ? <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-black/10 text-black/70">{locale}</span> : null}
              <span className={`text-xs px-2 py-0.5 rounded ${v.source === 'uploaded' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{v.source}</span>
            </div>
          </div>
          <div className="relative w-full" style={{ aspectRatio: aspectToRatio(v.aspect) }}>
            <Image src={v.url} alt={`${v.productName} ${v.aspect}`} fill className="object-cover rounded" sizes="(max-width: 768px) 100vw, 33vw" />
          </div>
          <div className="text-xs text-black/70">
            Contrast: {v.checks?.contrast?.ok ? 'OK' : 'Low'} {v.checks?.contrast?.ratio ? `(${v.checks.contrast.ratio}:1)` : ''}
          </div>
          {v.checks?.legal?.prohibitedWords && v.checks.legal.prohibitedWords.length > 0 ? (
            <div className="text-xs">
              <span className="inline-block text-[10px] uppercase px-2 py-0.5 rounded bg-red-100 text-red-800 mr-2">
                flagged {v.checks.legal.prohibitedWords.length}
              </span>
              <span className="text-black/70">
                {Array.from(new Set(v.checks.legal.prohibitedWords.map(p => p.word))).join(', ')}
              </span>
            </div>
          ) : null}
          <a className="text-xs underline" href={v.url} target="_blank" rel="noreferrer">Open full image</a>
        </div>
      ))}
    </div>
  );
}

export function ResultsSkeleton() {
  const items = ["1x1", "9x16", "16x9"] as const;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((ar) => (
        <div key={ar} className="border rounded p-3 space-y-2 animate-pulse">
          <div className="h-4 bg-black/10 w-1/2 rounded" />
          <div className="relative w-full bg-black/10 rounded" style={{ aspectRatio: aspectToRatio(ar) }} />
          <div className="h-3 bg-black/10 w-1/3 rounded" />
        </div>
      ))}
    </div>
  );
}

function aspectToRatio(ar: "1x1" | "9x16" | "16x9") {
  switch (ar) {
    case "1x1":
      return "1 / 1";
    case "9x16":
      return "9 / 16";
    case "16x9":
      return "16 / 9";
  }
}
