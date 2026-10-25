import "server-only";

export type Repo = { owner: string; name: string; branch: string; token: string };
export type GithubFile = { content: string; sha: string };
export type GithubBinaryFile = { bytes: Buffer; sha: string };
export type GithubWrite = { fileSha: string; commitSha: string };
export class GithubError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}

export function studioRepo(): Repo {
  const { STUDIO_GITHUB_OWNER: owner, STUDIO_GITHUB_REPO: name, STUDIO_GITHUB_BRANCH: branch = "main", STUDIO_GITHUB_TOKEN: token } = process.env;
  if (!owner || !name || !token) throw new Error("Private draft repository is not configured");
  if (owner === process.env.CRAFT_GITHUB_OWNER && name === process.env.CRAFT_GITHUB_REPO) throw new Error("Private draft repository must be separate from the public craft repository");
  return { owner, name, branch, token };
}
export const craftRequiredConfig = ["CRAFT_GITHUB_TOKEN", "CRAFT_GITHUB_OWNER", "CRAFT_GITHUB_REPO", "CRAFT_GITHUB_BRANCH", "CRAFT_CONTENT_PATH"] as const;
export function craftMissingConfig(): string[] {
  return craftRequiredConfig.filter(key => !process.env[key]?.trim());
}
export function craftConfigReady(): boolean { return craftMissingConfig().length === 0; }
export function craftRepo(): Repo {
  const { CRAFT_GITHUB_OWNER: owner, CRAFT_GITHUB_REPO: name, CRAFT_GITHUB_BRANCH: branch, CRAFT_GITHUB_TOKEN: token } = process.env;
  const missing = craftMissingConfig();
  if (missing.length) throw new Error(`Public craft publishing configuration is missing: ${missing.join(", ")}`);
  if (!owner || !name || !branch || !token) throw new Error("Public craft publishing configuration is incomplete");
  return { owner, name, branch, token };
}
export function safePath(path: string) {
  if (!/^[a-zA-Z0-9_.\-/]+$/.test(path) || path.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Invalid repository path");
  return path;
}
const root = (repo: Repo) => `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`;
const headers = (repo: Repo) => ({ Accept: "application/vnd.github+json", Authorization: `Bearer ${repo.token}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" });
function failure(response: Response, label: string): GithubError {
  const remaining = response.headers.get("x-ratelimit-remaining");
  if (response.status === 401) return new GithubError("GitHub token is invalid or expired", 401, "INVALID_GITHUB_TOKEN");
  if (response.status === 403 && remaining === "0") return new GithubError("GitHub API rate limit reached. Try again after it resets.", 429, "GITHUB_RATE_LIMIT");
  if (response.status === 403) return new GithubError("GitHub token lacks access to the configured repository or branch", 403, "GITHUB_ACCESS_DENIED");
  if (response.status === 404) return new GithubError(`${label} was not found or is inaccessible`, 404, "GITHUB_NOT_FOUND");
  if (response.status === 409 || response.status === 422) return new GithubError("GitHub rejected the change because the file or branch changed. Refresh and try again.", 409, "GITHUB_CONFLICT");
  return new GithubError(`GitHub API failed (${response.status})`, 502, "GITHUB_API_FAILURE");
}
async function contents(repo: Repo, path: string, init?: RequestInit, allowMissing = false) {
  const method = init?.method || "GET";
  const url = `${root(repo)}/contents/${safePath(path).split("/").map(encodeURIComponent).join("/")}${method === "GET" ? `?ref=${encodeURIComponent(repo.branch)}` : ""}`;
  const response = await fetch(url, { ...init, cache: "no-store", headers: { ...headers(repo), ...init?.headers } });
  if (response.status === 404 && allowMissing && method === "GET") return null;
  if (!response.ok) throw failure(response, "Repository path");
  return response.json();
}
export async function getFile(repo: Repo, path: string): Promise<GithubFile | null> {
  const data = await contents(repo, path, undefined, true);
  if (!data) return null;
  if (Array.isArray(data) || data.type !== "file" || typeof data.content !== "string" || !data.content) throw new Error("GitHub returned an unsupported file response");
  return { content: Buffer.from(data.content.replace(/\s/g, ""), "base64").toString("utf8"), sha: data.sha };
}
export async function getBinaryFile(repo: Repo, path: string): Promise<GithubBinaryFile | null> {
  const data = await contents(repo, path, undefined, true);
  if (!data) return null;
  if (Array.isArray(data) || data.type !== "file" || typeof data.sha !== "string") throw new Error("GitHub returned an unsupported image response");
  if (data.encoding === "base64" && typeof data.content === "string" && data.content) return { bytes: Buffer.from(data.content.replace(/\s/g, ""), "base64"), sha: data.sha };
  const response = await fetch(`${root(repo)}/git/blobs/${encodeURIComponent(data.sha)}`, { cache: "no-store", headers: headers(repo) });
  if (!response.ok) throw failure(response, "Image blob");
  const blob = await response.json();
  if (blob.encoding !== "base64" || typeof blob.content !== "string") throw new Error("GitHub returned an unsupported image blob");
  return { bytes: Buffer.from(blob.content.replace(/\s/g, ""), "base64"), sha: data.sha };
}
export async function listDirectory(repo: Repo, path: string): Promise<{ name: string; path: string; sha: string }[]> {
  const data = await contents(repo, path, undefined, true);
  if (!data) return [];
  if (!Array.isArray(data)) throw new Error("GitHub returned an unexpected directory response");
  return data.filter(x => x.type === "file").map(x => ({ name: x.name, path: x.path, sha: x.sha }));
}
export async function listFilesRecursive(repo: Repo, rootPath: string): Promise<string[]> {
  const root = safePath(rootPath);
  const pending = [root];
  const files: string[] = [];
  while (pending.length) {
    const directory = pending.pop()!;
    const data = await contents(repo, directory, undefined, true);
    if (!data) continue;
    if (!Array.isArray(data)) throw new Error("GitHub returned an unexpected directory response");
    for (const entry of data) {
      if (typeof entry.path !== "string" || !entry.path.startsWith(`${root}/`) || entry.path.split("/").length > root.split("/").length + 5) throw new Error("Unexpected repository asset path");
      if (entry.type === "dir") pending.push(safePath(entry.path));
      else if (entry.type === "file") files.push(safePath(entry.path));
      else throw new Error("Unexpected repository asset type");
      if (pending.length + files.length > 200) throw new Error("Too many article assets to delete safely");
    }
  }
  return files.sort();
}
export async function getFileSha(repo: Repo, path: string): Promise<string | null> {
  const data = await contents(repo, path, undefined, true);
  if (!data) return null;
  if (Array.isArray(data) || data.type !== "file" || typeof data.sha !== "string") throw new Error("GitHub returned an unexpected file response");
  return data.sha;
}
export async function putFileWithCommit(repo: Repo, path: string, content: string, message: string, sha?: string): Promise<GithubWrite> {
  const data = await contents(repo, path, { method: "PUT", body: JSON.stringify({ message, content: Buffer.from(content).toString("base64"), branch: repo.branch, ...(sha ? { sha } : {}) }) });
  if (!data?.content?.sha || !data?.commit?.sha) throw new Error("GitHub did not return file and commit identifiers");
  return { fileSha: data.content.sha, commitSha: data.commit.sha };
}
export async function putBinaryFileWithCommit(repo: Repo, path: string, bytes: Buffer, message: string, sha?: string): Promise<GithubWrite> {
  const data = await contents(repo, path, { method: "PUT", body: JSON.stringify({ message, content: bytes.toString("base64"), branch: repo.branch, ...(sha ? { sha } : {}) }) });
  if (!data?.content?.sha || !data?.commit?.sha) throw new Error("GitHub did not return image and commit identifiers");
  return { fileSha: data.content.sha, commitSha: data.commit.sha };
}
export async function branchHeadSha(repo: Repo): Promise<string> {
  const refPath = `git/ref/heads/${repo.branch.split("/").map(encodeURIComponent).join("/")}`;
  const response = await fetch(`${root(repo)}/${refPath}`, { cache: "no-store", headers: headers(repo) });
  if (!response.ok) throw failure(response, "GitHub branch");
  const data = await response.json();
  if (typeof data?.object?.sha !== "string") throw new Error("GitHub did not return the branch head");
  return data.object.sha;
}
export async function putFilesAtomic(repo: Repo, files: { path: string; bytes: Buffer }[], message: string, expectedBranchHead: string): Promise<{ commitSha: string; fileShas: Record<string, string> }> {
  if (!files.length) throw new Error("No files to commit");
  const endpoint = root(repo);
  async function api(path: string, init?: RequestInit) {
    const response = await fetch(`${endpoint}/${path}`, { ...init, cache: "no-store", headers: { ...headers(repo), ...init?.headers } });
    if (!response.ok) throw failure(response, "GitHub commit");
    return response.json();
  }
  const refPath = `git/ref/heads/${repo.branch.split("/").map(encodeURIComponent).join("/")}`;
  const reference = await api(refPath);
  const parent = reference?.object?.sha;
  if (typeof parent !== "string") throw new Error("GitHub did not return the branch head");
  if (parent !== expectedBranchHead) throw new GithubError("The public repository changed during publishing. Refresh and try again.", 409, "GITHUB_CONFLICT");
  const prior = await api(`git/commits/${encodeURIComponent(parent)}`);
  if (typeof prior?.tree?.sha !== "string") throw new Error("GitHub did not return the base tree");
  const treeEntries: { path: string; mode: string; type: string; sha: string }[] = [];
  const fileShas: Record<string, string> = {};
  for (const file of files) {
    const path = safePath(file.path);
    const blob = await api("git/blobs", { method: "POST", body: JSON.stringify({ content: file.bytes.toString("base64"), encoding: "base64" }) });
    if (typeof blob?.sha !== "string") throw new Error("GitHub did not return an image or article blob SHA");
    treeEntries.push({ path, mode: "100644", type: "blob", sha: blob.sha });
    fileShas[path] = blob.sha;
  }
  const tree = await api("git/trees", { method: "POST", body: JSON.stringify({ base_tree: prior.tree.sha, tree: treeEntries }) });
  if (typeof tree?.sha !== "string") throw new Error("GitHub did not return the new tree SHA");
  const commit = await api("git/commits", { method: "POST", body: JSON.stringify({ message, tree: tree.sha, parents: [parent] }) });
  if (typeof commit?.sha !== "string") throw new Error("GitHub did not return the commit SHA");
  await api(refPath.replace("git/ref/", "git/refs/"), { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
  return { commitSha: commit.sha, fileShas };
}
export async function putFile(repo: Repo, path: string, content: string, message: string, sha?: string): Promise<string> {
  return (await putFileWithCommit(repo, path, content, message, sha)).fileSha;
}
export async function deleteFile(repo: Repo, path: string, sha: string, message: string) {
  await contents(repo, path, { method: "DELETE", body: JSON.stringify({ message, sha, branch: repo.branch }) });
}
export async function fileExists(repo: Repo, path: string): Promise<boolean> {
  const data = await contents(repo, path, undefined, true);
  return !!data && !Array.isArray(data) && data.type === "file";
}
export async function assertPrivateRepo(repo: Repo) {
  const response = await fetch(root(repo), { cache: "no-store", headers: headers(repo) });
  if (!response.ok) throw failure(response, "Private draft repository");
  const data = await response.json();
  if (data.private !== true) throw new Error("Studio draft repository must be private");
}
export async function verifyRepositoryBranch(repo: Repo) {
  const repository = await fetch(root(repo), { cache: "no-store", headers: headers(repo) });
  if (!repository.ok) {
    if (repository.status === 404) throw new GithubError("Craft repository was not found or is inaccessible", 404, "REPOSITORY_NOT_FOUND");
    throw failure(repository, "Craft repository");
  }
  const branch = await fetch(`${root(repo)}/branches/${encodeURIComponent(repo.branch)}`, { cache: "no-store", headers: headers(repo) });
  if (!branch.ok) {
    if (branch.status === 404) throw new GithubError("Configured craft branch was not found", 404, "BRANCH_NOT_FOUND");
    throw failure(branch, "Craft branch");
  }
}
export async function latestCommitSha(repo: Repo, path: string): Promise<string | undefined> {
  const response = await fetch(`${root(repo)}/commits?sha=${encodeURIComponent(repo.branch)}&path=${encodeURIComponent(safePath(path))}&per_page=1`, { cache: "no-store", headers: headers(repo) });
  if (!response.ok) throw failure(response, "Craft commit");
  const data = await response.json();
  return Array.isArray(data) && typeof data[0]?.sha === "string" ? data[0].sha : undefined;
}
