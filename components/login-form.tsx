"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function LoginForm() { const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); setBusy(true); setError(""); const form = new FormData(e.currentTarget); try { const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); router.replace("/dashboard"); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Sign in failed"); } finally { setBusy(false); } }
  return <form onSubmit={submit} className="login-form"><label>Email<input name="email" type="email" autoComplete="username" required placeholder="you@example.com" /></label><label>Password<input name="password" type="password" autoComplete="current-password" required placeholder="Your password" /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button primary wide" disabled={busy}>{busy ? "Signing in…" : "Sign in to studio"}</button></form>;
}
