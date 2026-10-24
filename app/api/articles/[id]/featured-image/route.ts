import { apiAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { getArticle, saveArticle } from "@/lib/storage";
import { assertPrivateRepo, deleteFile, getBinaryFile, putBinaryFileWithCommit, studioRepo } from "@/lib/github";
import { draftImagePath, featuredPatternImagePath, imageUrlFromPath, MAX_IMAGE_BYTES } from "@/lib/image-path";
import { validateImage } from "@/lib/images";
import { suggestedImageAlt } from "@/lib/article-defaults";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const denied = await apiAuth(request); if (denied) return denied;
  try {
    const article = await getArticle((await params).id);
    if (!article?.draftImage) return Response.json({ error: "Draft image not found" }, { status: 404 });
    const repo = studioRepo(); await assertPrivateRepo(repo);
    const path = draftImagePath(article.id, article.draftImage.extension);
    const image = await getBinaryFile(repo, path);
    if (!image) return Response.json({ error: "Draft image not found" }, { status: 404 });
    const validated = validateImage(image.bytes, article.draftImage.originalName, article.draftImage.mimeType);
    return new Response(new Uint8Array(image.bytes), { headers: { "Content-Type": validated.mimeType, "Content-Length": String(image.bytes.length), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, { params }: Context) {
  const denied = await apiAuth(request); if (denied) return denied;
  try {
    if (Number(request.headers.get("content-length") || 0) > MAX_IMAGE_BYTES + 100_000) throw new Error("Image must be 4 MB or smaller");
    const article = await getArticle((await params).id);
    if (!article) return Response.json({ error: "Article not found" }, { status: 404 });
    if (article.status === "publishing") return Response.json({ error: "Check the publishing outcome before replacing the image" }, { status: 409 });
    const data = await request.formData();
    if (data.get("storageSha") !== article.storageSha) return Response.json({ error: "This draft changed. Reload before uploading the image." }, { status: 409 });
    const file = data.get("image");
    if (!(file instanceof File)) return Response.json({ error: "Choose an image file" }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be 4 MB or smaller");
    const bytes = Buffer.from(await file.arrayBuffer());
    const validated = validateImage(bytes, file.name, file.type);
    const publicPath = featuredPatternImagePath(article.slug, validated.extension);
    const featuredImage = imageUrlFromPath(publicPath);
    const path = draftImagePath(article.id, validated.extension);
    const repo = studioRepo(); await assertPrivateRepo(repo);
    const existing = await getBinaryFile(repo, path);
    await putBinaryFileWithCommit(repo, path, bytes, `studio: save featured image ${article.id}`, existing?.sha);
    const originalName = file.name.split(/[\\/]/).pop()?.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 180) || `featured.${validated.extension}`;
    const updated = await saveArticle({ ...article, status: "review", updatedAt: new Date().toISOString(), draftImage: { path, publicPath, originalName, ...validated }, featuredImage, imageAlt: article.imageAlt || suggestedImageAlt(article) });
    if (article.draftImage?.path && article.draftImage.path !== path) {
      try { const old = await getBinaryFile(repo, draftImagePath(article.id, article.draftImage.extension)); if (old) await deleteFile(repo, article.draftImage.path, old.sha, `studio: remove old featured image ${article.id}`); }
      catch { /* The new draft image is saved; an old private asset can be cleaned up later. */ }
    }
    return Response.json(updated);
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request, { params }: Context) {
  const denied = await apiAuth(request); if (denied) return denied;
  try {
    const article = await getArticle((await params).id);
    if (!article) return Response.json({ error: "Article not found" }, { status: 404 });
    if (article.status === "publishing") return Response.json({ error: "Check the publishing outcome before removing the image" }, { status: 409 });
    const body = await request.json().catch(() => null) as { storageSha?: string } | null;
    if (body?.storageSha !== article.storageSha) return Response.json({ error: "This draft changed. Reload before removing the image." }, { status: 409 });
    const old = article.draftImage;
    const updated = await saveArticle({ ...article, status: "review", updatedAt: new Date().toISOString(), draftImage: undefined, featuredImage: "" });
    if (old) {
      const repo = studioRepo();
      try { const file = await getBinaryFile(repo, draftImagePath(article.id, old.extension)); if (file) await deleteFile(repo, old.path, file.sha, `studio: remove featured image ${article.id}`); }
      catch { /* The draft no longer references this asset. */ }
    }
    return Response.json(updated);
  } catch (error) { return errorResponse(error); }
}
