// ============================================
// Smart Linker v4 — Monthly Link Audit
// ============================================
// Scans published articles via xAI Grok API to find new link opportunities.
// Uses category-filtered catalogs to reduce token usage and cost.
// Designed to run monthly via GitHub Action with Haiku 4.5.
//
// Usage:
//   npx tsx scripts/automation -f linker-v4 -m audit --all --use-api
//   npx tsx scripts/automation -f linker-v4 -m audit --slug my-article --use-api

import LlmClient from "../shared/llm";
import fs from "fs/promises";
import path from "path";
import type { CLIOptions } from "../types";
import { MODELS } from "../config";
import type { RawPageData, V3Suggestion, SuggestionFile, PageCatalog, PagePurpose, RankedPage } from "./types";
import {
  loadMarkdownFiles,
  numberParagraphs,
  parseBody,
  computeContentHash,
  BLOG_DIR,
} from "./parse";
import { rankPagesByRelevance } from "./semantic-filter";
import { loadLinkGraph } from "./link-graph";
import { CATEGORY_ADJACENCY, filterCatalogByCategory, extractExistingInternalLinks, type FilteredPage } from "./catalog-utils";

// ----------------
// Constants
// ----------------

const MODEL = MODELS.UTILITY;
const DATA_DIR = "src/data/linker-v4";
const SUGGESTIONS_DIR = "src/data/linker-v4/suggestions";
const DEFAULT_CONCURRENCY = 3;

// ----------------
// Main Function
// ----------------

export async function auditLinks(options: CLIOptions): Promise<void> {
  const { slug, all, useApi, dryRun } = options;

  if (!useApi) {
    console.error(
      "Audit mode requires --use-api flag.\n" +
      "  npx tsx scripts/automation -f linker-v4 -m audit --all --use-api"
    );
    return;
  }

  if (!process.env.XAI_API_KEY) {
    console.error("XAI_API_KEY environment variable required.");
    return;
  }

  console.log("Monthly link audit via xAI Grok API...\n");
  console.log(`  Model: ${MODEL}`);
  console.log(`  Mode: ${dryRun ? "dry-run" : "write suggestions"}\n`);

  // Load catalog (prioritize enriched JSON, fallback to raw JSON)
  const enrichedCatalogPath = path.resolve(DATA_DIR, "page-catalog.json");
  const rawCatalogPath = path.resolve(DATA_DIR, "raw-catalog.json");

  let catalogPages: (PagePurpose | RawPageData)[];
  try {
    const catalog = JSON.parse(await fs.readFile(enrichedCatalogPath, "utf-8")) as PageCatalog;
    catalogPages = catalog.pages;
  } catch {
    try {
      const catalog = JSON.parse(await fs.readFile(rawCatalogPath, "utf-8")) as { pages: RawPageData[] };
      catalogPages = catalog.pages;
    } catch {
      console.error("Raw catalog not found. Run build-catalog first.");
      return;
    }
  }

  // Only include published pages (not queue) as link targets
  const publishedPages = catalogPages.filter((p) => p.type !== "queue");

  // Load blog posts to audit
  const blogPosts = await loadMarkdownFiles(BLOG_DIR);

  let postsToAudit = blogPosts;
  if (slug) {
    postsToAudit = blogPosts.filter((p) => p.slug === slug);
    if (postsToAudit.length === 0) {
      console.error(`Post not found: ${slug}`);
      return;
    }
  } else if (!all) {
    console.error("Please specify --slug or --all");
    return;
  }

  console.log(`  Posts to audit: ${postsToAudit.length}`);
  console.log(`  Published pages in catalog: ${publishedPages.length}\n`);

  // Load link graph for orphan/well-linked annotations
  const linkGraph = await loadLinkGraph();
  if (linkGraph) {
    console.log(`  Link graph loaded: ${linkGraph.totalNodes} nodes, ${linkGraph.totalEdges} edges\n`);
  }

  const concurrency = options.concurrency || DEFAULT_CONCURRENCY;
  console.log(`  Concurrency: ${concurrency}\n`);

  const client = new LlmClient();
  const suggestionsDir = path.resolve(SUGGESTIONS_DIR);
  await fs.mkdir(suggestionsDir, { recursive: true });

  let totalSuggestions = 0;
  let totalNewOpportunities = 0;
  let totalErrors = 0;

  // Process in concurrent batches
  for (let i = 0; i < postsToAudit.length; i += concurrency) {
    const batch = postsToAudit.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map((post) =>
        auditSinglePost(client, post, publishedPages, linkGraph, dryRun, suggestionsDir)
      )
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const post = batch[j];
      const progress = `[${i + j + 1}/${postsToAudit.length}]`;

      if (result.status === "fulfilled") {
        const { suggestions, newOpportunities, catalogSize } = result.value;
        totalSuggestions += suggestions;
        totalNewOpportunities += newOpportunities;
        console.log(
          `  ${progress} ${post.slug}: ${suggestions} suggestions, ${newOpportunities} new (${catalogSize} pages)`
        );
      } else {
        totalErrors++;
        console.error(`  ${progress} ${post.slug}: ERROR - ${result.reason}`);
      }
    }
  }

  console.log(`\nAudit complete:`);
  console.log(`  Total suggestions: ${totalSuggestions}`);
  console.log(`  New opportunities: ${totalNewOpportunities}`);
  if (totalErrors > 0) console.log(`  Errors: ${totalErrors}`);
  if (!dryRun && totalNewOpportunities > 0) {
    console.log(`\nNext: Run validate and apply to insert new links`);
    console.log(`  npx tsx scripts/automation -f linker-v4 -m validate --all`);
    console.log(
      `  npx tsx scripts/automation -f linker-v4 -m apply --all --dry-run`
    );
  }
}

