"use client";
/* eslint-disable @next/next/no-img-element -- Photos are served by the authenticated draft endpoint. */
import { useEffect, useRef, useState } from "react";
import type { Article } from "@/lib/types";
import { imageExtension, MAX_IMAGE_BYTES } from "@/lib/image-path";

export function GalleryUpload({ article, upload, remove, update, busy }: { article: Article; upload: (file: File) => Promise<void>; remove: (id: string) => Promise<void>; update: (id: string, key: "alt" | "caption", value: string) => void; busy: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url); }, [pending]);
  async function choose(file?: File) {
    if (!file || busy) return;
    setError("");
    if (!imageExtension(file.name) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > MAX_IMAGE_BYTES) { setError("Choose a JPG, PNG, or WebP image up to 4 MB."); return; }
    setPending({ url: URL.createObjectURL(file), name: file.name });
    try { await upload(file); setPending(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Photo upload failed"); }
  }
  return <div className="gallery-upload"><input ref={input} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" hidden onChange={event => { void choose(event.target.files?.[0]); event.target.value = ""; }}/><button className="button secondary" disabled={busy || (article.galleryImages || []).length >= 12} onClick={() => input.current?.click()}>+ Upload photo</button><p className="editor-help">Up to 12 additional photos. They remain private until publication.</p>{error && <div className="form-error" role="alert">{error}</div>}{pending && <div className="gallery-item"><img src={pending.url} alt="Uploading photo preview"/><span>{pending.name} · saving…</span></div>}<div className="gallery-grid">{(article.galleryImages || []).map(image => <div className="gallery-item" key={image.id}><img src={`/api/articles/${article.id}/gallery-image?imageId=${image.id}&sha=${article.storageSha || ""}`} alt={image.alt || article.title}/><strong>{image.originalName}</strong><span>{image.width && image.height ? `${image.width} × ${image.height} px · ` : ""}{(image.size / 1024 / 1024).toFixed(2)} MB</span><label className="field"><span>Photo description</span><input value={image.alt} onChange={event => update(image.id, "alt", event.target.value)}/></label><label className="field"><span>Caption (optional)</span><input value={image.caption} onChange={event => update(image.id, "caption", event.target.value)}/></label><button className="button light" disabled={busy} onClick={() => void remove(image.id)}>Remove photo</button></div>)}</div></div>;
}
