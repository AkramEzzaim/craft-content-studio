import "server-only";
import { parseArticle } from "./validation";
import type { Article } from "./types";
export type AiArticleResponse = { title: string; slug?: string; description?: string; excerpt?: string; seoTitle?: string; metaDescription?: string; tags?: string[]; difficulty?: string; estimatedTime?: string; materials?: string[]; tools?: string[]; abbreviations?: string[]; patternNotes?: string[]; contentMarkdown: string; faq?: { question: string; answer: string }[]; featuredImagePrompt?: string; pinterestTitle?: string; pinterestDescription?: string };
export const generationPrompt = `Create original, genuinely useful crochet content for the requested audience and search intent. Use natural English, short readable paragraphs, H2/H3 sections, clear materials lists, explained US abbreviations, and logical numbered instructions with labeled rounds or rows where appropriate. Check stitch counts and increases internally, but never claim a pattern was physically tested. Avoid filler, keyword stuffing, unsupported claims, and copying or closely reproducing any existing pattern. Include useful FAQs and SEO metadata. Return structured JSON only. The draft requires human verification before publication.`;
const str = (v: unknown, max = 100000) => typeof v === "string" ? v.slice(0, max).trim() : "";
const strings = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 80).map(x => x.slice(0, 500)) : [];
export async function generateArticle(input: Record<string, unknown>): Promise<Article> {
  const endpoint = process.env.N8N_CONTENT_WEBHOOK_URL;
  if (!endpoint || !endpoint.startsWith("https://")) throw new Error("N8N_CONTENT_WEBHOOK_URL must be an HTTPS URL");
  const topic = str(input.topic, 200), primary = str(input.primaryKeyword, 150);
  if (!topic || !primary) throw new Error("Topic and primary keyword are required");
  const response = await fetch(endpoint, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(90000), headers: { "Content-Type": "application/json", ...(process.env.N8N_CONTENT_WEBHOOK_SECRET ? { "X-Webhook-Secret": process.env.N8N_CONTENT_WEBHOOK_SECRET } : {}) }, body: JSON.stringify({ topic, primary_keyword: primary, secondary_keywords: strings(input.secondaryKeywords), article_type: str(input.articleType, 80), category: "crochet", difficulty: str(input.difficulty, 80), audience: str(input.audience, 200), special_instructions: str(input.specialInstructions, 2000), system_prompt: generationPrompt }) });
  if (!response.ok) throw new Error(`Generation webhook returned ${response.status}`);
  const raw: unknown = await response.json();
  const data = Array.isArray(raw) ? raw[0] : raw;
  if (!data || typeof data !== "object") throw new Error("Generation webhook returned invalid JSON");
  const d = data as Record<string, unknown>;
  if (str(d.title).length < 8 || str(d.contentMarkdown).length < 200 || !/^## /m.test(str(d.contentMarkdown))) throw new Error("Generated article is incomplete or missing structured sections");
  const candidate = { ...d, primaryKeyword: primary, articleType: input.articleType, category: "crochet", difficulty: d.difficulty || input.difficulty, description: d.description, excerpt: d.excerpt, seoTitle: d.seoTitle, metaDescription: d.metaDescription, tags: d.tags, materials: d.materials, tools: d.tools, abbreviations: d.abbreviations, patternNotes: d.patternNotes, pinterestTitle: d.pinterestTitle, pinterestDescription: d.pinterestDescription };
  const article = parseArticle(candidate);
  article.status = "generated"; article.aiGenerated = true;
  return article;
}
