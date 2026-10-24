import { notFound } from "next/navigation";
import { getArticle } from "@/lib/storage";
import { Editor } from "@/components/editor";
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) { const article = await getArticle((await params).id); if (!article) notFound(); return <Editor initial={article}/>; }
