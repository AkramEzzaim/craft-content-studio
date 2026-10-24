import { apiAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { listArticles, saveArticle } from "@/lib/storage";
import { parseArticle } from "@/lib/validation";
export async function GET(request: Request) { const denied = await apiAuth(request); if (denied) return denied; try { return Response.json(await listArticles()); } catch (e) { return errorResponse(e); } }
export async function POST(request: Request) { const denied = await apiAuth(request); if (denied) return denied; try { const article = parseArticle(await request.json()); return Response.json(await saveArticle(article), { status: 201 }); } catch (e) { return errorResponse(e); } }
