import type { Article } from "./types";
const hasSection = (body: string, title: string) => new RegExp(`^## ${title}\\s*$`, "im").test(body);
const section = (title: string, items: string[]) => items.length ? `## ${title}\n${items.map(item => `- ${item.replace(/\n/g, " ")}`).join("\n")}` : "";
export function publicBody(a: Article): string {
  let body = a.contentMarkdown.trim();
  const additions = [
    !hasSection(body, "Materials") && section("Materials", a.materials || []),
    !hasSection(body, "Tools") && section("Tools", a.tools || []),
    !hasSection(body, "Abbreviations") && section("Abbreviations", a.abbreviations || []),
    !hasSection(body, "Pattern notes") && section("Pattern notes", a.patternNotes || []),
  ].filter((value): value is string => !!value);
  if (additions.length) {
    const instructions = /^## Instructions\s*$/im.exec(body);
    body = instructions ? `${body.slice(0, instructions.index).trimEnd()}\n\n${additions.join("\n\n")}\n\n${body.slice(instructions.index)}` : `${body}\n\n${additions.join("\n\n")}`;
  }
  if (a.faq?.length && !hasSection(body, "FAQ")) body += `\n\n## FAQ\n${a.faq.map(item => `### ${item.question.replace(/\n/g, " ")}\n${item.answer}`).join("\n\n")}`;
  return body.trim() + "\n";
}
