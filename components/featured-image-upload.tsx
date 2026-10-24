"use client";
/* eslint-disable @next/next/no-img-element -- The preview is a local blob or authenticated draft asset. */
import { useEffect, useRef, useState } from "react";
import type { Article } from "@/lib/types";
import { imageExtension, MAX_IMAGE_BYTES } from "@/lib/image-path";

type LocalPreview = { url: string; name: string; size: number; width?: number; height?: number };
export function FeaturedImageUpload({ article, upload, remove, busy, publicSiteUrl = "https://craft-iota-wheat.vercel.app" }: { article: Article; upload: (file: File) => Promise<void>; remove: () => Promise<void>; busy: boolean; publicSiteUrl?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState<LocalPreview | null>(null);
  const [remoteDimensions, setRemoteDimensions] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  useEffect(() => () => { if (local?.url) URL.revokeObjectURL(local.url); }, [local?.url]);
  async function select(file?: File) {
    if (!file || busy) return;
    setError("");
    const extension = imageExtension(file.name);
    if (!extension || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Choose a JPG, PNG, or WebP image."); return; }
    if (!file.size || file.size > MAX_IMAGE_BYTES) { setError("Choose an image 4 MB or smaller."); return; }
    const url = URL.createObjectURL(file);
    const preview: LocalPreview = { url, name: file.name, size: file.size };
    setLocal(preview);
    const img = new Image();
    img.onload = () => setLocal(current => current?.url === url ? { ...current, width: img.naturalWidth, height: img.naturalHeight } : current);
    img.src = url;
    try { await upload(file); setLocal(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Image upload failed. Try again."); }
  }
  async function discard() {
    setError("");
    if (local) { setLocal(null); return; }
    try { await remove(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove the image."); }
  }
  const image = article.draftImage;
  const source = local?.url || (image ? `/api/articles/${article.id}/featured-image?sha=${article.storageSha || ""}` : article.featuredImage?.startsWith("/images/") ? new URL(article.featuredImage, publicSiteUrl).toString() : article.featuredImage || "");
  const name = local?.name || image?.originalName;
  const size = local?.size || image?.size;
  const width = local?.width || image?.width || remoteDimensions?.width;
  const height = local?.height || image?.height || remoteDimensions?.height;
  return <div className="image-upload-wrap">
    <input ref={input} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" hidden onChange={event => { void select(event.target.files?.[0]); event.target.value = ""; }}/>
    <div className={`image-dropzone ${dragging ? "dragging" : ""}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void select(event.dataTransfer.files[0]); }}>
      {source ? <img src={source} alt={article.imageAlt || article.title || "Selected featured image"} onLoad={event => setRemoteDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}/> : <div className="image-drop-placeholder"><strong>Featured image</strong><span>JPG, PNG, or WebP · up to 4 MB</span></div>}
    </div>
    {name && <p className="image-file-details"><strong>{name}</strong> · {size ? (size / 1024 / 1024).toFixed(2) : "0"} MB{width && height ? ` · ${width} × ${height} px` : ""}{local && " · saving to private draft…"}</p>}
    <div className="image-upload-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => input.current?.click()}>{source ? "Replace image" : "Choose image"}</button>{source && <button type="button" className="button light" disabled={busy} onClick={() => void discard()}>Remove image</button>}</div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <p className="editor-help">Your selection is saved in the private Studio repository. Publishing copies it to the public craft repository automatically.</p>
  </div>;
}
