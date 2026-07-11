// ============================================
// Smart Linker v4 — API-Based Suggestion Generation
// ============================================
// Calls xAI Grok API directly (Haiku by default) to generate link suggestions.
// Supports concurrent batch processing and category-filtered catalogs.
//
// Usage:
//   npx tsx scripts/automation -f linker-v4 -m generate --all --use-api
//   npx tsx scripts/automation -f linker-v4 -m generate --slug my-article --use-api
//   npx tsx scripts/automation -f linker-v4 -m generate --all --use-api --concurrency 5
//   npx tsx scripts/automation -f linker-v4 -m generate --all --use-api --model haiku

import LlmClient from "../shared/llm";
import fs from "fs/promises";
import path from "path";
import type { CLIOptions } from "../types";
import { MODELS } from "../config";
import type { RawPageData, V3Suggestion, SuggestionFile, PageCatalog, PagePurpose, LinkGraphData, RankedPage, FocusPagesConfig, EmbeddingIndex, ValidatedLink, NumberedParagraph } from "./types";
import {
  loadMarkdownFiles,
  numberParagraphs,
  parseBody,
  computeContentHash,
  BLOG_DIR,
  QUEUE_DIR,
} from "./parse";
import { loadLinkGraph } from "./link-graph";
import { rankPagesByRelevance } from "./semantic-filter";
import { loadEmbeddingIndex, rankPagesByEmbedding } from "./embeddings";
import { CATEGORY_ADJACENCY, filterCatalogByCategory, extractExistingInternalLinks, loadMergedCatalog, type FilteredPage } from "./catalog-utils";
import { buildAnchorDiversityIndex, formatAnchorDistributionForPrompt, type AnchorDiversityIndex } from "./anchor-intelligence";
import { getHubAndSpokePromptNote } from "./cluster-enforcement";
import { resolveAnchorText } from "./anchor-extract";

// ----------------
// Constants
// ----------------

const DATA_DIR = "src/data/linker-v4";
const SUGGESTIONS_DIR = "src/data/linker-v4/suggestions";
const DEFAULT_CONCURRENCY = 3;

/** Score blend weights used when combining embedding similarity, TF-IDF similarity, and PageRank. */
const RANK_WEIGHT_EMBEDDING = 0.6;
const RANK_WEIGHT_TFIDF = 0.3;
const RANK_WEIGHT_PAGERANK = 0.1;

/** Fallback weights applied when no embedding index is available. */
const FALLBACK_WEIGHT_TFIDF = 0.8;
const FALLBACK_WEIGHT_PAGERANK = 0.2;

/** Top-K pages sent to the LLM after score blending. */
const RANK_TOP_N = 40;

/** Baseline number of links we target per article. The rerank pass clamps to this. */
const TARGET_LINK_COUNT = 6;
/** Rerank pass activates only when the validator accepts more than TARGET_LINK_COUNT + RERANK_TRIGGER_MARGIN. */
const RERANK_TRIGGER_MARGIN = 2;
/** How many of the top-confidence accepted links to submit to the rerank LLM. */
const RERANK_CANDIDATE_MARGIN = 3;

const MODEL_MAP: Record<string, string> = {
  sonnet: "grok-4.5",
  haiku: "grok-4.5",
  opus: "grok-4.5",
};

// ----------------
// Main Function
// ----------------

