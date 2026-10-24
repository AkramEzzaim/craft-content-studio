import "server-only";
import { imageExtension, MAX_IMAGE_BYTES } from "./image-path";
import type { DraftImage } from "./types";

const mime: Record<DraftImage["extension"], string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
export function validateImage(bytes: Buffer, filename: string, reportedMime: string) {
  const extension = imageExtension(filename);
  if (!extension) throw new Error("Choose a JPG, PNG, or WebP image");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("Image must be 4 MB or smaller");
  if (reportedMime !== mime[extension]) throw new Error("Image file type does not match its extension");
  const png = extension === "png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = extension === "jpg" && bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = extension === "webp" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!png && !jpg && !webp) throw new Error("Image contents do not match the selected file type");
  let width: number | undefined;
  let height: number | undefined;
  if (png && bytes.length >= 24) { width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20); }
  if (jpg) {
    let cursor = 2;
    while (cursor + 9 < bytes.length) {
      if (bytes[cursor] !== 0xff) { cursor++; continue; }
      const marker = bytes[cursor + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const length = bytes.readUInt16BE(cursor + 2);
      if (length < 2) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb].includes(marker)) {
        height = bytes.readUInt16BE(cursor + 5); width = bytes.readUInt16BE(cursor + 7); break;
      }
      cursor += length + 2;
    }
  }
  if (webp && bytes.toString("ascii", 12, 16) === "VP8X" && bytes.length >= 30) {
    width = 1 + bytes.readUIntLE(24, 3); height = 1 + bytes.readUIntLE(27, 3);
  }
  if (width !== undefined && height !== undefined && (!width || !height || width > 12000 || height > 12000)) throw new Error("Image dimensions are invalid or too large");
  return { extension, mimeType: mime[extension], size: bytes.length, width, height };
}
