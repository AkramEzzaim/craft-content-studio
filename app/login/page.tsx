import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
export default async function LoginPage() { if (await isAuthenticated()) redirect("/dashboard"); return <div className="login-page"><div className="login-brand"><div className="brand-mark">✳</div><span>Crochet Content Studio</span></div><div className="login-card"><div className="eyebrow">PRIVATE WORKSPACE</div><h1>Welcome back.</h1><p>Sign in to plan, review, and publish your next crochet story.</p><LoginForm /></div><p className="login-foot">An editorial workspace for Hearth & Thread.</p></div>; }
