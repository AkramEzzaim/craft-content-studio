/* eslint-disable @next/next/no-img-element -- Draft photos use authenticated Studio routes. */
import type { Article } from "@/lib/types";
import { publicBody } from "@/lib/public-body";
import type { ReactNode } from "react";

type Block = { kind: "h2" | "h3" | "text" | "ul" | "ol" | "image"; value: string; items?: string[]; src?: string };
function inline(value: string): ReactNode[] { return value.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part); }
function parse(source: string): Block[] {
  const lines = source.split(/\r?\n/); const blocks: Block[] = []; let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index++; continue; }
    if (line.startsWith("## ")) { blocks.push({ kind: "h2", value: line.slice(3) }); index++; continue; }
    if (line.startsWith("### ")) { blocks.push({ kind: "h3", value: line.slice(4) }); index++; continue; }
    const photo = /^!\[([^\]\n]*)\]\((\/images\/patterns\/[a-z0-9/_-]+\.(?:jpe?g|png|webp))\)$/i.exec(line);
    if (photo) { blocks.push({ kind: "image", value: photo[1], src: photo[2] }); index++; continue; }
    if (/^[-*] /.test(line)) { const items: string[] = []; while (index < lines.length && /^[-*] /.test(lines[index].trim())) items.push(lines[index++].trim().slice(2)); blocks.push({ kind: "ul", value: "", items }); continue; }
    if (/^\d+\. /.test(line)) { const items: string[] = []; while (index < lines.length && /^\d+\. /.test(lines[index].trim())) items.push(lines[index++].trim().replace(/^\d+\. /, "")); blocks.push({ kind: "ol", value: "", items }); continue; }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(#{2,3} |[-*] |\d+\. |!\[)/.test(lines[index].trim())) paragraph.push(lines[index++].trim());
    if (paragraph.length) blocks.push({ kind: "text", value: paragraph.join(" ") }); else index++;
  }
  return blocks;
}
function Body({ source, article, publicSiteUrl }: { source: string; article: Article; publicSiteUrl: string }) {
  const blocks = parse(source);
  function render(block: Block, index: number): ReactNode {
    if (block.kind === "text") return <p key={index}>{inline(block.value)}</p>;
    if (block.kind === "ul") return <ul key={index}>{block.items?.map((item, number) => <li key={number}>{inline(item)}</li>)}</ul>;
    if (block.kind === "ol") return <ol key={index}>{block.items?.map((item, number) => <li key={number}>{inline(item)}</li>)}</ol>;
    if (block.kind === "image" && block.src) {
      const image = article.galleryImages?.find(item => item.publicPath === `public${block.src}`);
      const src = image ? `/api/articles/${article.id}/gallery-image?imageId=${image.id}&sha=${article.storageSha || ""}` : new URL(block.src, publicSiteUrl).toString();
      return <figure className="preview-photo" key={index}><img src={src} alt={block.value}/>{image?.caption && <figcaption>{image.caption}</figcaption>}</figure>;
    }
    return null;
  }
  const sections: { title: string; blocks: Block[] }[] = [{ title: "", blocks: [] }];
  for (const block of blocks) if (block.kind === "h2") sections.push({ title: block.value, blocks: [] }); else sections[sections.length - 1].blocks.push(block);
  return <div className="preview-prose">{sections.map((section, sectionIndex) => {
    if (!section.title) return <div key={sectionIndex}>{section.blocks.map(render)}</div>;
    const id = section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const cards = ["Instructions", "Common Mistakes", "Variations", "FAQ"].includes(section.title);
    if (!cards) return <section className={`preview-section preview-${id}`} key={sectionIndex}><h2 id={id}>{section.title}</h2>{section.blocks.map(render)}</section>;
    const groups: { title: string; blocks: Block[] }[] = []; const intro: Block[] = [];
    for (const block of section.blocks) if (block.kind === "h3") groups.push({ title: block.value, blocks: [] }); else if (groups.length) groups[groups.length - 1].blocks.push(block); else intro.push(block);
    return <section className={`preview-section preview-${id}`} key={sectionIndex}><h2 id={id}>{section.title}</h2>{intro.map(render)}<div className="preview-card-stack">{groups.map((group, index) => section.title === "FAQ" ? <details className="preview-faq-card" key={index}><summary>{group.title}</summary><div>{group.blocks.map(render)}</div></details> : <div className="preview-step-card" key={index}><h3>{group.title}</h3>{group.blocks.map(render)}</div>)}</div></section>;
  })}</div>;
}
export function PublicPreview({ article: a, compact = false, publicSiteUrl = "https://craft-iota-wheat.vercel.app" }: { article: Article; compact?: boolean; publicSiteUrl?: string }) {
  const imageSrc = a.draftImage ? `/api/articles/${a.id}/featured-image?sha=${a.storageSha || ""}` : a.featuredImage?.startsWith("/images/") ? new URL(a.featuredImage, publicSiteUrl).toString() : a.featuredImage;
  return <div className={`public-preview ${compact ? "compact" : ""}`}><div className="preview-notice">PREVIEW — NOT PUBLISHED</div>
    <div className="preview-hero"><div><div className="preview-eyebrow">FREE CROCHET PATTERN</div><h1>{a.title || "Your article title"}</h1>{a.subtitle && <p className="preview-subtitle">{a.subtitle}</p>}<p>{a.description || "Your short introduction will appear here."}</p><div className="preview-facts"><span>✳ {a.difficulty || "Difficulty"}</span><span>◷ {a.estimatedTime || "Estimated time"}</span></div><small>By {a.author || "Hearth & Thread Studio"}</small></div><div className="preview-image">{imageSrc ? <img src={imageSrc} alt={a.imageAlt || a.title}/> : <div>Featured image preview</div>}</div></div>
    <div className="preview-body"><aside><span>IN THIS PROJECT</span>{["About This Pattern", "Materials", "Abbreviations", "Instructions", "Important Notes", "Variations", "Common Mistakes", "FAQ"].filter(title => a.contentMarkdown.includes(`## ${title}`)).map(title => <a key={title} href={`#${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{title}</a>)}</aside><article><Body source={a.contentMarkdown ? publicBody(a) : "Start writing to see the article preview."} article={a} publicSiteUrl={publicSiteUrl}/><div className="preview-cta"><small>KEEP MAKING</small><h2>Ready to start?</h2><p>Readers can get the free pattern and more project ideas here.</p><button>Get the free pattern</button></div><div className="preview-related"><h2>Related patterns</h2><p>The public site will select related crochet projects.</p></div><div className="preview-cta"><small>SHARE THE INSPIRATION</small><h2>Share your pattern</h2><p>Readers can share this tutorial with fellow makers.</p></div></article></div>
  </div>;
}
