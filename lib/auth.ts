import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSameOrigin } from "./origin";
const cookieName = "ccs_session";
const ttl = 60 * 60 * 12;
function secret() { const s = process.env.SESSION_SECRET; if (!s || s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters"); return s; }
export function verifyPassword(password: string) {
  const parts = (process.env.ADMIN_PASSWORD_HASH || "").split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt" || !/^[a-f0-9]+$/.test(parts[1]) || !/^[a-f0-9]+$/.test(parts[2])) return false;
  const expected = Buffer.from(parts[2], "hex"); if (expected.length !== 64) return false;
  const actual = scryptSync(password, Buffer.from(parts[1], "hex"), 64);
  return timingSafeEqual(actual, expected);
}
function sign(payload: string) { return createHmac("sha256", secret()).update(payload).digest("base64url"); }
export async function startSession() {
  const payload = `${Date.now() + ttl * 1000}.${randomBytes(16).toString("hex")}`;
  (await cookies()).set(cookieName, `${payload}.${sign(payload)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: ttl });
}
export async function endSession() { (await cookies()).delete(cookieName); }
export async function isAuthenticated() {
  const value = (await cookies()).get(cookieName)?.value || ""; const parts = value.split(".");
  if (parts.length !== 3 || !/^\d+$/.test(parts[0])) return false;
  const payload = `${parts[0]}.${parts[1]}`; const expected = Buffer.from(sign(payload)); const actual = Buffer.from(parts[2]);
  return Number(parts[0]) > Date.now() && expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function requireAuth() { if (!(await isAuthenticated())) redirect("/login"); }
export async function apiAuth(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (request.method !== "GET") {
    if (!isSameOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  return null;
}
