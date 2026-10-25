"use client";
import { useState } from "react";
import Link from "next/link";
import { ExternalLink, MoreHorizontal, Trash2, X } from "lucide-react";
import { hasPublicVersion, type Article } from "@/lib/types";

type Mode = "draft" | "unpublish" | "everything";
type Result = { complete: boolean; removed: boolean; mode: Mode; message: string; completed: string[]; article?: Article; error?: string; retainedAssets?: string[] };
export function ArticleDeletion({ article, variant, onComplete }: { article: Article; variant: "menu" | "zone"; onComplete: (result: Result) => void }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState<Result | null>(null);
  const published = hasPublicVersion(article);
  const unavailable = article.status === "publishing";
  function open(next: Mode) { setMode(next); setTyped(""); setError(""); setPartial(null); }
  function close() { if (!busy) { setMode(null); setTyped(""); setError(""); setPartial(null); } }
  async function submit() {
    if (!mode || busy || (mode === "everything" && typed !== "DELETE")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/articles/${article.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, confirmation: mode === "everything" ? typed : mode === "draft" ? "Delete Draft" : "Unpublish", storageSha: article.storageSha }) });
      const result = await response.json() as Result & { error?: string };
      if (response.status === 207) { setPartial(result); return; }
      if (!response.ok || !result.complete) throw new Error(result.error || result.message || "Could not delete article. No files were removed.");
      setMode(null); setTyped(""); setPartial(null); onComplete(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete article. No files were removed."); }
    finally { setBusy(false); }
  }
  const actions = published ? <><button type="button" disabled={unavailable} onClick={() => open("unpublish")}>Unpublish from Hearth &amp; Thread</button><button type="button" className="destructive-text" disabled={unavailable} onClick={() => open("everything")}><Trash2 size={15}/> Delete Everything</button></> : <button type="button" className="destructive-text" disabled={unavailable} onClick={() => open("draft")}><Trash2 size={15}/> Delete Draft</button>;
  return <>
    {variant === "menu" ? <details className="article-actions-menu"><summary aria-label={`More actions for ${article.title || "Untitled article"}`} title="More actions"><MoreHorizontal size={18}/></summary><div className="article-actions-popover"><Link href={`/articles/${article.id}/edit`}>Edit</Link><Link href={`/preview/${article.id}`}>Preview</Link>{published && article.publicUrl ? <a href={article.publicUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/> View Live</a> : article.status === "ready" ? <Link href={`/articles/${article.id}/edit?tab=review`}>Publish</Link> : null}{actions}</div></details> : <section className="danger-zone"><h3>Danger Zone</h3><p>{published ? "Remove the live article while keeping this draft, or permanently delete both." : "Permanently remove this draft and its privately stored images."}</p><div className="danger-actions">{actions}</div>{unavailable && <p>Check the publishing outcome before removing this article.</p>}</section>}
    {mode && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><div className="delete-modal" role="dialog" aria-modal="true" aria-label={mode === "draft" ? "Confirm draft deletion" : mode === "unpublish" ? "Confirm unpublishing" : "Confirm permanent deletion"}><button className="modal-close" aria-label="Close" disabled={busy} onClick={close}><X size={19}/></button><div className="eyebrow destructive-text">DESTRUCTIVE ACTION</div><h2>{mode === "draft" ? "Delete this draft?" : mode === "unpublish" ? "Unpublish this article?" : "Delete published article and draft?"}</h2><strong className="delete-article-title">“{article.title || "Untitled article"}”</strong><p>{mode === "draft" ? "This permanently removes the private Studio draft and its stored draft images. This cannot be undone." : mode === "unpublish" ? "This removes the article and its article-specific images from Hearth & Thread. The Studio draft and private images remain available for editing and republishing." : "This removes the public article, its article-specific public images, the private Studio draft, and its draft images. This cannot be undone automatically."}</p>{mode === "everything" && <label className="field"><span>Type DELETE exactly to confirm</span><input value={typed} onChange={event => setTyped(event.target.value)} autoComplete="off" placeholder="DELETE"/></label>}
      {partial && <div className="delete-partial" role="alert"><strong>Cleanup is incomplete.</strong><p>{partial.message}</p><ul>{partial.completed.map(item => <li key={item}>{item}</li>)}</ul></div>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="publish-modal-actions"><button className="button secondary" disabled={busy} onClick={close}>Cancel</button><button className="button destructive" disabled={busy || mode === "everything" && typed !== "DELETE"} onClick={() => void submit()}>{busy ? "Working…" : partial ? "Retry Cleanup" : mode === "draft" ? "Delete Draft" : mode === "unpublish" ? "Unpublish Article" : "Delete Everything"}</button></div>
    </div></div>}
  </>;
}