// ----------------
// Single Post Audit
// ----------------

interface AuditResult {
  suggestions: number;
  newOpportunities: number;
  catalogSize: number;
}

async function auditSinglePost(
  client: LlmClient,
  post: Awaited<ReturnType<typeof loadMarkdownFiles>>[0],
  publishedPages: (PagePurpose | RawPageData)[],
  linkGraph: Awaited<ReturnType<typeof loadLinkGraph>>,
  dryRun?: boolean,
  suggestionsDir?: string
): Promise<AuditResult> {
  const body = parseBody(post.rawContent);
  const postTitle = String(post.frontmatter.title || post.slug);

  // Try semantic ranking first, fall back to category filter
  let filteredCatalog: FilteredPage[];
  const semanticResults = await rankPagesByRelevance(body, postTitle, post.slug, 40);

  if (semanticResults.length > 0) {
    filteredCatalog = semanticResults.map((r) => ({
      url: r.url,
      title: r.title,
      description: r.description,
      category: r.category,
      region: r.region,
      tags: r.tags,
      readerPromise: r.readerPromise,
      linkWhen: r.linkWhen,
      doNotLinkWhen: r.doNotLinkWhen,
    }));
  } else {
    const category = String(post.frontmatter.category || "investing-fundamentals");
    filteredCatalog = filterCatalogByCategory(publishedPages, category, post.slug);
  }

  const paragraphs = numberParagraphs(body);
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const existingLinks = extractExistingInternalLinks(body);
  const targetLinks = Math.max(0, Math.min(Math.max(3, Math.round(wordCount / 200)), 10) - existingLinks.size);

  const prompt = buildAuditPrompt(post, paragraphs, filteredCatalog, targetLinks, existingLinks, linkGraph);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
    tools: [
      {
        name: "suggest_links",
        description: "Submit internal link suggestions for this article",
        input_schema: {
          type: "object" as const,
          properties: {
            links: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  paragraphIndex: { type: "number" },
                  anchorText: { type: "string" },
                  targetUrl: { type: "string" },
                  readerNeed: { type: "string" },
                  expectation: { type: "string" },
                  semanticIntent: { type: "string" },
                  confidence: { type: "number" },
                },
                required: [
                  "paragraphIndex", "anchorText", "targetUrl",
                  "readerNeed", "expectation", "semanticIntent", "confidence",
                ],
              },
            },
          },
          required: ["links"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "suggest_links" },
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { suggestions: 0, newOpportunities: 0, catalogSize: filteredCatalog.length };
  }

  const input = toolUse.input as { links: V3Suggestion[] };
  const suggestions = input.links || [];
  const newSuggestions = suggestions.filter(
    (s) => !existingLinks.has(s.targetUrl.replace(/\/$/, ""))
  );

  if (newSuggestions.length > 0 && suggestionsDir) {
    const suggestionFile: SuggestionFile = {
      sourceSlug: post.slug,
      sourceContentHash: computeContentHash(body),
      generatedAt: new Date().toISOString(),
      model: MODEL,
      catalogSize: filteredCatalog.length,
      raw: newSuggestions,
      validated: [],
    };

    if (!dryRun) {
      const outputPath = path.join(suggestionsDir, `${post.slug}.json`);
      await fs.writeFile(outputPath, JSON.stringify(suggestionFile, null, 2));
    }
  }

  return {
    suggestions: suggestions.length,
    newOpportunities: newSuggestions.length,
    catalogSize: filteredCatalog.length,
  };
}

