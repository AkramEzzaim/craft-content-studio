import { notFound } from "next/navigation";
import { getArticle } from "@/lib/storage";
import { craftConfigReady } from "@/lib/github";
import { Editor } from "@/components/editor";
export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const article = await getArticle((await params).id);
  if (!article) notFound();
  return <Editor initial={article} publishConfigured={craftConfigReady()} initialTab={(await searchParams).tab === "review" ? "Review" : "Basics"}/>;
}
