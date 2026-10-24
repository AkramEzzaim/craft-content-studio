import { apiAuth, endSession } from "@/lib/auth";
export async function POST(request: Request) { const denied = await apiAuth(request); if (denied) return denied; await endSession(); return Response.json({ ok: true }); }
