import { notFound } from "next/navigation";
import { getArticle } from "@/lib/storage";
import { craftMissingConfig } from "@/lib/github";
import { Editor } from "@/components/editor";
export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const article = await getArticle((await params).id);
  if (!article) notFound();
  return <Editor initial={article} publishMissingConfig={craftMissingConfig()} publicSiteUrl={process.env.CRAFT_SITE_URL || "https://craft-iota-wheat.vercel.app"} initialTab={(await searchParams).tab === "review" ? "Review" : "Pattern"}/>;
}