export async function generateViaApi(options: CLIOptions): Promise<void> {
  const { slug, all, dryRun } = options;
  const concurrency = options.concurrency || DEFAULT_CONCURRENCY;
  const modelKey = options.model || "haiku";
  const modelId = MODEL_MAP[modelKey] || MODELS.ANALYSIS;

  if (process.env.GITHUB_ACTIONS !== "true") {
    console.error(
      "generate --use-api is only allowed in GitHub Actions (new published posts).\n" +
        "  Local: npx tsx scripts/automation -f linker-v4 -m relink-local\n" +
        "  Or:    npx tsx scripts/automation -f linker-v4 -m generate --all"
    );
    return;
  }

  if (!process.env.XAI_API_KEY) {
    console.error("XAI_API_KEY environment variable required.");
    return;
  }

  console.log("Generating link suggestions via xAI Grok API...\n");
  console.log(`  Model: ${modelId}`);
  console.log(`  Concurrency: ${concurrency}`);
  console.log(`  Mode: ${dryRun ? "dry-run" : "write suggestions"}\n`);

  // Load merged catalog (raw pages + enriched purpose cards)
  let catalogPages: (PagePurpose | RawPageData)[];
  try {
    const merged = await loadMergedCatalog();
    catalogPages = merged.pages;
  } catch {
    console.error(
      "Catalog not found. Run build-catalog first:\n" +
        "  npx tsx scripts/automation -f linker-v4 -m build-catalog"
    );
    return;
  }
  console.log(`  Merged catalog: ${catalogPages.length} pages`);

  // Only published pages as link targets (never queue articles)
  const publishedPages = catalogPages.filter((p) => p.type !== "queue");

  // Load blog posts (and optionally queue articles as sources)
  const blogPosts = await loadMarkdownFiles(BLOG_DIR);
  const queueArticles = await loadMarkdownFiles(QUEUE_DIR);
  const allArticles = [...blogPosts, ...queueArticles];

  // Determine which articles to process
  let articlesToProcess = allArticles;
  if (slug) {
    articlesToProcess = allArticles.filter((a) => a.slug === slug);
    if (articlesToProcess.length === 0) {
      console.error(`Article not found: ${slug}`);
      return;
    }
  } else if (!all) {
    console.error("Please specify --slug or --all");
    return;
  }

  // Skip articles that already have suggestion files (unless --slug is specified)
  const suggestionsDir = path.resolve(SUGGESTIONS_DIR);
  await fs.mkdir(suggestionsDir, { recursive: true });

  if (!slug && !options.force) {
    const existingFiles = (await fs.readdir(suggestionsDir))
      .filter((f) => f.endsWith(".json"));
    const existingSlugs = new Set(existingFiles.map((f) => f.replace(".json", "")));

    // Parallel-read all suggestion files and build slug → sourceContentHash map
    const existingHashes = new Map<string, string>();
    const parsed = await Promise.all(
      existingFiles.map(async (file) => {
        try {
          const sf: SuggestionFile = JSON.parse(
            await fs.readFile(path.join(suggestionsDir, file), "utf-8")
          );
          return sf;
        } catch {
          return null;
        }
      })
    );
    for (const sf of parsed) {
      if (sf?.sourceContentHash) {
        existingHashes.set(sf.sourceSlug, sf.sourceContentHash);
      }
    }

    const before = articlesToProcess.length;
    let skippedExisting = 0;
    let skippedUnchanged = 0;

    articlesToProcess = articlesToProcess.filter((a) => {
      if (!existingSlugs.has(a.slug)) return true; // No suggestion file — process it

      // Check content hash: skip if article body is unchanged
      const existingHash = existingHashes.get(a.slug);
      if (existingHash) {
        const body = parseBody(a.rawContent);
        const currentHash = computeContentHash(body);
        if (currentHash === existingHash) {
          skippedUnchanged++;
          return false;
        }
      }

      // Has a suggestion file but content changed — skip (already processed)
      skippedExisting++;
      return false;
    });

    if (skippedUnchanged > 0) {
      console.log(`  Skipping ${skippedUnchanged} unchanged articles (content hash match)`);
    }
    if (skippedExisting > 0) {
      console.log(`  Skipping ${skippedExisting} articles with existing suggestions`);
    }
  }

  // Load link graph for orphan/well-linked annotations
  const linkGraph = await loadLinkGraph();
  if (linkGraph) {
    console.log(`  Link graph loaded: ${linkGraph.totalNodes} nodes, ${linkGraph.totalEdges} edges`);
  }

  // Load embedding index if available
  const embeddingIndex = await loadEmbeddingIndex();
  if (embeddingIndex) {
    console.log(`  Embedding index loaded: ${Object.keys(embeddingIndex.entries).length} entries (${embeddingIndex.model}, ${embeddingIndex.dimensions}d)`);
  }

  // Load focus pages for priority annotations
  let focusPageUrls = new Set<string>();
  let focusPageEntries: FocusPagesConfig["pages"] | undefined;
  try {
    const focusConfig: FocusPagesConfig = JSON.parse(
      await fs.readFile(path.resolve("src/data/linker-v4/focus-pages.json"), "utf-8")
    );
    focusPageUrls = new Set(focusConfig.pages.map((p) => p.url.endsWith("/") ? p.url : p.url + "/"));
    focusPageEntries = focusConfig.pages;
    console.log(`  Focus pages loaded: ${focusPageUrls.size} targets`);
  } catch {
    // No focus pages config
  }

  // Build anchor diversity index for prompt enrichment
  const anchorIndex = await buildAnchorDiversityIndex();
  const anchorIndexSize = Object.keys(anchorIndex).length;
  if (anchorIndexSize > 0) {
    console.log(`  Anchor diversity index: ${anchorIndexSize} target URLs tracked`);
  }

  console.log(`  Articles to process: ${articlesToProcess.length}`);
  console.log(`  Published pages in catalog: ${publishedPages.length}\n`);

  if (articlesToProcess.length === 0) {
    console.log("Nothing to process.");
    return;
  }

  const client = new LlmClient();

  let totalSuggestions = 0;
  let totalProcessed = 0;
  let totalErrors = 0;

  // Process in concurrent batches
  for (let i = 0; i < articlesToProcess.length; i += concurrency) {
    const batch = articlesToProcess.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map((article) =>
        processArticle(client, article, publishedPages, modelId, dryRun, linkGraph, focusPageUrls, embeddingIndex, anchorIndex, focusPageEntries, { verbose: options.verbose })
      )
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const article = batch[j];
      const progress = `[${i + j + 1}/${articlesToProcess.length}]`;

      if (result.status === "fulfilled") {
        const { suggestions, catalogSize } = result.value;
        totalSuggestions += suggestions.length;
        totalProcessed++;
        console.log(
          `  ${progress} ${article.slug}: ${suggestions.length} suggestions (${catalogSize} pages in catalog)`
        );

        if (dryRun && suggestions.length > 0) {
          for (const s of suggestions) {
            console.log(`    "${s.anchorText}" → ${s.targetUrl}`);
          }
        }
      } else {
        totalErrors++;
        console.error(`  ${progress} ${article.slug}: ERROR - ${result.reason}`);
      }
    }
  }

  console.log(`\nGeneration complete:`);
  console.log(`  Processed: ${totalProcessed}`);
  console.log(`  Total suggestions: ${totalSuggestions}`);
  if (totalErrors > 0) console.log(`  Errors: ${totalErrors}`);

  if (!dryRun && totalSuggestions > 0) {
    console.log(`\nNext: Run validate and apply:`);
    console.log(
      `  npx tsx scripts/automation -f linker-v4 -m validate --all`
    );
    console.log(
      `  npx tsx scripts/automation -f linker-v4 -m apply --all --dry-run`
    );
  }
}

