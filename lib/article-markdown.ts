import type { Article } from "./types";

const clean = (value: string) => value.trim().replace(/\r/g, "");
const oneLine = (value: string) => clean(value).replace(/\n+/g, " ").replace(/^#+\s*/, "");
const bullets = (values: string[]) => values.map(oneLine).filter(Boolean).map(value => `- ${value}`).join("\n");
export function generatedMarkdown(a: Article): string {
  const sections: string[] = [];
  const introduction = clean(a.introduction || a.description);
  if (introduction) sections.push(introduction);
  const details = [a.difficulty && `Difficulty: ${a.difficulty}`, a.estimatedTime && `Estimated time: ${a.estimatedTime}`, a.yarnType && `Yarn: ${a.yarnType}`, a.yarnWeight && `Yarn weight: ${a.yarnWeight}`, a.hookSize && `Hook size: ${a.hookSize}`].filter((value): value is string => !!value);
  if (details.length) sections.push(`## Project Details\n${bullets(details)}`);
  if (a.materials.length) sections.push(`## Materials\n${bullets(a.materials)}`);
  if (a.tools.length) sections.push(`## Tools\n${bullets(a.tools)}`);
  const steps = (a.instructions || []).filter(step => clean(step.instruction));
  if (steps.length) {
    sections.push(`## Instructions\n${steps.map((step, index) => {
      const title = oneLine(step.title).replace(/^Step\s+\d+\s*[—:-]?\s*/i, "");
      return `### Step ${index + 1}${title ? ` — ${title}` : ""}\n${clean(step.instruction)}`;
    }).join("\n\n")}`);
  }
  if (a.beginnerTips?.length) sections.push(`## Beginner Tips\n${bullets(a.beginnerTips)}`);
  const faq = a.faq.filter(item => item.question.trim() && item.answer.trim());
  if (faq.length) sections.push(`## FAQ\n${faq.map(item => `### ${oneLine(item.question)}\n${clean(item.answer)}`).join("\n\n")}`);
  return sections.filter(Boolean).join("\n\n").trim();
}
export function articleMarkdown(a: Article): string {
  return a.contentMode === "structured" ? generatedMarkdown(a) : a.contentMarkdown;
}
