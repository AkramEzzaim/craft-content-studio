"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Eye, Pencil, Send, Archive, ExternalLink } from "lucide-react";
import type { Article } from "@/lib/types";
import { assess } from "@/lib/validation";
import { ArticleDeletion } from "./article-deletion";
import { StatusBadge } from "./status";

export function ArticlesTable({ articles }: { articles: Article[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(articles);
  const [notice, setNotice] = useState("");
  async function duplicate(a: Article) {
    const payload = { ...a, title: `${a.title} (copy)`, slug: `${a.slug}-copy`, status: "draft", aiGenerated: false };
    const response = await fetch("/api/articles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (response.ok) router.push(`/articles/${data.id}/edit`); else alert(data.error);
  }
  async function archive(a: Article) {
    if (!confirm(`Archive “${a.title}” in the studio? Any published version will remain live on the craft site.`)) return;
    const response = await fetch(`/api/articles/${a.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...a, status: "archived" }) });
    const data = await response.json();
    if (!response.ok) alert(data.error); else { setRows(current => current.map(item => item.id === a.id ? data : item)); router.refresh(); }
  }
  return <div className="table-wrap">{notice && <div className="success-message" role="status">{notice}</div>}<table><thead><tr><th>ARTICLE</th><th>PRIMARY KEYWORD</th><th>CATEGORY</th><th>STATUS</th><th>QUALITY</th><th>SEO</th><th>UPDATED</th><th>PUBLISHED</th><th>PUBLIC URL</th><th>GIT COMMIT</th><th>ACTIONS</th></tr></thead><tbody>{rows.map(a => {
    const scores = assess(a);
    return <tr key={a.id}><td><Link className="table-title" href={`/articles/${a.id}`}>{a.title || "Untitled article"}</Link><span className="table-slug">/{a.slug || "untitled"}</span></td><td>{a.primaryKeyword || "—"}</td><td className="capitalize">{a.category}</td><td><StatusBadge status={a.status}/></td><td><span className="table-score">{scores.qualityScore}</span>/100</td><td><span className="table-score">{scores.seoScore}</span>/100</td><td>{new Date(a.updatedAt).toLocaleDateString()}</td><td>{a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : "—"}</td><td>{a.publicUrl ? <a className="public-url" href={a.publicUrl} target="_blank" rel="noreferrer">View live</a> : "—"}</td><td>{a.githubCommitSha && a.githubRepository && /^[a-f0-9]{40}$/i.test(a.githubCommitSha) && /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(a.githubRepository) ? <a className="public-url" href={`https://github.com/${a.githubRepository}/commit/${a.githubCommitSha}`} target="_blank" rel="noreferrer">{a.githubCommitSha.slice(0,7)}</a> : "—"}</td><td><div className="row-actions"><Link title="Edit" href={`/articles/${a.id}/edit`}><Pencil size={16}/></Link><Link title="Preview" href={`/preview/${a.id}`}><Eye size={16}/></Link><button title="Duplicate" onClick={() => duplicate(a)}><Copy size={16}/></button>{["ready","publishing"].includes(a.status) && <Link title="Review publishing" href={`/articles/${a.id}/edit?tab=review`}><Send size={16}/></Link>}{a.publicUrl && <a title="View live" href={a.publicUrl} target="_blank" rel="noreferrer"><ExternalLink size={16}/></a>}<button title="Archive" onClick={() => archive(a)}><Archive size={16}/></button><ArticleDeletion article={a} variant="menu" onComplete={result => { setNotice(result.message); setRows(current => result.removed ? current.filter(item => item.id !== a.id) : current.map(item => item.id === a.id && result.article ? result.article : item)); router.refresh(); }}/></div></td></tr>;
  })}</tbody></table></div>;
}