// ----------------
// PageRank Blending
// ----------------

type PageRankMap = { values: Map<string, number>; max: number };

function buildPageRankMap(linkGraph?: LinkGraphData | null): PageRankMap {
  const values = new Map<string, number>();
  let max = 0;
  if (!linkGraph) return { values, max };
  for (const node of Object.values(linkGraph.nodes)) {
    const pr = node.pageRank;
    if (typeof pr === "number" && pr > 0) {
      const normalized = node.url.endsWith("/") ? node.url : node.url + "/";
      values.set(normalized, pr);
      if (pr > max) max = pr;
    }
  }
  return { values, max };
}

function normalizedPageRankFor(url: string, map: PageRankMap): number {
  if (map.max <= 0) return 0;
  const normalized = url.endsWith("/") ? url : url + "/";
  const raw = map.values.get(normalized) ?? 0;
  return raw / map.max;
}

function blendPageRankIntoRanking(
  ranked: RankedPage[],
  pageRankMap: PageRankMap,
  tfidfBySlug: Map<string, number>,
  mode: "embedding" | "fallback",
  verbose?: boolean
): FilteredPage[] {
  const hasPageRank = pageRankMap.max > 0;

  const rescored = ranked.map((r) => {
    const pr = normalizedPageRankFor(r.url, pageRankMap);
    const tfidfComponent = tfidfBySlug.get(r.slug) ?? r.similarityScore;
    let blended: number;
    if (mode === "embedding") {
      const embeddingComponent = r.similarityScore;
      blended =
        embeddingComponent * RANK_WEIGHT_EMBEDDING +
        tfidfComponent * RANK_WEIGHT_TFIDF +
        pr * RANK_WEIGHT_PAGERANK +
        r.graphBoost;
    } else {
      blended =
        r.similarityScore * FALLBACK_WEIGHT_TFIDF +
        pr * FALLBACK_WEIGHT_PAGERANK +
        r.graphBoost;
    }
    return { ranked: r, pr, blended };
  });

  rescored.sort((a, b) => b.blended - a.blended);

  if (verbose && hasPageRank) {
    const top = rescored.slice(0, 3);
    const contributionLog = top
      .map(
        (e) =>
          `${e.ranked.url} sim=${e.ranked.similarityScore.toFixed(3)} pr=${e.pr.toFixed(3)} blended=${e.blended.toFixed(3)}`
      )
      .join(" | ");
    console.log(`    [rank/${mode}] ${contributionLog}`);
  }

  return rescored.slice(0, RANK_TOP_N).map(({ ranked: r }) => ({
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
}

// ----------------
// Single Article Processing
// ----------------

interface ProcessResult {
  suggestions: V3Suggestion[];
  catalogSize: number;
}

async function processArticle(
  client: LlmClient,
  article: Awaited<ReturnType<typeof loadMarkdownFiles>>[0],
  publishedPages: (PagePurpose | RawPageData)[],
  modelId: string,
  dryRun?: boolean,
  linkGraph?: LinkGraphData | null,
  focusPageUrls?: Set<string>,
  embeddingIndex?: EmbeddingIndex | null,
  anchorIndex?: AnchorDiversityIndex,
  focusPageEntries?: FocusPagesConfig["pages"],
  options?: { verbose?: boolean }
): Promise<ProcessResult> {
  const body = parseBody(article.rawContent);
  const articleTitle = String(article.frontmatter.title || article.slug);

  const pageRankMap = buildPageRankMap(linkGraph);

  // Always compute TF-IDF rankings for proper score blending
  const tfidfResults = await rankPagesByRelevance(body, articleTitle, article.slug, 80);
  const tfidfBySlug = new Map(tfidfResults.map((r) => [r.slug, r.similarityScore]));

  let filteredCatalog: FilteredPage[];
  let rankingMethod: "embedding" | "tf-idf" | "category-filter" = "category-filter";

  if (embeddingIndex && Object.keys(embeddingIndex.entries).length > 0) {
    const embeddingResults = await rankPagesByEmbedding(
      articleTitle, body, article.slug, embeddingIndex, linkGraph, focusPageEntries
    );
    if (embeddingResults.length > 0) {
      filteredCatalog = blendPageRankIntoRanking(
        embeddingResults, pageRankMap, tfidfBySlug, "embedding", options?.verbose
      );
      rankingMethod = "embedding";
    } else if (tfidfResults.length > 0) {
      filteredCatalog = blendPageRankIntoRanking(
        tfidfResults, pageRankMap, tfidfBySlug, "fallback", options?.verbose
      );
      rankingMethod = "tf-idf";
    } else {
      const category = String(article.frontmatter.category || "investing-fundamentals");
      filteredCatalog = filterCatalogByCategory(publishedPages, category, article.slug);
    }
  } else {
    if (tfidfResults.length > 0) {
      filteredCatalog = blendPageRankIntoRanking(
        tfidfResults, pageRankMap, tfidfBySlug, "fallback", options?.verbose
      );
      rankingMethod = "tf-idf";
    } else {
      const category = String(article.frontmatter.category || "investing-fundamentals");
      filteredCatalog = filterCatalogByCategory(publishedPages, category, article.slug);
    }
  }
  void rankingMethod;
  const paragraphs = numberParagraphs(body);
  const wordCount = body.split(/\s+/).filter(Boolean).length;

  // Find existing internal links (markdown + HTML + absolute multifamily-usa.com URLs)
  const existingLinks = extractExistingInternalLinks(body);

  // Subtract existing links from target count
  const targetLinks = Math.max(0, Math.min(Math.max(3, Math.round(wordCount / 200)), 10) - existingLinks.size);

  // Skip API call if article already has enough links
  if (targetLinks === 0) {
    return { suggestions: [], catalogSize: filteredCatalog.length };
  }

  const prompt = buildGeneratePrompt(
    article,
    paragraphs,
    filteredCatalog,
    targetLinks,
    existingLinks,
    linkGraph,
    focusPageUrls,
    anchorIndex
  );

  const response = await client.messages.create({
    model: modelId,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
    tools: [
      {
        name: "suggest_links",
        description:
          "Submit internal link suggestions for this article. Only suggest links to published pages.",
        input_schema: {
          type: "object" as const,
          properties: {
            links: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  paragraphIndex: {
                    type: "number",
                    description: "The [P#] paragraph number from the article",
                  },
                  anchorText: {
                    type: "string",
                    description:
                      "Optional hint — the system extracts the exact 3-12 word substring automatically",
                  },
                  targetUrl: {
                    type: "string",
                    description: "URL of the target page from the catalog",
                  },
                  readerNeed: {
                    type: "string",
                    description:
                      "Why the reader needs this link at this point",
                  },
                  expectation: {
                    type: "string",
                    description: "What the reader expects to find on click",
                  },
                  confidence: {
                    type: "number",
                    description: "0.0-1.0 confidence score (only 0.75+)",
                  },
                },
                required: [
                  "paragraphIndex",
                  "targetUrl",
                  "readerNeed",
                  "expectation",
                  "confidence",
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

  // Extract tool use result
  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { suggestions: [], catalogSize: filteredCatalog.length };
  }

  const input = toolUse.input as { links: V3Suggestion[] };
  const catalogByUrl = new Map(
    filteredCatalog.map((p) => [p.url.replace(/\/$/, ""), p])
  );

  const rawSuggestions = (input.links || []).filter(
    (s) =>
      !existingLinks.has(s.targetUrl.replace(/\/$/, "")) &&
      !s.targetUrl.includes("book-strategy-call")
  );

  // v5: deterministic anchor extraction per suggestion
  const suggestions: V3Suggestion[] = [];
  for (const s of rawSuggestions) {
    const para = paragraphs.find((p) => p.index === s.paragraphIndex);
    const normalizedTarget = s.targetUrl.replace(/\/$/, "");
    const target = catalogByUrl.get(normalizedTarget);
    if (!para || !target) continue;

    const anchor = resolveAnchorText(
      para.text,
      {
        title: target.title,
        description: target.description,
        tags: target.tags,
        url: target.url,
      },
      s.anchorText
    );
    if (!anchor) continue;

    suggestions.push({ ...s, anchorText: anchor });
  }

  // Write suggestion file
  if (!dryRun && suggestions.length > 0) {
    const suggestionFile: SuggestionFile = {
      sourceSlug: article.slug,
      sourceContentHash: computeContentHash(body),
      generatedAt: new Date().toISOString(),
      model: modelId,
      catalogSize: filteredCatalog.length,
      raw: suggestions,
      validated: [],
    };

    const outputPath = path.join(
      path.resolve(SUGGESTIONS_DIR),
      `${article.slug}.json`
    );
    await fs.writeFile(outputPath, JSON.stringify(suggestionFile, null, 2));
  }

  return { suggestions, catalogSize: filteredCatalog.length };
}

// ----------------
// Prompt Builder
// ----------------

function buildGeneratePrompt(
  post: Awaited<ReturnType<typeof loadMarkdownFiles>>[0],
  paragraphs: ReturnType<typeof numberParagraphs>,
  catalog: FilteredPage[],
  targetLinks: number,
  existingLinks: Set<string>,
  linkGraph?: LinkGraphData | null,
  focusPageUrls?: Set<string>,
  anchorIndex?: AnchorDiversityIndex
): string {
  const fm = post.frontmatter;
  const lines: string[] = [];

  lines.push(
    "You are an expert content editor for Multi-Family USA, a real estate investment mortgage broker."
  );
  lines.push(
    `Identify **${targetLinks}** places where a reader would genuinely benefit from a link to another page on this site.\n`
  );

  // How to think about linking
  lines.push("## How to Think About This\n");
  lines.push(
    "Read each paragraph and ask: **What is the reader thinking right now? Is there a moment where they'd want to go deeper?**\n"
  );
  lines.push("**A GOOD link:**");
  lines.push("- The paragraph discusses a topic another page covers in depth");
  lines.push(
    '- The reader would naturally think "tell me more about this"'
  );
  lines.push(
    "- The anchor text accurately describes what they'll find on click\n"
  );
  lines.push("**A BAD link:**");
  lines.push("- Forcing a connection between vaguely related topics");
  lines.push("- Generic phrase that could link to many different pages");
  lines.push("- Mid-clause fragments like \"the mortgage and\" or \"a property financed at\"");
  lines.push("- Anchors under 5 words or that start/end with function words (the, and, with, for)");
  lines.push(
    "- Reader is mid-thought and wouldn't want to navigate away\n"
  );

  // Few-shot examples
  lines.push("## Example Suggestion\n");
  lines.push("Here is what a GOOD suggestion looks like:");
  lines.push('- Paragraph mentions "qualifying for a DSCR loan requires meeting specific debt coverage thresholds"');
  lines.push('- Anchor: "qualifying for a DSCR loan requires meeting specific debt coverage thresholds"');
  lines.push("- Target: /blog/what-is-dscr-and-how-is-it-calculated/");
  lines.push("- Why: Reader is learning about DSCR qualification and would want to understand the calculation\n");
  lines.push("Here is a BAD suggestion:");
  lines.push('- Paragraph mentions "many investors explore different strategies"');
  lines.push('- Anchor: "different strategies" (too vague, only 2 words)');
  lines.push("- Target: /blog/scaling-your-portfolio/ (weak semantic connection)\n");

  // Article metadata
  lines.push(`## Article: ${fm.title}\n`);
  lines.push(`Category: ${fm.category}, Region: ${fm.region || "canada"}`);
  lines.push(`Tags: ${(fm.tags as string[])?.join(", ") || "none"}\n`);

  // Hub-and-spoke enforcement: inject a note if article is missing its pillar link
  const category = String(fm.category || "");
  const body = paragraphs.map((p) => p.text).join("\n\n");
  const hubSpokeNote = getHubAndSpokePromptNote(post.slug, category, body, linkGraph || null);
  if (hubSpokeNote) {
    lines.push(hubSpokeNote);
  }

  const bucketsByIndex = computePositionBuckets(paragraphs);
  for (const p of paragraphs) {
    const bucket = bucketsByIndex.get(p.index);
    const bucketTag = bucket ? ` [${bucket}]` : "";
    if (p.isContent) {
      lines.push(`[P${p.index}]${bucketTag} ${p.text}\n`);
    } else {
      lines.push(`[P${p.index} — skip] ${p.text}\n`);
    }
  }

  // Existing links
  if (existingLinks.size > 0) {
    lines.push(`\n## Existing Links (do NOT suggest these)\n`);
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
  lines.push(`\n## Available Pages (${catalog.length} pages)\n`);
  for (const p of catalog) {
    // Normalize URL for graph lookup
    const normalizedUrl = p.url.endsWith("/") ? p.url : p.url + "/";
    let annotation = "";
    if (focusPageUrls?.has(normalizedUrl)) {
      annotation = " [FOCUS PAGE - prioritize]";
    } else if (orphanSet.has(normalizedUrl)) {
      annotation = " [ORPHAN PAGE - prioritize]";
    } else if (wellLinkedSet.has(normalizedUrl)) {
      annotation = " [well-linked - lower priority]";
    }

    lines.push(`### ${p.title} (${p.url})${annotation}`);
    if (p.readerPromise) {
      lines.push(`- **Promise**: ${p.readerPromise}`);
      lines.push(`- **Link When**: ${p.linkWhen?.join(", ")}`);
      if (p.doNotLinkWhen && p.doNotLinkWhen.length > 0) {
        lines.push(`- **Do Not Link When**: ${p.doNotLinkWhen.join(", ")}`);
      }
    } else {
      lines.push(`- **Description**: ${p.description}`);
    }
    lines.push(`- **Region**: ${p.region}, **Tags**: ${p.tags?.join(", ") || "none"}`);
    // Append anchor diversity info if available
    if (anchorIndex) {
      const anchorInfo = formatAnchorDistributionForPrompt(p.url, anchorIndex);
      if (anchorInfo) {
        lines.push(`- ${anchorInfo}`);
      }
    }
    lines.push("");
  }

  // Rules
  lines.push(`\n## Rules\n`);
  lines.push(
    "1. **Do NOT suggest links to /book-strategy-call/** — CTAs are handled separately"
  );
  lines.push(
    "2. Pick the right **paragraph** and **target URL** — anchor text is extracted automatically (5–14 word descriptive phrase, never mid-clause fragments)"
  );
  lines.push(
    '3. **NO generic topics**: "real estate investors", "investment property", "financing options", "click here", "learn more"'
  );
  lines.push(
    "4. **NOT in**: headings, first paragraph, blockquotes, existing links, HTML/CTA elements, FAQ sections, paragraphs marked *skip*"
  );
  lines.push("5. **Maximum 3** service/pillar page links per article");
  lines.push("6. **One link** per target URL");
  lines.push("7. **Spread** links across the article — not clustered in one section");
  lines.push(
    "8. **Region match**: Prefer same-region pages; cross-border links OK when article discusses US/Mexico investing"
  );
  lines.push("9. **Confidence 0.75+ only**");
  lines.push("10. **Only link to pages in the catalog above** — never invent URLs");
  lines.push(
    "11. **Anchor diversity**: If a page shows [EXISTING ANCHORS], choose a different paragraph/angle"
  );
  lines.push(
    "12. **Position preference**: Prefer INTRO and early BODY when reader-need is strongest"
  );
  lines.push(
    `\nUse the suggest_links tool to submit your suggestions.`
  );

  return lines.join("\n");
}

// ----------------
// Single-Article Helper (for publish workflow)
// ----------------

/**
 * Generate, validate, and apply links for a single article.
 * Used by the publish workflow to auto-link newly published articles.
 */
export async function autoLinkArticle(
  slug: string,
  dryRun?: boolean,
  opts?: { rerank?: boolean; verbose?: boolean }
): Promise<{ applied: number; suggestions: number }> {
  if (!process.env.XAI_API_KEY) {
    console.log(
      "  Skipping auto-link: XAI_API_KEY not set"
    );
    return { applied: 0, suggestions: 0 };
  }

  const { pages: catalogPages } = await loadMergedCatalog();
  const publishedPages = catalogPages.filter((p) => p.type !== "queue");

  // Load the specific article
  const blogPosts = await loadMarkdownFiles(BLOG_DIR);
  const article = blogPosts.find((a) => a.slug === slug);
  if (!article) {
    console.log(`  Skipping auto-link: article ${slug} not found in blog`);
    return { applied: 0, suggestions: 0 };
  }

  const client = new LlmClient();
  const modelId = MODELS.ANALYSIS; // Haiku for speed

  // Load link graph for annotations
  const autoLinkGraph = await loadLinkGraph();

  // Load focus pages
  let autoFocusUrls = new Set<string>();
  try {
    const fc: FocusPagesConfig = JSON.parse(
      await fs.readFile(path.resolve("src/data/linker-v4/focus-pages.json"), "utf-8")
    );
    autoFocusUrls = new Set(fc.pages.map((p) => p.url.endsWith("/") ? p.url : p.url + "/"));
  } catch { /* no focus config */ }

  // Load embedding index if available
  const autoEmbeddingIndex = await loadEmbeddingIndex();

  console.log(`  Auto-linking: ${slug} (model: ${modelId})`);

  const result = await processArticle(
    client,
    article,
    publishedPages,
    modelId,
    false, // always write the suggestion file
    autoLinkGraph,
    autoFocusUrls,
    autoEmbeddingIndex,
    undefined,
    undefined,
    { verbose: opts?.verbose }
  );

  if (result.suggestions.length === 0) {
    console.log("  Auto-link: no suggestions generated");
    return { applied: 0, suggestions: 0 };
  }

  console.log(
    `  Auto-link: ${result.suggestions.length} suggestions generated`
  );

  // Validate
  const { validateSuggestions } = await import("./validate");
  await validateSuggestions({ slug, all: false });

  // LLM rerank pass (default on, disable with --no-rerank)
  const rerankEnabled = opts?.rerank !== false;
  if (rerankEnabled) {
    await rerankValidatedSuggestionFile(client, modelId, slug, article, opts?.verbose);
  }

  // Apply (respect dry-run)
  if (!dryRun) {
    const { applyLinks } = await import("./apply");
    await applyLinks({ slug, all: false });
  }

  // Read back the suggestion file to count applied
  const suggestionPath = path.join(
    path.resolve(SUGGESTIONS_DIR),
    `${slug}.json`
  );
  try {
    const sf: SuggestionFile = JSON.parse(
      await fs.readFile(suggestionPath, "utf-8")
    );
    const passed = (sf.validated || []).filter((v) => v.passed).length;
    return { applied: passed, suggestions: result.suggestions.length };
  } catch {
    return { applied: 0, suggestions: result.suggestions.length };
  }
}

// ----------------
// Position Buckets
// ----------------

function computePositionBuckets(
  paragraphs: NumberedParagraph[]
): Map<number, "INTRO" | "BODY" | "CONCLUSION"> {
  const contentParagraphs = paragraphs.filter((p) => p.isContent);
  const result = new Map<number, "INTRO" | "BODY" | "CONCLUSION">();
  const total = contentParagraphs.length;
  if (total === 0) return result;

  const introCutoff = Math.max(1, Math.floor(total * 0.25));
  const conclusionStart = total - Math.max(1, Math.floor(total * 0.25));

  contentParagraphs.forEach((p, i) => {
    if (i < introCutoff) {
      result.set(p.index, "INTRO");
    } else if (i >= conclusionStart) {
      result.set(p.index, "CONCLUSION");
    } else {
      result.set(p.index, "BODY");
    }
  });

  return result;
}

// ----------------
// LLM Rerank Pass
// ----------------

interface RerankInput {
  kept_indices: number[];
  rejected_indices: number[];
  reasoning: string;
}

export async function rerankValidatedSuggestionFile(
  client: LlmClient,
  modelId: string,
  slug: string,
  article: Awaited<ReturnType<typeof loadMarkdownFiles>>[0],
  verbose?: boolean
): Promise<void> {
  const suggestionPath = path.join(path.resolve(SUGGESTIONS_DIR), `${slug}.json`);

  let suggestionFile: SuggestionFile;
  try {
    suggestionFile = JSON.parse(await fs.readFile(suggestionPath, "utf-8"));
  } catch {
    return;
  }

  const validated = suggestionFile.validated || [];
  const accepted = validated.filter((v) => v.passed);

  if (accepted.length <= TARGET_LINK_COUNT + RERANK_TRIGGER_MARGIN) {
    return;
  }

  const byConfidence = [...accepted].sort(
    (a, b) => (b.suggestion.confidence || 0) - (a.suggestion.confidence || 0)
  );
  const candidates = byConfidence.slice(0, TARGET_LINK_COUNT + RERANK_CANDIDATE_MARGIN);
  const keepCount = TARGET_LINK_COUNT;

  const body = parseBody(article.rawContent);
  const articleTitle = String(article.frontmatter.title || slug);

  const candidateBlock = candidates
    .map((c, i) => {
      const s = c.suggestion;
      return [
        `[${i}] confidence=${s.confidence.toFixed(2)}`,
        `  anchor: "${s.anchorText}"`,
        `  target: ${s.targetUrl}`,
        `  reader need: ${s.readerNeed}`,
        `  expectation: ${s.expectation}`,
      ].join("\n");
    })
    .join("\n\n");

  const prompt = [
    "You previously suggested these internal links for this article. Now pick the strongest subset.",
    "Judge each on: reader value, anchor naturalness, and spread across the article (avoid clustering).",
    "",
    `Article title: ${articleTitle}`,
    `Article excerpt: ${body.slice(0, 800)}${body.length > 800 ? "…" : ""}`,
    "",
    `Candidate links (${candidates.length}):`,
    candidateBlock,
    "",
    `Keep exactly ${keepCount} indices. Reject the rest. Use the rerank_links tool.`,
  ].join("\n");

  let rerankResult: RerankInput | null = null;

  try {
    const response = await client.messages.create({
      model: modelId,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          name: "rerank_links",
          description:
            "Return the final kept vs rejected set from a candidate list of link suggestions.",
          input_schema: {
            type: "object" as const,
            properties: {
              kept_indices: {
                type: "array",
                items: { type: "number" },
                description: "Indices of candidates to keep.",
              },
              rejected_indices: {
                type: "array",
                items: { type: "number" },
                description: "Indices of candidates to reject.",
              },
              reasoning: {
                type: "string",
                description: "One-to-two sentence rationale for the selection.",
              },
            },
            required: ["kept_indices", "rejected_indices", "reasoning"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "rerank_links" },
    });

    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (toolUse && toolUse.type === "tool_use") {
      rerankResult = toolUse.input as RerankInput;
    }
  } catch (err) {
    console.warn(
      `  Rerank failed for ${slug} (${err instanceof Error ? err.message : String(err)}); keeping pre-rerank result.`
    );
    return;
  }

  if (!rerankResult) {
    console.warn(`  Rerank produced no tool_use for ${slug}; keeping pre-rerank result.`);
    return;
  }

  const kept = new Set<number>(
    (rerankResult.kept_indices || []).filter((i) => i >= 0 && i < candidates.length)
  );
  const candidateSet = new Set(candidates);

  const updated = validated.map((v) => {
    if (!v.passed) return v;
    if (!candidateSet.has(v)) return v;
    const candidateIndex = candidates.indexOf(v);
    if (kept.has(candidateIndex)) return v;
    return {
      ...v,
      passed: false,
      rejectionReason: "llm-rerank",
    };
  });

  suggestionFile.validated = updated;
  await fs.writeFile(suggestionPath, JSON.stringify(suggestionFile, null, 2));

  if (verbose) {
    console.log(
      `  Rerank ${slug}: kept ${kept.size}/${candidates.length}. ${rerankResult.reasoning}`
    );
  } else {
    console.log(`  Rerank ${slug}: kept ${kept.size}/${candidates.length}`);
  }
}

/**
 * Run LLM rerank pass on all suggestion files with excess accepted links.
 */
export async function rerankAllValidatedSuggestions(
  options: { verbose?: boolean; model?: string } = {}
): Promise<void> {
  if (!process.env.XAI_API_KEY) {
    console.log("  Skipping rerank: XAI_API_KEY not set");
    return;
  }

  const modelKey = options.model || "haiku";
  const modelId = MODEL_MAP[modelKey] || MODELS.ANALYSIS;
  const client = new LlmClient();
  const blogPosts = await loadMarkdownFiles(BLOG_DIR);
  const suggestionsDir = path.resolve(SUGGESTIONS_DIR);
  const files = (await fs.readdir(suggestionsDir)).filter((f) => f.endsWith(".json"));

  console.log(`\nReranking ${files.length} suggestion files (model: ${modelId})...\n`);

  for (const file of files) {
    const slug = file.replace(".json", "");
    const article = blogPosts.find((a) => a.slug === slug);
    if (!article) continue;
    await rerankValidatedSuggestionFile(client, modelId, slug, article, options.verbose);
  }
}
