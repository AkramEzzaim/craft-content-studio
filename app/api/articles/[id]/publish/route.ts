import { apiAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { getArticle, saveArticle } from "@/lib/storage";
import { publishToCraft } from "@/lib/public-adapter";
import { publishIssues } from "@/lib/validation";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  const denied = await apiAuth(request); if (denied) return denied;
  try {
    const a = await getArticle((await params).id); if (!a) return Response.json({ error: "Not found" }, { status: 404 });
    if (!["ready", "publishing"].includes(a.status)) return Response.json({ error: "Mark article ready after review before publishing" }, { status: 400 });
    const issues = publishIssues(a); if (issues.length) return Response.json({ error: issues.join("; ") }, { status: 400 });
    let progress = a.status === "publishing" ? a : await saveArticle({ ...a, status: "publishing", publishedAt: a.publishedAt || new Date().toISOString(), updatedAt: new Date().toISOString(), publishError: undefined });
    let result;
    try { result = await publishToCraft(progress); }
    catch (e) { await saveArticle({ ...progress, status: "failed", updatedAt: new Date().toISOString(), publishError: e instanceof Error ? e.message : "Publish failed" }); throw e; }
    try {
      progress = await saveArticle({ ...progress, status: "published", updatedAt: new Date().toISOString(), publishedSha: result.sha, publishedPath: result.path, publicUrl: result.url, publishError: undefined });
      return Response.json(progress);
    } catch { throw new Error("The GitHub commit succeeded, but the private status update failed. Retry Publish to reconcile the article."); }
  } catch (e) { return errorResponse(e); }
}
