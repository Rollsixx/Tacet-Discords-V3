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

function PreviewContent({ file }: { file: File }) {
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
      <div>
        <h3 className="text-sm font-semibold">
          Automatic image extraction preview
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Development preview only. Echo and Sonata identities
          have not been verified.
        </p>
      </div>

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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {current.slots.map(item => (
            <div
              key={item.slot}
              className="rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <p className="mb-2 text-xs font-semibold">
                Echo slot {item.slot}
              </p>

              <p className="mb-1 text-xs text-slate-400">
                Portrait · 192×182
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.portraitUrl}
                alt={`Extracted Echo portrait for slot ${item.slot}`}
                className="h-auto w-full rounded-md"
              />

              <p className="mb-1 mt-3 text-xs text-slate-400">
                Sonata icon · 56×56
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.sonataUrl}
                alt={`Extracted Sonata icon for slot ${item.slot}`}
                width={56}
                height={56}
                className="rounded-md"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function EchoVisualPreview({ file }: { file: File | null }) {
  if (!file) return null;

  return <PreviewContent key={file.name + ":" + file.size + ":" + file.lastModified} file={file} />;
}