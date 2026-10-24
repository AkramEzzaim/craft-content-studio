import { apiAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { getArticle, saveArticle } from "@/lib/storage";
import { parseArticle, publishIssues } from "@/lib/validation";
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
