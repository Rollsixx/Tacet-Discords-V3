"use client";

import { useEffect, useState } from "react";
import { extractEchoVisuals } from "@/lib/scanner/portrait-regions";

type PreviewSlot = {
  slot: number;
  portraitUrl: string;
  sonataUrl: string;
};

type PreviewState = {
  file: File;
  slots: PreviewSlot[];
  error: string;
};

function PreviewContent({ file, renderFields, selectedSlot, onSelectSlot }: { file: File; renderFields?: (slot: number) => React.ReactNode; selectedSlot?:number|null; onSelectSlot?:(slot:number)=>void }) {
  const [state, setState] = useState<PreviewState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function processFile() {
      let bitmap: ImageBitmap | null = null;

      try {
        bitmap = await createImageBitmap(file);

        if (cancelled) return;

        const extracted = extractEchoVisuals(
          bitmap,
          bitmap.width,
          bitmap.height,
        );

        const slots = extracted.map(item => ({
          slot: item.slot,
          portraitUrl: item.portrait.toDataURL("image/png"),
          sonataUrl: item.sonata.toDataURL("image/png"),
        }));

        if (!cancelled) {
          setState({
            file,
            slots,
            error: "",
          });
        }
      } catch (cause) {
        if (!cancelled) {
          setState({
            file,
            slots: [],
            error:
              cause instanceof Error
                ? cause.message
                : "Unable to extract Echo image regions.",
          });
        }
      } finally {
        bitmap?.close();
      }
    }

    void processFile();

    return () => {
      cancelled = true;
    };
  }, [file]);

  const current = state?.file === file ? state : null;

  return (
    <section
      aria-label="Automatic Echo crop preview"
      className="mt-5 space-y-3"
    >
      {!current && (
        <p className="text-sm text-slate-400">
          Extracting five Echo portraits and Sonata icons...
        </p>
      )}

      {current?.error && (
        <p role="alert" className="text-sm text-amber-400">
          {current.error}
        </p>
      )}

      {current && current.slots.length > 0 && (
        <div className="import-echo-grid">
          {current.slots.map(item => (
            <div
              key={item.slot}
              className={`import-echo-card${selectedSlot===item.slot?" is-focused":""}`}
            >
              <div className="echo-review-images">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.portraitUrl}
                alt={`Extracted Echo portrait for slot ${item.slot}`}
                className="echo-review-portrait"
              />


              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.sonataUrl}
                alt={`Extracted Sonata icon for slot ${item.slot}`}
                width={56}
                height={56}
                className="echo-review-sonata"
              /></div>
              {onSelectSlot&&<button type="button" className="echo-focus-button" aria-pressed={selectedSlot===item.slot} onClick={()=>onSelectSlot(item.slot)}>{selectedSlot===item.slot?"Highlighted in screenshot":"Highlight in screenshot"}</button>}
              {renderFields?.(item.slot)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function EchoVisualPreview({ file, renderFields, selectedSlot, onSelectSlot }: { file: File | null; renderFields?: (slot: number) => React.ReactNode; selectedSlot?:number|null; onSelectSlot?:(slot:number)=>void }) {
  if (!file) return null;

  return <PreviewContent key={file.name + ":" + file.size + ":" + file.lastModified} file={file} renderFields={renderFields} selectedSlot={selectedSlot} onSelectSlot={onSelectSlot} />;
}
