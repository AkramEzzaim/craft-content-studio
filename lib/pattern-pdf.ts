import "server-only";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { existsSync } from "node:fs";
import path from "node:path";
import { publicBody } from "./public-body";
import type { Article } from "./types";

const INK = "#283b32";
const ACCENT = "#b75d4f";
const MUTED = "#637269";
const RULE = "#dce3dc";
const PAGE_WIDTH = 595.28; // A4 in points
const PAGE_HEIGHT = 841.89;
const LEFT = 50;
const WIDTH = PAGE_WIDTH - LEFT * 2;
const TOP = 56;
const BOTTOM = PAGE_HEIGHT - 68;
const bodyFontPath = path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");
const headingFontPath = path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.ttf");

type Block = { kind: "section" | "subsection" | "paragraph" | "list" | "image"; text?: string; items?: string[]; path?: string; caption?: string };
type PreparedImage = { bytes: Buffer; width: number; height: number };

function plain(text: string) {
  return text.replace(/\*\*/g, "").replace(/\\([*_])/g, "$1").replace(/\s+/g, " ").trim();
}

function markdownBlocks(body: string, intro: string): Block[] {
  const lines = body.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index++; continue; }
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) { blocks.push({ kind: heading[1].length === 2 ? "section" : "subsection", text: plain(heading[2]) }); index++; continue; }
    const photo = /^!\[([^\]]*)\]\((\/images\/[a-z0-9/_-]+\.(?:jpe?g|png|webp|avif))\)$/i.exec(line);
    if (photo) {
      const next = lines[index + 1]?.trim();
      blocks.push({ kind: "image", path: photo[2], caption: next && !/^(?:#|\-|!\[)/.test(next) ? plain(next) : plain(photo[1]) });
      index += next && !/^(?:#|\-|!\[)/.test(next) ? 2 : 1;
      continue;
    }
    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^-\s+/.test(lines[index].trim())) items.push(plain(lines[index++].trim().slice(2)));
      blocks.push({ kind: "list", items });
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(?:#{2,3}\s+|-\s+|!\[)/.test(lines[index].trim())) paragraph.push(lines[index++].trim());
    if (!paragraph.length) { index++; continue; }
    const text = plain(paragraph.join(" "));
    if (text && !(blocks.length === 0 && text === plain(intro))) blocks.push({ kind: "paragraph", text });
  }
  return blocks;
}

function factRows(article: Article): [string, string][] {
  return [
    ["Difficulty", article.difficulty], ["Time", article.estimatedTime],
    ["Yarn", [article.yarnWeight, article.yarnType].filter(Boolean).join(" ")],
    ["Hook", article.hookSize], ["Finished size", article.dimensions],
  ].filter(([, value]) => !!value?.trim()) as [string, string][];
}

async function preparedImage(bytes: Buffer): Promise<PreparedImage> {
  const { data, info } = await sharp(bytes, { failOn: "error" }).rotate().resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  return { bytes: data, width: info.width, height: info.height };
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > BOTTOM) doc.addPage();
}

function measure(doc: PDFKit.PDFDocument, text: string, size = 10.5, width = WIDTH) {
  doc.font("Body").fontSize(size);
  return doc.heightOfString(text, { width, lineGap: 3 });
}

function paragraph(doc: PDFKit.PDFDocument, value: string, indent = 0) {
  const text = plain(value);
  if (!text) return;
  const width = WIDTH - indent;
  const height = measure(doc, text, 10.5, width);
  if (height <= BOTTOM - TOP) ensureSpace(doc, height + 11);
  doc.font("Body").fontSize(10.5).fillColor(INK).text(text, LEFT + indent, doc.y, { width, lineGap: 3 });
  doc.y += 10;
}

function section(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 57);
  doc.y += 17;
  doc.font("Heading").fontSize(15).fillColor(INK).text(title, LEFT, doc.y, { width: WIDTH });
  doc.y += 7;
  doc.moveTo(LEFT, doc.y).lineTo(LEFT + WIDTH, doc.y).strokeColor(RULE).lineWidth(0.7).stroke();
  doc.y += 13;
}

