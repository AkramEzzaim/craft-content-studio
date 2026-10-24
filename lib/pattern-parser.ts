import "server-only";
import { emptyArticle, type Article, type InstructionStep } from "./types";
import { parseArticle } from "./validation";
import { rawFingerprint } from "./raw-fingerprint";

type Section = "intro" | "project" | "materials" | "abbreviations" | "instructions" | "finishing" | "about" | "notes" | "mistakes" | "variations" | "faq" | "image" | "photos" | "other";
type Block = { heading: string; lines: string[]; section: Section; child: boolean; assigned?: boolean };
const aliases: Record<string, Section> = {
  "short introduction": "intro", introduction: "intro", intro: "intro",
  "project information": "project", "project info": "project", "pattern information": "project",
  materials: "materials", supplies: "materials", abbreviations: "abbreviations", "stitch abbreviations": "abbreviations",
  "main pattern": "instructions", pattern: "instructions", instructions: "instructions",
  finishing: "finishing", "about this pattern": "about", "about the pattern": "about",
  "important notes": "notes", notes: "notes", "pattern notes": "notes",
  "common mistakes": "mistakes", mistakes: "mistakes", troubleshooting: "mistakes",
  variations: "variations", "pattern variations": "variations", faq: "faq", "frequently asked questions": "faq",
  "featured image description": "image", "suggested additional photos": "photos", "additional photos": "photos",
};
const cleanHeading = (text: string) => text.trim().replace(/\s*#+\s*$/, "").replace(/:$/, "").trim();
const key = (text: string) => cleanHeading(text).toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ");
const childSections = new Set<Section>(["instructions", "notes", "mistakes", "variations", "faq"]);
const stepHeading = /^(?:(round|row|step)\s*\d+\b|foundation(?:\s+row)?\b|border\b|assembly\b)/i;
const heading = (line: string) => {
  const match = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
  if (match) return { level: match[1].length, text: cleanHeading(match[2]) };
  if (stepHeading.test(line.trim()) && line.trim().length < 90) return { level: 2, text: cleanHeading(line) };
  return null;
};
const body = (block: Block) => block.lines.join("\n").trim();
const stripBullet = (line: string) => line.trim().replace(/^[-*+]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
const plain = (text: string) => text.replace(/\*\*/g, "").trim();
const splitItems = (text: string) => text.split("\n").map(stripBullet).filter(Boolean);
const field = (line: string) => /^(?:[-*+]\s*)?(?:\*\*)?([^:*]+?)(?:\*\*)?\s*:\s*(?:\*\*)?(.+)\s*$/.exec(line.trim());
const stepKind = (label: string): "round" | "row" | "step" => /^round\b/i.test(label) ? "round" : /^row\b/i.test(label) ? "row" : "step";

function parseStep(block: Block): InstructionStep {
  const parts: Record<string, string[]> = { pattern: [], explanation: [], tip: [], image: [] };
  let mode: "pattern" | "explanation" | "tip" | "image" = "pattern";
  let stitchCount = "";
  for (const line of block.lines) {
    const h = heading(line);
    if (h && /^(pattern|notation)$/i.test(h.text)) { mode = "pattern"; continue; }
    if (h && /^(beginner explanation|step-by-step explanation|explanation|plain english)$/i.test(h.text)) { mode = "explanation"; continue; }
    if (h && /^tip$/i.test(h.text)) { mode = "tip"; continue; }
    if (h && /^(image description|photo description)$/i.test(h.text)) { mode = "image"; continue; }
    const labeled = field(line);
    if (labeled && /^stitch count$/i.test(plain(labeled[1]))) { stitchCount = plain(labeled[2]); continue; }
    if (labeled && /^tip$/i.test(plain(labeled[1]))) { parts.tip.push(labeled[2]); continue; }
    if (labeled && /^(image description|photo description)$/i.test(plain(labeled[1]))) { parts.image.push(labeled[2]); continue; }
    parts[mode].push(line);
  }
  const label = block.heading;
  const title = label.replace(/^(?:round|row|step)\s*\d+\s*[—–:-]?\s*/i, "").trim();
  return { kind: stepKind(label), title: title === label && /^(round|row|step)\s*\d+$/i.test(label) ? "" : title, pattern: parts.pattern.join("\n").trim(), explanation: parts.explanation.join("\n").trim(), instruction: parts.explanation.join("\n").trim(), stitchCount, tip: parts.tip.join("\n").trim(), imageDescription: parts.image.join("\n").trim() };
}

export function parsePastedPattern(rawSource: string, assignments: Record<string, Section> = {}): Article {
  const raw = rawSource.replace(/\r\n?/g, "\n").trim().slice(0, 150000);
  if (!raw) throw new Error("Paste a crochet article before parsing.");
  const blocks: Block[] = [];
  let section: Section = "intro";
  let current: Block = { heading: "", lines: [], section, child: false };
  let title = "";
  const push = () => { if (current.lines.some(line => line.trim()) || current.heading) blocks.push(current); };
  for (const line of raw.split("\n")) {
    const h = heading(line);
    if (!h) { current.lines.push(line); continue; }
    const normalized = key(h.text);
    const assigned = assignments[h.text];
    const detected = assigned || aliases[normalized];
    if (current.child && section === "instructions" && /^(pattern|notation|beginner explanation|step-by-step explanation|explanation|plain english|tip|image description|photo description)$/i.test(h.text)) { current.lines.push(line); continue; }
    if (current.child && section === "mistakes" && /^(what happens|problem|why it happens|how to fix it|fix|solution)$/i.test(h.text)) { current.lines.push(line); continue; }
    if (!title && h.level === 1 && !detected && !stepHeading.test(h.text)) { title = h.text; continue; }
    if (detected) { push(); section = detected; current = { heading: h.text, lines: [], section, child: false, assigned: !!assigned }; continue; }
    if (childSections.has(section) && (h.level > 1 || stepHeading.test(h.text))) { push(); current = { heading: h.text, lines: [], section, child: true }; continue; }
    push(); section = "other"; current = { heading: h.text, lines: [], section, child: false };
  }
  push();
  const grouped = (name: Section) => blocks.filter(block => block.section === name);
  const joined = (name: Section) => grouped(name).map(body).filter(Boolean).join("\n\n");
  const warnings: string[] = [];
  const unparsed = grouped("other").filter(block => !block.assigned).map(block => ({ heading: block.heading || "Untitled section", body: body(block) }));
  const otherSections = grouped("other").filter(block => block.assigned).map(block => ({ heading: block.heading || "Additional detail", body: body(block) }));
  for (const item of unparsed) warnings.push(`We couldn't confidently classify “${item.heading}”.`);
  const intro = joined("intro");
  const project: Record<string, string> = {};
  for (const line of joined("project").split("\n")) {
    const match = field(line);
    if (match) project[key(plain(match[1]))] = plain(match[2]);
  }
  const materials = grouped("materials").flatMap(block => splitItems(body(block)));
  const abbreviationEntries = grouped("abbreviations").flatMap(block => splitItems(body(block)).map(line => {
    const match = /^(?:\*\*)?(.+?)(?:\*\*)?\s*(?:—|–|-|:)\s*(.+)$/.exec(line);
    return match ? { short: plain(match[1]), meaning: plain(match[2]) } : null;
  }).filter((entry): entry is { short: string; meaning: string } => !!entry));
  const instructionBlocks = grouped("instructions");
  const instructions = instructionBlocks.filter(block => block.child || block.assigned || stepHeading.test(block.heading)).map(parseStep).filter(step => step.pattern || step.explanation);
  const leftoverInstructions = instructionBlocks.filter(block => !block.child && !block.assigned && !stepHeading.test(block.heading) && body(block));
  if (!instructions.length && leftoverInstructions.length) {
    instructions.push({ kind: "step", title: "Main pattern", instruction: joined("instructions"), explanation: joined("instructions"), pattern: "" });
    warnings.push("No separate rounds were detected; the main pattern was kept as one editable step.");
  }
  const noteEntries: { title: string; body: string }[] = [];
  for (const block of grouped("notes")) {
    if (block.child) { noteEntries.push({ title: block.heading, body: body(block) }); continue; }
    let currentNote: { title: string; body: string } | null = null;
    for (const line of body(block).split("\n")) {
      const match = /^\*\*(.+?)\*\*\s*$/.exec(line.trim());
      if (match) { if (currentNote) noteEntries.push(currentNote); currentNote = { title: match[1], body: "" }; continue; }
      if (!line.trim()) continue;
      const item = stripBullet(line);
      if (/^[-*+]\s+/.test(line.trim()) || /^\d+[.)]\s+/.test(line.trim())) { if (currentNote) noteEntries.push(currentNote); currentNote = { title: "", body: item }; continue; }
      if (currentNote) currentNote.body = [currentNote.body, item].filter(Boolean).join("\n");
      else currentNote = { title: "", body: item };
    }
    if (currentNote) noteEntries.push(currentNote);
  }
  if (instructions.length) for (const block of leftoverInstructions) {
    noteEntries.unshift({ title: "Pattern guidance", body: body(block) });
    warnings.push("Text before the first round was kept as an important note.");
  }
  const notes = noteEntries.map(item => [item.title, item.body].filter(Boolean).join(": "));
  const mistakes = grouped("mistakes").filter(block => block.child || block.assigned).map(block => {
    let mode: "explanation" | "fix" = "explanation";
    const explanation: string[] = [], fix: string[] = [];
    for (const line of block.lines) {
      const h = heading(line);
      if (h && /^(what happens|problem|why it happens)$/i.test(h.text)) { mode = "explanation"; continue; }
      if (h && /^(how to fix it|fix|solution)$/i.test(h.text)) { mode = "fix"; continue; }
      (mode === "fix" ? fix : explanation).push(line);
    }
    return { title: block.heading, explanation: explanation.join("\n").trim(), fix: fix.join("\n").trim() };
  });
  const variations = grouped("variations").filter(block => block.child || block.assigned).map(block => ({ title: block.heading, text: body(block) }));
  const faq = grouped("faq").filter(block => block.child || block.assigned).map(block => ({ question: block.heading, answer: body(block) })).filter(item => item.answer);
  const suggestedPhotos = grouped("photos").flatMap(block => splitItems(body(block)));
  const article = parseArticle({ ...emptyArticle(), title, description: intro.slice(0, 300), introduction: intro, difficulty: project.difficulty || "Beginner", estimatedTime: project["estimated time"] || project.time || "", yarnWeight: project.yarn || project["yarn weight"] || "", hookSize: project.hook || project["hook size"] || "", dimensions: project["finished size"] || project.size || "", materials, abbreviationEntries, instructions, instructionMode: instructions.some(step => step.kind === "round") ? "rounds" : "steps", finishing: joined("finishing"), aboutOverride: joined("about"), importantNotes: notes, noteEntries, mistakes, variations, faq, imageAlt: joined("image"), suggestedPhotos, rawSource: raw, parseFingerprint: rawFingerprint(raw), parseWarnings: warnings, unparsedSections: unparsed, otherSections, contentMode: "structured" });
  if (!title) article.parseWarnings?.push("No article title was detected.");
  if (!intro) article.parseWarnings?.push("No short introduction was detected.");
  if (!materials.length) article.parseWarnings?.push("No materials were detected.");
  if (!instructions.length) article.parseWarnings?.push("No rounds or steps were detected.");
  return article;
}
