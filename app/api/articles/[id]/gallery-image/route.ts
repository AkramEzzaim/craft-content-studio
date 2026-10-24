import { apiAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { getArticle, saveArticle } from "@/lib/storage";
import { assertPrivateRepo, deleteFile, getBinaryFile, putBinaryFileWithCommit, studioRepo } from "@/lib/github";
import { galleryDraftPath, galleryPatternImagePath, MAX_IMAGE_BYTES } from "@/lib/image-path";
import { validateImage } from "@/lib/images";
import { generatedMarkdown } from "@/lib/article-markdown";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const denied = await apiAuth(request); if (denied) return denied;
  try {
    const article = await getArticle((await params).id);
    const imageId = new URL(request.url).searchParams.get("imageId");
    const item = article?.galleryImages?.find(image => image.id === imageId);
    if (!article || !item) return Response.json({ error: "Draft photo not found" }, { status: 404 });
    const repo = studioRepo(); await assertPrivateRepo(repo);
    const image = await getBinaryFile(repo, galleryDraftPath(article.id, item.id, item.extension));
    if (!image) return Response.json({ error: "Draft photo not found" }, { status: 404 });
    const checked = validateImage(image.bytes, item.originalName, item.mimeType);
    return new Response(new Uint8Array(image.bytes), { headers: { "Content-Type": checked.mimeType, "Content-Length": String(image.bytes.length), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, { params }: Context) {
  const denied = await apiAuth(request); if (denied) return denied;
  try {
    if (Number(request.headers.get("content-length") || 0) > MAX_IMAGE_BYTES + 100_000) throw new Error("Image must be 4 MB or smaller");
    const article = await getArticle((await params).id);
    if (!article) return Response.json({ error: "Article not found" }, { status: 404 });
    if (article.status === "publishing") return Response.json({ error: "Check the publishing outcome before adding a photo" }, { status: 409 });
    if ((article.galleryImages || []).length >= 12) return Response.json({ error: "A draft can have up to 12 extra photos" }, { status: 400 });
    const data = await request.formData();
    if (data.get("storageSha") !== article.storageSha) return Response.json({ error: "This draft changed. Reload before adding a photo." }, { status: 409 });
    const file = data.get("image");
    if (!(file instanceof File) || file.size > MAX_IMAGE_BYTES) return Response.json({ error: "Choose an image 4 MB or smaller" }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const checked = validateImage(bytes, file.name, file.type);
    const imageId = crypto.randomUUID();
    const path = galleryDraftPath(article.id, imageId, checked.extension);
    const publicPath = article.slug ? galleryPatternImagePath(article.slug, imageId, checked.extension) : undefined;
    const repo = studioRepo(); await assertPrivateRepo(repo);
    await putBinaryFileWithCommit(repo, path, bytes, `studio: add photo ${imageId}`);
    const originalName = file.name.split(/[\\/]/).pop()?.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 180) || `photo.${checked.extension}`;
    const next = { ...article, status: "review" as const, updatedAt: new Date().toISOString(), galleryImages: [...(article.galleryImages || []), { id: imageId, path, publicPath, originalName, ...checked, alt: article.title, caption: "" }] };
    const updated = await saveArticle({ ...next, contentMarkdown: next.contentMode === "structured" ? generatedMarkdown(next) : next.contentMarkdown });
    return Response.json(updated);
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request, { params }: Context) {
  const denied = await apiAuth(request); if (denied) return denied;
  try {
    const article = await getArticle((await params).id);
    if (!article) return Response.json({ error: "Article not found" }, { status: 404 });
    if (article.status === "publishing") return Response.json({ error: "Check the publishing outcome before removing a photo" }, { status: 409 });
    const body = await request.json().catch(() => null) as { storageSha?: string; imageId?: string } | null;
    if (body?.storageSha !== article.storageSha) return Response.json({ error: "This draft changed. Reload before removing a photo." }, { status: 409 });
    const item = article.galleryImages?.find(image => image.id === body?.imageId);
    if (!item) return Response.json({ error: "Draft photo not found" }, { status: 404 });
    const next = { ...article, status: "review" as const, updatedAt: new Date().toISOString(), galleryImages: article.galleryImages!.filter(image => image.id !== item.id), instructions: article.instructions?.map(step => step.imageId === item.id ? { ...step, imageId: "" } : step) };
    const updated = await saveArticle({ ...next, contentMarkdown: next.contentMode === "structured" ? generatedMarkdown(next) : next.contentMarkdown });
    const repo = studioRepo();
    try { const file = await getBinaryFile(repo, galleryDraftPath(article.id, item.id, item.extension)); if (file) await deleteFile(repo, item.path, file.sha, `studio: remove photo ${item.id}`); } catch { /* The draft no longer references this asset. */ }
    return Response.json(updated);
  } catch (error) { return errorResponse(error); }
}
