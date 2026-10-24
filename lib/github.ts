import "server-only";
export class GithubError extends Error { constructor(message: string, public status: number) { super(message); } }
export type Repo = { owner: string; name: string; branch: string; token: string };
export function studioRepo(): Repo {
  const { STUDIO_GITHUB_OWNER: owner, STUDIO_GITHUB_REPO: name, STUDIO_GITHUB_BRANCH: branch = "main", STUDIO_GITHUB_TOKEN: token } = process.env;
  if (!owner || !name || !token) throw new Error("Private draft repository is not configured");
  if (owner === process.env.CRAFT_GITHUB_OWNER && name === process.env.CRAFT_GITHUB_REPO) throw new Error("Private draft repository must be separate from the public craft repository");
  return { owner, name, branch, token };
}
export function craftRepo(): Repo {
  const { CRAFT_GITHUB_OWNER: owner, CRAFT_GITHUB_REPO: name, CRAFT_GITHUB_BRANCH: branch = "main", CRAFT_GITHUB_TOKEN: token } = process.env;
  if (!owner || !name || !token) throw new Error("Public craft repository is not configured");
  return { owner, name, branch, token };
}
export function safePath(path: string) {
  if (!/^[a-zA-Z0-9_.\-/]+$/.test(path) || path.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Invalid repository path");
  return path;
}
async function request(repo: Repo, path: string, init?: RequestInit) {
  const url = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/contents/${safePath(path).split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(repo.branch)}`;
  const response = await fetch(url, { ...init, cache: "no-store", headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${repo.token}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", ...init?.headers } });
  if (response.status === 404) return null;
  if (!response.ok) throw new GithubError(`GitHub returned ${response.status} for ${path}`, response.status);
  return response.json();
}
export async function getFile(repo: Repo, path: string): Promise<{ content: string; sha: string } | null> {
  const data = await request(repo, path);
  if (!data) return null;
  if (Array.isArray(data) || data.type !== "file" || typeof data.content !== "string") throw new Error(`Unexpected GitHub file response for ${path}`);
  return { content: Buffer.from(data.content.replace(/\s/g, ""), "base64").toString("utf8"), sha: data.sha };
}
export async function listDirectory(repo: Repo, path: string): Promise<{ name: string; path: string; sha: string }[]> {
  const data = await request(repo, path); if (!data) return [];
  if (!Array.isArray(data)) throw new Error(`Unexpected GitHub directory response for ${path}`);
  return data.filter(x => x.type === "file").map(x => ({ name: x.name, path: x.path, sha: x.sha }));
}
export async function putFile(repo: Repo, path: string, content: string, message: string, sha?: string): Promise<string> {
  const data = await request(repo, path, { method: "PUT", body: JSON.stringify({ message, content: Buffer.from(content).toString("base64"), branch: repo.branch, ...(sha ? { sha } : {}) }) });
  if (!data?.content?.sha) throw new Error("GitHub did not return a file SHA");
  return data.content.sha;
}
export async function deleteFile(repo: Repo, path: string, sha: string, message: string) {
  await request(repo, path, { method: "DELETE", body: JSON.stringify({ message, sha, branch: repo.branch }) });
}

export async function assertPrivateRepo(repo: Repo) {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`, { cache: "no-store", headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${repo.token}`, "X-GitHub-Api-Version": "2022-11-28" } });
  if (!response.ok) throw new GithubError(`Unable to verify private draft repository (${response.status})`, response.status);
  const data = await response.json();
  if (data.private !== true) throw new Error("Studio draft repository must be private");
}

export async function fileExists(repo: Repo, path: string): Promise<boolean> {
  const data = await request(repo, path);
  return !!data && !Array.isArray(data) && data.type === "file";
}
