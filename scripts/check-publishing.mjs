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
const body = load("lib/public-body.ts");
const defaults = load("lib/article-defaults.ts", { "./types": types });
const imagePath = load("lib/image-path.ts");
const articleMarkdown = load("lib/article-markdown.ts", { "./image-path": imagePath });
const images = load("lib/images.ts", { "server-only": {}, "./image-path": imagePath });
const validation = load("lib/validation.ts", { "./types": types, "./article-defaults": defaults, "./article-markdown": articleMarkdown, "./image-path": imagePath });
const repo = { owner: "AkramEzzaim", name: "craft", branch: "main", token: "test-only" };
const calls = [];
let remote = null;
let remotePdf = null;
let failPdf = false;
let branchChecks = 0;
const pdfBytes = Buffer.from("%PDF-1.7\nmock PDF content\n%%EOF");
const github = {
  craftRepo: () => repo,
  safePath: value => { if (value.includes("..")) throw new Error("Invalid repository path"); return value; },
  verifyRepositoryBranch: async () => { branchChecks++; },
  fileExists: async (_repo, path) => path === "public/images/patterns/flower.png",
  getFile: async () => remote,
  getFileSha: async (_repo, path) => path.endsWith(".pdf") ? remotePdf?.sha || null : remote?.sha || null,
  getBinaryFile: async (_repo, path) => path.endsWith(".pdf") ? remotePdf : null,
  studioRepo: () => ({ ...repo, name: "private-studio" }),
  branchHeadSha: async () => "b".repeat(40),
  latestCommitSha: async () => "c".repeat(40),
  putFilesAtomic: async (_repo, files, message, expectedBranchHead) => {
    assert.equal(expectedBranchHead, "b".repeat(40));
    calls.push({ files, message });
    const markdown = files.find(file => file.path.endsWith(".md"));
    const pdf = files.find(file => file.path.endsWith(".pdf"));
    assert.ok(pdf, "every publishing commit must contain a PDF");
    if (markdown) remote = { content: markdown.bytes.toString("utf8"), sha: String(calls.length).repeat(40) };
    remotePdf = { bytes: pdf.bytes, sha: `p${calls.length}` };
    return { fileShas: { ...(markdown ? { [markdown.path]: remote.sha } : {}), [pdf.path]: remotePdf.sha }, commitSha: "c".repeat(40) };
  },
  putFileWithCommit: async (_repo, path, content, message, sha) => {
    calls.push({ path, content, message, sha });
    remote = { content, sha: String(calls.length).repeat(40) };
    return { fileSha: remote.sha, commitSha: "c".repeat(40) };
  },
};
const adapter = load("lib/public-adapter.ts", { "server-only": {}, "./github": github, "./validation": validation, "./public-body": body });
const publishing = load("lib/publishing.ts", { "server-only": {}, "./github": github, "./public-adapter": adapter, "./validation": validation, "./public-body": body, "./image-path": imagePath, "./images": images, "./pattern-pdf": { generatePatternPdf: async () => { if (failPdf) throw new Error("renderer failed"); return pdfBytes; } } });
const React = await import("react");
const ReactDOMServer = await import("react-dom/server");
const ui = load("components/publish-panel.tsx", { "react": React, "react/jsx-runtime": await import("react/jsx-runtime"), "next/link": ({ children }) => children, "lucide-react": { Check: () => null, ExternalLink: () => null, Send: () => null, X: () => null }, "@/lib/validation": validation }, true);
const article = types.emptyArticle();
Object.assign(article, { id: "11111111-1111-4111-8111-111111111111", title: "Easy Crochet Flower", slug: "easy-crochet-flower", description: "A small crochet flower for a beginner.", author: "Hearth & Thread Studio", difficulty: "Beginner", featuredImage: "/images/patterns/flower.png", imageAlt: "Crocheted flower", materials: ["Cotton yarn"], yarnType: "cotton", hookSize: "3.5 mm", tools: ["3.5 mm hook"], accuracyChecks: [...types.accuracyItems], contentMarkdown: "Make a small flower with easy stitches.\n\n## Instructions\n### Make the center\nWork ten stitches into a ring, count them, and fasten off.\n", status: "ready", storageSha: "draft-1", updatedAt: "2026-10-24T10:00:00.000Z" });
assert.deepEqual(validation.publishIssues(article), []);
const readyHtml = ReactDOMServer.renderToStaticMarkup(React.createElement(ui.PublishPanel, { article, missingConfig: [], dirty: false, onArticleChange: () => {} }));
assert.match(readyHtml, /PUBLISH TO HEARTH &amp; THREAD/);
const reviewHtml = ReactDOMServer.renderToStaticMarkup(React.createElement(ui.PublishPanel, { article: { ...article, status: "review" }, missingConfig: [], dirty: false, onArticleChange: () => {} }));
assert.match(reviewHtml, /PUBLISH TO HEARTH &amp; THREAD/);
assert.match(reviewHtml, /disabled=""/);
assert.match(reviewHtml, /Mark this saved article ready/);
const missingHtml = ReactDOMServer.renderToStaticMarkup(React.createElement(ui.PublishPanel, { article, missingConfig: ["CRAFT_GITHUB_TOKEN", "CRAFT_CONTENT_PATH"], dirty: false, onArticleChange: () => {} }));
assert.doesNotMatch(missingHtml, /PUBLISH TO HEARTH &amp; THREAD/);
assert.match(missingHtml, /CRAFT_GITHUB_TOKEN, CRAFT_CONTENT_PATH/);
const unsavedHtml = ReactDOMServer.renderToStaticMarkup(React.createElement(ui.PublishPanel, { article: { ...article, storageSha: undefined }, missingConfig: [], dirty: false, onArticleChange: () => {} }));
assert.doesNotMatch(unsavedHtml, /PUBLISH TO HEARTH &amp; THREAD/);
const inspected = await publishing.inspectTarget(article);
assert.equal(inspected.target.path, "content/patterns/easy-crochet-flower.md");
assert.equal(inspected.target.url, "https://craft-iota-wheat.vercel.app/patterns/easy-crochet-flower");
assert.equal(inspected.pdf.path, "public/pdfs/easy-crochet-flower.pdf");
assert.equal(inspected.existing, null);
const hookState = [];
let hookIndex = 0;
const interactive = load("components/publish-panel.tsx", { "react": { useState(initial) { const index = hookIndex++; if (!(index in hookState)) hookState[index] = initial; return [hookState[index], next => { hookState[index] = next; }]; } }, "react/jsx-runtime": await import("react/jsx-runtime"), "next/link": ({ children }) => children, "lucide-react": { Check: () => null, ExternalLink: () => null, Send: () => null, X: () => null }, "@/lib/validation": validation }, true);
const renderPanel = () => { hookIndex = 0; return interactive.PublishPanel({ article, missingConfig: [], dirty: false, onArticleChange: () => {} }); };
const flatten = node => node == null ? [] : Array.isArray(node) ? node.flatMap(flatten) : typeof node === "object" ? [node, ...flatten(node.props?.children)] : [node];
const firstPanel = flatten(renderPanel());
const publishButton = firstPanel.find(node => node?.type === "button" && flatten(node.props.children).includes(" PUBLISH TO HEARTH & THREAD"));
assert.ok(publishButton, "ready article shows publish button");
const savedFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => Response.json({ title: article.title, slug: article.slug, status: "ready", qualityScore: 70, seoScore: 60, warnings: [], target: inspected.target, pdf: inspected.pdf, existing: null, storageSha: article.storageSha, recoveryAvailable: false });
  await publishButton.props.onClick();
  const confirmText = flatten(renderPanel()).filter(value => typeof value === "string").join(" ");
  assert.match(confirmText, /Confirm publication/);
  assert.match(confirmText, /content\/patterns\/easy-crochet-flower\.md/);
  assert.match(confirmText, /public\/pdfs\/easy-crochet-flower\.pdf/);
  assert.match(confirmText, /Confirm Publish/);
  assert.match(confirmText, /https:\/\/craft-iota-wheat\.vercel\.app\/patterns\/easy-crochet-flower/);
} finally { globalThis.fetch = savedFetch; }
const first = await publishing.executePublicCommit(article, "create");
assert.equal(first.commitSha, "c".repeat(40));
assert.equal(calls[0].message, "content: publish easy-crochet-flower");
assert.match(remote.content, /status: "published"/);
assert.equal((remote.content.match(/## Materials/g) || []).length, 1);
assert.equal((remote.content.match(/## Tools/g) || []).length, 1);
await assert.rejects(() => publishing.executePublicCommit(article, "create"), error => error.code === "ARTICLE_ALREADY_EXISTS");
assert.equal(calls.length, 1, "duplicate create must not write");
await assert.rejects(() => publishing.executePublicCommit(article, "update", "0".repeat(40)), error => error.code === "ARTICLE_CHANGED");
assert.equal(calls.length, 1, "stale update must not write");
const revised = { ...article, contentMarkdown: article.contentMarkdown + "\n## Finishing\nWeave in the yarn ends.\n", updatedAt: "2026-10-24T11:00:00.000Z" };
const second = await publishing.executePublicCommit(revised, "update", remote.sha);
assert.equal(second.commitSha, "c".repeat(40));
assert.equal(calls[1].message, "content: update easy-crochet-flower");
assert.equal(calls[1].files.find(file => file.path.endsWith(".pdf")).path, "public/pdfs/easy-crochet-flower.pdf");
assert.equal(calls[1].files.find(file => file.path.endsWith(".md")).path, "content/patterns/easy-crochet-flower.md");
const recovered = await publishing.executePublicCommit(revised, "reconcile");
assert.equal(recovered.reconciled, true);
assert.equal(calls.length, 2, "reconciliation must not write");
failPdf = true;
await assert.rejects(() => publishing.executePublicCommit(revised, "update", remote.sha), error => error.code === "PDF_GENERATION_FAILED" && /renderer failed/.test(error.message));
assert.equal(calls.length, 2, "PDF failure must not write any public file");
failPdf = false;
await assert.rejects(() => publishing.executePublicCommit({ ...article, title: "" }, "create"), error => error.code === "INVALID_ARTICLE");
await assert.rejects(() => publishing.executePublicCommit({ ...article, slug: "../escape" }, "create"), error => error.code === "INVALID_ARTICLE");
assert.ok(branchChecks >= 4);

// Route tests cover authentication, conflict handling, and private status persistence.
let stored = { ...article };
let saves = 0;
const storage = { getArticle: async () => stored, saveArticle: async next => { saves++; stored = { ...next, storageSha: `draft-${saves + 1}` }; return stored; } };
const routeImports = { "@/lib/auth": { apiAuth: async () => null }, "@/lib/api": { errorResponse: error => Response.json({ error: error.message, code: error.code }, { status: error.status || 400 }) }, "@/lib/storage": storage, "@/lib/publishing": publishing, "@/lib/public-adapter": adapter, "@/lib/validation": validation, "@/lib/github": { GithubError: class GithubError extends Error {} } };
const route = load("app/api/articles/[id]/publish/route.ts", routeImports);
const context = { params: Promise.resolve({ id: article.id }) };
const req = value => new Request("http://localhost/api/articles/id/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
const guarded = load("app/api/articles/[id]/publish/route.ts", { ...routeImports, "@/lib/auth": { apiAuth: async () => Response.json({ error: "Unauthorized" }, { status: 401 }) }, "@/lib/storage": { getArticle: async () => { throw new Error("should not be called"); } } });
assert.equal((await guarded.POST(req({ mode: "create" }), context)).status, 401);
remote = null; remotePdf = null; calls.length = 0; saves = 0; stored = { ...article };
const preview = await route.GET(new Request("http://localhost/api/articles/id/publish"), context);
assert.equal(preview.status, 200);
assert.equal((await preview.json()).target.filename, "easy-crochet-flower.md");
const created = await route.POST(req({ mode: "create", storageSha: stored.storageSha }), context);
assert.equal(created.status, 200);
const createdData = await created.json();
assert.equal(createdData.commitSha, "c".repeat(40));
assert.equal(stored.status, "published");
assert.equal(stored.githubPath, "content/patterns/easy-crochet-flower.md");
assert.equal(stored.githubCommitSha, "c".repeat(40));
assert.equal(stored.publicUrl, inspected.target.url);
assert.equal(stored.pdfUrl, inspected.pdf.url);
assert.ok(stored.publishedAt);
assert.equal(saves, 2);
const pdfOnly = await publishing.regeneratePublicPdf(stored);
assert.equal(pdfOnly.pdfUrl, inspected.pdf.url);
assert.deepEqual(calls.at(-1).files.map(file => file.path), ["public/pdfs/easy-crochet-flower.pdf"]);
const pdfRoute = load("app/api/articles/[id]/pdf/route.ts", routeImports);
const regenerated = await pdfRoute.POST(req({ storageSha: stored.storageSha }), context);
assert.equal(regenerated.status, 200);
assert.equal((await regenerated.json()).pdfUrl, inspected.pdf.url);
failPdf = true;
const beforePdfFailure = calls.length;
await assert.rejects(() => publishing.regeneratePublicPdf(stored), error => error.code === "PDF_GENERATION_FAILED");
assert.equal(calls.length, beforePdfFailure, "PDF regeneration failure must not write");
failPdf = false;
stored = { ...article, storageSha: "draft-new" }; saves = 0;
const duplicate = await route.POST(req({ mode: "create", storageSha: stored.storageSha }), context);
assert.equal(duplicate.status, 409);
assert.equal((await duplicate.json()).code, "ARTICLE_ALREADY_EXISTS");
assert.equal(saves, 0);
remote = null; remotePdf = null; stored = { ...article, status: "publishing", storageSha: "draft-pending" }; saves = 0;
const pendingPreview = await route.GET(new Request("http://localhost/api/articles/id/publish"), context);
assert.equal((await pendingPreview.json()).retryAvailable, true);
const unlocked = await route.POST(req({ mode: "reconcile", storageSha: stored.storageSha }), context);
assert.equal(unlocked.status, 409);
assert.equal((await unlocked.json()).code, "PUBLISHING_RETRY_AVAILABLE");
assert.equal(stored.status, "failed");
// Check the actual GitHub Contents API payload without making a network request.
const realGithub = load("lib/github.ts", { "server-only": {} });
for (const key of realGithub.craftRequiredConfig) process.env[key] = "test-configured";
delete process.env.CRAFT_GITHUB_BRANCH;
assert.deepEqual(realGithub.craftMissingConfig(), ["CRAFT_GITHUB_BRANCH"]);
process.env.CRAFT_GITHUB_BRANCH = "main";
assert.deepEqual(realGithub.craftMissingConfig(), []);
const savedSiteUrl = process.env.CRAFT_SITE_URL;
delete process.env.CRAFT_SITE_URL;
assert.equal(adapter.publicUrl(article), "https://craft-iota-wheat.vercel.app/patterns/easy-crochet-flower");
process.env.CRAFT_SITE_URL = savedSiteUrl;
const priorFetch = globalThis.fetch;
let requestUrl;
let requestInit;
try {
  globalThis.fetch = async (url, init) => {
    requestUrl = url; requestInit = init;
    return Response.json({ content: { sha: "f".repeat(40) }, commit: { sha: "c".repeat(40) } });
  };
  const write = await realGithub.putFileWithCommit(repo, "content/patterns/easy-crochet-flower.md", "test body", "content: publish easy-crochet-flower");
  assert.equal(write.commitSha, "c".repeat(40));
  assert.match(requestUrl, /\/repos\/AkramEzzaim\/craft\/contents\/content\/patterns\/easy-crochet-flower\.md$/);
  const payload = JSON.parse(requestInit.body);
  assert.equal(requestInit.method, "PUT");
  assert.equal(payload.branch, "main");
  assert.equal(payload.message, "content: publish easy-crochet-flower");
  assert.equal(Buffer.from(payload.content, "base64").toString("utf8"), "test body");
  assert.equal(payload.sha, undefined);
} finally { globalThis.fetch = priorFetch; }
console.log("Publishing visibility, confirmation, auth, payload, duplicate, update, reconciliation, and status checks passed.");
