"use client";
/* eslint-disable @next/next/no-img-element -- Saved photos use the authenticated draft endpoint. */
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Article } from "@/lib/types";
import { imageExtension, MAX_IMAGE_BYTES } from "@/lib/image-path";

type Props = { article: Article; upload: (files: File[]) => Promise<void>; remove: (id: string) => Promise<void>; update: (id: string, key: "alt" | "caption", value: string) => void; move: (id: string, direction: -1 | 1) => void; busy: boolean };
export function GalleryUpload({ article, upload, remove, update, move, busy }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url); }, [pending]);
  async function choose(files: File[]) {
    if (!files.length || busy) return;
    setError("");
    if (files.length + (article.galleryImages || []).length > 12) { setError("A draft can have up to 12 extra photos."); return; }
    if (files.some(file => !imageExtension(file.name) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > MAX_IMAGE_BYTES)) { setError("Choose JPG, PNG, or WebP images up to 4 MB each."); return; }
    setPending({ url: URL.createObjectURL(files[0]), name: files.length === 1 ? files[0].name : `${files.length} photos` });
    try { await upload(files); setPending(null); }
    catch (cause) { setPending(null); setError(cause instanceof Error ? cause.message : "Photo upload failed"); }
  }
  return <div className="gallery-upload">
    <input ref={input} type="file" multiple accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" hidden onChange={event => { void choose(Array.from(event.target.files || [])); event.target.value = ""; }}/>
    <button className="button secondary" disabled={busy || (article.galleryImages || []).length >= 12} onClick={() => input.current?.click()}>+ Upload photos</button>
    <p className="editor-help">Choose up to 12 extra photos. They stay private until publication.</p>
    {error && <div className="form-error" role="alert">{error}</div>}
    {pending && <div className="gallery-item"><img src={pending.url} alt="Uploading photo preview"/><span>{pending.name} · saving…</span></div>}
    <div className="gallery-grid">{(article.galleryImages || []).map((image, index) => <div className="gallery-item" key={image.id}>
      <img src={`/api/articles/${article.id}/gallery-image?imageId=${image.id}&sha=${article.storageSha || ""}`} alt={image.alt || article.title}/>
      <strong>{image.originalName}</strong><span>{image.width && image.height ? `${image.width} × ${image.height} px · ` : ""}{(image.size / 1024 / 1024).toFixed(2)} MB</span>
      <label className="field"><span>Photo description (optional)</span><input value={image.alt} onChange={event => update(image.id, "alt", event.target.value)}/></label>
      <label className="field"><span>Caption (optional)</span><input value={image.caption} onChange={event => update(image.id, "caption", event.target.value)}/></label>
      <div className="gallery-controls"><button className="button light" aria-label={`Move photo ${index + 1} up`} disabled={busy || index === 0} onClick={() => move(image.id, -1)}><ArrowUp size={15}/></button><button className="button light" aria-label={`Move photo ${index + 1} down`} disabled={busy || index === (article.galleryImages || []).length - 1} onClick={() => move(image.id, 1)}><ArrowDown size={15}/></button><button className="button light" disabled={busy} onClick={() => void remove(image.id)}>Remove</button></div>
    </div>)}</div>
  </div>;
}
