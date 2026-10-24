import { apiAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { generateArticle } from "@/lib/generation";
import { saveArticle } from "@/lib/storage";
export async function POST(request: Request) { const denied = await apiAuth(request); if (denied) return denied; try { const data = await request.json(); return Response.json(await saveArticle(await generateArticle(data)), { status: 201 }); } catch (e) { return errorResponse(e); } }
