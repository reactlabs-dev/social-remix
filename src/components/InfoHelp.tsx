"use client";
import { useEffect, useId, useState } from "react";

export default function InfoHelp() {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-black/20 text-xs text-black/70 hover:bg-black/5"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={titleId}
        onClick={() => setOpen(true)}
        title="How this works"
      >
        i
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          aria-labelledby={titleId}
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white text-black rounded-md shadow-xl max-w-2xl w-[92vw] p-5">
            <div className="flex items-start justify-between mb-3">
              <h2 id={titleId} className="text-lg font-semibold">About Social Remix</h2>
              <button
                type="button"
                className="px-2 py-1 text-sm rounded hover:bg-black/5"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >✕</button>
            </div>
            <div className="space-y-3 text-sm leading-relaxed">
              <p>
                Upload a JSON brief (and optional product images) to generate social-ready creatives in three aspect ratios: 1:1, 9:16, and 16:9. If an image is missing for a product, we generate a hero image automatically.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Inputs:</strong> brief.json + optional product images (filenames must match <code>imageFile</code> in the brief).</li>
                <li><strong>Processing:</strong> Resize/crop with Sharp, add a branded overlay band and your logo, then upload outputs to S3.</li>
                <li><strong>Outputs:</strong> PNG images per aspect ratio, plus a manifest JSON with S3 URLs and checks.</li>
              </ul>
              <p>
                <strong>Validation:</strong> We run brand and legal checks per creative (logo presence, brand color usage, a contrast heuristic for legibility, and a prohibited-words scan). Flags will appear in the manifest and UI.
              </p>
              <p>
                <strong>Locale:</strong> Choose a locale (e.g., <code>en</code> or <code>es</code>). If the brief contains a locale-specific message, we use that; otherwise we fall back to <code>message.default</code>.
              </p>
              <p>
                While generating, you&#39;ll see placeholders. Once complete, thumbnails appear with links to the full S3 images.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