// ----------------
// Audit Prompt Builder
// ----------------

function buildAuditPrompt(
  post: Awaited<ReturnType<typeof loadMarkdownFiles>>[0],
  paragraphs: ReturnType<typeof numberParagraphs>,
  catalog: FilteredPage[],
  targetLinks: number,
  existingLinks: Set<string>,
  linkGraph?: Awaited<ReturnType<typeof loadLinkGraph>>
): string {
  const fm = post.frontmatter;
  const lines: string[] = [];

  lines.push(
    "You are a content editor auditing internal links for a real estate investing blog."
  );
  lines.push(
    `Identify ${targetLinks} places where a reader would benefit from a link to another page.\n`
  );

  // Article
  lines.push(`## Article: ${fm.title}\n`);
  lines.push(`Category: ${fm.category}, Region: ${fm.region}\n`);

  for (const p of paragraphs) {
    if (p.isContent) {
      lines.push(`[P${p.index}] ${p.text}\n`);
    }
  }

  // Existing links
  if (existingLinks.size > 0) {
    lines.push(`\n## Existing Links (already placed — do NOT suggest these)\n`);
    for (const url of existingLinks) {
      lines.push(`- ${url}`);
    }
  }

  // Build orphan/well-linked sets from link graph
  const orphanSet = new Set(linkGraph?.orphanPages || []);
  const wellLinkedSet = new Set<string>();
  if (linkGraph) {
    for (const node of Object.values(linkGraph.nodes)) {
      if (node.inboundCount >= 15) wellLinkedSet.add(node.url);
    }
  }

  // Catalog
  lines.push(`\n## Available Pages\n`);
  for (const p of catalog) {
    // Normalize URL for graph lookup
    const normalizedUrl = p.url.endsWith("/") ? p.url : p.url + "/";
    let annotation = "";
    if (orphanSet.has(normalizedUrl)) {
      annotation = " [ORPHAN PAGE - prioritize]";
    } else if (wellLinkedSet.has(normalizedUrl)) {
      annotation = " [well-linked - lower priority]";
    }

    if (p.readerPromise) {
      lines.push(`### ${p.title} (${p.url})${annotation}`);
      lines.push(`- **Promise**: ${p.readerPromise}`);
      lines.push(`- **Link When**: ${p.linkWhen?.join(", ")}`);
      if (p.doNotLinkWhen && p.doNotLinkWhen.length > 0) {
        lines.push(`- **Do Not Link When**: ${p.doNotLinkWhen.join(", ")}`);
      }
    } else {
      lines.push(`- ${p.title} (${p.url})${annotation} — ${p.description}`);
    }
    lines.push("");
  }

  // Rules
  lines.push(`\n## Rules`);
  lines.push(`- **Anchor Text Fidelity**: The anchorText MUST be an EXACT word-for-word substring from the paragraph. No partial matches, no changed punctuation, no modifications.`);
  lines.push(`- **Semantic Accuracy**: The anchor text should logically lead to the "readerPromise" of the target page. Do not link just because a keyword matches; link because the reader at this point would want the value promised by the target.`);
  lines.push(`- **Anchor Length**: 3-12 words (shorter is fine if highly distinctive).`);
  lines.push(`- **No Generic Anchors**: Avoid phrases like "this article", "click here", "learn more".`);
  lines.push(`- **Placement**: Not in headings (lines starting with #), first paragraph [P1], or existing links.`);
  lines.push(`- **Limits**: Max 3 service page links per article. One link per unique target URL.`);
  lines.push(`- **Region match**: Prefer same region, but allow cross-border if relevant to expansion or travel.`);
  lines.push(`- **Confidence**: 0.75+ only.`);
  lines.push(`\nIn the 'semanticIntent' field, explain exactly how the anchor text relates to the target's Promise and why a reader would find it helpful here.`);
  lines.push(
    `\nUse the suggest_links tool to submit your suggestions.`
  );

  return lines.join("\n");
}
