export const statuses = ["draft", "generated", "review", "ready", "publishing", "published", "failed", "archived"] as const;
export type Status = typeof statuses[number];
export const articleTypes = ["Free Crochet Pattern", "Crochet Tutorial", "Crochet Guide", "Crochet Tips", "Beginner Guide", "Roundup", "Other"] as const;
export const categories = ["crochet"] as const;
export const accuracyItems = ["Stitch counts reviewed", "Round transitions reviewed", "Increase/decrease logic reviewed", "Materials reviewed", "Hook/yarn combination reviewed", "Abbreviations reviewed", "Finished dimensions reviewed", "Instructions tested or verified"] as const;
export type StepImage = { url: string; alt: string; caption: string };
export type Faq = { question: string; answer: string };
export type InstructionStep = { title: string; instruction: string };
export type DraftImage = { path: string; extension: "jpg" | "png" | "webp"; mimeType: string; originalName: string; size: number; width?: number; height?: number };
export type Article = {
  id: string; title: string; slug: string; primaryKeyword: string; secondaryKeywords: string[]; category: string; articleType: string; difficulty: string; estimatedTime: string; author: string; description: string; excerpt: string;
  yarnType: string; yarnWeight: string; hookSize: string; gauge: string; dimensions: string; requiredSkills: string[]; materials: string[]; tools: string[]; abbreviations: string[]; patternNotes: string[]; sizing: string; safetyNotes: string;
  contentMarkdown: string; featuredImagePrompt: string; faq: Faq[]; featuredImage: string; imageAlt: string; pinterestImage: string; stepImages: StepImage[];
  seoTitle: string; metaDescription: string; canonicalSlug: string; tags: string[]; ogTitle: string; ogDescription: string; pinterestTitle: string; pinterestDescription: string;
  accuracyChecks: string[]; status: Status; aiGenerated: boolean; createdAt: string; updatedAt: string; publishedAt?: string; publicUrl?: string; publishedSha?: string; publishedPath?: string; githubCommitSha?: string; githubPath?: string; githubRepository?: string; publishError?: string; storageSha?: string;
  contentMode?: "structured" | "markdown"; introduction?: string; instructions?: InstructionStep[]; beginnerTips?: string[]; draftImage?: DraftImage;
};
export function emptyArticle(): Article {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title: "", slug: "", primaryKeyword: "", secondaryKeywords: [], category: "crochet", articleType: "Free Crochet Pattern", difficulty: "Beginner", estimatedTime: "", author: "Hearth & Thread Studio", description: "", excerpt: "", yarnType: "", yarnWeight: "", hookSize: "", gauge: "", dimensions: "", requiredSkills: [], materials: [], tools: [], abbreviations: [], patternNotes: [], sizing: "", safetyNotes: "", contentMarkdown: "", contentMode: "structured", introduction: "", instructions: [], beginnerTips: [], featuredImagePrompt: "", faq: [], featuredImage: "", imageAlt: "", pinterestImage: "", stepImages: [], seoTitle: "", metaDescription: "", canonicalSlug: "", tags: [], ogTitle: "", ogDescription: "", pinterestTitle: "", pinterestDescription: "", accuracyChecks: [], status: "draft", aiGenerated: false, createdAt: now, updatedAt: now };
}
export const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
