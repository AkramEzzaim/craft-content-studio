import { accuracyItems, articleTypes, categories, emptyArticle, slugify, type Article } from "./types";
import { applyArticleDefaults } from "./article-defaults";
import { generatedMarkdown } from "./article-markdown";
import { featuredPatternImagePath, galleryPatternImagePath, imageUrlFromPath, publicImageUrl } from "./image-path";
const string = (v: unknown, max = 10000) => typeof v === "string" ? v.slice(0, max).trim() : "";
const list = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 80).map(x => x.slice(0, 500).trim()).filter(Boolean) : [];
const oldChecks: Record<string, string> = { "Materials reviewed": "Materials checked", "Hook/yarn combination reviewed": "Hook/yarn checked", "Abbreviations reviewed": "Abbreviations checked", "Rounds reviewed": "Rounds/steps checked", "Round transitions reviewed": "Rounds/steps checked", "Stitch counts reviewed": "Stitch counts checked where applicable", "Pattern reviewed": "Instructions reviewed", "Instructions tested or verified": "Instructions reviewed" };
const url = (v: unknown) => { const s = string(v, 2000); return !s || /^https:\/\/[^\s]+$/i.test(s) || /^\/images\/[a-z0-9/_-]+\.(?:png|jpe?g|webp|avif)$/i.test(s) ? s : ""; };
export function parseArticle(value: unknown, prior?: Article): Article {
  if (!value || typeof value !== "object") throw new Error("Invalid article data");
  const v = value as Record<string, unknown>;
  const base = prior || emptyArticle();
  const mode = v.contentMode === "structured" || v.contentMode === "markdown" ? v.contentMode :
    prior ? (prior.contentMode || "markdown") : v.contentMarkdown ? "markdown" : "structured";
  const out: Article = {
    ...base,
    title: string(v.title, 180), slug: slugify(string(v.slug, 100)), primaryKeyword: string(v.primaryKeyword, 150), secondaryKeywords: list(v.secondaryKeywords),
    category: categories.includes(v.category as "crochet") ? String(v.category) : "crochet",
    articleType: articleTypes.includes(v.articleType as typeof articleTypes[number]) ? String(v.articleType) : "Other",
    difficulty: string(v.difficulty, 80), estimatedTime: string(v.estimatedTime, 80), author: string(v.author, 100),
    description: string(v.description, 300), excerpt: string(v.excerpt, 500), yarnType: string(v.yarnType, 100), yarnWeight: string(v.yarnWeight, 100),
    hookSize: string(v.hookSize, 100), gauge: string(v.gauge, 200), dimensions: string(v.dimensions, 200), requiredSkills: list(v.requiredSkills),
    materials: list(v.materials), tools: list(v.tools), abbreviations: list(v.abbreviations), patternNotes: list(v.patternNotes),
    sizing: string(v.sizing, 500), safetyNotes: string(v.safetyNotes, 500), contentMarkdown: string(v.contentMarkdown, 100000),
    contentMode: mode, instructionMode: v.instructionMode === "steps" ? "steps" : v.instructionMode === "rounds" ? "rounds" : Array.isArray(v.instructions) && v.instructions.length ? v.instructions.some((item: unknown) => (item as Record<string, unknown>)?.kind === "round") ? "rounds" : "steps" : base.instructionMode || "rounds", physicallyTested: v.physicallyTested === true,
    rawSource: string(v.rawSource, 150000), parseFingerprint: string(v.parseFingerprint, 40), parseWarnings: list(v.parseWarnings).slice(0, 40), finishing: string(v.finishing, 10000), suggestedPhotos: list(v.suggestedPhotos).slice(0, 30),
    noteEntries: Array.isArray(v.noteEntries) ? v.noteEntries.slice(0, 80).map((item: unknown) => ({ title: string((item as Record<string, unknown>)?.title, 180), body: string((item as Record<string, unknown>)?.body, 2000) })).filter(item => item.title || item.body) : [],
    unparsedSections: Array.isArray(v.unparsedSections) ? v.unparsedSections.slice(0, 40).map((item: unknown) => ({ heading: string((item as Record<string, unknown>)?.heading, 180), body: string((item as Record<string, unknown>)?.body, 10000) })).filter(item => item.heading || item.body) : [],
    otherSections: Array.isArray(v.otherSections) ? v.otherSections.slice(0, 40).map((item: unknown) => ({ heading: string((item as Record<string, unknown>)?.heading, 180), body: string((item as Record<string, unknown>)?.body, 10000) })).filter(item => item.heading || item.body) : [],
    introduction: string(v.introduction, 10000), subtitle: string(v.subtitle, 180), aboutOverride: string(v.aboutOverride, 5000),
    instructions: Array.isArray(v.instructions) ? v.instructions.slice(0, 80).map((item: unknown) => ({
      title: string((item as Record<string, unknown>)?.title, 150), instruction: string((item as Record<string, unknown>)?.instruction, 5000),
      pattern: string((item as Record<string, unknown>)?.pattern, 5000), explanation: string((item as Record<string, unknown>)?.explanation, 5000),
      kind: (item as Record<string, unknown>)?.kind === "round" ? "round" as const : (item as Record<string, unknown>)?.kind === "row" ? "row" as const : "step" as const,
      stitchCount: string((item as Record<string, unknown>)?.stitchCount, 100), tip: string((item as Record<string, unknown>)?.tip, 1000),
      imageId: string((item as Record<string, unknown>)?.imageId, 36),
      imageDescription: string((item as Record<string, unknown>)?.imageDescription, 300),
    })).filter(item => item.title || item.instruction || item.pattern || item.explanation) : [],
    beginnerTips: list(v.beginnerTips), importantNotes: list(v.importantNotes),
    abbreviationEntries: Array.isArray(v.abbreviationEntries) ? v.abbreviationEntries.slice(0, 80).map((item: unknown) => ({ short: string((item as Record<string, unknown>)?.short, 40), meaning: string((item as Record<string, unknown>)?.meaning, 200) })).filter(item => item.short || item.meaning) : [],
    mistakes: Array.isArray(v.mistakes) ? v.mistakes.slice(0, 40).map((item: unknown) => ({ title: string((item as Record<string, unknown>)?.title, 180), explanation: string((item as Record<string, unknown>)?.explanation, 2000), fix: string((item as Record<string, unknown>)?.fix, 2000) })).filter(item => item.title || item.explanation || item.fix) : [],
    variations: Array.isArray(v.variations) ? v.variations.slice(0, 40).map((item: unknown) => ({ title: string((item as Record<string, unknown>)?.title, 180), text: string((item as Record<string, unknown>)?.text, 3000) })).filter(item => item.title || item.text) : [],
    relatedSlugs: list(v.relatedSlugs).map(slugify).filter(Boolean), galleryImages: (() => {
      const images = prior?.galleryImages || [];
      const submitted = Array.isArray(v.galleryImages) ? v.galleryImages as Record<string, unknown>[] : [];
      const order = submitted.map(item => images.find(image => image.id === item?.id)).filter((image): image is NonNullable<typeof image> => !!image);
      return [...order, ...images.filter(image => !order.some(item => item.id === image.id))].map(image => {
        const item = submitted.find(value => value?.id === image.id);
        return { ...image, alt: item ? string(item.alt, 300) : image.alt, caption: item ? string(item.caption, 500) : image.caption };
      });
    })(),
    featuredImagePrompt: string(v.featuredImagePrompt, 1000),
    faq: Array.isArray(v.faq) ? v.faq.slice(0, 30).map((item: unknown) => ({ question: string((item as Record<string, unknown>)?.question, 300), answer: string((item as Record<string, unknown>)?.answer, 2000) })).filter(item => item.question && item.answer) : [],
    featuredImage: url(v.featuredImage), imageAlt: string(v.imageAlt, 300), pinterestImage: url(v.pinterestImage),
    stepImages: Array.isArray(v.stepImages) ? v.stepImages.slice(0, 40).map((item: unknown) => ({ url: url((item as Record<string, unknown>)?.url), alt: string((item as Record<string, unknown>)?.alt, 300), caption: string((item as Record<string, unknown>)?.caption, 300) })).filter(item => item.url) : [],
    seoTitle: string(v.seoTitle, 180), metaDescription: string(v.metaDescription, 300), canonicalSlug: slugify(string(v.canonicalSlug, 100)),
    tags: list(v.tags), ogTitle: string(v.ogTitle, 180), ogDescription: string(v.ogDescription, 300), pinterestTitle: string(v.pinterestTitle, 180),
    pinterestDescription: string(v.pinterestDescription, 500), accuracyChecks: [...new Set(list(v.accuracyChecks).map(item => oldChecks[item] || item).filter(item => (accuracyItems as readonly string[]).includes(item)))],
    updatedAt: new Date().toISOString(), storageSha: prior?.storageSha,
  };
  if (prior) {
    out.id = prior.id; out.createdAt = prior.createdAt; out.aiGenerated = prior.aiGenerated; out.publishedAt = prior.publishedAt;
    out.publicUrl = prior.publicUrl; out.publishedSha = prior.publishedSha; out.publishedPath = prior.publishedPath;
    out.githubCommitSha = prior.githubCommitSha; out.githubPath = prior.githubPath; out.githubRepository = prior.githubRepository;
    out.draftImage = prior.draftImage; out.status = "review";
  } else out.status = "draft";
  if (v.status === "archived" && prior) out.status = "archived";
  if (v.status === "ready" && prior) out.status = "ready";
  const withDefaults = applyArticleDefaults(out);
  if (withDefaults.draftImage && withDefaults.slug) withDefaults.draftImage = { ...withDefaults.draftImage, publicPath: featuredPatternImagePath(withDefaults.slug, withDefaults.draftImage.extension) };
  if (withDefaults.galleryImages?.length && withDefaults.slug) withDefaults.galleryImages = withDefaults.galleryImages.map(image => ({ ...image, publicPath: galleryPatternImagePath(withDefaults.slug, image.id, image.extension) }));
  if (withDefaults.draftImage && withDefaults.slug) withDefaults.featuredImage = withDefaults.draftImage.publicPath ? imageUrlFromPath(withDefaults.draftImage.publicPath) : publicImageUrl(withDefaults.slug, withDefaults.draftImage.extension);
  if (withDefaults.contentMode === "structured") withDefaults.contentMarkdown = generatedMarkdown(withDefaults);
  return withDefaults;
}
export type Check = { label: string; pass: boolean };
function hasEmptySection(body: string) {
  const lines = body.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const heading = /^(#{2,3}) .+/.exec(lines[index]);
    if (!heading) continue;
    let next = index + 1;
    while (next < lines.length && !lines[next].trim()) next++;
    if (next === lines.length) return true;
    const nextHeading = /^(#{2,3}) .+/.exec(lines[next]);
    if (nextHeading && nextHeading[1].length <= heading[1].length) return true;
  }
  return false;
}
export function assess(article: Article) {
  const body = article.contentMarkdown;
  const pattern = article.articleType === "Free Crochet Pattern";
  const seo: Check[] = [
    { label: "Search title generated", pass: !!article.seoTitle },
    { label: "Search description generated", pass: !!article.metaDescription },
    { label: "Readable slug", pass: !!article.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug) },
    { label: "Featured image description generated", pass: !!article.imageAlt },
  ];
  const quality: Check[] = [
    { label: "Title provided", pass: !!article.title.trim() },
    { label: "Introduction provided", pass: !!article.description.trim() },
    { label: "Featured image provided", pass: !!article.featuredImage },
    { label: "Materials provided", pass: !pattern || article.materials.length > 0 },
    { label: "Hook and yarn provided", pass: !pattern || !!article.hookSize && !!(article.yarnType || article.yarnWeight) },
    { label: "At least one round or step", pass: !pattern || !!article.instructions?.some(step => !!(step.instruction || step.pattern || step.explanation)?.trim()) || (article.contentMode !== "structured" && /^## Instructions/m.test(body)) },
    { label: "Crochet instructions reviewed", pass: !pattern || accuracyItems.every(x => article.accuracyChecks.includes(x)) },
    { label: "No empty sections", pass: !body || !hasEmptySection(body) },
    { label: "No placeholder text", pass: !/\b(?:lorem ipsum|todo|tbd|insert here|placeholder)\b/i.test(body) },
  ];
  const score = (checks: Check[]) => Math.round(100 * checks.filter(x => x.pass).length / checks.length);
  return { seo, quality, seoScore: score(seo), qualityScore: score(quality) };
}
export function publishIssues(a: Article): string[] {
  const issues: string[] = [];
  if (a.contentMode === "structured" && a.unparsedSections?.length) issues.push("Assign every unparsed section before publishing");
  for (const [label, value] of [["Title", a.title], ["Slug", a.slug], ["Description", a.description], ["Author", a.author], ["Difficulty", a.difficulty], ["Featured image", a.featuredImage], ["Featured image alt text", a.imageAlt], ["Content", a.contentMarkdown]]) if (!value) issues.push(`${label} is required`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug)) issues.push("Slug must use lowercase words separated by hyphens");
  if (!categories.includes(a.category as "crochet")) issues.push("Category is not supported by the studio");
  if (!/^## Instructions\s*$/im.test(a.contentMarkdown)) issues.push("The public site requires a ## Instructions section");
  if (!/^## Materials\s*$/im.test(a.contentMarkdown) && !a.materials?.length) issues.push("Add at least one material");
  if (a.articleType === "Free Crochet Pattern" && (!a.hookSize || !(a.yarnType || a.yarnWeight))) issues.push("Add yarn and hook details");
  if (a.canonicalSlug && a.canonicalSlug !== a.slug) issues.push("Canonical slug must match the published article slug");
  if (a.articleType === "Free Crochet Pattern" && !accuracyItems.every(x => a.accuracyChecks?.includes(x))) issues.push("Complete all crochet accuracy checks");
  if (/^# /m.test(a.contentMarkdown)) issues.push("Remove body H1; the public site adds the title H1");
  const withoutGeneratedImages = a.contentMarkdown.replace(/!\[[^\]\n]*\]\(\/images\/patterns\/[a-z0-9/_-]+\.(?:jpe?g|png|webp)\)/gi, "");
  if (/!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]*\)|^\|/m.test(withoutGeneratedImages)) issues.push("Use uploaded photos; the public renderer does not support custom Markdown links or tables");
  if (/^> |^```|^#{4,6} |^(?:---+|\*\*\*+|___+)\s*$|(?<!\*)\*(?!\*)[^*\n]+\*(?!\*)/m.test(a.contentMarkdown)) issues.push("The public renderer does not support quotes, code blocks, H4+, rules, or italic syntax yet");
  if (a.featuredImage && !/^\/images\/[a-z0-9/_-]+\.(?:png|jpe?g|webp|avif)$/i.test(a.featuredImage)) issues.push("Featured image must point to /images in the public repository");
  if (hasEmptySection(a.contentMarkdown)) issues.push("Remove empty Markdown sections");
  return issues;
}
export function publishingFieldsPresent(a: Article): boolean {
  return !!a.title?.trim() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug) &&
    !!a.description?.trim() && !!a.difficulty?.trim() && !!a.author?.trim() &&
    !!a.featuredImage?.trim() && !!a.imageAlt?.trim() && !!a.contentMarkdown?.trim() && (a.articleType !== "Free Crochet Pattern" || !!a.hookSize && !!(a.yarnType || a.yarnWeight)) && (!!a.materials?.length || /^## Materials\s*$/im.test(a.contentMarkdown)) &&
    /^## Instructions\s*$/im.test(a.contentMarkdown) && categories.includes(a.category as "crochet");
}
export function publishingReadiness(a: Article, configured: boolean): Check[] {
  return [
    { label: "Title present", pass: !!a.title?.trim() },
    { label: "Slug valid", pass: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug) },
    { label: "Content and instructions present", pass: !!a.contentMarkdown?.trim() && /^## Instructions\s*$/im.test(a.contentMarkdown) },
    { label: "Materials present", pass: !!a.materials?.length || /^## Materials\s*$/im.test(a.contentMarkdown) },
    { label: "Yarn and hook present", pass: a.articleType !== "Free Crochet Pattern" || !!a.hookSize && !!(a.yarnType || a.yarnWeight) },
    { label: "Category supported", pass: categories.includes(a.category as "crochet") },
    { label: "Required metadata present", pass: !!a.description && !!a.difficulty && !!a.author && !!a.featuredImage && !!a.imageAlt },
    { label: "Crochet accuracy reviewed", pass: a.articleType !== "Free Crochet Pattern" || accuracyItems.every(x => a.accuracyChecks?.includes(x)) },
    { label: "Public GitHub configuration available", pass: configured },
    { label: "Public article schema valid", pass: publishIssues(a).length === 0 },
  ];
}
