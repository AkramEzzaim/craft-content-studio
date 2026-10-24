import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
function load(file, imports = {}, isJsx = false) {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: isJsx ? ts.JsxEmit.ReactJSX : undefined } }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", code)((name) => { if (name in imports) return imports[name]; throw new Error(`Unexpected import ${name} in ${file}`); }, mod, mod.exports);
  return mod.exports;
}
const types = load("lib/types.ts"), paths = load("lib/image-path.ts");
const defaults = load("lib/article-defaults.ts", { "./types": types });
const markdown = load("lib/article-markdown.ts", { "./image-path": paths });
const validation = load("lib/validation.ts", { "./types": types, "./article-defaults": defaults, "./article-markdown": markdown, "./image-path": paths });
const fingerprint = load("lib/raw-fingerprint.ts");
const parser = load("lib/pattern-parser.ts", { "server-only": {}, "./types": types, "./validation": validation, "./raw-fingerprint": fingerprint });
const source = `# Easy Crochet Sunflower Coaster — Free Beginner Pattern

## Short Introduction
A bright beginner-friendly coaster with a raised flower center.

## Project Info
**Difficulty:** Easy
- Estimated time: 30–45 minutes
Yarn: DK cotton
**Hook:** 4 mm
Finished size: 10–12 cm

## Supplies
- Brown cotton yarn
- Yellow cotton yarn
- 4 mm hook
- Scissors

## Stitch Abbreviations
**MR** — Magic ring
ch — Chain
sc: Single crochet
dc — Double crochet

# Main Pattern
## Round 1 — Flower Center
### Pattern
MR, ch 1, 8 sc in ring.
### Beginner Explanation
Make a magic ring and work eight single crochets into it.
**Stitch count:** 8 stitches.
### Tip
Keep the center flat.
## Round 2 — Expand the Center
### Pattern
2 sc in each stitch around.
### Beginner Explanation
Work an increase in every stitch.
**Stitch count:** 16 stitches.
## Round 3 — Petals
### Pattern
Repeat five chain petals around.

## Finishing
Fasten off and weave in the ends.

# About This Pattern
This coaster uses a simple circular center and bright petals.

# Pattern Notes
- Count each stitch before joining.
- Use markers at the round start.
- Block gently.
- Keep tension even.
- Weave ends securely.

# Troubleshooting
## Center starts curling
### What happens
The center will not lie flat.
### How to fix it
Loosen your tension.
## Petals overlap
### What happens
The petals bunch together.
### How to fix it
Space each petal evenly.
## Edges wave
### What happens
The outer edge becomes wavy.
### How to fix it
Check your stitch count.
## Join is visible
### What happens
A ridge appears.
### How to fix it
Use a slip stitch join.

# Pattern Variations
## Larger Sunflower
Use thicker yarn.
## Smaller Sunflower
Use a finer hook.
## Two Colors
Change yarn after round two.

# Frequently Asked Questions
## Can a beginner make this?
Yes. Review the abbreviations first.
## Can I use acrylic?
Yes, but cotton absorbs moisture better.
## How large is it?
About 10–12 cm.
## Can I wash it?
Follow your yarn care instructions.
## Can I add a hanging loop?
Yes, add a chain loop before fastening off.

# Featured Image Description
A finished sunflower coaster on a light table.

# Suggested Additional Photos
1. Close-up of the center.
2. Round two in progress.
3. Petals before finishing.
4. Finished coaster from above.`;
const article = parser.parsePastedPattern(source);
assert.equal(article.title, "Easy Crochet Sunflower Coaster — Free Beginner Pattern");
assert.match(article.description, /bright beginner-friendly coaster/);
assert.equal(article.difficulty, "Easy"); assert.equal(article.estimatedTime, "30–45 minutes"); assert.equal(article.yarnWeight, "DK cotton"); assert.equal(article.hookSize, "4 mm"); assert.equal(article.dimensions, "10–12 cm");
assert.equal(article.materials.length, 4); assert.equal(article.abbreviationEntries.length, 4);
assert.equal(article.abbreviationEntries[0].short, "MR"); assert.equal(article.abbreviationEntries[2].meaning, "Single crochet");
assert.equal(article.instructions.length, 3); assert.equal(article.instructions[0].title, "Flower Center");
assert.match(article.instructions[0].pattern, /8 sc/); assert.match(article.instructions[0].explanation, /eight single crochets/); assert.equal(article.instructions[0].stitchCount, "8 stitches.");
assert.equal(article.importantNotes.length, 5); assert.equal(article.mistakes.length, 4); assert.equal(article.variations.length, 3); assert.equal(article.faq.length, 5); assert.equal(article.suggestedPhotos.length, 4);
assert.equal(article.noteEntries.length, 5); assert.equal(article.mistakes[0].fix, "Loosen your tension.");
assert.match(article.finishing, /Fasten off/); assert.match(article.aboutOverride, /simple circular center/); assert.match(article.imageAlt, /finished sunflower coaster/);
assert.deepEqual(article.parseWarnings, []); assert.deepEqual(article.unparsedSections, []);
for (const section of ["About This Pattern", "Materials", "Abbreviations", "Instructions", "Finishing", "Important Notes", "Common Mistakes", "Variations", "FAQ"]) assert.match(article.contentMarkdown, new RegExp(`## ${section}`));
assert.doesNotMatch(article.contentMarkdown, /^# Easy Crochet Sunflower/m);
const reopened = validation.parseArticle(JSON.parse(JSON.stringify(article)), article);
assert.equal(reopened.rawSource, source); assert.equal(reopened.parseFingerprint, fingerprint.rawFingerprint(source)); assert.equal(reopened.instructions.length, 3);
const edited = validation.parseArticle({ ...reopened, materials: [...reopened.materials, "Yarn needle"], instructions: reopened.instructions.map((step, index) => index === 0 ? { ...step, pattern: "MR, ch 1, 8 sc; join." } : step) }, reopened);
assert.equal(edited.rawSource, source); assert.equal(edited.materials.length, 5); assert.match(edited.contentMarkdown, /8 sc; join/);
const unknown = parser.parsePastedPattern(`${source}\n\n# Special Yarn Advice\nAvoid fuzzy yarn.`);
assert.equal(unknown.unparsedSections[0].heading, "Special Yarn Advice"); assert.match(unknown.parseWarnings[0], /couldn't confidently classify/);
assert.match(validation.publishIssues(unknown).join("; "), /Assign every unparsed section/);
const assigned = parser.parsePastedPattern(`${source}\n\n# Special Yarn Advice\nAvoid fuzzy yarn.`, { "Special Yarn Advice": "notes" });
assert.equal(assigned.unparsedSections.length, 0); assert.equal(assigned.importantNotes.length, 6);
const other = parser.parsePastedPattern(`${source}\n\n# Special Yarn Advice\nAvoid fuzzy yarn.`, { "Special Yarn Advice": "other" });
assert.equal(other.unparsedSections.length, 0); assert.equal(other.otherSections.length, 1); assert.match(other.contentMarkdown, /## Additional Details/);
const assignedFaq = parser.parsePastedPattern(`${source}\n\n# Does the center need blocking?\nOnly if it curls.`, { "Does the center need blocking?": "faq" });
assert.equal(assignedFaq.faq.length, 6);
const assignedStep = parser.parsePastedPattern(`${source}\n\n# Add the hanging loop\nChain ten and join.`, { "Add the hanging loop": "instructions" });
assert.equal(assignedStep.instructions.length, 4);
const rows = parser.parsePastedPattern("# Rows\n## Intro\nA row pattern.\n## Supplies\n- Yarn\n# Main Pattern\n## Row 1\n### Pattern\nch 4");
assert.equal(rows.instructions[0].kind, "row"); assert.match(rows.contentMarkdown, /### Row 1/);
const React = await import("react");
const jsx = await import("react/jsx-runtime");
const { renderToStaticMarkup } = await import("react-dom/server");
const publicBody = load("lib/public-body.ts");
const adapter = load("lib/public-adapter.ts", { "server-only": {}, "./github": {}, "./validation": validation, "./public-body": publicBody });
const publishedText = adapter.serializePublicArticle(edited);
assert.match(publishedText, /^---\ntitle: "Easy Crochet Sunflower/); assert.match(publishedText, /## Instructions\n### Round 1/); assert.match(publishedText, /## Finishing/); assert.doesNotMatch(publishedText, /rawSource:/);
const preview = load("components/public-preview.tsx", { "react/jsx-runtime": jsx, "@/lib/public-body": publicBody }, true);
const previewHtml = renderToStaticMarkup(React.createElement(preview.PublicPreview, { article: edited }));
for (const title of ["About This Pattern", "Materials", "Abbreviations", "Instructions", "Finishing", "Important Notes", "Common Mistakes", "Variations", "FAQ"]) assert.match(previewHtml, new RegExp(title));
const paste = load("components/paste-article-editor.tsx", { "react": React, "react/jsx-runtime": jsx, "next/navigation": { useRouter: () => ({ replace() {}, push() {} }) }, "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) }, "@/lib/types": types, "@/lib/raw-fingerprint": fingerprint, "./featured-image-upload": { FeaturedImageUpload: () => null }, "./gallery-upload": { GalleryUpload: () => null } }, true);
const startHtml = renderToStaticMarkup(React.createElement(paste.PasteArticleEditor, { publicSiteUrl: "https://example.com" }));
assert.match(startHtml, /Paste your complete crochet pattern/); assert.match(startHtml, /Parse Pattern/); assert.doesNotMatch(startHtml, /SEO title/);
const reviewHtml = renderToStaticMarkup(React.createElement(paste.PasteArticleEditor, { initial: article, publicSiteUrl: "https://example.com" }));
assert.match(reviewHtml, /ARTICLE DETECTED/); assert.match(reviewHtml, /Review Parsed Article/);
console.log("Paste parser: sections, rounds, notes, mistakes, FAQ, raw persistence, unknown assignment, rows, and public Markdown passed.");
