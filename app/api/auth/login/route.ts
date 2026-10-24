import { startSession, verifyPassword } from "@/lib/auth";
import { isSameOrigin } from "@/lib/origin";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const data = await request.json().catch(() => null);
  const email = typeof data?.email === "string" ? data.email.trim().toLowerCase() : "";
  const password = typeof data?.password === "string" ? data.password : "";
  const owner = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!owner || !process.env.ADMIN_PASSWORD_HASH || !process.env.SESSION_SECRET) return Response.json({ error: "Owner login is not configured" }, { status: 503 });
  if (email !== owner || !verifyPassword(password)) return Response.json({ error: "Invalid email or password" }, { status: 401 });
  await startSession(); return Response.json({ ok: true });
}
