import { Editor } from "@/components/editor";
import { craftMissingConfig } from "@/lib/github";
export default async function NewArticle({ searchParams }: { searchParams: Promise<{ generate?: string }> }) { const query = await searchParams; return <Editor openGenerate={query.generate === "1"} publishMissingConfig={craftMissingConfig()}/>; }
