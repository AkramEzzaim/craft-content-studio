import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
function load(file, imports = {}, jsx = false) {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: jsx ? ts.JsxEmit.ReactJSX : undefined } }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", code)((name) => { if (name in imports) return imports[name]; throw new Error(`Unexpected import ${name} in ${file}`); }, mod, mod.exports);
  return mod.exports;
}
process.env.CRAFT_CONTENT_PATH = "content/patterns";
const types = load("lib/types.ts");
const id = "11111111-1111-4111-8111-111111111111", slug = "sunflower-coaster";
const draftPath = `studio/articles/${id}.json`, privateRoot = `studio/assets/${id}`;
const publicPath = `content/patterns/${slug}.md`, imageRoot = `public/images/patterns/${slug}`;
const privateRepo = { owner: "owner", name: "private", branch: "main", token: "private-token" };
const publicRepo = { owner: "owner", name: "public", branch: "main", token: "public-token" };
let privateFiles = new Map(), publicFiles = new Map(), currentArticle, failPath = "", failStatusSave = false, deletions = [], shaReads = [];
const mapFor = repo => repo.name === "private" ? privateFiles : publicFiles;
const github = {
  assertPrivateRepo: async () => {}, studioRepo: () => privateRepo, craftRepo: () => publicRepo, verifyRepositoryBranch: async () => {},
  safePath: path => { if (!/^[a-zA-Z0-9_.\-/]+$/.test(path) || path.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Invalid repository path"); return path; },
  getFile: async (repo, path) => mapFor(repo).get(path) || null,
  getFileSha: async (repo, path) => { shaReads.push(path); return mapFor(repo).get(path)?.sha || null; },
  listFilesRecursive: async (repo, root) => [...mapFor(repo).keys()].filter(path => path.startsWith(`${root}/`)).sort(),
  deleteFile: async (repo, path, sha, message) => {
    assert.ok(shaReads.includes(path), `SHA fetched before deleting ${path}`);
    assert.equal(mapFor(repo).get(path)?.sha, sha);
    assert.match(message, /delete/);
    if (path === failPath) throw new Error(`GitHub failed deleting ${path}`);
    mapFor(repo).delete(path); deletions.push(path);
  },
};
const storage = {
  draftArticlePath: () => draftPath,
  getArticle: async () => currentArticle,
  saveArticle: async next => { if (failStatusSave) throw new Error("Private draft status save failed"); currentArticle = { ...next, storageSha: "new-draft-sha" }; privateFiles.set(draftPath, { sha: "new-draft-sha", content: JSON.stringify(currentArticle) }); return currentArticle; },
};
const adapter = { publicPath: article => `content/patterns/${article.slug}.md` };
const deletion = load("lib/deletion.ts", { "server-only": {}, "./github": github, "./public-adapter": adapter, "./storage": storage, "./types": types });
const route = load("app/api/articles/[id]/route.ts", { "@/lib/auth": { apiAuth: async () => null }, "@/lib/api": { errorResponse: error => Response.json({ error: error.message }, { status: 502 }) }, "@/lib/storage": storage, "@/lib/validation": {}, "@/lib/deletion": deletion, "@/lib/types": types });
const context = { params: Promise.resolve({ id }) };
const request = (mode, confirmation, storageSha = currentArticle.storageSha) => new Request(`http://localhost/api/articles/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, confirmation, storageSha }) });
function reset(published) {
  const base = { ...types.emptyArticle(), id, title: "Sunflower Coaster", slug, storageSha: "draft-sha" };
  currentArticle = published ? { ...base, status: "published", publishedPath: publicPath, publishedSha: "public-sha", publishedBranch: "main", githubRepository: "owner/public", publicUrl: `https://example.com/patterns/${slug}`, publishedAt: "2026-10-25T10:00:00.000Z", githubCommitSha: "c".repeat(40) } : base;
  privateFiles = new Map([[draftPath, { sha: "draft-sha", content: JSON.stringify(currentArticle) }], [`${privateRoot}/featured.png`, { sha: "feat-sha" }], [`${privateRoot}/photos/one.png`, { sha: "photo-sha" }]]);
  publicFiles = published ? new Map([[publicPath, { sha: "public-sha", content: `---\nslug: "${slug}"\n---\n## Instructions\nWork stitches.` }], [`${imageRoot}/featured.png`, { sha: "pub-image-sha" }], [`${imageRoot}/photo-one.png`, { sha: "pub-photo-sha" }], ["public/images/patterns/shared.png", { sha: "shared-sha" }]]) : new Map();
  failPath = ""; failStatusSave = false; deletions = []; shaReads = [];
}
reset(false);
assert.equal((await route.DELETE(request("draft", "wrong"), context)).status, 400);
assert.equal(deletions.length, 0, "wrong confirmation does nothing");
const draftDeleted = await route.DELETE(request("draft", "Delete Draft"), context);
assert.equal(draftDeleted.status, 200); assert.equal((await draftDeleted.json()).message, "Draft deleted.");
assert.equal(privateFiles.size, 0); assert.equal(publicFiles.size, 0);

reset(true);
assert.equal((await route.DELETE(request("everything", "delete"), context)).status, 400);
assert.equal(deletions.length, 0, "DELETE must match exactly");
assert.equal((await route.DELETE(request("unpublish", "Unpublish", "stale-sha"), context)).status, 409);
assert.equal(deletions.length, 0, "stale draft cannot be deleted");
const unpublished = await route.DELETE(request("unpublish", "Unpublish"), context);
assert.equal(unpublished.status, 200);
const unpublishData = await unpublished.json();
assert.equal(unpublishData.article.status, "draft"); assert.equal(unpublishData.article.publicUrl, undefined); assert.equal(unpublishData.article.publishedPath, undefined); assert.equal(unpublishData.article.publishedBranch, undefined); assert.equal(unpublishData.article.githubCommitSha, undefined);
assert.equal(publicFiles.has(publicPath), false); assert.equal(publicFiles.has(`${imageRoot}/featured.png`), false); assert.equal(publicFiles.has(`${imageRoot}/photo-one.png`), false);
assert.equal(publicFiles.has("public/images/patterns/shared.png"), true);
assert.equal(privateFiles.has(draftPath), true); assert.equal(privateFiles.has(`${privateRoot}/featured.png`), true);
assert.equal(types.hasPublicVersion(currentArticle), false);
// The retained draft can be marked ready and published again by the existing pipeline.
currentArticle = { ...currentArticle, status: "ready" };
assert.equal(currentArticle.status, "ready");

reset(true);
failPath = `${imageRoot}/featured.png`;
const imagePartial = await route.DELETE(request("unpublish", "Unpublish"), context);
assert.equal(imagePartial.status, 207); assert.equal(publicFiles.has(publicPath), false); assert.equal(privateFiles.has(draftPath), true);
failPath = "";
assert.equal((await route.DELETE(request("unpublish", "Unpublish"), context)).status, 200);

reset(true);
failStatusSave = true;
const statusPartial = await route.DELETE(request("unpublish", "Unpublish"), context);
assert.equal(statusPartial.status, 207); assert.equal(publicFiles.has(publicPath), false); assert.equal(currentArticle.status, "published");
failStatusSave = false;
assert.equal((await route.DELETE(request("unpublish", "Unpublish"), context)).status, 200); assert.equal(currentArticle.status, "draft");

reset(true);
const allDeleted = await route.DELETE(request("everything", "DELETE"), context);
assert.equal(allDeleted.status, 200); assert.equal((await allDeleted.json()).removed, true);
assert.equal(privateFiles.size, 0); assert.deepEqual([...publicFiles.keys()], ["public/images/patterns/shared.png"]);

reset(true);
failPath = draftPath;
const partial = await route.DELETE(request("everything", "DELETE"), context);
assert.equal(partial.status, 207);
const partialData = await partial.json();
assert.equal(partialData.complete, false); assert.match(partialData.message, /private draft deletion failed/);
assert.equal(privateFiles.has(draftPath), true); assert.equal(publicFiles.has(publicPath), false);
failPath = "";
const retry = await route.DELETE(request("everything", "DELETE"), context);
assert.equal(retry.status, 200); assert.equal(privateFiles.has(draftPath), false);

reset(true);
failPath = publicPath;
const githubFailure = await route.DELETE(request("everything", "DELETE"), context);
assert.equal(githubFailure.status, 502); assert.equal(deletions.length, 0); assert.equal(privateFiles.has(draftPath), true);

reset(true);
publicFiles.get(publicPath).sha = "changed-sha";
const conflict = await route.DELETE(request("everything", "DELETE"), context);
assert.equal(conflict.status, 502); assert.equal(deletions.length, 0, "changed public article is protected");
reset(true);
currentArticle.publishedBranch = "old-branch";
assert.equal((await route.DELETE(request("everything", "DELETE"), context)).status, 502);
assert.equal(deletions.length, 0, "different public branch is protected");
const jsx = await import("react/jsx-runtime");
const state = [];
let cursor = 0;
const fakeReact = { useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], next => { state[index] = typeof next === "function" ? next(state[index]) : next; }]; } };
const icon = () => null;
const ui = load("components/article-deletion.tsx", { "react": fakeReact, "react/jsx-runtime": jsx, "next/link": { default: () => null }, "lucide-react": { ExternalLink: icon, MoreHorizontal: icon, Trash2: icon, X: icon }, "@/lib/types": types }, true);
const flatten = node => node == null ? [] : Array.isArray(node) ? node.flatMap(flatten) : typeof node === "object" ? [node, ...flatten(node.props?.children)] : [node];
const render = article => { cursor = 0; return flatten(ui.ArticleDeletion({ article, variant: "zone", onComplete() {} })); };
state.length = 0; reset(false);
let nodes = render(currentArticle);
assert.equal(nodes.some(node => node?.props?.role === "dialog"), false);
nodes.find(node => node?.type === "button" && node.props.className === "destructive-text")?.props.onClick();
nodes = render(currentArticle);
assert.equal(nodes.some(node => node?.props?.role === "dialog"), true);
nodes.find(node => node?.type === "button" && node.props.children === "Cancel")?.props.onClick();
assert.equal(render(currentArticle).some(node => node?.props?.role === "dialog"), false);
assert.equal(deletions.length, 0, "cancelling the dialog does not call deletion");
state.length = 0; reset(true);
nodes = render(currentArticle);
nodes.find(node => node?.type === "button" && Array.isArray(node.props.children) && node.props.children.includes(" Delete Everything"))?.props.onClick();
nodes = render(currentArticle);
assert.equal(nodes.find(node => node?.type === "button" && node.props.className === "button destructive")?.props.disabled, true);
nodes.find(node => node?.type === "input" && node.props.placeholder === "DELETE")?.props.onChange({ target: { value: "DELETE" } });
nodes = render(currentArticle);
assert.equal(nodes.find(node => node?.type === "button" && node.props.className === "button destructive")?.props.disabled, false);
console.log("Deletion checks: draft, unpublish, delete everything, shared asset safety, confirmation, stale SHA, GitHub failure, partial failure, and retry passed.");
