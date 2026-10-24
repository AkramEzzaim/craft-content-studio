import { notFound } from "next/navigation";
import { getArticle } from "@/lib/storage";
import { craftMissingConfig } from "@/lib/github";
import { Editor } from "@/components/editor";
import { PasteArticleEditor } from "@/components/paste-article-editor";
export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; mode?: string }> }) {
  const article = await getArticle((await params).id);
  if (!article) notFound();
  const query = await searchParams;
  const publicSiteUrl = process.env.CRAFT_SITE_URL || "https://craft-iota-wheat.vercel.app";
  if (query.mode === "raw" || (article.rawSource && query.tab !== "review" && query.mode !== "legacy")) return <PasteArticleEditor initial={article} publicSiteUrl={publicSiteUrl}/>;
  return <Editor initial={article} publishMissingConfig={craftMissingConfig()} publicSiteUrl={publicSiteUrl} initialTab={query.tab === "review" ? "Review" : "Pattern"}/>;
}
