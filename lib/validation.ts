import { accuracyItems, articleTypes, categories, emptyArticle, slugify, type Article } from "./types";
const string = (v: unknown, max = 10000) => typeof v === "string" ? v.slice(0, max).trim() : "";
const list = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 80).map(x => x.slice(0, 500).trim()).filter(Boolean) : [];
const url = (v: unknown) => { const s = string(v, 2000); return !s || /^https:\/\/[^\s]+$/i.test(s) || /^\/images\/[a-z0-9/_-]+\.(?:png|jpe?g|webp|avif)$/i.test(s) ? s : ""; };
export function parseArticle(value: unknown, prior?: Article): Article {
  if (!value || typeof value !== "object") throw new Error("Invalid article data");
  const v = value as Record<string, unknown>; const base = prior || emptyArticle();
  const out: Article = { ...base, title: string(v.title, 180), slug: slugify(string(v.slug, 100)), primaryKeyword: string(v.primaryKeyword, 150), secondaryKeywords: list(v.secondaryKeywords), category: categories.includes(v.category as "crochet") ? String(v.category) : "crochet", articleType: articleTypes.includes(v.articleType as typeof articleTypes[number]) ? String(v.articleType) : "Other", difficulty: string(v.difficulty, 80), estimatedTime: string(v.estimatedTime, 80), author: string(v.author, 100), description: string(v.description, 300), excerpt: string(v.excerpt, 500), yarnType: string(v.yarnType, 100), yarnWeight: string(v.yarnWeight, 100), hookSize: string(v.hookSize, 100), gauge: string(v.gauge, 200), dimensions: string(v.dimensions, 200), requiredSkills: list(v.requiredSkills), materials: list(v.materials), tools: list(v.tools), abbreviations: list(v.abbreviations), patternNotes: list(v.patternNotes), sizing: string(v.sizing, 500), safetyNotes: string(v.safetyNotes, 500), contentMarkdown: string(v.contentMarkdown, 100000), featuredImagePrompt: string(v.featuredImagePrompt, 1000), faq: Array.isArray(v.faq) ? v.faq.slice(0, 30).map((x: unknown) => ({ question: string((x as Record<string, unknown>)?.question, 300), answer: string((x as Record<string, unknown>)?.answer, 2000) })).filter(x => x.question && x.answer) : [], featuredImage: url(v.featuredImage), imageAlt: string(v.imageAlt, 300), pinterestImage: url(v.pinterestImage), stepImages: Array.isArray(v.stepImages) ? v.stepImages.slice(0, 40).map((x: unknown) => ({ url: url((x as Record<string, unknown>)?.url), alt: string((x as Record<string, unknown>)?.alt, 300), caption: string((x as Record<string, unknown>)?.caption, 300) })).filter(x => x.url) : [], seoTitle: string(v.seoTitle, 180), metaDescription: string(v.metaDescription, 300), canonicalSlug: slugify(string(v.canonicalSlug, 100)), tags: list(v.tags), ogTitle: string(v.ogTitle, 180), ogDescription: string(v.ogDescription, 300), pinterestTitle: string(v.pinterestTitle, 180), pinterestDescription: string(v.pinterestDescription, 500), accuracyChecks: list(v.accuracyChecks).filter(x => (accuracyItems as readonly string[]).includes(x)), updatedAt: new Date().toISOString(), storageSha: prior?.storageSha };
  if (prior) { out.id = prior.id; out.createdAt = prior.createdAt; out.aiGenerated = prior.aiGenerated; out.publishedAt = prior.publishedAt; out.publicUrl = prior.publicUrl; out.publishedSha = prior.publishedSha; out.publishedPath = prior.publishedPath; out.status = "review"; }
  else { out.status = "draft"; }
  if (v.status === "archived" && prior) out.status = "archived";
  if (v.status === "ready" && prior) out.status = "ready";
  return out;
}
export type Check = { label: string; pass: boolean };
export function assess(article: Article) {
  const body = article.contentMarkdown; const headings = [...body.matchAll(/^#{1,3} (.+)$/gm)].map(m => m[1].toLowerCase()); const words = body.split(/\s+/).filter(Boolean).length;
  const pattern = article.articleType === "Free Crochet Pattern";
  const seo: Check[] = [
    { label: "Title and target keyword", pass: !!article.title && !!article.primaryKeyword && article.title.toLowerCase().includes(article.primaryKeyword.toLowerCase()) },
    { label: "Keyword in introduction", pass: !!article.primaryKeyword && body.slice(0, 700).toLowerCase().includes(article.primaryKeyword.toLowerCase()) },
    { label: "Meta description is 100–160 characters", pass: article.metaDescription.length >= 100 && article.metaDescription.length <= 160 },
    { label: "Readable slug", pass: !!article.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug) },
    { label: "No body H1; structured H2 sections", pass: !/^# /m.test(body) && headings.length >= 2 },
    { label: "Featured image and alt text", pass: !!article.featuredImage && !!article.imageAlt },
    { label: "Materials and instructions", pass: !pattern || (article.materials.length > 0 && /^## Instructions/m.test(body)) },
    { label: "Useful FAQ", pass: article.faq.length > 0 || /^## FAQ/m.test(body) },
    { label: "Internal link", pass: /\]\(\/(?:patterns|crochet)\//.test(body) },
    { label: "Useful article depth", pass: words >= 300 },
    { label: "Avoid keyword stuffing", pass: !!article.primaryKeyword && words >= 100 && (body.toLowerCase().split(article.primaryKeyword.toLowerCase()).length - 1) / words < 0.04 },
  ];
  const quality: Check[] = [
    { label: "Clear introduction", pass: body.split(/\n\n/)[0]?.split(/\s+/).length >= 25 },
    { label: "Logical sections", pass: headings.length >= 3 && new Set(headings).size === headings.length },
    { label: "Instructions are present", pass: !pattern || /^## Instructions/m.test(body) },
    { label: "Materials are listed", pass: !pattern || article.materials.length > 0 },
    { label: "Readable paragraphs", pass: words >= 50 && !body.split(/\n\n/).some(p => p.split(/\s+/).length > 180) },
    { label: "No empty sections", pass: headings.length > 0 && !/^#{2,3} .+\n\s*(?=#{2,3} |$)/m.test(body) },
    { label: "No placeholder text", pass: !!body && !/\b(?:lorem ipsum|todo|tbd|insert here|placeholder)\b/i.test(body) },
    { label: "No unsupported testing claim", pass: !!body && !/\b(?:personally tested|tested this pattern|physically tested)\b/i.test(body) },
    { label: "Crochet accuracy reviewed", pass: !pattern || accuracyItems.every(x => article.accuracyChecks.includes(x)) },
  ];
  const score = (checks: Check[]) => Math.round(100 * checks.filter(x => x.pass).length / checks.length);
  return { seo, quality, seoScore: score(seo), qualityScore: score(quality) };
}
export function publishIssues(a: Article): string[] {
  const issues: string[] = [];
  for (const [label, value] of [["Title", a.title], ["Slug", a.slug], ["Description", a.description], ["Author", a.author], ["Difficulty", a.difficulty], ["Featured image", a.featuredImage], ["Featured image alt text", a.imageAlt], ["Content", a.contentMarkdown]]) if (!value) issues.push(`${label} is required`);
  if (!/^## Instructions/m.test(a.contentMarkdown)) issues.push("The public site requires a ## Instructions section");
  if (a.articleType === "Free Crochet Pattern" && !/^## Materials/m.test(a.contentMarkdown)) issues.push("Add a ## Materials section to the article body");
  if (a.canonicalSlug && a.canonicalSlug !== a.slug) issues.push("Canonical slug must match the published article slug");
  if (a.articleType === "Free Crochet Pattern" && !accuracyItems.every(x => a.accuracyChecks.includes(x))) issues.push("Complete all crochet accuracy checks");
  if (/^# /m.test(a.contentMarkdown)) issues.push("Remove body H1; the public site adds the title H1");
  if (/!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]*\)|^\|/m.test(a.contentMarkdown)) issues.push("The public renderer does not support Markdown links, inline images, or tables yet");
  if (/^> |^```|^#{4,6} |^(?:---+|\*\*\*+|___+)\s*$|(?<!\*)\*(?!\*)[^*\n]+\*(?!\*)/m.test(a.contentMarkdown)) issues.push("The public renderer does not support quotes, code blocks, H4+, rules, or italic syntax yet");
  if (a.featuredImage.startsWith("https://")) issues.push("The public site only supports images already in its /public/images directory");
  if (a.contentMarkdown.length < 200) issues.push("Add substantive article instructions");
  const scores = assess(a);
  if (scores.qualityScore < 60) issues.push("Content quality checks must reach at least 60/100");
  if (scores.seoScore < 40) issues.push("SEO guidance checks must reach at least 40/100");
  return issues;
}
