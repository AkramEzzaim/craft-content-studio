import { apiAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { getArticle, saveArticle } from "@/lib/storage";
import { executePublicCommit, inspectTarget, PublishError, type PublishMode } from "@/lib/publishing";
import { serializePublicArticle } from "@/lib/public-adapter";
import { GithubError } from "@/lib/github";
import { assess, publishIssues } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const denied = await apiAuth(request); if (denied) return denied;
  try {
    const article = await getArticle((await params).id);
    if (!article) return Response.json({ error: "Article not found", code: "ARTICLE_NOT_FOUND" }, { status: 404 });
    if (!["ready", "publishing"].includes(article.status)) throw new PublishError("Mark the saved article ready after review before publishing.", "ARTICLE_NOT_READY", 409);
    const { target, existing, image, gallery } = await inspectTarget(article);
    const scores = assess(article);
    return Response.json({ title: article.title, slug: article.slug, status: article.status, qualityScore: scores.qualityScore, seoScore: scores.seoScore, warnings: [...scores.quality, ...scores.seo].filter(x => !x.pass).map(x => x.label), target, image, gallery, existing: existing ? { sha: existing.sha } : null, storageSha: article.storageSha, recoveryAvailable: article.status === "publishing" && !!existing && existing.content === serializePublicArticle(article) && (!image || image.sameContent) && gallery.every(item => item.sameContent), retryAvailable: article.status === "publishing" && !existing });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, { params }: Context) {
  const denied = await apiAuth(request); if (denied) return denied;
  try {
    const body = await request.json().catch(() => null) as { mode?: PublishMode; expectedSha?: string; expectedImageSha?: string; replaceImage?: boolean; storageSha?: string } | null;
    const mode = body?.mode;
    if (mode !== "create" && mode !== "update" && mode !== "reconcile") throw new PublishError("Choose a valid publishing action.", "INVALID_ACTION");
    const article = await getArticle((await params).id);
    if (!article) return Response.json({ error: "Article not found", code: "ARTICLE_NOT_FOUND" }, { status: 404 });
    if (body?.storageSha !== article.storageSha) throw new PublishError("This draft changed after the confirmation opened. Reload it before publishing.", "DRAFT_CHANGED", 409);
    if (mode === "reconcile") {
      if (article.status !== "publishing") throw new PublishError("This article is not awaiting a publishing result.", "ARTICLE_NOT_PUBLISHING", 409);
      let result;
      try { result = await executePublicCommit(article, "reconcile"); }
      catch (error) {
        if (error instanceof PublishError && error.code === "NO_MATCHING_COMMIT" && !(await inspectTarget(article)).existing) {
          const saved = await saveArticle({ ...article, status: "failed", updatedAt: new Date().toISOString(), publishError: "No public article commit was found. The draft can be marked ready and retried." });
          return Response.json({ article: saved, error: "No public article commit was found. Mark the draft ready and retry publishing.", code: "PUBLISHING_RETRY_AVAILABLE" }, { status: 409 });
        }
        throw error;
      }
      const saved = await saveArticle({ ...article, status: "published", updatedAt: new Date().toISOString(), publishedAt: article.publishedAt || article.updatedAt, publishedSha: result.fileSha, publishedPath: result.target.path, publishedBranch: result.target.branch, githubCommitSha: result.commitSha, githubPath: result.target.path, githubRepository: result.target.repository, publicUrl: result.target.url, publishError: undefined });
      return Response.json({ article: saved, commitSha: result.commitSha, url: result.target.url, path: result.target.path, reconciled: true });
    }
    if (article.status !== "ready") throw new PublishError("Mark the saved article ready after review before publishing.", "ARTICLE_NOT_READY", 409);
    const issues = publishIssues(article); if (issues.length) throw new PublishError(issues.join("; "), "INVALID_ARTICLE");
    const { existing, image, gallery } = await inspectTarget(article);
    if (mode === "create" && existing) throw new PublishError("An article with this slug already exists. Review it and confirm an update to continue.", "ARTICLE_ALREADY_EXISTS", 409, existing.sha);
    if (mode === "update" && (!existing || body?.expectedSha !== existing.sha)) throw new PublishError("The public article changed since you opened the confirmation. Refresh before updating.", "ARTICLE_CHANGED", 409, existing?.sha);
    if (image?.replaceRequired && (!body?.replaceImage || body.expectedImageSha !== image.existingSha)) throw new PublishError("A public image with this filename already exists. Confirm replacement before publishing.", "PUBLIC_IMAGE_EXISTS", 409, image.existingSha);
    if (gallery.some(item => item.replaceRequired)) throw new PublishError("A public photo with this filename already exists. Remove and upload it again.", "PUBLIC_IMAGE_EXISTS", 409);
    const progress = await saveArticle({ ...article, status: "publishing", updatedAt: new Date().toISOString(), publishError: undefined });
    let result;
    try { result = await executePublicCommit(progress, mode, body?.expectedSha, body?.expectedImageSha, body?.replaceImage === true); }
    catch (error) {
      // A timeout can happen after GitHub accepted a commit. Leave this state reconcilable.
      if (error instanceof PublishError || (error instanceof GithubError && [401, 403, 404, 409, 429].includes(error.status))) {
        try { await saveArticle({ ...progress, status: "failed", publishError: error.message, updatedAt: new Date().toISOString() }); }
        catch { /* Preserve the original error; the publishing state remains recoverable. */ }
      }
      throw error;
    }
    try {
      const saved = await saveArticle({ ...progress, status: "published", updatedAt: new Date().toISOString(), publishedAt: progress.publishedAt || progress.updatedAt, publishedSha: result.fileSha, publishedPath: result.target.path, publishedBranch: result.target.branch, githubCommitSha: result.commitSha, githubPath: result.target.path, githubRepository: result.target.repository, publicUrl: result.target.url, publishError: undefined });
      return Response.json({ article: saved, commitSha: result.commitSha, url: result.target.url, path: result.target.path, reconciled: false });
    } catch {
      throw new PublishError("GitHub accepted the commit, but the private status update failed. Use Check publishing outcome to reconcile it.", "COMMIT_RECORDED_STATUS_PENDING", 502);
    }
  } catch (error) { return errorResponse(error); }
}
