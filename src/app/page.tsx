"use client";
import { useMemo, useState } from "react";
import { ResultsGrid, ResultsSkeleton, type Variant } from "../components/ResultsGrid";
import InfoHelp from "../components/InfoHelp";

export default function Home() {
  const [result, setResult] = useState<unknown | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setPending(true);
    try {
      const res = await fetch("/api/generate", { method: "POST", body: data });
      const json = await res.json();
      setResult(json);
    } finally {
      setPending(false);
    }
  }

  const variants = useMemo<Variant[]>(() => {
    if (!result || typeof result !== 'object' || result === null) return [];
    const v = (result as { variants?: Variant[] }).variants;
    return Array.isArray(v) ? v : [];
  }, [result]);
  const selectedLocale = useMemo(() => {
    if (!result || typeof result !== 'object' || result === null) return undefined;
    return (result as { locale?: string }).locale;
  }, [result]);
  const precheck = useMemo(() => {
    if (!result || typeof result !== 'object' || result === null) return undefined as undefined | { legal?: { prohibitedWords?: Array<{ word: string; index: number }> } };
    return (result as { precheck?: { legal?: { prohibitedWords?: Array<{ word: string; index: number }> } } }).precheck;
  }, [result]);
  const skipped = useMemo(() => {
    if (!result || typeof result !== 'object' || result === null) return false;
    return Boolean((result as { skippedGeneration?: boolean }).skippedGeneration);
  }, [result]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Generate Campaign Creatives</h1>
        <InfoHelp />
      </div>
      <form onSubmit={onSubmit} className="space-y-4 border p-4 rounded-md">
        <div>
          <label className="block text-sm mb-1">Brief (JSON)</label>
          <input type="file" name="brief" accept="application/json" required className="block" />
        </div>
        <div>
          <label className="block text-sm mb-1">Locale</label>
          <select name="locale" defaultValue="en" className="border rounded px-2 py-1">
            <option value="en">en</option>
            <option value="es">es</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Product Images (optional)</label>
          <input type="file" name="image_1" multiple accept="image/*" className="block" />
          <p className="text-xs text-black/60 mt-1">If provided, filenames must match brief products&#39; imageFile values.</p>
        </div>
        <button className="btn" disabled={pending}>{pending ? "Generating..." : "Run pipeline"}</button>
      </form>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Results</h2>
        {skipped && precheck?.legal?.prohibitedWords && precheck.legal.prohibitedWords.length > 0 ? (
          <div className="border border-red-300 bg-red-50 text-red-900 rounded p-3 text-sm">
            <div className="font-semibold mb-1">Generation skipped due to flagged language</div>
            <div>
              Flagged terms: <span className="font-mono">{Array.from(new Set(precheck.legal.prohibitedWords.map(p => p.word))).join(', ')}</span>
            </div>
            <div className="mt-1 text-red-900/80">Please revise the brief message and try again.</div>
          </div>
        ) : null}
        {pending ? (
          <ResultsSkeleton />
        ) : skipped ? (
          <p className="text-sm text-black/60">No images generated.</p>
        ) : variants.length > 0 ? (
          <ResultsGrid variants={variants} locale={selectedLocale} />
        ) : (
          <p className="text-sm text-black/60">No results yet.</p>
        )}
      </section>

      {result !== null ? (
        <details>
          <summary className="cursor-pointer text-sm">View manifest JSON</summary>
          <pre className="mt-2 text-xs bg-black/5 p-3 rounded max-h-[400px] overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  );
}
