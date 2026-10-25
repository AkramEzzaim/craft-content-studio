import { apiAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { getArticle, saveArticle } from "@/lib/storage";
import { PublishError, regeneratePublicPdf } from "@/lib/publishing";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  const denied = await apiAuth(request); if (denied) return denied;
  try {
    const body = await request.json().catch(() => null) as { storageSha?: string } | null;
    const article = await getArticle((await params).id);
    if (!article) return Response.json({ error: "Article not found" }, { status: 404 });
    if (!body?.storageSha || body.storageSha !== article.storageSha) throw new PublishError("This article changed. Reload it before regenerating the PDF.", "DRAFT_CHANGED", 409);
    const result = await regeneratePublicPdf(article);
    try {
      const saved = await saveArticle({ ...article, pdfUrl: result.pdfUrl });
      return Response.json({ article: saved, ...result });
    } catch {
      throw new PublishError("The PDF was committed, but Studio could not save its status. Reload and retry; the same PDF path will be replaced.", "PDF_COMMITTED_STATUS_PENDING", 502);
    }
  } catch (error) { return errorResponse(error); }
}
