import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import PDFDocument from "pdfkit";
import sharp from "sharp";

function load(file, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", code)((name) => {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected import ${name} in ${file}`);
  }, mod, mod.exports);
  return mod.exports;
}

const types = load("lib/types.ts");
const imagePaths = load("lib/image-path.ts");
const markdown = load("lib/article-markdown.ts", { "./image-path": imagePaths });
const body = load("lib/public-body.ts");
const pdf = load("lib/pattern-pdf.ts", { "server-only": {}, pdfkit: PDFDocument, sharp, "node:fs": fs, "node:path": path, "./public-body": body });
const id = "11111111-1111-4111-8111-111111111111";
const article = {
  ...types.emptyArticle(), id, slug: "easy-crochet-frog", title: "Easy Crochet Frog",
  description: "A friendly beginner crochet frog with clearly numbered rounds.",
  introduction: "Make a small crochet frog with simple stitches and a soft cotton yarn.",
  difficulty: "Beginner", estimatedTime: "2 hours", yarnType: "cotton yarn", yarnWeight: "DK",
  hookSize: "3.5 mm", dimensions: "About 10 cm tall", featuredImage: "/images/patterns/easy-crochet-frog/featured.png",
  materials: ["Green DK cotton yarn", "A small amount of black yarn", "Fiberfill"],
  abbreviationEntries: [{ short: "ch", meaning: "chain" }, { short: "sc", meaning: "single crochet" }, { short: "sl st", meaning: "slip stitch" }],
  instructions: Array.from({ length: 10 }, (_, index) => ({ kind: "round", title: index === 0 ? "Center" : `Body ${index + 1}`, pattern: `Magic ring, ch 1, work ${8 + index * 2} sc. Repeat evenly around.`, explanation: "Count each stitch before you continue. Keep the yarn tension gentle and consistent.", stitchCount: String(8 + index * 2), imageId: index === 1 ? id : "" })),
  galleryImages: [{ id, path: `studio/assets/${id}/photos/${id}.png`, publicPath: `public/images/patterns/easy-crochet-frog/photo-${id}.png`, extension: "png", mimeType: "image/png", originalName: "round-2.png", size: 100, alt: "Crochet frog after round two", caption: "The body after round two." }],
  finishing: "Stuff the body, sew the opening closed, and weave in all yarn ends.",
  importantNotes: ["Keep stitch markers at the start of each round."],
  mistakes: [{ title: "Uneven edges", explanation: "Missed stitches can pull the body out of shape.", fix: "Count every round before moving on." }],
  variations: [{ title: "Different colors", text: "Try a second color for the frog's belly." }],
  faq: [{ question: "Can I use another yarn?", answer: "Yes. Match the hook to the yarn and check the finished size." }],
  updatedAt: "2026-10-25T12:00:00.000Z", contentMode: "structured",
};
article.contentMarkdown = markdown.generatedMarkdown(article);
const image = await sharp({ create: { width: 1200, height: 850, channels: 3, background: "#a9c49a" } }).png().toBuffer();
const result = await pdf.generatePatternPdf(article, async path => path.startsWith("/images/patterns/easy-crochet-frog/") ? image : null, "https://freecrochetpatternsforall.com/pdfs/easy-crochet-frog.pdf");
assert.ok(result.length > 2500);
assert.equal(result.subarray(0, 5).toString(), "%PDF-");
assert.match(result.subarray(-24).toString("latin1"), /%%EOF/);
assert.match(result.toString("latin1"), /NotoSans-Regular/);
assert.match(result.toString("latin1"), /NotoSans-Bold/);
assert.doesNotMatch(result.toString("latin1"), /Helvetica/);
if (process.env.PDF_OUTPUT_PATH) fs.writeFileSync(process.env.PDF_OUTPUT_PATH, result);
const revised = { ...article, title: "Easy Crochet Frog - Revised", updatedAt: "2026-10-25T13:00:00.000Z" };
const updated = await pdf.generatePatternPdf(revised, async () => image, "https://freecrochetpatternsforall.com");
assert.notDeepEqual(updated, result, "updating an article regenerates its PDF");
await assert.rejects(() => pdf.generatePatternPdf({ ...article, slug: "../escape" }, async () => image, "https://freecrochetpatternsforall.com"), /Invalid article slug/);
await assert.rejects(() => pdf.generatePatternPdf(article, async () => null, "https://freecrochetpatternsforall.com"), /featured image is missing/);
console.log(`PDF generation passed: ${result.length} bytes, structured rounds and images, update and invalid input checks.`);
