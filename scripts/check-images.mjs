import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
function load(file, imports = {}, jsx = false) {
  const source = fs.readFileSync(file, "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: jsx ? ts.JsxEmit.ReactJSX : undefined } }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", code)((name) => { if (name in imports) return imports[name]; throw new Error(`Unexpected import ${name} in ${file}`); }, mod, mod.exports);
  return mod.exports;
}
process.env.CRAFT_CONTENT_PATH = "content/patterns";
process.env.CRAFT_SITE_URL = "https://craft-iota-wheat.vercel.app";
const types = load("lib/types.ts");
const defaults = load("lib/article-defaults.ts", { "./types": types });
const markdown = load("lib/article-markdown.ts");
const paths = load("lib/image-path.ts");
const images = load("lib/images.ts", { "server-only": {}, "./image-path": paths });
const validation = load("lib/validation.ts", { "./types": types, "./article-defaults": defaults, "./article-markdown": markdown, "./image-path": paths });
const id = "11111111-1111-4111-8111-111111111111";
const base = { ...types.emptyArticle(), id, title: "Easy Crochet Flower Pattern", primaryKeyword: "crochet flower", description: "A small flower for a beginner maker.", materials: ["Cotton yarn"], instructions: [{ title: "Create the center", instruction: "Work six stitches into a magic ring and join carefully." }], beginnerTips: ["Count the stitches after each round."], faq: [{ question: "Can I change yarn?", answer: "Yes. Your flower size will change." }] };
let article = validation.parseArticle(base);
article.id = id;
assert.equal(article.slug, "easy-crochet-flower-pattern");
assert.match(article.seoTitle, /for Beginners/);
assert.ok(article.metaDescription.length > 90);
assert.ok(article.tags.includes("beginner crochet"));
assert.match(article.contentMarkdown, /## Materials/);
assert.match(article.contentMarkdown, /### Step 1 — Create the center/);
assert.match(article.contentMarkdown, /## Beginner Tips/);
assert.equal((article.contentMarkdown.match(/## FAQ/g) || []).length, 1);
assert.doesNotMatch(markdown.generatedMarkdown({ ...article, faq: [], beginnerTips: [] }), /## FAQ|## Beginner Tips/);
const legacy = { ...article, contentMode: undefined, contentMarkdown: "A preserved introduction.\n\n## Instructions\n### Original step\nWork the original pattern." };
assert.equal(validation.parseArticle(legacy, legacy).contentMarkdown, legacy.contentMarkdown, "existing Markdown drafts keep their body");
article = { ...article, storageSha: "draft-1" };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO9u7N8AAAAASUVORK5CYII=", "base64");
assert.deepEqual({ width: images.validateImage(png, "IMG_3829.PNG", "image/png").width, height: images.validateImage(png, "IMG_3829.PNG", "image/png").height }, { width: 1, height: 1 });
assert.throws(() => images.validateImage(png, "image.jpg", "image/jpeg"), /contents/);
assert.throws(() => images.validateImage(Buffer.alloc(paths.MAX_IMAGE_BYTES + 1), "big.png", "image/png"), /4 MB/);
assert.throws(() => paths.publicImagePath("../escape", "png"), /valid article title/);
let privateFile = null;
let saved = article;
const privateRepo = { owner: "owner", name: "private", branch: "main", token: "test" };
const publicRepo = { owner: "owner", name: "craft", branch: "main", token: "test" };
const publicFiles = new Map();
const writes = [];
let failArticleWrite = false;
const github = {
  studioRepo: () => privateRepo, craftRepo: () => publicRepo, assertPrivateRepo: async () => {}, verifyRepositoryBranch: async () => {},
  safePath: value => { if (value.includes("..")) throw new Error("Invalid path"); return value; },
  getBinaryFile: async (repo, path) => repo.name === "private" ? privateFile : publicFiles.get(path) || null,
  putBinaryFileWithCommit: async (repo, path, bytes, message, sha) => { writes.push({ kind: "image", path, message, sha }); const file = { bytes, sha: "b".repeat(40) }; if (repo.name === "private") privateFile = file; else publicFiles.set(path, file); return { fileSha: file.sha, commitSha: "c".repeat(40) }; },
  branchHeadSha: async () => "h".repeat(40),
  putFilesAtomic: async (_repo, files, message, expectedBranchHead) => {
    assert.equal(expectedBranchHead, "h".repeat(40));
    if (failArticleWrite) throw new Error("Atomic commit failed");
    const fileShas = {};
    for (const file of files) {
      fileShas[file.path] = file.path.endsWith(".md") ? "a".repeat(40) : "b".repeat(40);
      publicFiles.set(file.path, file.path.endsWith(".md") ? { content: file.bytes.toString("utf8"), sha: fileShas[file.path] } : { bytes: file.bytes, sha: fileShas[file.path] });
    }
    writes.push({ kind: "atomic", files: files.map(file => file.path), message });
    return { fileShas, commitSha: "c".repeat(40) };
  },
  deleteFile: async () => { privateFile = null; },
  getFile: async (_repo, path) => publicFiles.get(path) || null,
  putFileWithCommit: async (_repo, path, content, message, sha) => { if (failArticleWrite) throw new Error("Article write failed"); writes.push({ kind: "article", path, content, message, sha }); publicFiles.set(path, { content, sha: "a".repeat(40) }); return { fileSha: "a".repeat(40), commitSha: "c".repeat(40) }; },
  fileExists: async () => true,
  latestCommitSha: async () => "c".repeat(40),
};
const storage = { getArticle: async () => saved, saveArticle: async next => { saved = { ...next, storageSha: `draft-${Number(saved.storageSha?.split("-")[1] || 1) + 1}` }; return saved; } };
const route = load("app/api/articles/[id]/featured-image/route.ts", { "@/lib/auth": { apiAuth: async () => null }, "@/lib/api": { errorResponse: error => Response.json({ error: error.message }, { status: 400 }) }, "@/lib/storage": storage, "@/lib/github": github, "@/lib/image-path": paths, "@/lib/images": images, "@/lib/article-defaults": defaults });
const context = { params: Promise.resolve({ id }) };
const imageRequest = (filename, bytes, mime = "image/png") => { const form = new FormData(); form.set("storageSha", saved.storageSha); form.set("image", new File([bytes], filename, { type: mime })); return new Request("http://localhost/api/articles/id/featured-image", { method: "POST", body: form }); };
const guarded = load("app/api/articles/[id]/featured-image/route.ts", { "@/lib/auth": { apiAuth: async () => Response.json({ error: "Unauthorized" }, { status: 401 }) }, "@/lib/api": {}, "@/lib/storage": { getArticle: async () => { throw new Error("Auth must run first"); } }, "@/lib/github": github, "@/lib/image-path": paths, "@/lib/images": images, "@/lib/article-defaults": defaults });
assert.equal((await guarded.POST(imageRequest("flower.png", png), context)).status, 401);
assert.equal((await route.POST(imageRequest("bad.jpg", png, "image/jpeg"), context)).status, 400);
assert.equal((await route.POST(imageRequest("large.png", Buffer.alloc(paths.MAX_IMAGE_BYTES + 1)), context)).status, 400);
const upload = await route.POST(imageRequest("IMG_3829.PNG", png), context);
assert.equal(upload.status, 200);
assert.equal(saved.draftImage.path, `studio/assets/${id}/featured.png`);
assert.equal(saved.featuredImage, "/images/patterns/easy-crochet-flower-pattern.png");
assert.equal(saved.draftImage.width, 1);
assert.ok(saved.imageAlt);
assert.equal(privateFile.bytes.equals(png), true);
const React = await import("react");
const ReactDOMServer = await import("react-dom/server");
const imageUi = load("components/featured-image-upload.tsx", { "react": React, "react/jsx-runtime": await import("react/jsx-runtime"), "@/lib/image-path": paths }, true);
const savedPreview = ReactDOMServer.renderToStaticMarkup(React.createElement(imageUi.FeaturedImageUpload, { article: saved, upload: async () => {}, remove: async () => {}, busy: false }));
assert.match(savedPreview, new RegExp(`/api/articles/${id}/featured-image`));
assert.match(savedPreview, /IMG_3829.PNG/);
const state = [];
let stateIndex = 0;
const interactiveUi = load("components/featured-image-upload.tsx", { "react": { useRef: () => ({ current: null }), useEffect: () => {}, useState(initial) { const index = stateIndex++; if (!(index in state)) state[index] = initial; return [state[index], next => { state[index] = typeof next === "function" ? next(state[index]) : next; }]; } }, "react/jsx-runtime": await import("react/jsx-runtime"), "@/lib/image-path": paths }, true);
const renderImage = () => { stateIndex = 0; return interactiveUi.FeaturedImageUpload({ article: { ...saved, draftImage: undefined }, upload: () => new Promise(() => {}), remove: async () => {}, busy: false }); };
const flatten = node => node == null ? [] : Array.isArray(node) ? node.flatMap(flatten) : typeof node === "object" ? [node, ...flatten(node.props?.children)] : [node];
const originalCreateUrl = URL.createObjectURL;
const originalImage = globalThis.Image;
try {
  URL.createObjectURL = () => "blob:local-preview";
  globalThis.Image = class { naturalWidth = 1; naturalHeight = 1; set src(_) { this.onload?.(); } };
  const input = flatten(renderImage()).find(node => node?.type === "input" && node.props.type === "file");
  input.props.onChange({ target: { files: [new File([png], "local.png", { type: "image/png" })], value: "local.png" } });
  const localPreview = flatten(renderImage()).find(node => node?.type === "img");
  assert.equal(localPreview.props.src, "blob:local-preview");
  assert.match(flatten(renderImage()).filter(value => typeof value === "string").join(" "), /local.png/);
} finally { URL.createObjectURL = originalCreateUrl; globalThis.Image = originalImage; }
const reopened = await route.GET(new Request("http://localhost/api/articles/id/featured-image"), context);
assert.equal(reopened.status, 200);
assert.equal(reopened.headers.get("content-type"), "image/png");
assert.deepEqual(Buffer.from(await reopened.arrayBuffer()), png);
const restored = validation.parseArticle(saved, saved);
assert.equal(restored.draftImage.path, saved.draftImage.path);

saved = { ...saved, status: "ready", accuracyChecks: [...types.accuracyItems] };
const adapter = load("lib/public-adapter.ts", { "server-only": {}, "./github": github, "./validation": validation, "./public-body": load("lib/public-body.ts") });
const publishing = load("lib/publishing.ts", { "server-only": {}, "./github": github, "./public-adapter": adapter, "./image-path": paths, "./images": images, "./validation": validation, "./public-body": load("lib/public-body.ts") });
const target = await publishing.inspectTarget(saved);
assert.equal(target.image.path, "public/images/patterns/easy-crochet-flower-pattern.png");
assert.equal(target.image.replaceRequired, false);
assert.equal(target.existing, null);
const committed = await publishing.executePublicCommit(saved, "create");
assert.equal(committed.target.path, "content/patterns/easy-crochet-flower-pattern.md");
assert.equal(writes.at(-1).kind, "atomic");
assert.deepEqual(writes.at(-1).files.sort(), [target.image.path, committed.target.path].sort());
assert.equal(publicFiles.get(target.image.path).bytes.equals(png), true);
assert.match(publicFiles.get(committed.target.path).content, /featuredImage: "\/images\/patterns\/easy-crochet-flower-pattern.png"/);
assert.match(fs.readFileSync("../craft/app/patterns/[slug]/page.tsx", "utf8"), /<Image src=\{pattern\.featuredImage\}/);

publicFiles.delete(committed.target.path);
privateFile = { bytes: Buffer.from(png.map((byte, index) => index === png.length - 1 ? byte ^ 1 : byte)), sha: "d".repeat(40) };
const collision = await publishing.inspectTarget(saved);
assert.equal(collision.image.replaceRequired, true);
await assert.rejects(() => publishing.executePublicCommit(saved, "create"), error => error.code === "PUBLIC_IMAGE_EXISTS");
failArticleWrite = true;
const priorPublicImage = publicFiles.get(target.image.path).bytes;
await assert.rejects(() => publishing.executePublicCommit(saved, "create", undefined, collision.image.existingSha, true), /Atomic commit failed/);
assert.equal(publicFiles.has(committed.target.path), false, "article must remain absent when the atomic commit fails");
assert.equal(publicFiles.get(target.image.path).bytes, priorPublicImage, "existing public image must remain unchanged on failure");
failArticleWrite = false;
await publishing.executePublicCommit(saved, "create", undefined, collision.image.existingSha, true);
assert.equal(publicFiles.get(target.image.path).bytes.equals(privateFile.bytes), true, "retry atomically updates the image and article");
privateFile = { bytes: png, sha: "e".repeat(40) };
const updateImageSha = publicFiles.get(target.image.path).sha;
const updateArticleSha = publicFiles.get(committed.target.path).sha;
await assert.rejects(() => publishing.executePublicCommit(saved, "update", updateArticleSha, updateImageSha), error => error.code === "PUBLIC_IMAGE_EXISTS");
await publishing.executePublicCommit(saved, "update", updateArticleSha, updateImageSha, true);
assert.equal(writes.at(-1).message, "content: update easy-crochet-flower-pattern");
assert.equal(publicFiles.get(target.image.path).bytes.equals(png), true, "confirmed update replaces the public image");

const removed = await route.DELETE(new Request("http://localhost/api/articles/id/featured-image", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storageSha: saved.storageSha }) }), context);
assert.equal(removed.status, 200);
assert.equal(saved.draftImage, undefined);
assert.equal(privateFile, null);
const realGithub = load("lib/github.ts", { "server-only": {} });
const originalFetch = globalThis.fetch;
const apiCalls = [];
try {
  globalThis.fetch = async (url, init) => {
    const method = init?.method || "GET";
    apiCalls.push({ url, method, body: init?.body && JSON.parse(init.body) });
    if (url.endsWith("/git/ref/heads/main")) return Response.json({ object: { sha: "h".repeat(40) } });
    if (url.endsWith(`/git/commits/${"h".repeat(40)}`)) return Response.json({ tree: { sha: "t".repeat(40) } });
    if (url.endsWith("/git/blobs")) return Response.json({ sha: String(apiCalls.filter(call => call.url.endsWith("/git/blobs")).length).repeat(40) });
    if (url.endsWith("/git/trees")) return Response.json({ sha: "n".repeat(40) });
    if (url.endsWith("/git/commits")) return Response.json({ sha: "c".repeat(40) });
    if (url.endsWith("/git/refs/heads/main")) return Response.json({ object: { sha: "c".repeat(40) } });
    throw new Error(`Unexpected GitHub endpoint ${url}`);
  };
  const atomic = await realGithub.putFilesAtomic(publicRepo, [{ path: "content/patterns/flower.md", bytes: Buffer.from("article") }, { path: "public/images/patterns/flower.png", bytes: png }], "content: publish flower", "h".repeat(40));
  assert.equal(atomic.commitSha, "c".repeat(40));
  assert.equal(apiCalls.filter(call => call.url.endsWith("/git/blobs")).length, 2);
  assert.equal(apiCalls.find(call => call.url.endsWith("/git/trees")).body.tree.length, 2);
  assert.equal(apiCalls.at(-1).method, "PATCH");
  assert.equal(apiCalls.at(-1).body.force, false);
  assert.equal(apiCalls.at(-1).body.sha, "c".repeat(40));
  await assert.rejects(() => realGithub.putFilesAtomic(publicRepo, [{ path: "content/patterns/flower.md", bytes: Buffer.from("article") }], "content: publish flower", "z".repeat(40)), error => error.code === "GITHUB_CONFLICT");
} finally { globalThis.fetch = originalFetch; }
console.log("Image validation, local preview, private upload, reopen, atomic public publish, collision, retry, and removal checks passed.");
