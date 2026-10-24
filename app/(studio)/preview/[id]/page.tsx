import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { getArticle } from "@/lib/storage";
import { PublicPreview } from "@/components/public-preview";
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) { const a = await getArticle((await params).id); if (!a) notFound(); return <><div className="preview-page-head"><div><Link href={`/articles/${a.id}/edit`} className="back-link"><ArrowLeft size={16}/> Back to editor</Link><h1>Article preview</h1><p>This shows the public site’s current article structure. Preview — Not Published.</p></div><Link href={`/articles/${a.id}/edit`} className="button primary"><Pencil size={16}/> Edit article</Link></div><PublicPreview article={a}/></>; }
