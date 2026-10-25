# Crochet Content Studio

A private Next.js editorial dashboard for the existing [Hearth & Thread craft site](https://craft-iota-wheat.vercel.app/). The studio is a separate Vercel application. It creates durable private drafts, accepts structured n8n AI drafts, supports human review, and commits approved Markdown articles into the public craft repository.

## Public site compatibility audit

The public site's source was inspected in the sibling `../craft` checkout at the time of implementation:

- Articles are `content/patterns/*.md`, parsed by `lib/patterns.ts`. There is no MDX pipeline.
- The filename normally matches a lowercase kebab-case `slug`; the parser validates the slug, and routes are `/patterns/[slug]`.
- Required frontmatter: `title`, `slug`, `description`, `category`, `difficulty`, `featuredImage`, `publishedAt`, `status`, `author`. Accepted categories are `crochet`, `knitting`, and `diy`; the studio starts with `crochet`.
- Public production pages filter for `status: "published"`. Local development can show drafts. `app/sitemap.ts` uses only published patterns.
- Featured images are uploaded to the private Studio repository first. New articles publish them to `public/images/patterns/{slug}/featured.{extension}`; older saved drafts retain their original flat image paths. Additional photos publish beside the featured image. The public site's `next/image` component renders these local paths.
- The site renders the body with `components/markdown-article.tsx`. It supports H2/H3, paragraphs, bold, lists, and Studio uploaded photos. Structured sections render as round cards, note blocks, troubleshooting cards, and native FAQ accordions. Custom Markdown links, tables, quotes, and rules remain unsupported.
- The public checker requires a `## Instructions` section. The adapter includes compatible SEO metadata, image alt text, tags as comma-separated frontmatter, canonical URL, and the published date.

The preview reproduces the public article hierarchy and the supported Markdown renderer. It is an approximation of the public CSS, not a pixel-perfect mirror.

## Local setup

1. `npm ci`
2. Copy `.env.example` to `.env.local` and fill in the required values. Use `npm run hash-password` to generate `ADMIN_PASSWORD_HASH`; use a random secret of at least 32 characters for `SESSION_SECRET`.
3. Create and initialize a **separate private GitHub repository** for studio drafts. Set `STUDIO_GITHUB_OWNER`, `STUDIO_GITHUB_REPO`, `STUDIO_GITHUB_BRANCH`, and `STUDIO_GITHUB_TOKEN`. The token needs Contents read/write on that private repository. Do not use the public craft repository for drafts.
4. Set `CRAFT_GITHUB_TOKEN` with Contents read/write on the public craft repository. Configure `CRAFT_GITHUB_OWNER`, `CRAFT_GITHUB_REPO`, `CRAFT_GITHUB_BRANCH`, and `CRAFT_CONTENT_PATH=content/patterns`. Optionally set `CRAFT_SITE_URL`; it defaults to `https://craft-iota-wheat.vercel.app`.
5. Optionally configure `N8N_CONTENT_WEBHOOK_URL` and `N8N_CONTENT_WEBHOOK_SECRET` for AI drafts.
6. Run `npm run dev`. Deploy this repository as its own Vercel project with the same environment variables.

No database or Vercel filesystem persistence is required. Private drafts are JSON files in the private studio repository. Each save uses the GitHub file SHA to detect concurrent edits. The GitHub tokens and webhook secret are used only in server code.

## Article creation and image storage

New articles start with a single large paste area. Paste a complete crochet article and choose **Parse Pattern**. The authenticated `POST /api/parse-pattern` route parses headings, project facts, materials, abbreviations, individual rounds or rows, finishing, notes, mistakes, variations, FAQ, image descriptions, and suggested photos. Studio saves the original text as `rawSource` along with the structured article, parse warnings, and any unparsed sections in the private draft repository. Unknown sections can be assigned and reparsed; unresolved sections block structured publication. The Review Parsed Article action opens the existing five-tab editor for corrections, preview, the manual accuracy checklist, and confirmed publishing. The original text is always available through **Raw Article**. Older drafts without pasted source open directly in the existing editor. A collapsed Advanced area offers a legacy Markdown fallback.

The review editor has five tabs: **Pattern**, **Instructions**, **Extras**, **Photos**, and **Review**. Pattern collects the title, introduction, featured image, project facts, materials, and abbreviations. Instructions contains movable round, row, or step cards with pattern notation, a beginner explanation, optional stitch count, tip, and photo. Extras contains repeatable notes, finishing, mistakes, variations, and FAQ. Photos accepts multiple extra images and allows reordering. Review shows a summary, image, accuracy checklist, preview, and publishing readiness. A separate optional checkbox records whether a pattern was physically tested. **Advanced settings** is collapsed and holds slug, SEO and social overrides, older draft fields, image metadata, and the Markdown editor. Structured fields generate public-compatible sectioned Markdown and frontmatter; the raw paste itself is never sent as one article body.

Select a JPG, PNG, or WebP image up to 4 MB in Pattern or Photos. Studio previews it locally, saves the draft if needed, validates the file server-side, and commits it to the private draft repository at `studio/assets/{article-id}/featured.{extension}`. Additional photos use `studio/assets/{article-id}/photos/{image-id}.{extension}`. The draft JSON stores metadata and private paths; the browser loads saved images through authenticated routes. Images survive refreshes and browser restarts. Replacing or removing an image updates the draft. No new environment variables or persistent local filesystem storage are required.

## Publishing workflow

Create or generate a draft, edit it, complete crochet accuracy checks, inspect the preview, mark it ready, then explicitly publish. Generated content requires review. Publishing checks the private photos and public destinations, generates a printer-friendly A4 PDF from the same article body, then commits the compatible `.md` article, PDF, and changed images in one GitHub tree commit. The PDF is stored at `public/pdfs/{slug}.pdf` and is available at `{CRAFT_SITE_URL}/pdfs/{slug}.pdf` after deployment. `CRAFT_SITE_URL` must point to the deployed public domain; a custom domain works only after its DNS and hosting are configured. Existing featured image replacement and article updates require explicit confirmation. Updates replace the same PDF path. The draft becomes `published` only after the commit succeeds. PDF generation failures leave the public article unchanged and show a clear error; if the later private status save fails, reconciliation checks the committed article, images, and PDF. GitHub commits trigger the public site's normal Vercel deployment; Studio reports expected URLs without claiming they are live yet.

The PDF renderer embeds Noto Sans Regular and Bold from `public/fonts/` (license in `public/fonts/OFL.txt`). `next.config.ts` keeps PDFKit external to the server bundle and includes those font files in the publishing routes' Vercel traces.

In **Preview & Publish**, save the article and mark it ready. **PUBLISH TO HEARTH & THREAD** opens a confirmation with the repository, branch, article and image paths, and expected URL. If the public article exists, Studio requires a separate **Update existing article** action followed by **Confirm Update**. Updates use the current GitHub file SHA and reject changes made after confirmation opened. A slug change after publication requires manual migration. If GitHub commits but the subsequent private draft status save fails, **Check publishing outcome** compares the public files with the saved publishing revision and reconciles the status without another commit.

To test one article safely:

1. In Settings, check that the craft repository, token, branch, content path, and public site are configured. Confirm the configured branch is the public site’s deployment branch.
2. Create or open a draft with a unique title, introduction, yarn, hook, materials, and rounds or steps. Upload a featured image in Basics or Images; confirm its filename and preview, then reload the article to verify it remains available.
3. Review the generated article and complete the crochet accuracy checklist.
4. Save the draft, open Preview & Publish, and choose **Mark ready**. Check the publishing readiness list; optional search suggestions may remain.
5. Choose **PUBLISH TO HEARTH & THREAD**. Verify the title, slug, repository, branch, `content/patterns/{slug}.md` destination, and expected URL in the confirmation. **Cancel** here makes no public change.
6. Choose **Confirm Publish** once. Copy the commit SHA from the success screen, open GitHub, and verify both the new Markdown file and image under `public/images/patterns/`. The expected public URL may become available after Vercel finishes its normal build.
7. To test replacement protection, edit the published article, replace its image, mark it ready, and reopen the confirmation. **Cancel** leaves the public files intact; updating requires **Update existing article** and a second **Confirm Update** click.

Article deletion is available from each row’s More actions menu and from the editor Danger Zone. Draft deletion removes the private JSON and all files under that draft’s private asset folder. Published articles offer **Unpublish** (remove the public article, its PDF, and its article-specific image folder, retaining the private draft) or **Delete Everything** (remove both public and private files). Deletion fetches each file’s current GitHub SHA before using the Contents API, requires a confirmation dialog, and requires typing `DELETE` for Delete Everything. Cleanup can be retried after a partial failure; shared or legacy flat public images outside the article folder are retained and reported. Already published articles show **Generate PDF** or **Regenerate PDF** in the Review panel. This action writes only the PDF after checking that the public Markdown still matches the last Studio publication.

Local checks: `npm run check:pdf`, `npm run check:deletion`, `npm run check:parser`, `npm run check:compatibility`, `npm run check:publishing`, `npm run check:images`, `npm run check:builder`, `npm run typecheck`, `npm run lint`, and `npm run build`.

## n8n contract

The studio posts topic, keyword, article type, category, difficulty, audience, special instructions, and a server-side editorial prompt as JSON. If `N8N_CONTENT_WEBHOOK_SECRET` is set, it sends it in `X-Webhook-Secret`. The response must be one JSON article object with at least a title and structured `contentMarkdown`, plus optional metadata such as `description`, `excerpt`, `seoTitle`, `metaDescription`, `tags`, `materials`, `tools`, `abbreviations`, `patternNotes`, `faq`, and Pinterest fields. Unknown fields are ignored; supported fields are bounded and validated. The AI cannot publish.

## Security and current limits

The owner login uses a salted scrypt hash and a signed, HTTP-only, SameSite=Strict session cookie. Rotate `SESSION_SECRET` to invalidate all sessions. All admin pages and APIs check the session on the server; mutating APIs also check same-origin requests. Use a strong admin password and Vercel deployment protection or rate limiting for the login endpoint in production.

Older drafts can retain their original step image references. New step photos are stored in the private draft repository and published with the article. The public renderer still limits custom Markdown features. Revisit the adapter and compatibility audit if the public site changes.