function subsection(doc: PDFKit.PDFDocument, title: string, next: Block[]) {
  const estimated = next.reduce((sum, block) => sum + (block.kind === "image" ? 255 : block.text ? measure(doc, block.text) + 9 : block.items?.reduce((total, item) => total + measure(doc, item, 10.5, WIDTH - 23) + 5, 0) || 0), 0);
  ensureSpace(doc, Math.min(27 + estimated, BOTTOM - TOP));
  doc.y += 9;
  doc.font("Heading").fontSize(11.5).fillColor(ACCENT).text(title.toUpperCase(), LEFT, doc.y, { width: WIDTH });
  doc.y += 8;
}

function list(doc: PDFKit.PDFDocument, items: string[]) {
  for (const item of items) {
    const height = measure(doc, item, 10.5, WIDTH - 26);
    if (height <= BOTTOM - TOP) ensureSpace(doc, height + 8);
    const y = doc.y;
    doc.circle(LEFT + 5, y + 6, 2).fill(ACCENT);
    doc.font("Body").fontSize(10.5).fillColor(INK).text(item, LEFT + 19, y, { width: WIDTH - 19, lineGap: 3 });
    doc.y += 6;
  }
  doc.y += 5;
}

function image(doc: PDFKit.PDFDocument, photo: PreparedImage, caption?: string) {
  const width = Math.min(WIDTH, 380, 225 * photo.width / photo.height);
  const height = width * photo.height / photo.width;
  ensureSpace(doc, height + (caption ? 39 : 21));
  doc.image(photo.bytes, LEFT, doc.y, { width });
  doc.y += height + 8;
  if (caption) {
    doc.font("Body").fontSize(8.5).fillColor(MUTED).text(caption, LEFT, doc.y, { width: WIDTH });
    doc.y += 4;
  }
  doc.y += 12;
}

function footer(doc: PDFKit.PDFDocument, host: string) {
  const count = doc.bufferedPageRange().count;
  for (let page = 0; page < count; page++) {
    doc.switchToPage(page);
    doc.page.margins.bottom = 20; // Footer text sits below the body margin without creating another page.
    doc.moveTo(LEFT, PAGE_HEIGHT - 51).lineTo(LEFT + WIDTH, PAGE_HEIGHT - 51).strokeColor(RULE).lineWidth(0.6).stroke();
    doc.font("Body").fontSize(8).fillColor(MUTED).text(host, LEFT, PAGE_HEIGHT - 41, { width: WIDTH - 50, lineBreak: false });
    doc.text(String(page + 1), LEFT + WIDTH - 36, PAGE_HEIGHT - 41, { width: 36, align: "right", lineBreak: false });
  }
}

