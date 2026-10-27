"use client";

import { useEffect, useState } from "react";
import { extractEchoVisuals } from "./portrait-regions";
import { recognizeVisualRegion } from "./visual-recognition";
import {
  ECHO_REFERENCES,
  SONATA_REFERENCES,
} from "./visual-reference-catalog";

type DiagnosticMatch = {
  status: "matched" | "ambiguous" | "unknown";
  key: string | null;
  ranked: Array<{ key: string; difference: number }>;
  failures: number;
  referenceCount: number;
};

type DiagnosticSlot = {
  slot: number;
  echo: DiagnosticMatch;
  sonata: DiagnosticMatch;
};

type DiagnosticState = {
  file: File;
  slots: DiagnosticSlot[];
  error: string;
};

const DIAGNOSTIC_POLICY = {
  maximumDifference: 0,
  minimumMargin: 0,
};

async function inspectRegion(
  canvas: HTMLCanvasElement,
  references: typeof ECHO_REFERENCES,
): Promise<DiagnosticMatch> {
  const result = await recognizeVisualRegion(
    canvas,
    references,
    DIAGNOSTIC_POLICY,
  );

  return {
    status: result.status,
    key: result.key,
    ranked: result.ranked.slice(0, 3),
    failures: result.referenceFailures.length,
    referenceCount: references.length,
  };
}

function MatchDetails({
  title,
  result,
}: {
  title: string;
  result: DiagnosticMatch;
}) {
  const label =
    result.referenceCount === 0
      ? "Unknown - no reference images"
      : result.failures === result.referenceCount
        ? "Unknown - references failed to load"
        : result.status === "matched"
          ? `Diagnostic match: ${result.key}`
          : result.status === "ambiguous"
            ? "Ambiguous"
            : "Unknown";

  return (
    <div className="mt-2 text-xs">
      <p className="font-medium text-slate-200">{title}</p>
      <p className="mt-1 text-slate-400">{label}</p>

      {result.ranked.length > 0 && (
        <ol className="mt-1 space-y-1 text-slate-400">
          {result.ranked.map(item => (
            <li key={item.key}>
              {item.key}: {item.difference.toFixed(5)}
            </li>
          ))}
        </ol>
      )}

      {result.failures > 0 && (
        <p className="mt-1 text-amber-400">
          Failed references: {result.failures}
        </p>
      )}
    </div>
  );
}

function DiagnosticContent({ file }: { file: File }) {
  const [state, setState] = useState<DiagnosticState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function processFile() {
      let bitmap: ImageBitmap | null = null;

      try {
        bitmap = await createImageBitmap(file);

        if (cancelled) return;

        const crops = extractEchoVisuals(
          bitmap,
          bitmap.width,
          bitmap.height,
        );

        const slots: DiagnosticSlot[] = [];

        for (const crop of crops) {
          if (cancelled) return;

          const [echo, sonata] = await Promise.all([
            inspectRegion(crop.portrait, ECHO_REFERENCES),
            inspectRegion(crop.sonata, SONATA_REFERENCES),
          ]);

          slots.push({
            slot: crop.slot,
            echo,
            sonata,
          });
        }

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
                : "Visual recognition diagnostics failed.",
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
      aria-label="Echo and Sonata recognition diagnostics"
      className="mt-4 rounded-xl border border-white/10 p-4"
    >
      <h3 className="text-sm font-semibold">
        Automatic recognition diagnostics
      </h3>

      <p className="mt-1 text-xs text-slate-400">
        Development only. Results do not validate an official build.
      </p>

      {!current && (
        <p className="mt-3 text-xs text-slate-400">
          Checking screenshot image regions...
        </p>
      )}

      {current?.error && (
        <p role="alert" className="mt-3 text-xs text-amber-400">
          {current.error}
        </p>
      )}

      {current && current.slots.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {current.slots.map(slot => (
            <div
              key={slot.slot}
              className="rounded-lg border border-white/10 p-3"
            >
              <p className="text-xs font-semibold">
                Slot {slot.slot}
              </p>

              <MatchDetails
                title="Echo"
                result={slot.echo}
              />

              <MatchDetails
                title="Sonata"
                result={slot.sonata}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function VisualRecognitionDiagnostics({
  file,
}: {
  file: File | null;
}) {
  if (!file) return null;

  return (
    <DiagnosticContent
      key={`${file.name}:${file.size}:${file.lastModified}`}
      file={file}
    />
  );
}