"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Send, X } from "lucide-react";
import type { Article } from "@/lib/types";
import { assess, publishIssues, publishingFieldsPresent, publishingReadiness } from "@/lib/validation";

type Preview = {
  title: string; slug: string; status: string; qualityScore: number; seoScore: number; warnings: string[];
  target: { repository: string; branch: string; path: string; url: string; filename: string };
  existing: { sha: string } | null; storageSha: string; recoveryAvailable: boolean;
};
type Result = { article: Article; commitSha?: string; url: string; path: string; reconciled: boolean };
type ApiError = { error?: string; code?: string; existingSha?: string };
export function PublishPanel({ article, missingConfig, dirty, onArticleChange }: { article: Article; missingConfig: string[]; dirty: boolean; onArticleChange: (article: Article) => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [stage, setStage] = useState<"review" | "update" | "success">("review");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const configured = missingConfig.length === 0;
  const issues = publishIssues(article);
  const readiness = publishingReadiness(article, configured);
  const scores = assess(article);
  const showPublish = !!article.storageSha && configured && publishingFieldsPresent(article) && !["publishing", "published", "archived"].includes(article.status);
  const mayPublish = showPublish && article.status === "ready" && !dirty && issues.length === 0;
  const mayRecover = !!article.storageSha && article.status === "publishing" && configured && !dirty;
  async function open() {
    setLoading(true); setError(""); setResult(null); setStage("review");
    try {
      const response = await fetch(`/api/articles/${article.id}/publish`, { cache: "no-store" });
      const data = await response.json() as Preview & ApiError;
      if (!response.ok) throw new Error(data.error || "Could not inspect publishing target");
      setPreview(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not inspect publishing target"); }
    finally { setLoading(false); }
  }
  async function submit(mode: "create" | "update" | "reconcile") {
    if (!preview) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/articles/${article.id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, expectedSha: preview.existing?.sha, storageSha: preview.storageSha }) });
      const data = await response.json() as Result & ApiError;
      if (!response.ok) {
        if (data.code === "ARTICLE_ALREADY_EXISTS" && data.existingSha) {
          setPreview({ ...preview, existing: { sha: data.existingSha } });
          setStage("review");
        }
        if (data.code === "COMMIT_RECORDED_STATUS_PENDING") {
          const current = await fetch(`/api/articles/${article.id}`, { cache: "no-store" });
          if (current.ok) onArticleChange(await current.json() as Article);
        }
        throw new Error(data.error || "Publishing failed");
      }
      onArticleChange(data.article); setResult(data); setStage("success");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Publishing failed"); }
    finally { setLoading(false); }
  }
  function close() { if (!loading) { setPreview(null); setResult(null); setError(""); setStage("review"); } }
  const commitUrl = result?.commitSha && /^[a-f0-9]{40}$/i.test(result.commitSha) && preview ? `https://github.com/${preview.target.repository}/commit/${result.commitSha}` : "";
  return <>
    <div className="publish-readiness"><div className="subsection-head"><h3>Publishing readiness</h3><span className={readiness.every(x => x.pass) && !dirty && article.status === "ready" ? "ready-label" : "needs-review-label"}>{readiness.every(x => x.pass) && !dirty && article.status === "ready" ? "Ready to publish" : "Needs review"}</span></div><div className="readiness-grid">{readiness.map(check => <div className="check-row" key={check.label}><span className={check.pass ? "passed" : "unchecked"}>{check.pass ? "✓" : "·"}</span>{check.label}</div>)}</div>
      {issues.length > 0 && <ul className="issue-list">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
      {dirty && <p className="publish-hint">Save these changes and mark the article ready again before publishing.</p>}
      {missingConfig.length > 0 && <div className="publish-hint" role="status">Missing publishing configuration: <strong>{missingConfig.join(", ")}</strong>. Set these server environment variables and restart or redeploy Studio.</div>}
      {!!article.storageSha && configured && !publishingFieldsPresent(article) && <p className="publish-hint">Complete the required article fields shown above to reveal the Publish button.</p>}
      {showPublish && !mayPublish && article.status !== "ready" && <p className="publish-hint">Mark this saved article ready in the Review tab before publishing.</p>}
      {error && !preview && <div className="form-error" role="alert">{error}</div>}
      {!dirty && issues.length === 0 && scores.seoScore < 70 && <p className="publish-hint">SEO score is {scores.seoScore}/100. These are recommendations; you can publish after the required checks pass.</p>}
      {showPublish && <button className="button primary publish-button" disabled={!mayPublish || loading} onClick={open}><Send size={17}/> PUBLISH TO HEARTH &amp; THREAD</button>}
      {mayRecover && <button className="button secondary publish-button" disabled={loading} onClick={open}>Check publishing outcome</button>}
    </div>
    {preview && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><div className="publish-modal" role="dialog" aria-modal="true" aria-label="Confirm publication"><button className="modal-close" onClick={close} disabled={loading} aria-label="Close"><X size={20}/></button>
      {stage === "success" && result ? <><div className="publish-success-icon"><Check size={28}/></div><div className="eyebrow">GITHUB COMMIT CONFIRMED</div><h2>Article published successfully.</h2><p>The GitHub commit is complete. Vercel may still be rebuilding the public site; the URL is expected, not yet verified live.</p><dl className="publish-summary"><div><dt>Git commit</dt><dd>{result.commitSha || "Commit recorded"}</dd></div><div><dt>Expected public URL</dt><dd>{result.url}</dd></div></dl><div className="publish-modal-actions">{commitUrl && <a className="button secondary" href={commitUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/> View GitHub Commit</a>}<a className="button secondary" href={result.url} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Open Public Article</a><Link className="button primary" href="/articles">Return to Articles</Link></div></> : <><div className="eyebrow">{stage === "update" ? "SECOND CONFIRMATION" : preview.status === "publishing" ? "PUBLISHING OUTCOME" : "PUBLISHING REVIEW"}</div><h2>{stage === "update" ? "Update the existing article?" : preview.status === "publishing" ? "Check the previous commit" : "Confirm publication"}</h2><p>{stage === "update" ? "This will replace the public file at the destination below using its current GitHub file SHA." : preview.status === "publishing" ? "A previous attempt may have committed successfully. Checking it will not create another public commit." : "Review the destination and scores before making a public GitHub commit."}</p>
        <dl className="publish-summary"><div><dt>Title</dt><dd>{preview.title}</dd></div><div><dt>Slug</dt><dd>{preview.slug}</dd></div><div><dt>Status</dt><dd>{preview.status}</dd></div><div><dt>Content quality</dt><dd>{preview.qualityScore}/100</dd></div><div><dt>SEO score</dt><dd>{preview.seoScore}/100</dd></div><div><dt>Repository</dt><dd>{preview.target.repository}</dd></div><div><dt>Branch</dt><dd>{preview.target.branch}</dd></div><div><dt>Destination</dt><dd>{preview.target.path}</dd></div><div><dt>Filename</dt><dd>{preview.target.filename}</dd></div><div><dt>Expected URL</dt><dd>{preview.target.url}</dd></div></dl>
        {preview.existing && preview.status !== "publishing" && <div className="publish-conflict"><strong>An article with this slug already exists.</strong><span>It will remain unchanged unless you explicitly confirm the update.</span></div>}
        {preview.status === "publishing" && !preview.recoveryAvailable && <div className="form-error" role="alert">The public file does not match this publishing attempt. Inspect the public repository before trying again.</div>}
        {preview.warnings.length > 0 && <details className="publish-warnings"><summary>{preview.warnings.length} editorial suggestions remain</summary><ul>{preview.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></details>}
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="publish-modal-actions"><button className="button secondary" onClick={close} disabled={loading}>Cancel</button>{preview.status === "publishing" ? <button className="button primary" onClick={() => submit("reconcile")} disabled={loading || !preview.recoveryAvailable}>{loading ? "Checking…" : "Confirm status check"}</button> : preview.existing ? stage === "update" ? <button className="button primary" onClick={() => submit("update")} disabled={loading}>{loading ? "Updating…" : "Confirm Update"}</button> : <button className="button primary" onClick={() => setStage("update")} disabled={loading}>Update existing article</button> : <button className="button primary" onClick={() => submit("create")} disabled={loading}>{loading ? "Publishing…" : "Confirm Publish"}</button>}</div>
      </>}
    </div></div>}
  </>;
}
