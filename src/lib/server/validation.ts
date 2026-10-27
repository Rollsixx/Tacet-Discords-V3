import { validateEchoSlot } from "../scanner/stat-validation.ts";
import type { RecognizedSlot } from "../scanner/build-card-ocr";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown, max: number, min = 1): string {
  if (typeof value !== "string" || value.trim().length < min || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new HttpError(400, "Missing or invalid text field.");
  }
  return value.trim();
}
function field(value: unknown) {
  if (!record(value)) throw new HttpError(400, "Invalid OCR field.");
  return { raw: text(value.raw, 160, 0), value: text(value.value, 160) };
}
function png(value: unknown, width: number, height: number) {
  if (typeof value !== "string" || value.length > 204822 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new HttpError(400, "Missing or oversized PNG crop.");
  const bytes = Buffer.from(value.slice(22), "base64");
  if (bytes.length < 50 || bytes.length > 153600 ||
    bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    bytes.subarray(12, 16).toString() !== "IHDR" ||
    bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height ||
    bytes.subarray(-8, -4).toString() !== "IEND") throw new HttpError(400, "Invalid PNG crop dimensions or structure.");
  return bytes;
}
export function validateSubmission(input: unknown) {
  if (!record(input) || !/^[0-9]{8,12}$/.test(String(input.uid)) || typeof input.uid !== "string" ||
    !Array.isArray(input.slots) || input.slots.length !== 5 || input.confirmed !== true) {
    throw new HttpError(400, "UID, five Echo slots and screenshot confirmation are required.");
  }
  const slots = input.slots.map((item, index) => {
    if (!record(item) || item.slot !== index + 1 || !Array.isArray(item.substats) || item.substats.length !== 5) throw new HttpError(400, "Five ordered Echo slots with five substats are required.");
    if (item.presence === "empty") throw new HttpError(400, "All five Echoes must be equipped. Missing slots cannot be submitted.");
    const stats: RecognizedSlot = {
      slot: index + 1, cost: field(item.cost), mainStat: field(item.mainStat), substats: item.substats.map(field),
    };
    const issues = validateEchoSlot(stats);
    if (issues.length) throw new HttpError(400, `Echo ${index + 1}: ${issues[0].message}`);
    return { ...stats, portrait: png(item.portrait, 192, 182), sonata: png(item.sonata, 56, 56) };
  });
  let sourceImage: Buffer | undefined;
  if (input.sourceImage !== undefined) {
    if (typeof input.sourceImage !== "string" || input.sourceImage.length > 1500000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(input.sourceImage)) throw new HttpError(400, "Invalid or oversized original screenshot evidence.");
    sourceImage = Buffer.from(input.sourceImage.split(",")[1], "base64");
  }
  return { uid: input.uid, ign: text(input.ign, 32, 2), character: text(input.character, 64), slots, sourceImage };
}
export type SubmissionInput = ReturnType<typeof validateSubmission>;
