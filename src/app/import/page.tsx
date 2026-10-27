"use client";

import { validateEchoSlot } from "@/lib/scanner/stat-validation";
import { EchoVisualPreview } from "@/lib/scanner/echo-visual-preview";
import { SubmitBuild } from "@/components/submit-build";

import { useRef, useState } from "react";
import { PageHeading, Panel } from "@/components/ui";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  recognizeBuildCard,
  type RecognitionProgress,
  type RecognitionResult,
} from "@/lib/scanner/build-card-ocr";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<RecognitionProgress | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);


  function handleFile(candidate?: File) {
    if (running || !candidate) return;

    setError("");
    setResult(null);
    setProgress(null);

    if (!ALLOWED_TYPES.includes(candidate.type)) {
      setError("Choose a PNG, JPEG or WebP screenshot.");
      return;
    }

    if (candidate.size > MAX_BYTES) {
      setError("Screenshot must be 10 MB or smaller.");
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const url = URL.createObjectURL(candidate);
    previewUrlRef.current = url;
    setPreview(url);
    setFile(candidate);
  }

  function buildValidationSummary(
    slots: RecognitionResult["slots"],
  ) {
    const issues = slots.flatMap(slot =>
      validateEchoSlot(slot).map(issue => ({
        slot: slot.slot,
        ...issue,
      })),
    );

    return {
      issues,
      issueCount: issues.length,
      affectedSlots: new Set(
        issues.map(issue => issue.slot),
      ).size,
      structurallyValid: issues.length === 0,
    };
  }
  function correctField(
    slotNumber: number,
    field: "cost" | "mainStat" | "substat",
    value: string,
    substatIndex?: number,
  ) {
    setResult(previous => {
      if (!previous) return previous;

      return {
        ...previous,
        slots: previous.slots.map(slot => {
          if (slot.slot !== slotNumber) return slot;

          if (field === "cost") {
            return { ...slot, cost: { ...slot.cost, value } };
          }

          if (field === "mainStat") {
            return { ...slot, mainStat: { ...slot.mainStat, value } };
          }

          return {
            ...slot,
            substats: slot.substats.map((stat, index) =>
              index === substatIndex
                ? { ...stat, value }
                : stat,
            ),
          };
        }),
      };
    });
  }
  function clearFile() {
    if (running) return;

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setPreview(null);
    setFile(null);
    setError("");
    setResult(null);
    setProgress(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function startRecognition() {
    if (!file || running) return;

    setRunning(true);
    setError("");
    setResult(null);
    setProgress(null);

    try {
      const output = await recognizeBuildCard(file, setProgress);
      setResult(output);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Screenshot recognition failed.",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Build workspace / 01"
        title="Import your build."
        description="Extract five Echo portraits, five Sonata icons, and Echo statistics from a supported Wuthering Waves build card."
      />

      <div className="demo-banner">
        <span className="status-dot" />
        OCR BETA — Text recognition is functional but unverified.
        Review all extracted fields. Submissions are stored for moderator review; Echo identities and Solo scores remain unverified.
      </div>

      <div className="workspace-grid">
        <Panel>
          <div className="workspace-header">
            <div>
              <span className="eyebrow">Build card scanner</span>
              <h2 className="panel-title">Screenshot recognition</h2>
          <EchoVisualPreview file={file} />

            </div>
            <span className="tag">OCR BETA</span>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="visually-hidden"
            aria-label="Choose build screenshot"
            disabled={running}
            onChange={event => handleFile(event.target.files?.[0])}
          />

          {!file ? (
            <div
              className={`upload-zone ${dragging ? "drag-active" : ""}`}
              onDragOver={event => {
                event.preventDefault();
                if (!running) setDragging(true);
              }}
              onDragLeave={event => {
                event.preventDefault();
                setDragging(false);
              }}
              onDrop={event => {
                event.preventDefault();
                setDragging(false);
                handleFile(event.dataTransfer.files[0]);
              }}
            >
              <div className="upload-icon" aria-hidden="true">↑</div>
              <h3>Drop your build card here</h3>
              <p className="muted">
                Required resolution: {CARD_WIDTH} × {CARD_HEIGHT}.
                PNG, JPEG or WebP, up to 10 MB.
              </p>
              <button
                type="button"
                className="action"
                onClick={() => inputRef.current?.click()}
              >
                Browse screenshot
              </button>
            </div>
          ) : (
            <div className="uploaded-image">
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="Selected build screenshot"
                />
              )}
              <div className="uploaded-details">
                <div>
                  <strong>{file.name}</strong>
                  <p className="muted">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  className="outline-button"
                  disabled={running}
                  onClick={clearFile}
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {file && (
            <button
              type="button"
              className="action"
              disabled={running}
              onClick={startRecognition}
            >
              {running ? "Recognizing..." : "Recognize Echo stats"}
            </button>
          )}

          {running && (
            <div className="workspace-note" role="status">
              <span className="eyebrow">OCR processing</span>
              <p className="muted">
                {progress
                  ? `${progress.completed}/${progress.total} regions — ${progress.label}`
                  : "Initializing OCR worker and language data..."}
              </p>
              {progress && (
                <progress
                  value={progress.completed}
                  max={progress.total}
                  style={{ width: "100%", accentColor: "#76e4df" }}
                />
              )}
            </div>
          )}

          {error && (
            <p className="field-error" role="alert">{error}</p>
          )}

          {result && (
            <div className="workspace-note" aria-live="polite">
              <span className="eyebrow">Recognition results</span>
              <h2 className="panel-title">
                {result.slots.length} Echo slots processed
              </h2>
              <p className="muted">
                OCR output is provisional. Verify every stat against
                your screenshot before using it in calculations.
              </p>

              {(() => {
                const summary = buildValidationSummary(result.slots);

                return (
                  <div
                    className="workspace-note"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="eyebrow">
                      Build validation summary
                    </span>

                    <h3 className="panel-title">
                      {summary.structurallyValid
                        ? "No structural warnings"
                        : `${summary.issueCount} issue(s) require review`}
                    </h3>

                    <p className="muted">
                      {summary.affectedSlots} of {result.slots.length}
                      {" "}Echo slots currently contain validation warnings.
                    </p>

                    <p className="muted">
                      This checks recognized stat text only.
                      Echo identity, Sonata sets, complete game-data
                      legality and leaderboard eligibility remain
                      unverified.
                    </p>
                  </div>
                );
              })()}
              {result.slots.map(slot => (
                <section
                  key={slot.slot}
                  style={{
                    borderTop: "1px solid #34404d",
                    marginTop: 20,
                    paddingTop: 16,
                  }}
                >
                  <h3 className="panel-title">
                    Echo {slot.slot} {slot.presence === "empty" ? "— No equipped Echo detected" : ""}
                  </h3>
                  <details><summary>Compare original OCR with your corrections</summary>
                    <p className="muted">Cost: {slot.cost.raw || "Unreadable"} {slot.cost.raw !== slot.cost.value ? "(corrected)" : ""}</p>
                    <p className="muted">Main stat: {slot.mainStat.raw || "Unreadable"} {slot.mainStat.raw !== slot.mainStat.value ? "(corrected)" : ""}</p>
                    {slot.substats.map((stat, index) => <p className="muted" key={index}>Substat {index + 1}: {stat.raw || "Unreadable"} {stat.raw !== stat.value ? "(corrected)" : ""}</p>)}
                  </details>
                  <fieldset disabled={slot.presence === "empty"} style={{border: 0, padding: 0, minWidth: 0}}>
                  <div className="card-row">
                    <span>Cost (reviewed value)</span>
                    <input
                      aria-label={`Echo ${slot.slot} cost`}
                      value={slot.cost.value}
                      onChange={event =>
                        correctField(slot.slot, "cost", event.target.value)
                      }
                      style={{
                        width: 190,
                        maxWidth: "55%",
                        padding: 8,
                        color: "#f2f5f8",
                        background: "#111923",
                        border: "1px solid #40505c",
                        borderRadius: 7,
                        textAlign: "right",
                      }}
                    />
                  </div>
                  <div className="card-row">
                    <span>Main stat label</span>
                    <input
                      aria-label={`Echo ${slot.slot} main stat`}
                      value={slot.mainStat.value}
                      onChange={event =>
                        correctField(slot.slot, "mainStat", event.target.value)
                      }
                      style={{
                        width: 270,
                        maxWidth: "65%",
                        padding: 8,
                        color: "#f2f5f8",
                        background: "#111923",
                        border: "1px solid #40505c",
                        borderRadius: 7,
                        textAlign: "right",
                      }}
                    />
                  </div>

                  {slot.substats.map((stat, index) => (
                    <div className="card-row" key={index}>
                      <span>Substat {index + 1}</span>
                      <input
                        aria-label={`Echo ${slot.slot} substat ${index + 1}`}
                        value={stat.value}
                        onChange={event =>
                          correctField(
                            slot.slot,
                            "substat",
                            event.target.value,
                            index,
                          )
                        }
                        style={{
                          width: 310,
                          maxWidth: "65%",
                          padding: 8,
                          color: "#f2f5f8",
                          background: "#111923",
                          border: "1px solid #40505c",
                          borderRadius: 7,
                          textAlign: "right",
                        }}
                      />
                    </div>
                  ))}

                  </fieldset>
                  {validateEchoSlot(slot).length > 0 && (
                    <div className="workspace-note">
                      <span className="eyebrow">
                        Validation warnings
                      </span>

                      {validateEchoSlot(slot).map((issue, index) => (
                        <p
                          className="muted"
                          key={`${issue.code}-${index}`}
                        >
                          {issue.message}
                        </p>
                      ))}
                    </div>
                  )}
                </section>
              ))}

              {file && <SubmitBuild key={file.name + file.lastModified} file={file} result={result} />}
              {result.warnings.length > 0 && (
                <div className="workspace-note">
                  <span className="eyebrow">Review required</span>
                  {result.warnings.map(warning => (
                    <p className="muted" key={warning}>{warning}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="workspace-note">
            <span className="eyebrow">Privacy and limitations</span>
            <p className="muted">
              Screenshot processing runs in your browser.
              OCR worker and English language resources are served by this website. Only after you submit, ten visual crops and reviewed statistics are stored for moderation. The original screenshot stays in your browser.
              Recognition supports only the specified build-card layout.
            </p>
          </div>
        </Panel>

        <div className="workspace-side">
          <Panel>
            <span className="eyebrow">Recognition pipeline</span>
            <h2 className="panel-title">Processing stages</h2>

            {[
              ["01", "Select screenshot", file ? "Ready" : "Waiting"],
              ["02", "Read Echo text", result ? "Completed" : running ? "Processing" : "Waiting"],
              ["03", "Review OCR results", result ? "Ready" : "Waiting"],
              ["04", "Review five visual crops", file ? "Ready" : "Waiting"],
              ["05", "Submit for moderation", result ? "Ready after corrections" : "Waiting"],
            ].map(([number, title, status]) => (
              <div className="pipeline-step" key={number}>
                <span className="pipeline-number">{number}</span>
                <div>
                  <strong>{title}</strong>
                  <small>{status}</small>
                </div>
              </div>
            ))}
          </Panel>

          <Panel>
            <span className="eyebrow">Supported input</span>
            <h2 className="panel-title">1920 × 1080</h2>
            <p className="muted">
              Five-slot build-card screenshots only.
              Ordinary gameplay screenshots and Echo inventory
              screens are not supported by this OCR layout.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}






