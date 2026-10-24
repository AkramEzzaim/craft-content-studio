import "server-only";
import { craftRepo, fileExists, getFile, putFile, safePath } from "./github";
import { publishIssues } from "./validation";
import type { Article } from "./types";
const quote = (value: string) => JSON.stringify(value.replace(/[\r\n]+/g, " ").replace(/"/g, "”"));
export function publicPath(article: Article) { return `${safePath(process.env.CRAFT_CONTENT_PATH || "content/patterns")}/${article.slug}.md`; }
export function serializePublicArticle(a: Article, date = a.updatedAt.slice(0, 10)) {
  const fields: [string, string][] = [
    ["title", quote(a.title)], ["slug", quote(a.slug)], ["description", quote(a.description)], ["category", quote(a.category)], ["difficulty", quote(a.difficulty)], ["estimatedTime", quote(a.estimatedTime)], ["featuredImage", quote(a.featuredImage)], ["imageAlt", quote(a.imageAlt)], ["publishedAt", quote(a.publishedAt?.slice(0, 10) || date)], ["updatedAt", quote(date)], ["status", quote("published")], ["featured", "false"], ["trending", "false"], ["beginnerFriendly", String(a.difficulty.toLowerCase().includes("beginner"))], ["tags", quote(a.tags.join(", "))], ["author", quote(a.author)], ["seoTitle", quote(a.seoTitle || a.title)], ["metaDescription", quote(a.metaDescription || a.description)], ["canonicalUrl", quote(`/patterns/${a.canonicalSlug || a.slug}`)], ["pinterestImage", quote(a.pinterestImage || a.featuredImage)], ["patternDownloadUrl", quote(`/patterns/${a.slug}#instructions`)]];
  const faq = a.faq.length && !/^## FAQ/m.test(a.contentMarkdown) ? `\n\n## FAQ\n${a.faq.map(x => `### ${x.question}\n${x.answer}`).join("\n\n")}` : "";
  return `---\n${fields.map(([key, val]) => `${key}: ${val}`).join("\n")}\n---\n${a.contentMarkdown.trim()}${faq}\n`;
}
export async function publishToCraft(a: Article): Promise<{ sha: string; path: string; url: string }> {
  const issues = publishIssues(a); if (issues.length) throw new Error(issues.join("; "));
  const repo = craftRepo(); const path = publicPath(a);
  if (a.publishedPath && a.publishedPath !== path) throw new Error("Published slug changed. Restore the original slug before updating; manual migration is required.");
  const imagePath = a.featuredImage.replace(/^\//, "");
  if (!imagePath.startsWith("images/") || !(await fileExists(repo, `public/${imagePath}`))) throw new Error("Featured image must exist under public/images in the craft repository");
  if (a.pinterestImage?.startsWith("/") && !(await fileExists(repo, `public/${a.pinterestImage.replace(/^\//, "")}`))) throw new Error("Pinterest image must exist in the craft repository");
  const existing = await getFile(repo, path);
  if (existing && a.status === "publishing" && !a.publishedSha && existing.content === serializePublicArticle(a)) {
    const base = (process.env.CRAFT_SITE_URL || "https://craft-iota-wheat.vercel.app").replace(/\/$/, "");
    return { sha: existing.sha, path, url: `${base}/patterns/${a.slug}` };
  }
  if (existing && (!a.publishedSha || a.publishedSha !== existing.sha)) throw new Error("This article path already exists or changed externally. Review the public repository before publishing.");
  if (!existing && a.publishedSha) throw new Error("The previously published article is missing from the public repository");
  const sha = await putFile(repo, path, serializePublicArticle(a), `content: publish ${a.slug}`, existing?.sha);
  const base = (process.env.CRAFT_SITE_URL || "https://craft-iota-wheat.vercel.app").replace(/\/$/, "");
  return { sha, path, url: `${base}/patterns/${a.slug}` };
}
