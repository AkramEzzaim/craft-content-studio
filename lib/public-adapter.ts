import "server-only";
import { craftRepo, fileExists, getFile, putFileWithCommit, safePath, verifyRepositoryBranch, type GithubFile, type GithubWrite } from "./github";
import { publishIssues } from "./validation";
import type { Article } from "./types";
import { publicBody } from "./public-body";

// The public site's parser only strips matching outer quotes; it does not parse YAML escapes.
const scalar = (value: string) => `"${value.replace(/[\r\n]+/g, " ").replace(/"/g, "”").replace(/\\/g, "/")}"`;
export function publicPath(a: Article) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug)) throw new Error("Invalid article slug");
  const root = safePath(process.env.CRAFT_CONTENT_PATH || "");
  return safePath(`${root}/${a.slug}.md`);
}
export function publicUrl(a: Article) {
  const base = process.env.CRAFT_SITE_URL;
  if (!base) throw new Error("Public site URL is not configured");
  const parsed = new URL(base);
  if (parsed.protocol !== "https:") throw new Error("Public site URL must use HTTPS");
  return `${parsed.origin}/patterns/${a.slug}`;
}
export function serializePublicArticle(a: Article, date = a.updatedAt.slice(0, 10)) {
  const fields: [string, string][] = [
    ["title", scalar(a.title)], ["slug", scalar(a.slug)], ["description", scalar(a.description)], ["category", scalar(a.category)], ["difficulty", scalar(a.difficulty)],
    ["estimatedTime", scalar(a.estimatedTime)], ["featuredImage", scalar(a.featuredImage)], ["imageAlt", scalar(a.imageAlt)],
    ["publishedAt", scalar(a.publishedAt?.slice(0, 10) || date)], ["updatedAt", scalar(date)], ["status", scalar("published")],
    ["featured", "false"], ["trending", "false"], ["beginnerFriendly", String(a.difficulty.toLowerCase().includes("beginner"))],
    ["tags", scalar(a.tags.join(", "))], ["author", scalar(a.author)], ["seoTitle", scalar(a.seoTitle || a.title)],
    ["metaDescription", scalar(a.metaDescription || a.description)], ["canonicalUrl", scalar(`/patterns/${a.canonicalSlug || a.slug}`)],
    ["pinterestImage", scalar(a.pinterestImage || a.featuredImage)], ["patternDownloadUrl", scalar(`/patterns/${a.slug}#instructions`)],
  ];
  return `---\n${fields.map(([key, value]) => `${key}: ${value}`).join("\n")}\n---\n${publicBody(a)}`;
}
export function publicTarget(a: Article) {
  const repo = craftRepo();
  return { repository: `${repo.owner}/${repo.name}`, branch: repo.branch, path: publicPath(a), url: publicUrl(a), filename: `${a.slug}.md` };
}
export async function inspectPublicArticle(a: Article): Promise<GithubFile | null> {
  const repo = craftRepo();
  await verifyRepositoryBranch(repo);
  return getFile(repo, publicPath(a));
}
export async function validatePublicAssets(a: Article) {
  const repo = craftRepo();
  const paths = [a.featuredImage, a.pinterestImage].filter(Boolean);
  for (const image of paths) {
    if (!/^\/images\/[a-z0-9/_-]+\.(?:png|jpe?g|webp|avif)$/i.test(image)) throw new Error("Public images must use a path under /images in the craft repository");
    if (!(await fileExists(repo, `public/${image.slice(1)}`))) throw new Error(`Image does not exist in the craft repository: ${image}`);
  }
}
export async function writePublicArticle(a: Article, mode: "create" | "update", existingSha?: string): Promise<GithubWrite> {
  const issues = publishIssues({ ...a, contentMarkdown: publicBody(a) });
  if (issues.length) throw new Error(issues.join("; "));
  const repo = craftRepo();
  return putFileWithCommit(repo, publicPath(a), serializePublicArticle(a), `content: ${mode === "create" ? "publish" : "update"} ${a.slug}`, existingSha);
}
