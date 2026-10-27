import { createHash, timingSafeEqual } from "node:crypto";
import { HttpError } from "./validation.ts";

export const privateHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export function json(value: unknown, status = 200) { return Response.json(value, { status, headers: privateHeaders }); }
export function failure(error: unknown) {
  if (error instanceof HttpError) return json({ ok: false, error: error.message }, error.status);
  console.error("Tacet service error", error instanceof Error ? error.message : "Unknown error");
  return json({ ok: false, error: "Service unavailable. Check database configuration and migrations." }, 503);
}
export async function readJson(request: Request, limit = 2200000): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) throw new HttpError(415, "JSON required.");
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // Next's internal request URL may use localhost while the browser uses the
  // public Host. APP_ORIGIN pins the canonical origin behind reverse proxies.
  const expectedOrigin = process.env.APP_ORIGIN || (request.headers.get("host") ? url.protocol + "//" + request.headers.get("host") : url.origin);
  if (origin && origin !== expectedOrigin) throw new HttpError(403, "Cross-origin writes are not allowed.");
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) throw new HttpError(413, "Request too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Request body required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > limit) { await reader.cancel(); throw new HttpError(413, "Request too large."); }
      chunks.push(next.value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new HttpError(400, "Invalid JSON."); }
  } finally { reader.releaseLock(); }
}
export function authorize(request: Request) {
  const secret = process.env.MODERATOR_TOKEN;
  if (!secret || secret.length < 32) throw new HttpError(503, "Moderator access is not configured.");
  const supplied = request.headers.get("authorization") || "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(supplied), digest(`Bearer ${secret}`))) throw new HttpError(401, "Moderator authorization required.");
}
