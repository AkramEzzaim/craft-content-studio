import { apiAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { getArticle, saveArticle } from "@/lib/storage";
import { parseArticle, publishIssues } from "@/lib/validation";
import { deleteArticleFiles, type DeleteMode } from "@/lib/deletion";
import { hasPublicVersion } from "@/lib/types";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const denied = await apiAuth(request); if (denied) return denied;
  try { const article = await getArticle((await params).id); return article ? Response.json(article) : Response.json({ error: "Not found" }, { status: 404 }); }
  catch (error) { return errorResponse(error); }
}
export async function PUT(request: Request, { params }: Context) {
  const denied = await apiAuth(request); if (denied) return denied;
  try {
    const old = await getArticle((await params).id);
    if (!old) return Response.json({ error: "Not found" }, { status: 404 });
    if (old.status === "publishing") return Response.json({ error: "This article is publishing. Check the outcome before editing." }, { status: 409 });
    const body = await request.json();
    if (body.storageSha !== old.storageSha) return Response.json({ error: "This article changed in another tab. Reload before saving." }, { status: 409 });
    const next = parseArticle(body, old);
    if (next.status === "ready") {
      const issues = publishIssues(next);
      if (issues.length) return Response.json({ error: issues.join("; "), code: "INVALID_ARTICLE" }, { status: 400 });
    }
    return Response.json(await saveArticle(next));
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request, { params }: Context) {
  const denied = await apiAuth(request); if (denied) return denied;
  try {
    const body = await request.json().catch(() => null) as { mode?: DeleteMode; confirmation?: string; storageSha?: string } | null;
    if (!body || !["draft", "unpublish", "everything"].includes(body.mode || "")) return Response.json({ error: "Choose a valid deletion action." }, { status: 400 });
    if (body.mode === "everything" && body.confirmation !== "DELETE") return Response.json({ error: "Type DELETE exactly to confirm permanent deletion." }, { status: 400 });
    if (body.mode === "draft" && body.confirmation !== "Delete Draft") return Response.json({ error: "Confirm draft deletion in the dialog." }, { status: 400 });
    if (body.mode === "unpublish" && body.confirmation !== "Unpublish") return Response.json({ error: "Confirm unpublishing in the dialog." }, { status: 400 });
    const article = await getArticle((await params).id);
    if (!article) return Response.json({ error: "Article not found" }, { status: 404 });
    if (body.storageSha !== article.storageSha) return Response.json({ error: "This article changed. Reload before deleting." }, { status: 409 });
    if (body.mode === "draft" && hasPublicVersion(article)) return Response.json({ error: "This article has a public version. Choose Unpublish or Delete Everything." }, { status: 409 });
    const result = await deleteArticleFiles(article, body.mode!);
    return Response.json(result, { status: result.complete ? 200 : 207 });
  } catch (error) { return errorResponse(error); }
}
