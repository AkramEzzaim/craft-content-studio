import type { Article } from "./types";
import { imageUrlFromPath } from "./image-path";

const clean = (value: string) => value.trim().replace(/\r/g, "");
const oneLine = (value: string) => clean(value).replace(/\n+/g, " ").replace(/^#+\s*/, "");
const bullets = (values: string[]) => values.map(oneLine).filter(Boolean).map(value => `- ${value}`).join("\n");
const section = (title: string, content: string) => content.trim() ? `## ${title}\n${content.trim()}` : "";
export function generatedMarkdown(a: Article): string {
  const sections: string[] = [];
  const intro = clean(a.introduction || a.description);
  if (intro) sections.push(intro);
  const difficulty = a.difficulty.trim().toLowerCase();
  const about = clean(a.aboutOverride || [
    a.title ? `${a.title} is ${difficulty ? `${/^[aeiou]/.test(difficulty) ? "an" : "a"} ${difficulty} crochet project` : "a crochet project"}.` : "",
    a.estimatedTime ? `Set aside about ${a.estimatedTime} to make it.` : "",
    a.yarnWeight || a.yarnType ? `Use ${[a.yarnWeight, a.yarnType].filter(Boolean).join(" ")} yarn${a.hookSize ? ` with a ${a.hookSize} hook` : ""}.` : a.hookSize ? `Use a ${a.hookSize} hook.` : "",
    a.instructions?.length ? `The pattern has ${a.instructions.length} ${a.instructions.every(step => step.kind === "round") ? "rounds" : "steps"}.` : "",
  ].filter(Boolean).join(" "));
  if (about) sections.push(section("About This Pattern", about));
  const details = [a.difficulty && `Difficulty: ${a.difficulty}`, a.estimatedTime && `Estimated time: ${a.estimatedTime}`, a.yarnType && `Yarn: ${a.yarnType}`, a.yarnWeight && `Yarn weight: ${a.yarnWeight}`, a.hookSize && `Hook size: ${a.hookSize}`, a.dimensions && `Finished size: ${a.dimensions}`].filter((value): value is string => !!value);
  if (details.length) sections.push(section("Project Information", bullets(details)));
  if (a.materials.length) sections.push(section("Materials", bullets(a.materials)));
  if (a.tools.length) sections.push(section("Tools", bullets(a.tools)));
  const abbreviations = a.abbreviationEntries?.length ? a.abbreviationEntries.filter(item => item.short.trim() && item.meaning.trim()).map(item => `**${oneLine(item.short)}** — ${oneLine(item.meaning)}`) : a.abbreviations.map(oneLine).filter(Boolean);
  if (abbreviations.length) sections.push(section("Abbreviations", bullets(abbreviations)));
  const steps = (a.instructions || []).filter(step => clean(step.instruction));
  if (steps.length) sections.push(section("Instructions", steps.map((step, index) => {
    const kind = step.kind === "round" ? "Round" : "Step";
    const title = oneLine(step.title).replace(/^(?:Step|Round)\s+\d+\s*[—:-]?\s*/i, "");
    const photo = (a.galleryImages || []).find(image => image.id === step.imageId && image.publicPath);
    return `### ${kind} ${index + 1}${title ? ` — ${title}` : ""}\n${clean(step.instruction)}${step.stitchCount?.trim() ? `\n\n**Stitch count:** ${oneLine(step.stitchCount)}` : ""}${step.tip?.trim() ? `\n\n**Tip:** ${clean(step.tip)}` : ""}${photo ? `\n\n![${oneLine(photo.alt || a.title)}](${imageUrlFromPath(photo.publicPath!)})${photo.caption.trim() ? `\n${oneLine(photo.caption)}` : ""}` : ""}`;
  }).join("\n\n")));
  if (a.importantNotes?.length) sections.push(section("Important Notes", bullets(a.importantNotes)));
  if (a.beginnerTips?.length) sections.push(section("Beginner Tips", bullets(a.beginnerTips)));
  const variations = (a.variations || []).filter(item => item.title.trim() && item.text.trim());
  if (variations.length) sections.push(section("Variations", variations.map(item => `### ${oneLine(item.title)}\n${clean(item.text)}`).join("\n\n")));
  const mistakes = (a.mistakes || []).filter(item => item.title.trim() && (item.explanation.trim() || item.fix.trim()));
  if (mistakes.length) sections.push(section("Common Mistakes", mistakes.map(item => `### ${oneLine(item.title)}${item.explanation.trim() ? `\n${clean(item.explanation)}` : ""}${item.fix.trim() ? `\n\n**How to fix it:** ${clean(item.fix)}` : ""}`).join("\n\n")));
  const faq = a.faq.filter(item => item.question.trim() && item.answer.trim());
  if (faq.length) sections.push(section("FAQ", faq.map(item => `### ${oneLine(item.question)}\n${clean(item.answer)}`).join("\n\n")));
  const assigned = new Set((a.instructions || []).map(step => step.imageId).filter(Boolean));
  const gallery = (a.galleryImages || []).filter(image => image.publicPath && !assigned.has(image.id));
  if (gallery.length) sections.push(section("More Photos", gallery.map(image => `![${oneLine(image.alt || a.title)}](${imageUrlFromPath(image.publicPath!)})${image.caption.trim() ? `\n${oneLine(image.caption)}` : ""}`).join("\n\n")));
  return sections.filter(Boolean).join("\n\n").trim();
}
export function articleMarkdown(a: Article): string { return a.contentMode === "structured" ? generatedMarkdown(a) : a.contentMarkdown; }
