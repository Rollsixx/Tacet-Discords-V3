// Synthetic PNGs for automated tests only; these are not OCR accuracy fixtures.
import { deflateSync } from "node:zlib";
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function testPng(width, height) {
  function chunk(kind, data) {
    const label = Buffer.from(kind);
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([label, data])));
    return Buffer.concat([length, label, data, crc]);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc(height * (width * 3 + 1), 70);
  for (let y = 0; y < height; y++) pixels[y * (width * 3 + 1)] = 0;
  return "data:image/png;base64," + Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}
export function fixture(uid = "812345678") {
  const field = value => ({ raw: value, value });
  return { uid, ign: "Test Rover", character: "Jinhsi", confirmed: true,
    slots: Array.from({ length: 5 }, (_, i) => ({
      slot: i + 1, cost: field("4"), mainStat: field("Crit. DMG"),
      substats: ["Crit. Rate 10.5%", "Crit. DMG 21%", "ATK 9.4%", "HP 10.1%", "Resonance Skill DMG Bonus 8.6%"].map(field),
      portrait: testPng(192, 182), sonata: testPng(56, 56),
    })),
  };
}