/** Render the exact public article body and its structured project facts without using a browser or filesystem. */
export async function generatePatternPdf(article: Article, resolveImage: (path: string) => Promise<Buffer | null>, siteUrl: string): Promise<Buffer> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) throw new Error("Invalid article slug for PDF");
  if (!/^\/images\/[a-z0-9/_-]+\.(?:jpe?g|png|webp|avif)$/i.test(article.featuredImage)) throw new Error("Invalid featured image path for PDF");
  const intro = article.introduction?.trim() || article.description.trim();
  let body = publicBody(article).trimStart();
  if (intro && body.startsWith(intro)) body = body.slice(intro.length).trimStart(); // The introduction is on the cover.
  let omitSection = false;
  const blocks = markdownBlocks(body, intro).filter(block => {
    if (block.kind === "section") omitSection = ["project information", "more photos"].includes(block.text?.toLowerCase() || "");
    return !omitSection;
  });
  const paths = [...new Set([article.featuredImage, ...blocks.flatMap(block => block.path ? [block.path] : [])])];
  const images = new Map<string, PreparedImage>();
  await Promise.all(paths.map(async path => {
    const source = await resolveImage(path);
    if (!source) { if (path === article.featuredImage) throw new Error("The featured image is missing"); return; }
    images.set(path, await preparedImage(source));
  }));
  const parsedSite = new URL(siteUrl);
  if (parsedSite.protocol !== "https:") throw new Error("Public site URL must use HTTPS");
  if (!existsSync(bodyFontPath) || !existsSync(headingFontPath)) throw new Error("Bundled PDF fonts are missing from the server deployment");
  const doc = new PDFDocument({ size: "A4", font: bodyFontPath, margins: { top: TOP, bottom: 68, left: LEFT, right: LEFT }, bufferPages: true, autoFirstPage: true, info: { Title: article.title, Author: "Loop & Bloom", Subject: "Printable crochet pattern", CreationDate: new Date(article.updatedAt) } });
  doc.registerFont("Body", bodyFontPath);
  doc.registerFont("Heading", headingFontPath);
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  try {
    doc.font("Heading").fontSize(11).fillColor(ACCENT).text("LOOP & BLOOM", LEFT, TOP);
    doc.y += 12;
    doc.font("Heading").fontSize(25).fillColor(INK).text(article.title, LEFT, doc.y, { width: WIDTH, lineGap: 2 });
    doc.y += 13;
    if (intro) paragraph(doc, intro);
    const cover = images.get(article.featuredImage)!;
    const coverWidth = Math.min(WIDTH, 265 * cover.width / cover.height);
    const coverHeight = coverWidth * cover.height / cover.width;
    ensureSpace(doc, coverHeight + 26);
    doc.image(cover.bytes, LEFT, doc.y, { width: coverWidth });
    doc.y += coverHeight + 23;
    const facts = factRows(article);
    if (facts.length) {
      ensureSpace(doc, Math.ceil(facts.length / 2) * 36 + 18);
      doc.font("Heading").fontSize(11).fillColor(INK).text("PROJECT INFORMATION", LEFT, doc.y);
      doc.y += 12;
      for (let i = 0; i < facts.length; i += 2) {
        const rowY = doc.y;
        for (const [column, fact] of facts.slice(i, i + 2).entries()) {
          const x = LEFT + column * (WIDTH / 2);
          doc.font("Heading").fontSize(8).fillColor(ACCENT).text(fact[0].toUpperCase(), x, rowY, { width: WIDTH / 2 - 12 });
          doc.font("Body").fontSize(10).fillColor(INK).text(fact[1], x, rowY + 12, { width: WIDTH / 2 - 12, height: 24 });
        }
        doc.y = rowY + 39;
      }
    }
    doc.addPage();
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.kind === "section") {
        section(doc, block.text || "");
      } else if (block.kind === "subsection") {
        const next: Block[] = [];
        for (let j = i + 1; j < blocks.length && !["section", "subsection"].includes(blocks[j].kind); j++) next.push(blocks[j]);
        subsection(doc, block.text || "", next);
      } else if (block.kind === "list") list(doc, block.items || []);
      else if (block.kind === "paragraph") paragraph(doc, block.text || "");
      else if (block.kind === "image" && block.path && images.has(block.path)) image(doc, images.get(block.path)!, block.caption);
    }
    doc.y += 14;
    ensureSpace(doc, 30);
    doc.font("Body").fontSize(9).fillColor(MUTED).text(`${parsedSite.origin}/patterns/${article.slug}`, LEFT, doc.y, { width: WIDTH, link: `${parsedSite.origin}/patterns/${article.slug}` });
    footer(doc, parsedSite.hostname);
    doc.end();
  } catch (error) { void completed.catch(() => {}); doc.destroy(error instanceof Error ? error : new Error("PDF rendering failed")); throw error; }
  const bytes = await completed;
  if (bytes.length < 1000 || !bytes.subarray(0, 5).equals(Buffer.from("%PDF-")) || !bytes.subarray(-24).toString("latin1").includes("%%EOF")) throw new Error("PDF rendering produced an invalid file");
  return bytes;
}
