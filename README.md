# Crochet Content Studio

A private Next.js editorial dashboard for the existing [Hearth & Thread craft site](https://craft-iota-wheat.vercel.app/). The studio is a separate Vercel application. It creates durable private drafts, accepts structured n8n AI drafts, supports human review, and commits approved Markdown articles into the public craft repository.

## Public site compatibility audit

The public site's source was inspected in the sibling `../craft` checkout at the time of implementation:

- Articles are `content/patterns/*.md`, parsed by `lib/patterns.ts`. There is no MDX pipeline.
- The filename normally matches a lowercase kebab-case `slug`; the parser validates the slug, and routes are `/patterns/[slug]`.
- Required frontmatter: `title`, `slug`, `description`, `category`, `difficulty`, `featuredImage`, `publishedAt`, `status`, `author`. Accepted categories are `crochet`, `knitting`, and `diy`; the studio starts with `crochet`.
- Public production pages filter for `status: "published"`. Local development can show drafts. `app/sitemap.ts` uses only published patterns.
- Featured images are uploaded to the private Studio repository first. Publishing copies them to public `public/images/patterns/{slug}.{extension}`; the article uses `/images/patterns/{slug}.{extension}`. The public site's `next/image` component renders that local path.
- The site renders the body with `components/markdown-article.tsx`. It supports H2/H3, paragraphs, bold, bullet lists, and numbered lists. It does not currently render links, inline images, tables, block quotes, or horizontal rules. The studio can hold these in drafts but blocks unsupported constructs before publishing.
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

The normal editor shows **Basics**, **Pattern**, **Image**, and **Review**. **Advanced** holds slug, SEO overrides, secondary keywords, crochet details, Pinterest and Open Graph metadata, optional step images, image alt text, and the full Markdown editor. New articles generate a slug, SEO title, meta description, tags, alt text, and Markdown from the title, description, materials, yarn and hook details, instruction steps, beginner tips, and FAQ. Existing Markdown drafts retain their text and can be edited in Advanced.

Select a JPG, PNG, or WebP image up to 4 MB in the Image tab. Studio previews it locally, saves the draft if needed, validates the file server-side, and commits the image to the private draft repository at `studio/assets/{article-id}/featured.{extension}`. The draft JSON stores only metadata and the private path; the browser loads saved images through an authenticated route. Images survive refreshes and browser restarts. Replacing or removing an image updates the draft. No new environment variables or persistent local filesystem storage are required.

## Publishing workflow

Create or generate a draft, edit it, complete crochet accuracy checks, inspect the preview, mark it ready, then explicitly publish. Generated content is always saved as `generated` and requires review. Publishing checks the private featured image and public filename, then commits the image under `public/images/patterns/` and the compatible `.md` article in one GitHub tree commit. Existing image replacement and article updates require explicit confirmation. The draft becomes `published` only after that commit succeeds. A failed GitHub commit changes neither public file; if the later private status save fails, the existing reconciliation flow checks the committed article and image. GitHub commits trigger the public site's normal Vercel deployment; the studio reports the expected URL without claiming the site is live yet.

In the editor’s Review tab, save the article and mark it ready. **PUBLISH TO HEARTH & THREAD** opens a confirmation with the repository, branch, file path, expected URL, quality score, and SEO score. If the public file already exists, the studio requires a separate **Update existing article** action followed by **Confirm Update**. Updates use the current GitHub file SHA and reject changes made after the confirmation opened. A slug change after publication requires manual migration. If GitHub commits but the subsequent private draft status save fails, **Check publishing outcome** compares the public file with the saved publishing revision and reconciles the status without another commit.

To test one article safely:

1. In Settings, check that the craft repository, token, branch, content path, and public site are configured. Confirm the configured branch is the public site’s deployment branch.
2. Create or open a draft with a unique title, description, materials, and instruction steps. Select a featured image in the Image tab; confirm its filename and preview, then reload the article to verify it remains available.
3. Review the generated article and complete the crochet accuracy checklist.
4. Save the draft, open Review, and choose **Mark ready**. Check the publishing readiness list; SEO suggestions may remain.
5. Choose **PUBLISH TO HEARTH & THREAD**. Verify the title, slug, repository, branch, `content/patterns/{slug}.md` destination, and expected URL in the confirmation. **Cancel** here makes no public change.
6. Choose **Confirm Publish** once. Copy the commit SHA from the success screen, open GitHub, and verify both the new Markdown file and image under `public/images/patterns/`. The expected public URL may become available after Vercel finishes its normal build.
7. To test replacement protection, edit the published article, replace its image, mark it ready, and reopen the confirmation. **Cancel** leaves the public files intact; updating requires **Update existing article** and a second **Confirm Update** click.

Local checks: `npm run check:compatibility`, `npm run check:publishing`, `npm run check:images`, `npm run typecheck`, `npm run lint`, and `npm run build`.

## n8n contract

The studio posts topic, keyword, article type, category, difficulty, audience, special instructions, and a server-side editorial prompt as JSON. If `N8N_CONTENT_WEBHOOK_SECRET` is set, it sends it in `X-Webhook-Secret`. The response must be one JSON article object with at least a title and structured `contentMarkdown`, plus optional metadata such as `description`, `excerpt`, `seoTitle`, `metaDescription`, `tags`, `materials`, `tools`, `abbreviations`, `patternNotes`, `faq`, and Pinterest fields. Unknown fields are ignored; supported fields are bounded and validated. The AI cannot publish.

## Security and current limits

The owner login uses a salted scrypt hash and a signed, HTTP-only, SameSite=Strict session cookie. Rotate `SESSION_SECRET` to invalidate all sessions. All admin pages and APIs check the session on the server; mutating APIs also check same-origin requests. Use a strong admin password and Vercel deployment protection or rate limiting for the login endpoint in production.

Step images remain optional metadata for a later public renderer update. The public repository's current renderer also limits which Markdown features can be published. Revisit the adapter and compatibility audit if the public site changes.
