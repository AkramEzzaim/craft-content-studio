import { slugify, type Article } from "./types";

export const suggestedSlug = (title: string) => slugify(title);
export function suggestedSeoTitle(article: Pick<Article, "title" | "difficulty">) {
  const title = article.title.trim();
  if (!title) return "";
  return /beginner/i.test(article.difficulty) && !/beginner/i.test(title) ? `${title} for Beginners` : title;
}
export function suggestedMetaDescription(article: Pick<Article, "description" | "title">) {
  const description = article.description.trim();
  if (description.length >= 100) return description.slice(0, 160);
  const subject = article.title.trim().replace(/\s+pattern$/i, "").toLowerCase() || "crochet project";
  return `${description || `Learn how to make ${subject}.`} Find the materials, clear step-by-step instructions, and helpful tips for your next handmade project.`.slice(0, 160);
}
export function suggestedTags(article: Pick<Article, "primaryKeyword" | "difficulty" | "articleType">) {
  const tags = ["crochet", article.primaryKeyword.trim().toLowerCase(), /beginner/i.test(article.difficulty) ? "beginner crochet" : "", article.articleType === "Free Crochet Pattern" ? "free crochet pattern" : ""];
  return [...new Set(tags.filter(Boolean))];
}
export function suggestedImageAlt(article: Pick<Article, "title" | "yarnWeight">) {
  const project = article.title.trim().replace(/\s+pattern$/i, "").toLowerCase();
  return project ? `Handmade ${project}${article.yarnWeight.trim() ? ` made with ${article.yarnWeight.trim()} yarn` : ""}` : "";
}
export function applyArticleDefaults(article: Article): Article {
  const keyword = article.primaryKeyword || article.title.trim().toLowerCase();
  const withKeyword = { ...article, primaryKeyword: keyword };
  return {
    ...withKeyword,
    slug: article.slug || suggestedSlug(article.title),
    seoTitle: article.seoTitle || suggestedSeoTitle(article),
    metaDescription: article.metaDescription || suggestedMetaDescription(article),
    tags: article.tags.length ? article.tags : suggestedTags(withKeyword),
    imageAlt: article.imageAlt || suggestedImageAlt(article),
    ogTitle: article.ogTitle || suggestedSeoTitle(article),
    ogDescription: article.ogDescription || suggestedMetaDescription(article),
    pinterestTitle: article.pinterestTitle || suggestedSeoTitle(article),
    pinterestDescription: article.pinterestDescription || suggestedMetaDescription(article),
  };
}
