"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Eye, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { accuracyItems, articleTypes, categories, emptyArticle, type Article, type InstructionStep } from "@/lib/types";
import { applyArticleDefaults, suggestedImageAlt, suggestedMetaDescription, suggestedSeoTitle, suggestedSlug, suggestedTags } from "@/lib/article-defaults";
import { generatedMarkdown } from "@/lib/article-markdown";
import { publicImageUrl } from "@/lib/image-path";
import { assess, publishIssues } from "@/lib/validation";
import { PublicPreview } from "./public-preview";
import { FeaturedImageUpload } from "./featured-image-upload";
import { PublishPanel } from "./publish-panel";
import { Score, StatusBadge } from "./status";

const tabs = ["Basics", "Pattern", "Image", "Review", "Advanced"] as const;
type Tab = typeof tabs[number];
function normalized(article: Article): Article {
  const next = applyArticleDefaults(article);
  if (next.draftImage) next.featuredImage = publicImageUrl(next.slug, next.draftImage.extension);
  if (next.contentMode === "structured") next.contentMarkdown = generatedMarkdown(next);
  return next;
}
export function Editor({ initial, openGenerate = false, publishMissingConfig = [], publicSiteUrl = "https://craft-iota-wheat.vercel.app", initialTab = "Basics" }: { initial?: Article; openGenerate?: boolean; publishMissingConfig?: string[]; publicSiteUrl?: string; initialTab?: Tab }) {
  const router = useRouter();
  const [article, setArticle] = useState<Article>(initial || emptyArticle());
  const [tab, setTab] = useState<Tab>(initialTab);
  const [showGenerate, setShowGenerate] = useState(openGenerate);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [gen, setGen] = useState({ topic: "", primaryKeyword: "", articleType: "Free Crochet Pattern", difficulty: "Beginner", audience: "Beginner crocheters", specialInstructions: "" });
  const scores = assess(article);
  const issues = publishIssues(article);
  const structured = article.contentMode === "structured";

  function set<K extends keyof Article>(key: K, value: Article[K]) {
    setArticle(current => {
      const next = { ...current, [key]: value } as Article;
      if (key === "title") {
        if (!current.slug || current.slug === suggestedSlug(current.title)) next.slug = suggestedSlug(String(value));
        if (!current.seoTitle || current.seoTitle === suggestedSeoTitle(current)) next.seoTitle = suggestedSeoTitle(next);
        if (!current.imageAlt || current.imageAlt === suggestedImageAlt(current)) next.imageAlt = suggestedImageAlt(next);
      }
      if (key === "description" && (!current.metaDescription || current.metaDescription === suggestedMetaDescription(current))) next.metaDescription = suggestedMetaDescription(next);
      if (key === "difficulty" && (!current.seoTitle || current.seoTitle === suggestedSeoTitle(current))) next.seoTitle = suggestedSeoTitle(next);
      if ((key === "primaryKeyword" || key === "difficulty" || key === "articleType") && (!current.tags.length || current.tags.join("|") === suggestedTags(current).join("|"))) next.tags = suggestedTags(next);
      if (key === "yarnWeight" && (!current.imageAlt || current.imageAlt === suggestedImageAlt(current))) next.imageAlt = suggestedImageAlt(next);
      return normalized(next);
    });
    setDirty(true); setMessage("");
  }
  function field(label: string, key: keyof Article, placeholder = "", multiline = false) {
    return <label className="field"><span>{label}</span>{multiline ? <textarea rows={3} value={String(article[key] || "")} placeholder={placeholder} onChange={event => set(key, event.target.value as never)}/> : <input value={String(article[key] || "")} placeholder={placeholder} onChange={event => set(key, event.target.value as never)}/>}</label>;
  }
  function lines(label: string, key: keyof Article, placeholder = "One item per line") {
    const values = article[key] as string[];
    return <label className="field"><span>{label}</span><textarea rows={4} value={values.join("\n")} placeholder={placeholder} onChange={event => set(key, event.target.value.split("\n").map(item => item.trim()).filter(Boolean) as never)}/></label>;
  }
  async function writeDraft(next: Article, status?: "ready") {
    const persisted = !!next.storageSha;
    const prepared = normalized({ ...next, status: status || (persisted ? "review" : "draft") });
    const response = await fetch(persisted ? `/api/articles/${next.id}` : "/api/articles", { method: persisted ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prepared) });
    const data = await response.json() as Article & { error?: string };
    if (!response.ok) throw new Error(data.error || "Could not save the draft");
    setArticle(data); setDirty(false);
    if (!persisted) router.replace(`/articles/${data.id}/edit`);
    router.refresh();
    return data;
  }
  async function save(status?: "ready") {
    setBusy(true); setError(""); setMessage("");
    try {
      if (status === "ready" && issues.length) { setTab("Review"); throw new Error(`Resolve publishing checks: ${issues.join("; ")}`); }
      await writeDraft(article, status);
      setMessage(status ? "Marked ready for publishing" : "Draft saved");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Save failed"); }
    finally { setBusy(false); }
  }
  async function uploadImage(file: File) {
    setBusy(true); setError("");
    try {
      const saved = !article.storageSha || dirty ? await writeDraft(article) : article;
      const data = new FormData(); data.set("image", file); data.set("storageSha", saved.storageSha || "");
      const response = await fetch(`/api/articles/${saved.id}/featured-image`, { method: "POST", body: data });
      const result = await response.json() as Article & { error?: string };
      if (!response.ok) throw new Error(result.error || "Image upload failed");
      setArticle(result); setDirty(false); setMessage("Featured image saved with the private draft"); router.refresh();
    } finally { setBusy(false); }
  }
  async function removeImage() {
    setBusy(true); setError("");
    try {
      const saved = dirty ? await writeDraft(article) : article;
      if (!saved.storageSha) return;
      const response = await fetch(`/api/articles/${saved.id}/featured-image`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storageSha: saved.storageSha }) });
      const result = await response.json() as Article & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not remove image");
      setArticle(result); setDirty(false); setMessage("Featured image removed from the draft"); router.refresh();
    } finally { setBusy(false); }
  }
  async function generate() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(gen) });
      const data = await response.json() as Article & { error?: string };
      if (!response.ok) throw new Error(data.error || "Generation failed");
      setArticle(data); setDirty(false); setShowGenerate(false); setTab("Pattern");
      setMessage("AI draft saved. Review every instruction and accuracy check before publishing.");
      router.replace(`/articles/${data.id}/edit`); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Generation failed"); }
    finally { setBusy(false); }
  }
  function switchToMarkdown() { set("contentMode", "markdown"); setTab("Advanced"); }
  function switchToStructured() {
    if (!confirm("Switch to structured fields? The current Markdown will be replaced by content generated from the Pattern fields.")) return;
    set("contentMode", "structured"); setTab("Pattern");
  }
  function updateStep(index: number, key: keyof InstructionStep, value: string) { set("instructions", (article.instructions || []).map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)); }

  return <>
    <div className="editor-top"><div><Link href="/articles" className="back-link"><ArrowLeft size={16}/> Articles</Link><div className="editor-title-row"><h1>{article.title || "New article"}</h1><StatusBadge status={article.status}/></div><p>Write the pattern, add an image, review, and publish.</p></div><div className="head-actions"><button className="button secondary" onClick={() => setShowGenerate(true)}><Sparkles size={16}/> Generate with AI</button>{article.storageSha && <Link className="button secondary" href={`/preview/${article.id}`}><Eye size={16}/> Full preview</Link>}<button className="button primary" disabled={busy || article.status === "publishing"} onClick={() => void save()}><Save size={16}/>{busy ? "Working…" : "Save draft"}</button></div></div>
    {article.aiGenerated && <div className="ai-warning">✳ AI GENERATED — REVIEW REQUIRED. Check stitch counts, round transitions, materials, and instructions yourself.</div>}
    {message && <div className="success-message" role="status"><Check size={16}/>{message}</div>}
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="editor-grid"><div className="editor-main"><div className="editor-tabs">{tabs.map(item => <button key={item} className={tab === item ? "selected" : ""} onClick={() => setTab(item)}>{item}</button>)}</div><div className="editor-card">
      {tab === "Basics" && <><div className="section-heading"><div className="eyebrow">01 / THE IDEA</div><h2>Article basics</h2><p>Only the information needed to shape the article.</p></div><div className="form-grid">{field("Article title", "title", "Easy Crochet Flower Pattern")}{field("Primary keyword", "primaryKeyword", "easy crochet flower pattern")}{field("Difficulty", "difficulty", "Beginner")}{field("Estimated time", "estimatedTime", "1 hour")}{field("Short description", "description", "What will readers make?", true)}</div><p className="editor-help">Slug, SEO title, description, tags, and image alt text are suggested automatically. Edit them in Advanced if needed.</p></>}
      {tab === "Pattern" && <><div className="section-heading"><div className="eyebrow">02 / THE PATTERN</div><h2>Write the making steps</h2><p>Use plain fields. Studio turns them into the public article’s Markdown.</p></div>{!structured && <div className="publish-conflict"><strong>This draft uses the Advanced Markdown Editor.</strong><span>Its existing article text is preserved. You can keep editing it in Advanced, or switch to structured fields.</span><button className="button secondary" onClick={switchToStructured}>Use structured fields</button></div>}{structured && <>{field("Introduction", "introduction", "Introduce the project in a few sentences", true)}<div className="form-grid">{field("Yarn type", "yarnType", "Cotton yarn")}{field("Yarn weight", "yarnWeight", "Medium weight")}{field("Hook size", "hookSize", "4 mm")}</div><div className="subsection-head"><h3>Materials</h3><button className="button light" onClick={() => set("materials", [...article.materials, ""])}><Plus size={15}/> Add material</button></div>{article.materials.map((item, index) => <div className="repeat-row" key={index}><input aria-label={`Material ${index + 1}`} placeholder="e.g. Medium-weight yarn" value={item} onChange={event => set("materials", article.materials.map((value, position) => position === index ? event.target.value : value))}/><button aria-label={`Remove material ${index + 1}`} onClick={() => set("materials", article.materials.filter((_, position) => position !== index))}><Trash2 size={16}/></button></div>)}<div className="subsection-head"><h3>Instructions</h3><button className="button light" onClick={() => set("instructions", [...(article.instructions || []), { title: "", instruction: "" }])}><Plus size={15}/> Add step</button></div>{(article.instructions || []).map((step, index) => <div className="step-card" key={index}><div className="subsection-head"><h4>Step {index + 1}</h4><button className="button light" aria-label={`Remove step ${index + 1}`} onClick={() => set("instructions", (article.instructions || []).filter((_, position) => position !== index))}><Trash2 size={15}/></button></div><input aria-label={`Step ${index + 1} title`} placeholder="Step title, e.g. Create the center" value={step.title} onChange={event => updateStep(index, "title", event.target.value)}/><textarea aria-label={`Step ${index + 1} instruction`} rows={4} placeholder="Describe the stitches and counts clearly" value={step.instruction} onChange={event => updateStep(index, "instruction", event.target.value)}/></div>)}<div className="subsection-head"><h3>Beginner tips</h3><button className="button light" onClick={() => set("beginnerTips", [...(article.beginnerTips || []), ""])}><Plus size={15}/> Add tip</button></div>{(article.beginnerTips || []).map((tip, index) => <div className="repeat-row" key={index}><input aria-label={`Beginner tip ${index + 1}`} value={tip} placeholder="A practical tip for beginners" onChange={event => set("beginnerTips", (article.beginnerTips || []).map((value, position) => position === index ? event.target.value : value))}/><button aria-label={`Remove tip ${index + 1}`} onClick={() => set("beginnerTips", (article.beginnerTips || []).filter((_, position) => position !== index))}><Trash2 size={16}/></button></div>)}<div className="subsection-head"><h3>FAQ</h3><button className="button light" onClick={() => set("faq", [...article.faq, { question: "", answer: "" }])}><Plus size={15}/> Add FAQ</button></div>{article.faq.map((item, index) => <div className="step-card" key={index}><input aria-label={`FAQ ${index + 1} question`} placeholder="Question" value={item.question} onChange={event => set("faq", article.faq.map((value, position) => position === index ? { ...value, question: event.target.value } : value))}/><textarea aria-label={`FAQ ${index + 1} answer`} rows={3} placeholder="Answer" value={item.answer} onChange={event => set("faq", article.faq.map((value, position) => position === index ? { ...value, answer: event.target.value } : value))}/><button className="button light" onClick={() => set("faq", article.faq.filter((_, position) => position !== index))}>Remove FAQ</button></div>)}</>}</>}
      {tab === "Image" && <><div className="section-heading"><div className="eyebrow">03 / FEATURED IMAGE</div><h2>Add the project photo</h2><p>Choose a local image. Studio keeps it with the private draft and copies it to the public site when you publish.</p></div><FeaturedImageUpload article={article} upload={uploadImage} remove={removeImage} busy={busy} publicSiteUrl={publicSiteUrl}/></>}
      {tab === "Review" && <><div className="section-heading"><div className="eyebrow">04 / FINAL REVIEW</div><h2>Ready for the world?</h2><p>Review the article and verify each crochet instruction before publishing.</p></div><div className="review-scores"><Score value={scores.qualityScore} label="Content quality"/><Score value={scores.seoScore} label="SEO guidance"/></div><div className="review-actions"><button className="button secondary" disabled={busy || !article.storageSha || !!issues.length || article.status === "publishing"} onClick={() => void save("ready")}>Mark ready</button>{!article.storageSha && <span className="publish-hint">Save the draft first.</span>}</div><PublishPanel article={article} missingConfig={publishMissingConfig} dirty={dirty} onArticleChange={next => { setArticle(next); setDirty(false); router.refresh(); }}/><div className="review-preview"><h3>Article preview</h3><PublicPreview article={article} compact publicSiteUrl={publicSiteUrl}/></div><div className="seo-summary"><h3>SEO summary</h3><p><strong>Title:</strong> {article.seoTitle || "Add a title"}</p><p><strong>Description:</strong> {article.metaDescription || "Add a short description"}</p><p><strong>Tags:</strong> {article.tags.join(", ") || "—"}</p></div>{article.articleType === "Free Crochet Pattern" && <div className="accuracy-box"><h3>Crochet accuracy checklist</h3><p>Check every item yourself before marking this article ready.</p>{accuracyItems.map(item => <label key={item} className="accuracy-item"><input type="checkbox" checked={article.accuracyChecks.includes(item)} onChange={event => set("accuracyChecks", event.target.checked ? [...article.accuracyChecks, item] : article.accuracyChecks.filter(value => value !== item))}/>{item}</label>)}</div>}{issues.length > 0 && <div className="review-requirements"><h3>Required before publishing</h3><ul className="issue-list">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}</>}
      {tab === "Advanced" && <><div className="section-heading"><div className="eyebrow">OPTIONAL DETAILS</div><h2>Advanced settings</h2><p>Override suggestions or add details that do not belong in the main workflow.</p></div><details className="advanced-group"><summary>SEO and article settings</summary><div className="form-grid">{field("Slug", "slug", "auto-generated-from-title")}{field("SEO title", "seoTitle")}{field("Meta description", "metaDescription", "", true)}{lines("Tags", "tags")}{lines("Secondary keywords", "secondaryKeywords")}{field("Canonical slug", "canonicalSlug")}{field("Author", "author")}<label className="field"><span>Article type</span><select value={article.articleType} onChange={event => set("articleType", event.target.value)}>{articleTypes.map(value => <option key={value}>{value}</option>)}</select></label><label className="field"><span>Category</span><select value={article.category} onChange={event => set("category", event.target.value)}>{categories.map(value => <option key={value}>{value}</option>)}</select></label></div></details><details className="advanced-group"><summary>Advanced crochet details</summary><div className="form-grid">{field("Gauge", "gauge")}{field("Finished dimensions", "dimensions")}{lines("Required skills", "requiredSkills")}{lines("Tools", "tools")}{lines("Abbreviations", "abbreviations")}{lines("Pattern notes", "patternNotes")}{field("Sizing", "sizing", "", true)}{field("Safety notes", "safetyNotes", "", true)}</div></details><details className="advanced-group"><summary>Advanced Markdown Editor</summary><p className="editor-help">Use this for full control. The public renderer supports H2/H3 headings, paragraphs, bold, and lists.</p>{structured ? <><p>Studio is generating Markdown from the Pattern fields.</p><button className="button secondary" onClick={switchToMarkdown}>Edit Markdown directly</button><pre className="generated-markdown-preview">{article.contentMarkdown || "Add pattern content first."}</pre></> : <><button className="button light" onClick={switchToStructured}>Use structured fields</button><textarea className="markdown-editor" value={article.contentMarkdown} onChange={event => set("contentMarkdown", event.target.value)}/></>}</details><details className="advanced-group"><summary>Image metadata</summary><div className="form-grid">{field("Featured image alt text", "imageAlt")}{field("Featured image prompt", "featuredImagePrompt", "", true)}</div>{article.featuredImage && <p className="editor-help">Public image path: {article.featuredImage}</p>}</details><details className="advanced-group"><summary>Pinterest and social metadata</summary><div className="form-grid">{field("Pinterest image path (optional)", "pinterestImage", "/images/patterns/optional-pin.png")}{field("Pinterest title", "pinterestTitle")}{field("Pinterest description", "pinterestDescription", "", true)}{field("Open Graph title", "ogTitle")}{field("Open Graph description", "ogDescription", "", true)}</div></details><details className="advanced-group"><summary>Step images (optional)</summary><button className="button light" onClick={() => set("stepImages", [...article.stepImages, { url: "", alt: "", caption: "" }])}><Plus size={15}/> Add step image</button>{article.stepImages.map((image, index) => <div className="step-card" key={index}><input aria-label={`Step image ${index + 1} URL`} placeholder="Image URL" value={image.url} onChange={event => set("stepImages", article.stepImages.map((value, position) => position === index ? { ...value, url: event.target.value } : value))}/><input aria-label={`Step image ${index + 1} alt text`} placeholder="Alt text" value={image.alt} onChange={event => set("stepImages", article.stepImages.map((value, position) => position === index ? { ...value, alt: event.target.value } : value))}/><input aria-label={`Step image ${index + 1} caption`} placeholder="Caption" value={image.caption} onChange={event => set("stepImages", article.stepImages.map((value, position) => position === index ? { ...value, caption: event.target.value } : value))}/><button className="button light" onClick={() => set("stepImages", article.stepImages.filter((_, position) => position !== index))}>Remove</button></div>)}</details></>}
    </div></div><aside className="panel editor-side-card"><div className="eyebrow">ARTICLE HEALTH</div><div className="score-stack"><Score value={scores.qualityScore} label="Content quality"/><Score value={scores.seoScore} label="SEO guidance"/></div><div className="side-divider"/><div className="side-fact"><span>Status</span><StatusBadge status={article.status}/></div><div className="side-fact"><span>Word count</span><strong>{article.contentMarkdown.split(/\s+/).filter(Boolean).length}</strong></div><div className="side-fact"><span>Checks remaining</span><strong>{issues.length}</strong></div></aside></div>
    {showGenerate && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowGenerate(false); }}><div className="generate-modal"><button className="modal-close" onClick={() => setShowGenerate(false)}>×</button><div className="eyebrow">AI ASSISTED DRAFT</div><h2>Generate a crochet article</h2><p>The generated draft still needs your review.</p><div className="form-grid"><label className="field"><span>Topic</span><input value={gen.topic} onChange={event => setGen({ ...gen, topic: event.target.value })}/></label><label className="field"><span>Primary keyword</span><input value={gen.primaryKeyword} onChange={event => setGen({ ...gen, primaryKeyword: event.target.value })}/></label><label className="field"><span>Article type</span><select value={gen.articleType} onChange={event => setGen({ ...gen, articleType: event.target.value })}>{articleTypes.map(value => <option key={value}>{value}</option>)}</select></label><label className="field"><span>Difficulty</span><input value={gen.difficulty} onChange={event => setGen({ ...gen, difficulty: event.target.value })}/></label><label className="field"><span>Audience</span><input value={gen.audience} onChange={event => setGen({ ...gen, audience: event.target.value })}/></label><label className="field"><span>Special instructions</span><textarea rows={3} value={gen.specialInstructions} onChange={event => setGen({ ...gen, specialInstructions: event.target.value })}/></label></div><button className="button primary wide" disabled={busy || !gen.topic || !gen.primaryKeyword} onClick={() => void generate()}><Sparkles size={17}/>{busy ? "Generating…" : "Generate draft"}</button></div></div>}
  </>;
}
