"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { emptyArticle, type Article } from "@/lib/types";
import { rawFingerprint } from "@/lib/raw-fingerprint";
import { FeaturedImageUpload } from "./featured-image-upload";
import { GalleryUpload } from "./gallery-upload";
import { ArticleDeletion } from "./article-deletion";

type Assignment = "intro" | "materials" | "instructions" | "notes" | "mistakes" | "variations" | "faq" | "other";
const assignmentOptions: { value: Assignment; label: string }[] = [{ value: "intro", label: "Introduction" }, { value: "materials", label: "Materials" }, { value: "instructions", label: "Round / step" }, { value: "notes", label: "Notes" }, { value: "mistakes", label: "Mistakes" }, { value: "variations", label: "Variations" }, { value: "faq", label: "FAQ" }, { value: "other", label: "Other" }];
export function PasteArticleEditor({ initial, publicSiteUrl }: { initial?: Article; publicSiteUrl: string }) {
  const router = useRouter();
  const [article, setArticle] = useState<Article>(initial || emptyArticle());
  const [raw, setRaw] = useState(initial?.rawSource || "");
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const parsed = !!article.rawSource && article.parseFingerprint === rawFingerprint(raw) && !dirty;
  async function save(next: Article) {
    const existing = !!next.storageSha;
    const response = await fetch(existing ? `/api/articles/${next.id}` : "/api/articles", { method: existing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...next, rawSource: raw, status: existing ? "review" : "draft" }) });
    const result = await response.json() as Article & { error?: string };
    if (!response.ok) throw new Error(result.error || "Could not save the draft");
    setArticle(result); setDirty(false);
    if (!existing) router.replace(`/articles/${result.id}/edit?mode=raw`);
    return result;
  }
  async function saveRaw() {
    setBusy(true); setError("");
    try { await save({ ...article, rawSource: raw }); setMessage("Draft saved in the private Studio repository."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Save failed"); }
    finally { setBusy(false); }
  }
  async function parse() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/parse-pattern", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawSource: raw, assignments }) });
      const data = await response.json() as Article & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not parse the pattern");
      const next = { ...data, id: article.id, createdAt: article.createdAt, storageSha: article.storageSha, draftImage: article.draftImage, galleryImages: article.galleryImages, featuredImage: article.featuredImage, status: article.status, rawSource: raw };
      const saved = await save(next);
      setMessage(saved.parseWarnings?.length ? "Pattern parsed and saved. Review the warnings below." : "Pattern parsed and saved. Review the article before publishing.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Parse failed"); }
    finally { setBusy(false); }
  }
  async function imageRequest(method: "POST" | "DELETE", type: "featured-image" | "gallery-image", image?: File, imageId?: string) {
    let saved = article;
    if (!saved.storageSha || dirty) saved = await save({ ...saved, rawSource: raw });
    const payload = method === "POST" ? new FormData() : null;
    if (payload && image) { payload.set("image", image); payload.set("storageSha", saved.storageSha || ""); }
    const response = await fetch(`/api/articles/${saved.id}/${type}`, { method, ...(payload ? { body: payload } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storageSha: saved.storageSha, imageId }) }) });
    const result = await response.json() as Article & { error?: string };
    if (!response.ok) throw new Error(result.error || "Image request failed");
    setArticle(result); setDirty(false); return result;
  }
  async function uploadFeatured(file: File) { setBusy(true); setError(""); try { await imageRequest("POST", "featured-image", file); setMessage("Featured image saved privately."); } finally { setBusy(false); } }
  async function uploadGallery(files: File[]) {
    setBusy(true); setError("");
    try {
      let saved = !article.storageSha || dirty ? await save({ ...article, rawSource: raw }) : article;
      for (const file of files) {
        const payload = new FormData(); payload.set("image", file); payload.set("storageSha", saved.storageSha || "");
        const response = await fetch(`/api/articles/${saved.id}/gallery-image`, { method: "POST", body: payload });
        const result = await response.json() as Article & { error?: string };
        if (!response.ok) throw new Error(result.error || `Could not upload ${file.name}`);
        saved = result; setArticle(result);
      }
      setMessage(`${files.length} photo${files.length === 1 ? "" : "s"} saved privately.`);
    } finally { setBusy(false); }
  }
  async function removeImage(id?: string) { setBusy(true); setError(""); try { await imageRequest("DELETE", id ? "gallery-image" : "featured-image", undefined, id); } finally { setBusy(false); } }
  function changeImages(id: string, direction: -1 | 1) {
    const images = [...(article.galleryImages || [])], index = images.findIndex(image => image.id === id), target = index + direction;
    if (index < 0 || target < 0 || target >= images.length) return;
    [images[index], images[target]] = [images[target], images[index]];
    setArticle(current => ({ ...current, galleryImages: images })); setDirty(true);
  }
  async function legacy() {
    const current = !article.storageSha || dirty ? await save({ ...article, rawSource: raw }) : article;
    const source = raw.replace(/^# [^\n]+\n?/, "").trim();
    await save({ ...current, rawSource: raw, contentMode: "markdown", contentMarkdown: source });
    router.push(`/articles/${current.id}/edit?tab=review`);
  }
  return <div className="paste-editor">
    <div className="page-head"><div><div className="eyebrow">CROCHET CONTENT STUDIO</div><h1>{article.storageSha ? "Raw article" : "Create crochet article"}</h1><p>Paste your complete pattern. Studio will sort it into editable sections.</p></div><div className="head-actions"><Link href="/articles" className="button light">All articles</Link>{article.storageSha && <Link href={`/articles/${article.id}/edit?tab=review`} className="button secondary">Review article</Link>}</div></div>
    {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="success-message" role="status">{message}</div>}
    <section className="editor-card paste-card"><label className="field"><span>Paste your complete crochet pattern</span><textarea className="paste-source" value={raw} onChange={event => { setRaw(event.target.value); setDirty(true); setMessage(""); }} placeholder="# Easy Crochet Sunflower Coaster\n\n## Short Introduction\n...\n\n## Materials\n- Cotton yarn\n\n# Main Pattern\n## Round 1\n### Pattern\n..."/></label><div className="paste-actions"><button className="button primary" disabled={busy || !raw.trim()} onClick={() => void parse()}>{busy ? "Working…" : "Parse Pattern"}</button><button className="button secondary" disabled={busy || !raw.trim()} onClick={() => void saveRaw()}>Save Draft</button></div></section>
    <div className="paste-media"><section className="editor-card"><h2>Featured image</h2><FeaturedImageUpload article={article} upload={uploadFeatured} remove={() => removeImage()} busy={busy} publicSiteUrl={publicSiteUrl}/></section><section className="editor-card"><h2>Additional photos</h2>{!!article.suggestedPhotos?.length && <div className="photo-suggestions"><h4>Suggested shots</h4><ul>{article.suggestedPhotos.map((photo, index) => <li key={index}>{photo}</li>)}</ul></div>}<GalleryUpload article={article} upload={uploadGallery} remove={id => removeImage(id)} move={changeImages} update={(id, key, value) => { setArticle(current => ({ ...current, galleryImages: (current.galleryImages || []).map(image => image.id === id ? { ...image, [key]: value } : image) })); setDirty(true); }} busy={busy}/></section></div>
    {parsed && <section className="editor-card paste-results"><div className="eyebrow">ARTICLE DETECTED</div><h2>{article.title || "Title not detected"}</h2><div className="builder-review-counts">{[["Introduction", article.description ? "✓" : "Missing"], ["Project info", article.estimatedTime || article.yarnWeight || article.hookSize ? "✓" : "Missing"], ["Materials", article.materials.length], ["Abbreviations", article.abbreviationEntries?.length || 0], ["Rounds / steps", article.instructions?.length || 0], ["Notes", article.noteEntries?.length || article.importantNotes?.length || 0], ["Mistakes", article.mistakes?.length || 0], ["Variations", article.variations?.length || 0], ["FAQ", article.faq.length], ["Suggested photos", article.suggestedPhotos?.length || 0], ["Featured image", article.draftImage ? "✓" : "Missing"]].map(([label, value]) => <span key={label}>{label}: <strong>{value}</strong></span>)}</div>
      {!!article.parseWarnings?.length && <div className="review-requirements"><h3>Review these sections</h3><ul className="issue-list">{article.parseWarnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
      {!!article.unparsedSections?.length && <div className="unparsed-list"><h3>Unparsed content</h3><p>Assign each section, then parse again. Your original text stays above.</p>{article.unparsedSections.map((section, index) => <div className="unparsed-item" key={`${section.heading}-${index}`}><strong>{section.heading}</strong><p>{section.body.slice(0, 500)}</p><label className="field"><span>Assign to</span><select value={assignments[section.heading] || ""} onChange={event => setAssignments(current => ({ ...current, [section.heading]: event.target.value as Assignment }))}><option value="">Choose a section</option>{assignmentOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>)}</div>}
      <div className="paste-actions"><Link className="button primary" href={`/articles/${article.id}/edit?tab=review`}>Review Parsed Article</Link><Link className="button secondary" href={`/preview/${article.id}`}>Full Preview</Link></div>
    </section>}
    {article.storageSha && <details className="builder-advanced"><summary>Advanced</summary><p>The original paste remains saved. If parsing cannot represent the article, use the legacy Markdown editor and complete the publishing checks there.</p><button className="button light" onClick={() => void legacy()}>Use legacy Markdown article</button><pre className="generated-markdown-preview">{article.contentMarkdown}</pre></details>}
    {article.storageSha && <ArticleDeletion article={article} variant="zone" onComplete={result => { if (result.removed) router.push(`/articles?notice=${result.retainedAssets?.length ? "deleted-assets-retained" : result.mode === "draft" ? "draft-deleted" : "everything-deleted"}`); else if (result.article) { setArticle(result.article); setMessage(result.message); } }}/>}
  </div>;
}
