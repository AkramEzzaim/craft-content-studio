import "server-only";
import { getFile, latestCommitSha, verifyRepositoryBranch, craftRepo, type GithubFile } from "./github";
import { publicPath, publicTarget, serializePublicArticle, validatePublicAssets, writePublicArticle } from "./public-adapter";
import { publishIssues } from "./validation";
import type { Article } from "./types";
import { publicBody } from "./public-body";

export class PublishError extends Error {
  constructor(message: string, public code: string, public status = 400, public existingSha?: string) { super(message); }
}
export type PublishMode = "create" | "update" | "reconcile";
export function validateDraftForPublishing(a: Article) {
  const issues = publishIssues({ ...a, contentMarkdown: publicBody(a) });
  if (issues.length) throw new PublishError(issues.join("; "), "INVALID_ARTICLE", 400);
  if (a.publishedPath && a.publishedPath !== publicPath(a)) throw new PublishError("This article was previously published under another slug. Restore that slug before updating.", "PUBLISHED_PATH_CHANGED", 409);
}
export async function inspectTarget(a: Article): Promise<{ target: ReturnType<typeof publicTarget>; existing: GithubFile | null }> {
  validateDraftForPublishing(a);
  const target = publicTarget(a);
  const repo = craftRepo();
  await verifyRepositoryBranch(repo);
  if (a.status !== "publishing") await validatePublicAssets(a);
  const existing = await getFile(repo, target.path);
  return { target, existing };
}
export async function executePublicCommit(a: Article, mode: PublishMode, expectedSha?: string) {
  validateDraftForPublishing(a);
  const target = publicTarget(a);
  const repo = craftRepo();
  await verifyRepositoryBranch(repo);
  if (mode !== "reconcile") await validatePublicAssets(a);
  const existing = await getFile(repo, target.path);
  if (mode === "reconcile") {
    if (!existing || existing.content !== serializePublicArticle(a)) throw new PublishError("No matching public commit was found for this publishing attempt.", "NO_MATCHING_COMMIT", 409);
    return { target, fileSha: existing.sha, commitSha: await latestCommitSha(repo, target.path), reconciled: true };
  }
  if (mode === "create" && existing) throw new PublishError("An article with this slug already exists. Review it and confirm an update to continue.", "ARTICLE_ALREADY_EXISTS", 409, existing.sha);
  if (mode === "update") {
    if (!existing) throw new PublishError("The public article no longer exists. Refresh the publishing review.", "ARTICLE_MISSING", 409);
    if (!expectedSha || !/^[a-f0-9]{40}$/i.test(expectedSha) || expectedSha !== existing.sha) throw new PublishError("The public article changed since you opened the confirmation. Refresh before updating.", "ARTICLE_CHANGED", 409, existing.sha);
  }
  const write = await writePublicArticle(a, mode, existing?.sha);
  return { target, fileSha: write.fileSha, commitSha: write.commitSha, reconciled: false };
}
