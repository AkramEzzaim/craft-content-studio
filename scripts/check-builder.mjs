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
process.env.CRAFT_SITE_URL = "https://craft-iota-wheat.vercel.app";
const types = load("lib/types.ts");
const paths = load("lib/image-path.ts");
const defaults = load("lib/article-defaults.ts", { "./types": types });
const markdown = load("lib/article-markdown.ts", { "./image-path": paths });
const validation = load("lib/validation.ts", { "./types": types, "./article-defaults": defaults, "./article-markdown": markdown, "./image-path": paths });
const id = "11111111-1111-4111-8111-111111111111";
const rounds = Array.from({ length: 4 }, (_, index) => ({ kind: "round", title: index === 0 ? "Make the center" : "Work outward", instruction: `Work the stitches for round ${index + 1} and join.`, stitchCount: `${(index + 1) * 6} sts`, tip: "Keep the corners even." }));
const input = { ...types.emptyArticle(), id, title: "Solid Crochet Hexagon Without Gaps", description: "A beginner friendly crochet motif with a smooth, gap-free finish.", difficulty: "Easy", estimatedTime: "30–45 minutes", yarnWeight: "DK", hookSize: "4 mm", materials: ["DK yarn", "4 mm hook", "Scissors", "Yarn needle"], abbreviationEntries: [{ short: "ch", meaning: "chain stitch" }, { short: "dc", meaning: "double crochet" }], instructions: rounds, importantNotes: ["Mark corner stitches."], mistakes: [{ title: "Too many corner stitches", explanation: "The motif waves.", fix: "Recount each round." }], variations: [{ title: "Larger hexagon", text: "Add another round." }], faq: [{ question: "Can I use cotton?", answer: "Yes, but check your gauge." }], accuracyChecks: [...types.accuracyItems] };
let article = validation.parseArticle(input);
article.id = id;
assert.equal(article.slug, "solid-crochet-hexagon-without-gaps");
assert.equal(article.primaryKeyword, input.title.toLowerCase());
for (const heading of ["About This Pattern", "Project Information", "Materials", "Abbreviations", "Instructions", "Important Notes", "Variations", "Common Mistakes", "FAQ"]) assert.match(article.contentMarkdown, new RegExp(`## ${heading}`));
assert.equal((article.contentMarkdown.match(/### Round \d/g) || []).length, 4);
assert.match(article.contentMarkdown, /\*\*ch\*\* — chain stitch/);
assert.match(article.contentMarkdown, /\*\*Stitch count:\*\* 6 sts/);
assert.match(article.contentMarkdown, /\*\*How to fix it:\*\* Recount each round/);
assert.doesNotMatch(markdown.generatedMarkdown({ ...article, variations: [], mistakes: [], faq: [], importantNotes: [] }), /## (Variations|Common Mistakes|FAQ|Important Notes)/);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO9u7N8AAAAASUVORK5CYII=", "base64");
const featuredPath = paths.draftImagePath(id, "png");
const featuredPublic = paths.featuredPatternImagePath(article.slug, "png");
const privateFiles = new Map([[featuredPath, { bytes: png, sha: "b".repeat(40) }]]);
const publicFiles = new Map();
article = { ...article, draftImage: { path: featuredPath, publicPath: featuredPublic, extension: "png", mimeType: "image/png", originalName: "feature.png", size: png.length }, featuredImage: paths.imageUrlFromPath(featuredPublic), status: "ready", storageSha: "draft-sha" };
let saved = article;
const repo = { owner: "test", name: "craft", branch: "main", token: "test" };
const github = {
  studioRepo: () => ({ ...repo, name: "studio" }), craftRepo: () => repo, assertPrivateRepo: async () => {}, verifyRepositoryBranch: async () => {}, branchHeadSha: async () => "h".repeat(40),
  getBinaryFile: async (target, path) => target.name === "studio" ? privateFiles.get(path) || null : publicFiles.get(path) || null,
  putBinaryFileWithCommit: async (_target, path, bytes) => { privateFiles.set(path, { bytes, sha: "b".repeat(40) }); return { fileSha: "b".repeat(40), commitSha: "c".repeat(40) }; },
  deleteFile: async (_target, path) => { privateFiles.delete(path); },
  getFile: async (_target, path) => publicFiles.get(path) || null,
  fileExists: async () => true,
  putFileWithCommit: async () => { throw new Error("Expected one atomic commit"); },
  putFilesAtomic: async (_target, files, _message, head) => {
    assert.equal(head, "h".repeat(40));
    const shas = {};
    for (const file of files) { shas[file.path] = "b".repeat(40); publicFiles.set(file.path, file.path.endsWith(".md") ? { content: file.bytes.toString("utf8"), sha: shas[file.path] } : { bytes: file.bytes, sha: shas[file.path] }); }
    return { fileShas: shas, commitSha: "c".repeat(40) };
  },
};
const images = load("lib/images.ts", { "server-only": {}, "./image-path": paths });
const storage = { getArticle: async () => saved, saveArticle: async next => { saved = { ...next, storageSha: "next-sha" }; return saved; } };
const api = load("app/api/articles/[id]/gallery-image/route.ts", { "@/lib/auth": { apiAuth: async () => null }, "@/lib/api": { errorResponse: error => Response.json({ error: error.message }, { status: 400 }) }, "@/lib/storage": storage, "@/lib/github": github, "@/lib/image-path": paths, "@/lib/images": images, "@/lib/article-markdown": markdown });
const context = { params: Promise.resolve({ id }) };
const form = new FormData(); form.set("storageSha", article.storageSha); form.set("image", new File([png], "extra.png", { type: "image/png" }));
const uploaded = await api.POST(new Request("http://localhost/api/articles/id/gallery-image", { method: "POST", body: form }), context);
assert.equal(uploaded.status, 200);
assert.equal(saved.galleryImages.length, 1);
const gallery = saved.galleryImages[0];
assert.equal(gallery.publicPath, `public/images/patterns/${article.slug}/photo-${gallery.id}.png`);
assert.match(saved.contentMarkdown, /## More Photos/);
const withStepPhoto = markdown.generatedMarkdown({ ...saved, instructions: saved.instructions.map((step, index) => index === 1 ? { ...step, imageId: gallery.id } : step) });
assert.match(withStepPhoto, new RegExp(`### Round 2[\\s\\S]*photo-${gallery.id}\\.png`));
assert.doesNotMatch(withStepPhoto, /## More Photos/, "a round photo is not repeated in the gallery");
const preview = await api.GET(new Request(`http://localhost/api/articles/id/gallery-image?imageId=${gallery.id}`), context);
assert.equal(preview.status, 200); assert.equal(Buffer.from(await preview.arrayBuffer()).equals(png), true);
const reopened = validation.parseArticle(JSON.parse(JSON.stringify(saved)), saved);
assert.equal(reopened.galleryImages.length, 1); assert.equal(reopened.instructions.length, 4); assert.equal(reopened.mistakes.length, 1);
const body = load("lib/public-body.ts");
const adapter = load("lib/public-adapter.ts", { "server-only": {}, "./github": { ...github, safePath: x => x }, "./validation": validation, "./public-body": body });
const publishing = load("lib/publishing.ts", { "server-only": {}, "./github": github, "./public-adapter": adapter, "./validation": validation, "./public-body": body, "./image-path": paths, "./images": images });
assert.deepEqual(validation.publishIssues(saved), []);
const result = await publishing.executePublicCommit(saved, "create");
assert.equal(result.target.path, `content/patterns/${article.slug}.md`);
assert.equal(publicFiles.get(gallery.publicPath).bytes.equals(png), true);
assert.equal(publicFiles.get(featuredPublic).bytes.equals(png), true);
assert.match(publicFiles.get(result.target.path).content, new RegExp(`photo-${gallery.id}\\.png`));
assert.match(publicFiles.get(result.target.path).content, /featuredImage: "\/images\/patterns\/solid-crochet-hexagon-without-gaps\/featured.png"/);
const legacy = { ...types.emptyArticle(), contentMode: undefined, contentMarkdown: "Legacy text.\n\n## Instructions\n### Step\nKeep this body." };
assert.equal(validation.parseArticle(legacy, legacy).contentMarkdown, legacy.contentMarkdown);
const React = await import("react");
const jsxRuntime = await import("react/jsx-runtime");
const debugJsx = { ...jsxRuntime, jsx(type, props, key) { if (!type) throw new Error(`Undefined JSX: ${JSON.stringify(props).slice(0, 150)}`); return jsxRuntime.jsx(type, props, key); }, jsxs(type, props, key) { if (!type) throw new Error(`Undefined JSX: ${JSON.stringify(props).slice(0, 150)}`); return jsxRuntime.jsxs(type, props, key); } };
const { renderToStaticMarkup } = await import("react-dom/server");
const icon = () => null;
const editor = load("components/editor.tsx", { "react": React, "react/jsx-runtime": debugJsx, "next/navigation": { useRouter: () => ({ replace() {}, refresh() {} }) }, "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) }, "lucide-react": Object.fromEntries(["ArrowLeft","ArrowDown","ArrowUp","Check","Eye","Plus","Save","Sparkles","Trash2"].map(name => [name, icon])), "@/lib/types": types, "@/lib/article-defaults": defaults, "@/lib/article-markdown": markdown, "@/lib/image-path": paths, "@/lib/validation": validation, "./public-preview": { PublicPreview: () => null }, "./featured-image-upload": { FeaturedImageUpload: () => null }, "./gallery-upload": { GalleryUpload: () => null }, "./publish-panel": { PublishPanel: () => null }, "./status": { StatusBadge: () => null } }, true);
assert.equal(typeof editor.Editor, "function");
const basicsHtml = renderToStaticMarkup(React.createElement(editor.Editor));
for (const label of ["Basics", "Project Info", "Materials", "Abbreviations", "Pattern / Rounds", "Important Notes", "Common Mistakes", "FAQ", "Images", "Preview &amp; Publish"]) assert.match(basicsHtml, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(basicsHtml, /Short introduction/);
assert.doesNotMatch(basicsHtml, /<span>SEO title<\/span>/);
const roundsHtml = renderToStaticMarkup(React.createElement(editor.Editor, { initial: article, initialTab: "Pattern / Rounds" }));
assert.match(roundsHtml, /Add round/); assert.match(roundsHtml, /Stitch count/);
console.log("Builder fields, four rounds, draft gallery reopen, preview, atomic public files, and legacy Markdown checks passed.");
