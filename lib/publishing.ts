import "server-only";
import { branchHeadSha, getBinaryFile, getFile, latestCommitSha, putFilesAtomic, verifyRepositoryBranch, craftRepo, studioRepo, type GithubFile } from "./github";
import { publicPath, publicTarget, serializePublicArticle, validatePublicAssets, writePublicArticle } from "./public-adapter";
import { draftImagePath, publicImagePath, publicImageUrl } from "./image-path";
import { validateImage } from "./images";
import { publishIssues } from "./validation";
import type { Article } from "./types";
import { publicBody } from "./public-body";

export class PublishError extends Error {
  constructor(message: string, public code: string, public status = 400, public existingSha?: string) { super(message); }
}
export type PublishMode = "create" | "update" | "reconcile";
export type ImageTarget = { path: string; url: string; existingSha?: string; replaceRequired: boolean; sameContent: boolean };
export function validateDraftForPublishing(a: Article) {
  const issues = publishIssues({ ...a, contentMarkdown: publicBody(a) });
  if (issues.length) throw new PublishError(issues.join("; "), "INVALID_ARTICLE", 400);
  if (a.publishedPath && a.publishedPath !== publicPath(a)) throw new PublishError("This article was previously published under another slug. Restore that slug before updating.", "PUBLISHED_PATH_CHANGED", 409);
  if (a.draftImage && a.featuredImage !== publicImageUrl(a.slug, a.draftImage.extension)) throw new PublishError("The featured image path does not match the article slug.", "INVALID_IMAGE_PATH", 400);
}
async function inspectImage(a: Article): Promise<{ target: ImageTarget; bytes: Buffer } | null> {
  if (!a.draftImage) return null;
  const privatePath = draftImagePath(a.id, a.draftImage.extension);
  if (a.draftImage.path !== privatePath) throw new PublishError("The draft image path is invalid.", "INVALID_IMAGE_PATH", 400);
  const privateFile = await getBinaryFile(studioRepo(), privatePath);
  if (!privateFile) throw new PublishError("The saved draft image is missing. Upload it again.", "DRAFT_IMAGE_MISSING", 409);
  validateImage(privateFile.bytes, a.draftImage.originalName, a.draftImage.mimeType);
  const path = publicImagePath(a.slug, a.draftImage.extension);
  const existing = await getBinaryFile(craftRepo(), path);
  const sameContent = !!existing && existing.bytes.equals(privateFile.bytes);
  return { bytes: privateFile.bytes, target: { path, url: publicImageUrl(a.slug, a.draftImage.extension), existingSha: existing?.sha, replaceRequired: !!existing && !sameContent, sameContent } };
}
export async function inspectTarget(a: Article): Promise<{ target: ReturnType<typeof publicTarget>; existing: GithubFile | null; image: ImageTarget | null }> {
  validateDraftForPublishing(a);
  const target = publicTarget(a);
  const repo = craftRepo();
  await verifyRepositoryBranch(repo);
  if (a.status !== "publishing") await validatePublicAssets(a);
  const [existing, image] = await Promise.all([getFile(repo, target.path), inspectImage(a)]);
  return { target, existing, image: image?.target || null };
}
export async function executePublicCommit(a: Article, mode: PublishMode, expectedSha?: string, expectedImageSha?: string, replaceImage = false) {
  validateDraftForPublishing(a);
  const target = publicTarget(a);
  const repo = craftRepo();
  await verifyRepositoryBranch(repo);
  if (mode !== "reconcile") await validatePublicAssets(a);
  const expectedBranchHead = a.draftImage && mode !== "reconcile" ? await branchHeadSha(repo) : "";
  const [existing, image] = await Promise.all([getFile(repo, target.path), inspectImage(a)]);
  if (mode === "reconcile") {
    if (!existing || existing.content !== serializePublicArticle(a) || (image && !image.target.sameContent)) throw new PublishError("No matching public article and image were found for this publishing attempt.", "NO_MATCHING_COMMIT", 409);
    return { target, fileSha: existing.sha, commitSha: await latestCommitSha(repo, target.path), reconciled: true };
  }
  if (mode === "create" && existing) throw new PublishError("An article with this slug already exists. Review it and confirm an update to continue.", "ARTICLE_ALREADY_EXISTS", 409, existing.sha);
  if (mode === "update") {
    if (!existing) throw new PublishError("The public article no longer exists. Refresh the publishing review.", "ARTICLE_MISSING", 409);
    if (!expectedSha || !/^[a-f0-9]{40}$/i.test(expectedSha) || expectedSha !== existing.sha) throw new PublishError("The public article changed since you opened the confirmation. Refresh before updating.", "ARTICLE_CHANGED", 409, existing.sha);
  }
  if (image) {
    if (image.target.replaceRequired && (!replaceImage || expectedImageSha !== image.target.existingSha)) throw new PublishError("A public image with this filename already exists. Confirm replacement before publishing.", "PUBLIC_IMAGE_EXISTS", 409, image.target.existingSha);
    const files: { path: string; bytes: Buffer }[] = [{ path: target.path, bytes: Buffer.from(serializePublicArticle(a), "utf8") }];
    if (!image.target.sameContent) files.push({ path: image.target.path, bytes: image.bytes });
    const write = await putFilesAtomic(repo, files, `content: ${mode === "create" ? "publish" : "update"} ${a.slug}`, expectedBranchHead);
    return { target, fileSha: write.fileShas[target.path], commitSha: write.commitSha, reconciled: false };
  }
  const write = await writePublicArticle(a, mode, existing?.sha);
  return { target, fileSha: write.fileSha, commitSha: write.commitSha, reconciled: false };
}
