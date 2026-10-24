import "server-only";
import { branchHeadSha, getBinaryFile, getFile, latestCommitSha, putFilesAtomic, verifyRepositoryBranch, craftRepo, studioRepo, type GithubFile } from "./github";
import { publicPath, publicTarget, serializePublicArticle, validatePublicAssets, writePublicArticle } from "./public-adapter";
import { draftImagePath, galleryDraftPath, imageUrlFromPath, publicImagePath, publicImageUrl } from "./image-path";
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
  if (a.draftImage && a.featuredImage !== (a.draftImage.publicPath ? imageUrlFromPath(a.draftImage.publicPath) : publicImageUrl(a.slug, a.draftImage.extension))) throw new PublishError("The featured image path does not match the article slug.", "INVALID_IMAGE_PATH", 400);
}
async function inspectImage(a: Article): Promise<{ target: ImageTarget; bytes: Buffer } | null> {
  if (!a.draftImage) return null;
  const privatePath = draftImagePath(a.id, a.draftImage.extension);
  if (a.draftImage.path !== privatePath) throw new PublishError("The draft image path is invalid.", "INVALID_IMAGE_PATH", 400);
  const privateFile = await getBinaryFile(studioRepo(), privatePath);
  if (!privateFile) throw new PublishError("The saved draft image is missing. Upload it again.", "DRAFT_IMAGE_MISSING", 409);
  validateImage(privateFile.bytes, a.draftImage.originalName, a.draftImage.mimeType);
  const path = a.draftImage.publicPath || publicImagePath(a.slug, a.draftImage.extension);
  if (path !== publicImagePath(a.slug, a.draftImage.extension) && path !== `public/images/patterns/${a.slug}/featured.${a.draftImage.extension}`) throw new PublishError("The featured image destination is invalid.", "INVALID_IMAGE_PATH", 400);
  const existing = await getBinaryFile(craftRepo(), path);
  const sameContent = !!existing && existing.bytes.equals(privateFile.bytes);
  return { bytes: privateFile.bytes, target: { path, url: imageUrlFromPath(path), existingSha: existing?.sha, replaceRequired: !!existing && !sameContent, sameContent } };
}
async function inspectGallery(a: Article): Promise<{ target: ImageTarget; bytes: Buffer }[]> {
  return Promise.all((a.galleryImages || []).map(async image => {
    if (image.path !== galleryDraftPath(a.id, image.id, image.extension) || image.publicPath !== `public/images/patterns/${a.slug}/photo-${image.id}.${image.extension}`) throw new PublishError("A photo destination is invalid.", "INVALID_IMAGE_PATH", 400);
    const privateFile = await getBinaryFile(studioRepo(), image.path);
    if (!privateFile) throw new PublishError("A saved draft photo is missing. Upload it again.", "DRAFT_IMAGE_MISSING", 409);
    validateImage(privateFile.bytes, image.originalName, image.mimeType);
    const existing = await getBinaryFile(craftRepo(), image.publicPath);
    const sameContent = !!existing && existing.bytes.equals(privateFile.bytes);
    return { bytes: privateFile.bytes, target: { path: image.publicPath!, url: imageUrlFromPath(image.publicPath!), existingSha: existing?.sha, replaceRequired: !!existing && !sameContent, sameContent } };
  }));
}
export async function inspectTarget(a: Article): Promise<{ target: ReturnType<typeof publicTarget>; existing: GithubFile | null; image: ImageTarget | null; gallery: ImageTarget[] }> {
  validateDraftForPublishing(a);
  const target = publicTarget(a);
  const repo = craftRepo();
  await verifyRepositoryBranch(repo);
  if (a.status !== "publishing") await validatePublicAssets(a);
  const [existing, image, gallery] = await Promise.all([getFile(repo, target.path), inspectImage(a), inspectGallery(a)]);
  return { target, existing, image: image?.target || null, gallery: gallery.map(item => item.target) };
}
export async function executePublicCommit(a: Article, mode: PublishMode, expectedSha?: string, expectedImageSha?: string, replaceImage = false) {
  validateDraftForPublishing(a);
  const target = publicTarget(a);
  const repo = craftRepo();
  await verifyRepositoryBranch(repo);
  if (mode !== "reconcile") await validatePublicAssets(a);
  const expectedBranchHead = (a.draftImage || a.galleryImages?.length) && mode !== "reconcile" ? await branchHeadSha(repo) : "";
  const [existing, image, gallery] = await Promise.all([getFile(repo, target.path), inspectImage(a), inspectGallery(a)]);
  if (mode === "reconcile") {
    if (!existing || existing.content !== serializePublicArticle(a) || (image && !image.target.sameContent) || gallery.some(item => !item.target.sameContent)) throw new PublishError("No matching public article and images were found for this publishing attempt.", "NO_MATCHING_COMMIT", 409);
    return { target, fileSha: existing.sha, commitSha: await latestCommitSha(repo, target.path), reconciled: true };
  }
  if (mode === "create" && existing) throw new PublishError("An article with this slug already exists. Review it and confirm an update to continue.", "ARTICLE_ALREADY_EXISTS", 409, existing.sha);
  if (mode === "update") {
    if (!existing) throw new PublishError("The public article no longer exists. Refresh the publishing review.", "ARTICLE_MISSING", 409);
    if (!expectedSha || !/^[a-f0-9]{40}$/i.test(expectedSha) || expectedSha !== existing.sha) throw new PublishError("The public article changed since you opened the confirmation. Refresh before updating.", "ARTICLE_CHANGED", 409, existing.sha);
  }
  if (gallery.some(item => item.target.replaceRequired)) throw new PublishError("A public gallery photo with this filename already exists. Remove and upload the photo again.", "PUBLIC_IMAGE_EXISTS", 409);
  if (image || gallery.length) {
    if (image?.target.replaceRequired && (!replaceImage || expectedImageSha !== image.target.existingSha)) throw new PublishError("A public image with this filename already exists. Confirm replacement before publishing.", "PUBLIC_IMAGE_EXISTS", 409, image.target.existingSha);
    const files: { path: string; bytes: Buffer }[] = [{ path: target.path, bytes: Buffer.from(serializePublicArticle(a), "utf8") }];
    if (image && !image.target.sameContent) files.push({ path: image.target.path, bytes: image.bytes });
    for (const item of gallery) if (!item.target.sameContent) files.push({ path: item.target.path, bytes: item.bytes });
    const write = await putFilesAtomic(repo, files, `content: ${mode === "create" ? "publish" : "update"} ${a.slug}`, expectedBranchHead);
    return { target, fileSha: write.fileShas[target.path], commitSha: write.commitSha, reconciled: false };
  }
  const write = await writePublicArticle(a, mode, existing?.sha);
  return { target, fileSha: write.fileSha, commitSha: write.commitSha, reconciled: false };
}
