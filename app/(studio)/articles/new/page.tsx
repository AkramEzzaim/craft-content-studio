import { Editor } from "@/components/editor";
import { PasteArticleEditor } from "@/components/paste-article-editor";
import { craftMissingConfig } from "@/lib/github";
export default async function NewArticle({ searchParams }: { searchParams: Promise<{ generate?: string }> }) {
  const query = await searchParams;
  const publicSiteUrl = process.env.CRAFT_SITE_URL || "https://craft-iota-wheat.vercel.app";
  return query.generate === "1" ? <Editor openGenerate publishMissingConfig={craftMissingConfig()} publicSiteUrl={publicSiteUrl}/> : <PasteArticleEditor publicSiteUrl={publicSiteUrl}/>;
}
