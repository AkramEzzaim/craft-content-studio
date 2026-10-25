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
const rounds = Array.from({ length: 4 }, (_, index) => ({ kind: "round", title: index === 0 ? "Make the center" : "Work outward", instruction: `Work the stitches for round ${index + 1} and join.`, pattern: index === 0 ? "ch 3, 2 dc in ring" : "", explanation: `Work the stitches for round ${index + 1} and join.`, stitchCount: `${(index + 1) * 6} sts`, tip: "Keep the corners even." }));
const input = { ...types.emptyArticle(), id, title: "Solid Crochet Hexagon Without Gaps", description: "A beginner friendly crochet motif with a smooth, gap-free finish.", difficulty: "Easy", estimatedTime: "30–45 minutes", yarnWeight: "DK", hookSize: "4 mm", materials: ["DK yarn", "4 mm hook", "Scissors", "Yarn needle"], abbreviationEntries: [{ short: "ch", meaning: "chain stitch" }, { short: "ch-sp", meaning: "chain space" }, { short: "dc", meaning: "double crochet" }, { short: "inc", meaning: "increase" }, { short: "rep", meaning: "repeat" }, { short: "st", meaning: "stitch" }, { short: "sl st", meaning: "slip stitch" }], instructions: rounds, importantNotes: ["Mark corner stitches.", "Check your tension.", "Block before joining.", "Count after every round."], mistakes: [{ title: "Too many corner stitches", explanation: "The motif waves.", fix: "Recount each round." }, { title: "Joining the wrong stitch", explanation: "The seam shifts.", fix: "Join the starting chain." }, { title: "Loose tension", explanation: "Corners flare.", fix: "Try a smaller hook." }], variations: [{ title: "Larger hexagon", text: "Add another round." }, { title: "Colorwork", text: "Change yarn each round." }], faq: [{ question: "Can I use cotton?", answer: "Yes, but check your gauge." }, { question: "Can I make it larger?", answer: "Add more rounds." }, { question: "Should I block it?", answer: "Block before joining." }, { question: "Which terms are used?", answer: "US crochet terms." }], accuracyChecks: [...types.accuracyItems] };
let article = validation.parseArticle(input);
article.id = id;
assert.equal(article.slug, "solid-crochet-hexagon-without-gaps");
assert.equal(article.primaryKeyword, input.title.toLowerCase());
for (const heading of ["About This Pattern", "Project Information", "Materials", "Abbreviations", "Instructions", "Important Notes", "Variations", "Common Mistakes", "FAQ"]) assert.match(article.contentMarkdown, new RegExp(`## ${heading}`));
assert.equal((article.contentMarkdown.match(/### Round \d/g) || []).length, 4);
assert.match(article.contentMarkdown, /\*\*ch\*\* — chain stitch/);
assert.match(article.contentMarkdown, /\*\*Stitch count:\*\* 6 sts/);
assert.match(article.contentMarkdown, /\*\*Pattern:\*\* ch 3, 2 dc in ring/);
assert.equal(article.abbreviationEntries.length, 7); assert.equal(article.importantNotes.length, 4); assert.equal(article.mistakes.length, 3); assert.equal(article.variations.length, 2); assert.equal(article.faq.length, 4);
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
  getFileSha: async (_target, path) => publicFiles.get(path)?.sha || null,
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
const secondForm = new FormData(); secondForm.set("storageSha", saved.storageSha); secondForm.set("image", new File([png], "second.png", { type: "image/png" }));
const secondUpload = await api.POST(new Request("http://localhost/api/articles/id/gallery-image", { method: "POST", body: secondForm }), context);
assert.equal(secondUpload.status, 200);
assert.equal(saved.galleryImages.length, 2);
const secondGallery = saved.galleryImages[1];
const reopened = validation.parseArticle(JSON.parse(JSON.stringify(saved)), saved);
assert.equal(reopened.galleryImages.length, 2); assert.equal(reopened.instructions.length, 4); assert.equal(reopened.mistakes.length, 3);
assert.equal(reopened.abbreviationEntries.length, 7); assert.equal(reopened.importantNotes.length, 4); assert.equal(reopened.variations.length, 2); assert.equal(reopened.faq.length, 4);
const reordered = validation.parseArticle({ ...reopened, galleryImages: [secondGallery, gallery] }, reopened);
assert.equal(reordered.galleryImages[0].id, secondGallery.id);
const body = load("lib/public-body.ts");
const adapter = load("lib/public-adapter.ts", { "server-only": {}, "./github": { ...github, safePath: x => x }, "./validation": validation, "./public-body": body });
const publishing = load("lib/publishing.ts", { "server-only": {}, "./github": github, "./public-adapter": adapter, "./validation": validation, "./public-body": body, "./image-path": paths, "./images": images, "./pattern-pdf": { generatePatternPdf: async () => Buffer.from("%PDF-1.7\nmock\n%%EOF") } });
assert.deepEqual(validation.publishIssues(saved), []);
const result = await publishing.executePublicCommit(saved, "create");
assert.equal(result.target.path, `content/patterns/${article.slug}.md`);
assert.equal(publicFiles.get(gallery.publicPath).bytes.equals(png), true);
assert.equal(publicFiles.get(secondGallery.publicPath).bytes.equals(png), true);
assert.equal(publicFiles.get(featuredPublic).bytes.equals(png), true);
assert.match(publicFiles.get(result.target.path).content, new RegExp(`photo-${gallery.id}\\.png`));
assert.match(publicFiles.get(result.target.path).content, new RegExp(`photo-${secondGallery.id}\\.png`));
assert.match(publicFiles.get(result.target.path).content, /featuredImage: "\/images\/patterns\/solid-crochet-hexagon-without-gaps\/featured.png"/);
const completedDraft = saved;
saved = { ...types.emptyArticle(), id, storageSha: "draft-sha", rawSource: "# Pattern" };
const beforeParseForm = new FormData(); beforeParseForm.set("storageSha", saved.storageSha); beforeParseForm.set("image", new File([png], "before-parse.png", { type: "image/png" }));
assert.equal((await api.POST(new Request("http://localhost/api/articles/id/gallery-image", { method: "POST", body: beforeParseForm }), context)).status, 200);
assert.equal(saved.galleryImages[0].publicPath, undefined);
const titledWithGallery = validation.parseArticle({ ...saved, title: "Sunflower Pattern" }, saved);
assert.match(titledWithGallery.galleryImages[0].publicPath, /^public\/images\/patterns\/sunflower-pattern\/photo-/);
saved = completedDraft;
const legacy = { ...types.emptyArticle(), contentMode: undefined, contentMarkdown: "Legacy text.\n\n## Instructions\n### Step\nKeep this body." };
assert.equal(validation.parseArticle(legacy, legacy).contentMarkdown, legacy.contentMarkdown);
const oldStructured = { ...types.emptyArticle(), instructionMode: undefined, instructions: [{ kind: "step", title: "Foundation", instruction: "Chain four.", stitchCount: "4 chains" }] };
const migrated = validation.parseArticle(oldStructured, oldStructured);
assert.equal(migrated.instructionMode, "steps");
assert.match(migrated.contentMarkdown, /### Step 1 — Foundation/);
assert.match(migrated.contentMarkdown, /Chain four\./);
const React = await import("react");
const jsxRuntime = await import("react/jsx-runtime");
const debugJsx = { ...jsxRuntime, jsx(type, props, key) { if (!type) throw new Error(`Undefined JSX: ${JSON.stringify(props).slice(0, 150)}`); return jsxRuntime.jsx(type, props, key); }, jsxs(type, props, key) { if (!type) throw new Error(`Undefined JSX: ${JSON.stringify(props).slice(0, 150)}`); return jsxRuntime.jsxs(type, props, key); } };
const { renderToStaticMarkup } = await import("react-dom/server");
const icon = () => null;
const editor = load("components/editor.tsx", { "react": React, "react/jsx-runtime": debugJsx, "next/navigation": { useRouter: () => ({ replace() {}, refresh() {} }) }, "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) }, "lucide-react": Object.fromEntries(["ArrowLeft","ArrowDown","ArrowUp","Check","Eye","Plus","Save","Sparkles","Trash2"].map(name => [name, icon])), "@/lib/types": types, "@/lib/article-defaults": defaults, "@/lib/article-markdown": markdown, "@/lib/image-path": paths, "@/lib/validation": validation, "./public-preview": { PublicPreview: () => null }, "./featured-image-upload": { FeaturedImageUpload: () => null }, "./gallery-upload": { GalleryUpload: () => null }, "./note-entries-editor": { NoteEntriesEditor: () => null }, "./article-deletion": { ArticleDeletion: () => null }, "./publish-panel": { PublishPanel: () => null }, "./status": { StatusBadge: () => null } }, true);
assert.equal(typeof editor.Editor, "function");
const basicsHtml = renderToStaticMarkup(React.createElement(editor.Editor));
for (const label of ["Pattern", "Instructions", "Extras", "Photos", "Review"]) assert.match(basicsHtml, new RegExp(label));
assert.match(basicsHtml, /Short introduction/);
assert.match(basicsHtml, /<details class="builder-advanced"><summary>Advanced settings<\/summary>/);
const roundsHtml = renderToStaticMarkup(React.createElement(editor.Editor, { initial: article, initialTab: "Instructions" }));
assert.match(roundsHtml, /Add round/); assert.match(roundsHtml, /Pattern notation/); assert.match(roundsHtml, /Step-by-step explanation/);
const reviewHtml = renderToStaticMarkup(React.createElement(editor.Editor, { initial: saved, initialTab: "Review" }));
assert.match(reviewHtml, /builder-review-image/); assert.match(reviewHtml, /Full Preview/); assert.match(reviewHtml, /Pattern physically tested/);
console.log("Builder fields, four rounds, two draft photos, reopen, reorder, atomic public files, and legacy Markdown checks passed.");
