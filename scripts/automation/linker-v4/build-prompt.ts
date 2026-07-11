// ============================================
// Smart Linker v4 — Build Prompt for Agent
// ============================================
// Generates a prompt file per article containing:
// 1. The full article text with numbered paragraphs
// 2. The ENTIRE page catalog organized by category
// 3. Linking rules and constraints
//
// An agent reads this prompt file and suggests links.

import fs from "fs/promises";
import path from "path";
import type { CLIOptions } from "../types";
import type { PageCatalog } from "./types";
import { loadMarkdownFiles, numberParagraphs, BLOG_DIR, QUEUE_DIR } from "./parse";

// ----------------
// Main Function
// ----------------

export async function buildPrompt(options: CLIOptions): Promise<void> {
  const { slug, all } = options;

  console.log("Building link analysis prompts...\n");

  // Load catalog (prioritize enriched JSON, fallback to compact MD)
  const jsonCatalogPath = path.resolve("src/data/linker-v4/page-catalog.json");
  const compactCatalogPath = path.resolve("src/data/linker-v4/compact-catalog.md");

  let catalogData: string | PageCatalog;
  try {
    catalogData = JSON.parse(await fs.readFile(jsonCatalogPath, "utf-8")) as PageCatalog;
  } catch {
    try {
      catalogData = await fs.readFile(compactCatalogPath, "utf-8");
    } catch {
      console.error(
        "Catalog not found. Run build-catalog first:\n" +
        "  npx tsx scripts/automation -f linker-v4 -m build-catalog"
      );
      return;
    }
  }

  // Load articles from both blog and queue
  const blogPosts = await loadMarkdownFiles(BLOG_DIR);
  const queueArticles = await loadMarkdownFiles(QUEUE_DIR);
  const allArticles = [...blogPosts, ...queueArticles];

  // Determine which articles to process
  let articlesToProcess = allArticles;
  if (slug) {
    articlesToProcess = allArticles.filter((a) => a.slug === slug);
    if (articlesToProcess.length === 0) {
      console.error(`Article not found: ${slug}`);
      console.log("Searched in src/content/blog/ and src/drafts/queue/");
      return;
    }
  } else if (!all) {
    console.error("Please specify --slug or --all");
    return;
  }

  console.log(`Processing ${articlesToProcess.length} articles\n`);

  const promptDir = path.resolve("src/data/linker-v4/prompts");
  await fs.mkdir(promptDir, { recursive: true });

  for (const article of articlesToProcess) {
    const promptContent = buildArticlePrompt(article, catalogData);
    const promptPath = path.join(promptDir, `${article.slug}-prompt.md`);
    await fs.writeFile(promptPath, promptContent);

    if (!all || articlesToProcess.length <= 10) {
      console.log(`  ${article.slug} → ${promptPath}`);
    }
  }

  if (all && articlesToProcess.length > 10) {
    console.log(`  Generated ${articlesToProcess.length} prompt files`);
  }

  console.log(`\nPrompt files ready.`);
  console.log(
    `\nNext: Ask an agent to read the prompt file and suggest links.`
  );
  if (slug) {
    console.log(`  Read: src/data/linker-v4/prompts/${slug}-prompt.md`);
  }
  console.log(
    `  Save suggestions to: src/data/linker-v4/suggestions/{slug}.json`
  );
}

// ----------------
// Prompt Builder
// ----------------

