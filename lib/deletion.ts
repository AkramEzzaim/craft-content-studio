import "server-only";
import { assertPrivateRepo, craftRepo, deleteFile, getFile, getFileSha, listFilesRecursive, safePath, studioRepo, verifyRepositoryBranch, type Repo } from "./github";
import { publicPath, publicPdfPath } from "./public-adapter";
import { draftArticlePath, saveArticle } from "./storage";
import { hasPublicVersion, type Article } from "./types";

export type DeleteMode = "draft" | "unpublish" | "everything";
export type DeleteOutcome = { complete: boolean; removed: boolean; mode: DeleteMode; message: string; completed: string[]; article?: Article; error?: string; retainedAssets?: string[] };
function publishedTarget(article: Article, repository: Repo) {
  if (article.githubRepository && article.githubRepository !== `${repository.owner}/${repository.name}`) throw new Error("This article was published to a different repository. Restore that configuration before deleting it.");
  if (article.publishedBranch && article.publishedBranch !== repository.branch) throw new Error("This article was published on a different branch. Restore that configuration before deleting it.");
  const path = safePath(article.publishedPath || article.githubPath || publicPath(article));
  const root = safePath(process.env.CRAFT_CONTENT_PATH || "");
  if (!path.startsWith(`${root}/`) || !path.endsWith(".md")) throw new Error("Recorded public article path is outside the configured content directory");
  const slug = path.slice(root.length + 1, -3);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Recorded public article slug is invalid");
  return { path, slug, pdfPath: publicPdfPath({ ...article, slug }), imageRoot: `public/images/patterns/${slug}` };
}
async function removeCurrentFile(repo: Repo, path: string, message: string) {
  const sha = await getFileSha(repo, path);
  if (!sha) return false;
  await deleteFile(repo, path, sha, message);
  return true;
}
const failureText = (error: unknown) => error instanceof Error ? error.message : "GitHub could not confirm the deletion";

export async function deleteArticleFiles(article: Article, mode: DeleteMode): Promise<DeleteOutcome> {
  if (!/^[0-9a-f-]{36}$/.test(article.id) || !article.storageSha) throw new Error("Invalid saved article");
  if (article.status === "publishing") throw new Error("Check the publishing outcome before deleting this article");
  const published = hasPublicVersion(article);
  if (mode === "draft" && published) throw new Error("This article has a public version. Choose Unpublish or Delete Everything.");
  if (mode !== "draft" && !published) throw new Error("This article has no recorded public version. Use Delete Draft.");

  // Discover and validate every target before changing either repository.
  const privateRepo = studioRepo();
  await assertPrivateRepo(privateRepo);
  const privatePath = draftArticlePath(article.id);
  const currentDraftSha = await getFileSha(privateRepo, privatePath);
  if (currentDraftSha !== article.storageSha) throw new Error("This draft changed. Reload it before deleting.");
  const privateRoot = `studio/assets/${article.id}`;
  const privateAssets = mode === "unpublish" ? [] : await listFilesRecursive(privateRepo, privateRoot);
  let publicRepo: Repo | undefined;
  let publicFile: { content: string; sha: string } | null = null;
  let publicAssets: string[] = [];
  let target: ReturnType<typeof publishedTarget> | undefined;
  let retainedAssets: string[] = [];
  if (mode !== "draft") {
    publicRepo = craftRepo();
    await verifyRepositoryBranch(publicRepo);
    target = publishedTarget(article, publicRepo);
    publicFile = await getFile(publicRepo, target.path);
    if (publicFile) {
      const slugMatch = /^slug:\s*"?([a-z0-9-]+)"?\s*$/m.exec(publicFile.content);
      if (slugMatch?.[1] !== target.slug) throw new Error("The public article no longer matches this Studio draft. No files were removed.");
      if (article.publishedSha && publicFile.sha !== article.publishedSha) throw new Error("The public article changed since Studio published it. No files were removed.");
    }
    const files = await listFilesRecursive(publicRepo, target.imageRoot);
    publicAssets = files.filter(path => /^public\/images\/patterns\/[a-z0-9-]+\/.+\.(?:jpe?g|png|webp|avif)$/i.test(path));
    retainedAssets = files.filter(path => !publicAssets.includes(path));
    if (article.featuredImage && /^\/images\/patterns\/[a-z0-9-]+\.(?:jpe?g|png|webp|avif)$/i.test(article.featuredImage)) {
      const flatPath = `public${article.featuredImage}`;
      if (await getFileSha(publicRepo, flatPath)) retainedAssets.push(flatPath);
    }
  }

  const completed: string[] = [];
  let stage = "";
  try {
    if (publicRepo && target) {
      stage = "public article deletion";
      if (publicFile && await removeCurrentFile(publicRepo, target.path, `content: delete ${target.slug}`)) completed.push("Public article removed from Hearth & Thread");
      else completed.push("Public article already absent");
      stage = "public PDF deletion";
      if (await removeCurrentFile(publicRepo, target.pdfPath, `content: delete ${target.slug} PDF`)) completed.push("Public PDF removed");
      else completed.push("Public PDF already absent");
      let publicDeleted = 0;
      let publicAbsent = 0;
      for (const path of publicAssets) {
        stage = `public image deletion (${path})`;
        if (await removeCurrentFile(publicRepo, path, `assets: delete ${target.slug} images`)) publicDeleted++;
        else publicAbsent++;
      }
      completed.push(`${publicDeleted} article-specific public image${publicDeleted === 1 ? "" : "s"} deleted${publicAbsent ? `; ${publicAbsent} already absent` : ""}`);
    }
    if (mode === "unpublish") {
      stage = "private draft status update";
      const updated = await saveArticle({ ...article, status: "draft", publishedAt: undefined, publicUrl: undefined, pdfUrl: undefined, publishedSha: undefined, publishedPath: undefined, publishedBranch: undefined, githubCommitSha: undefined, githubPath: undefined, githubRepository: undefined, publishError: undefined, updatedAt: new Date().toISOString() });
      completed.push("Private draft retained and reset to draft");
      return { complete: true, removed: false, mode, article: updated, completed, retainedAssets, message: `Article unpublished from Hearth & Thread. The Studio draft remains available.${retainedAssets.length ? ` ${retainedAssets.length} legacy or non-image asset${retainedAssets.length === 1 ? " was" : "s were"} retained for safety.` : ""}` };
    }
    for (const path of privateAssets) {
      stage = `private image deletion (${path})`;
      if (await removeCurrentFile(privateRepo, path, `studio: delete ${article.id} assets`)) completed.push(`Private asset removed: ${path}`);
    }
    stage = "private draft deletion";
    const latest = await getFileSha(privateRepo, privatePath);
    if (latest !== article.storageSha) throw new Error("The private draft changed during cleanup. Reload before retrying.");
    await deleteFile(privateRepo, privatePath, latest, `studio: delete ${article.slug || article.id}`);
    completed.push("Private draft removed");
    return { complete: true, removed: true, mode, completed, retainedAssets, message: `${mode === "draft" ? "Draft deleted." : "Article and associated files deleted."}${retainedAssets.length ? ` ${retainedAssets.length} legacy or non-image asset${retainedAssets.length === 1 ? " was" : "s were"} retained for safety.` : ""}` };
  } catch (error) {
    if (!completed.length) throw error;
    const detail = failureText(error);
    return { complete: false, removed: false, mode, article, completed, retainedAssets, error: detail, message: `${completed.join("; ")}, but ${stage} failed: ${detail}. Retry cleanup to finish.` };
  }
}
