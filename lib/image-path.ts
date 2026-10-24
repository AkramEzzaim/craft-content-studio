import type { DraftImage } from "./types";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export function imageExtension(name: string): DraftImage["extension"] | null {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return ext === "jpg" || ext === "jpeg" ? "jpg" : ext === "png" || ext === "webp" ? ext : null;
}
export function draftImagePath(id: string, extension: DraftImage["extension"]) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid article ID");
  if (!["jpg", "png", "webp"].includes(extension)) throw new Error("Invalid image extension");
  return `studio/assets/${id}/featured.${extension}`;
}
export function publicImagePath(slug: string, extension: DraftImage["extension"]) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Save a valid article title before uploading an image");
  if (!["jpg", "png", "webp"].includes(extension)) throw new Error("Invalid image extension");
  return `public/images/patterns/${slug}.${extension}`;
}
export function publicImageUrl(slug: string, extension: DraftImage["extension"]) {
  return `/${publicImagePath(slug, extension).slice("public/".length)}`;
}
