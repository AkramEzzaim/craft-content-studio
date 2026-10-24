import "server-only";
import { assertPrivateRepo, getFile, listDirectory, putFile, studioRepo } from "./github";
import type { Article } from "./types";
const pathRoot = () => (process.env.STUDIO_DRAFT_PATH || "studio/articles").replace(/\/$/, "");
const pathFor = (id: string) => { if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid article ID"); return `${pathRoot()}/${id}.json`; };
export async function listArticles(): Promise<Article[]> {
  const repo = studioRepo(); await assertPrivateRepo(repo); const files = await listDirectory(repo, pathRoot());
  const articles: (Article | null)[] = await Promise.all(files.filter(f => /^[0-9a-f-]{36}\.json$/.test(f.name)).map(async f => {
    const file = await getFile(repo, f.path); if (!file) return null;
    return { ...JSON.parse(file.content) as Article, storageSha: file.sha };
  }));
  return articles.filter((x): x is Article => !!x).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function getArticle(id: string): Promise<Article | null> {
  const repo = studioRepo(); await assertPrivateRepo(repo); const file = await getFile(repo, pathFor(id));
  return file ? { ...JSON.parse(file.content) as Article, storageSha: file.sha } : null;
}
export async function saveArticle(article: Article): Promise<Article> {
  const { storageSha, ...data } = article;
  const repo = studioRepo(); await assertPrivateRepo(repo);
  const sha = await putFile(repo, pathFor(article.id), JSON.stringify(data, null, 2) + "\n", `studio: save ${article.slug || article.id}`, storageSha);
  return { ...data, storageSha: sha };
}