function buildArticlePrompt(
  article: Awaited<ReturnType<typeof loadMarkdownFiles>>[0],
  catalog: string | PageCatalog
): string {
  const paragraphs = numberParagraphs(article.body);
  const fm = article.frontmatter;

  // Count existing internal links
  const existingLinks = (
    article.body.match(/\[[^\]]+\]\(\/[^)]+\)/g) || []
  ).length;

  // Calculate target link count based on word count
  const wordCount = article.body
    .replace(/[#*_\[\]()]/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
  const targetLinks = Math.min(Math.max(3, Math.round(wordCount / 200)), 10);

  const lines: string[] = [];

  // Header
  lines.push("# Internal Link Analysis\n");
  lines.push(
    "You are an expert content editor for Multi-Family USA, a real estate investment mortgage broker."
  );
  lines.push(
    "Your job: read this article paragraph by paragraph and identify **" +
    targetLinks +
    " places** where a reader would genuinely benefit from a link to another page on this site.\n"
  );

  // Article metadata
  lines.push("## Article Details\n");
  lines.push(`- **Title**: ${fm.title}`);
  lines.push(`- **Slug**: ${article.slug}`);
  lines.push(`- **Category**: ${fm.category || "unknown"}`);
  lines.push(`- **Region**: ${fm.region || "canada"}`);
  lines.push(`- **Tags**: ${(fm.tags as string[])?.join(", ") || "none"}`);
  lines.push(`- **Word count**: ~${wordCount}`);
  lines.push(`- **Existing internal links**: ${existingLinks}`);
  lines.push(`- **Target new links**: ${targetLinks}`);

  // How to think about linking
  lines.push("\n## How to Think About This\n");
  lines.push(
    "Read each paragraph and ask: **What is the reader thinking right now? Is there a moment where they'd want to go deeper on something?**\n"
  );
  lines.push("**A GOOD link:**");
  lines.push("- The paragraph discusses a topic another page covers in depth");
  lines.push(
    '- The reader would naturally think "tell me more about this"'
  );
  lines.push(
    "- The anchor text accurately describes what they'll find on click"
  );
  lines.push("- The link adds genuine value at that moment in the reading\n");
  lines.push("**A BAD link:**");
  lines.push("- Forcing a connection between vaguely related topics");
  lines.push("- Generic phrase that could link to many different pages");
  lines.push("- Reader is mid-thought and wouldn't want to navigate away");
  lines.push(
    "- The target page doesn't deliver what the anchor promises\n"
  );

  // The article with numbered paragraphs
  lines.push("## The Article\n");
  for (const p of paragraphs) {
    if (p.isContent) {
      lines.push(`**[P${p.index}]** ${p.text}\n`);
    } else {
      lines.push(`*[P${p.index} — skip]* ${p.text}\n`);
    }
  }

  // The catalog
  lines.push("\n## All Available Pages on This Site\n");
  if (typeof catalog === "string") {
    lines.push(catalog);
  } else {
    // Format enriched catalog for the prompt
    for (const p of catalog.pages) {
      if (p.isTooltipOnly) continue; // Skip glossary terms

      lines.push(`### ${p.title}`);
      lines.push(`- **URL**: ${p.url}`);
      lines.push(`- **Promise**: ${p.readerPromise}`);
      lines.push(`- **Link When**: ${p.linkWhen.join(", ")}`);
      if (p.doNotLinkWhen.length > 0) {
        lines.push(`- **Do Not Link When**: ${p.doNotLinkWhen.join(", ")}`);
      }
      lines.push("");
    }
  }

  // Rules
  lines.push("\n## Rules\n");
  lines.push(
    "1. **Anchor text** MUST be an exact substring from the article paragraph (copy-paste precision)"
  );
  lines.push(
    "2. Anchor text: **3-12 words**, prefer descriptive noun phrases"
  );
  lines.push(
    '3. **NO generic anchors**: "real estate investors", "investment property", "financing options", "click here", "learn more", "mortgage options", "real estate investing", "investment strategies"'
  );
  lines.push(
    "4. **NOT in**: headings, first paragraph, blockquotes, existing links, HTML/CTA elements, FAQ sections, paragraphs marked *skip*"
  );
  lines.push("5. **Maximum 3** service/pillar page links per article");
  lines.push("6. **One link** per target URL");
  lines.push(
    "7. **Spread** links across the article — not clustered in one section"
  );
  lines.push(
    "8. **Prefer published articles** over queue articles when both are relevant"
  );
  lines.push(
    "9. **Prefer blog posts** over glossary terms unless the glossary term is truly the best match"
  );
  lines.push(
    "10. **Region match**: Don't link a Canada-focused article to US-only pages unless the context is explicitly cross-border"
  );

  // Output format
  lines.push("\n## Output Format\n");
  lines.push(
    "Return a JSON array of link suggestions. Save to `src/data/linker-v4/suggestions/" +
    article.slug +
    ".json` with this structure:\n"
  );
  lines.push("```json");
  lines.push(`{
  "sourceSlug": "${article.slug}",
  "sourceContentHash": "",
  "generatedAt": "${new Date().toISOString()}",
  "model": "agent-prompt",
  "catalogSize": 999,
  "raw": [
    {
      "paragraphIndex": 3,
      "anchorText": "exact substring from paragraph text",
      "targetUrl": "/blog/target-article-slug/",
      "readerNeed": "Why the reader needs this link here",
      "expectation": "What the reader expects to find on click",
      "confidence": 0.9
    }
  ],
  "validated": []
}`);
  lines.push("```\n");
  lines.push("**Important:**");
  lines.push(
    "- `paragraphIndex` matches the [P#] markers in the article above"
  );
  lines.push(
    "- `anchorText` must be an EXACT substring found in that paragraph"
  );
  lines.push(
    "- `confidence` should be 0.0-1.0 (only suggest links with 0.75+)"
  );
  lines.push(
    "- `readerNeed` explains WHY the reader benefits from this link at this point"
  );

  return lines.join("\n");
}
