import "server-only";
import { branchHeadSha, getBinaryFile, getFile, getFileSha, latestCommitSha, putFilesAtomic, verifyRepositoryBranch, craftRepo, studioRepo, type GithubFile, type Repo } from "./github";
import { publicPath, publicPdfPath, publicPdfUrl, publicTarget, serializePublicArticle, validatePublicAssets } from "./public-adapter";
import { draftImagePath, galleryDraftPath, imageUrlFromPath, publicImagePath, publicImageUrl } from "./image-path";
import { validateImage } from "./images";
import { publishIssues } from "./validation";
import type { Article } from "./types";
import { publicBody } from "./public-body";
import { generatePatternPdf } from "./pattern-pdf";

export class PublishError extends Error {
  constructor(message: string, public code: string, public status = 400, public existingSha?: string) { super(message); }
}
export type PublishMode = "create" | "update" | "reconcile";
export type ImageTarget = { path: string; url: string; existingSha?: string; replaceRequired: boolean; sameContent: boolean };
async function pdfBytesFor(a: Article, repo: Repo, pendingImages = new Map<string, Buffer>()) {
  try {
    return await generatePatternPdf(a, async path => {
      if (pendingImages.has(path)) return pendingImages.get(path)!;
      if (!/^\/images\/[a-z0-9/_-]+\.(?:jpe?g|png|webp|avif)$/i.test(path)) return null;
      return (await getBinaryFile(repo, `public${path}`))?.bytes || null;
    }, publicPdfUrl(a));
  } catch (error) {
    throw new PublishError(`The printable PDF could not be generated: ${error instanceof Error ? error.message : "Unknown error"}. The public article was not changed.`, "PDF_GENERATION_FAILED", 422);
  }
}
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
export async function inspectTarget(a: Article): Promise<{ target: ReturnType<typeof publicTarget>; pdf: { path: string; url: string; existingSha: string | null }; existing: GithubFile | null; image: ImageTarget | null; gallery: ImageTarget[] }> {
  validateDraftForPublishing(a);
  const target = publicTarget(a);
  const repo = craftRepo();
  await verifyRepositoryBranch(repo);
  if (a.status !== "publishing") await validatePublicAssets(a);
  const pdf = { path: publicPdfPath(a), url: publicPdfUrl(a), existingSha: await getFileSha(repo, publicPdfPath(a)) };
  const [existing, image, gallery] = await Promise.all([getFile(repo, target.path), inspectImage(a), inspectGallery(a)]);
  return { target, pdf, existing, image: image?.target || null, gallery: gallery.map(item => item.target) };
}
export async function executePublicCommit(a: Article, mode: PublishMode, expectedSha?: string, expectedImageSha?: string, replaceImage = false) {
  validateDraftForPublishing(a);
  const target = publicTarget(a);
  const repo = craftRepo();
  await verifyRepositoryBranch(repo);
  if (mode !== "reconcile") await validatePublicAssets(a);
  const expectedBranchHead = mode !== "reconcile" ? await branchHeadSha(repo) : "";
  const [existing, image, gallery] = await Promise.all([getFile(repo, target.path), inspectImage(a), inspectGallery(a)]);
  const pdfPath = publicPdfPath(a);
  if (mode === "reconcile") {
    const pdf = await getBinaryFile(repo, pdfPath);
    const [articleCommit, pdfCommit] = await Promise.all([latestCommitSha(repo, target.path), latestCommitSha(repo, pdfPath)]);
    if (!existing || existing.content !== serializePublicArticle(a) || (image && !image.target.sameContent) || gallery.some(item => !item.target.sameContent) || !pdf || !pdf.bytes.subarray(0, 5).equals(Buffer.from("%PDF-")) || articleCommit !== pdfCommit) throw new PublishError("No matching public article, images, and PDF were found for this publishing attempt.", "NO_MATCHING_COMMIT", 409);
    return { target, pdfUrl: publicPdfUrl(a), fileSha: existing.sha, commitSha: articleCommit, reconciled: true };
  }
  if (mode === "create" && existing) throw new PublishError("An article with this slug already exists. Review it and confirm an update to continue.", "ARTICLE_ALREADY_EXISTS", 409, existing.sha);
  if (mode === "update") {
    if (!existing) throw new PublishError("The public article no longer exists. Refresh the publishing review.", "ARTICLE_MISSING", 409);
    if (!expectedSha || !/^[a-f0-9]{40}$/i.test(expectedSha) || expectedSha !== existing.sha) throw new PublishError("The public article changed since you opened the confirmation. Refresh before updating.", "ARTICLE_CHANGED", 409, existing.sha);
  }
  if (gallery.some(item => item.target.replaceRequired)) throw new PublishError("A public gallery photo with this filename already exists. Remove and upload the photo again.", "PUBLIC_IMAGE_EXISTS", 409);
  if (image?.target.replaceRequired && (!replaceImage || expectedImageSha !== image.target.existingSha)) throw new PublishError("A public image with this filename already exists. Confirm replacement before publishing.", "PUBLIC_IMAGE_EXISTS", 409, image.target.existingSha);
  const pendingImages = new Map<string, Buffer>();
  if (image) pendingImages.set(image.target.url, image.bytes);
  for (const item of gallery) pendingImages.set(item.target.url, item.bytes);
  const pdfBytes = await pdfBytesFor(a, repo, pendingImages);
  const files: { path: string; bytes: Buffer }[] = [
    { path: target.path, bytes: Buffer.from(serializePublicArticle(a), "utf8") },
    { path: pdfPath, bytes: pdfBytes },
  ];
  if (image && !image.target.sameContent) files.push({ path: image.target.path, bytes: image.bytes });
  for (const item of gallery) if (!item.target.sameContent) files.push({ path: item.target.path, bytes: item.bytes });
  const write = await putFilesAtomic(repo, files, `content: ${mode === "create" ? "publish" : "update"} ${a.slug}`, expectedBranchHead);
  return { target, pdfUrl: publicPdfUrl(a), fileSha: write.fileShas[target.path], commitSha: write.commitSha, reconciled: false };
}

/** Backfill or refresh the PDF for an unchanged public article without rewriting its Markdown. */
export async function regeneratePublicPdf(a: Article) {
  if (a.status !== "published" || !a.publishedSha || a.publishedPath !== publicPath(a)) throw new PublishError("Only an unchanged published article can regenerate its PDF.", "ARTICLE_NOT_PUBLISHED", 409);
  const repo = craftRepo();
  await verifyRepositoryBranch(repo);
  const articleSha = await getFileSha(repo, publicPath(a));
  if (articleSha !== a.publishedSha) throw new PublishError("The public article changed since Studio published it. Review and republish the article first.", "ARTICLE_CHANGED", 409);
  const expectedBranchHead = await branchHeadSha(repo);
  const bytes = await pdfBytesFor(a, repo);
  const write = await putFilesAtomic(repo, [{ path: publicPdfPath(a), bytes }], `content: regenerate PDF ${a.slug}`, expectedBranchHead);
  return { pdfUrl: publicPdfUrl(a), commitSha: write.commitSha };
}
