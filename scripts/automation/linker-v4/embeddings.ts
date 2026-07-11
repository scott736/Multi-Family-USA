// ============================================
// Smart Linker v4 — OpenAI Embedding-Based Ranking
// ============================================
// Uses text-embedding-3-small for semantic page ranking.
// Replaces TF-IDF when an embedding index is available.
//
// Usage:
//   Index is built automatically at the end of build-catalog
//   (only when OPENAI_API_KEY is set).
//   Called by generate-api.ts to rank pages by embedding similarity.

import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import { computeContentHash, loadMarkdownFiles, parseBody, BLOG_DIR } from "./parse";
import type {
  EmbeddingIndex,
  EmbeddingEntry,
  RankedPage,
  RawPageData,
  LinkGraphData,
  FocusPagesConfig,
  FocusPageEntry,
} from "./types";

// ----------------
// Constants
// ----------------

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1024; // Matryoshka truncation for efficiency
const DATA_DIR = "src/data/linker-v4";
const INDEX_PATH = path.join(DATA_DIR, "embedding-index.json");
const GRAPH_PATH = path.join(DATA_DIR, "link-graph.json");
const FOCUS_PAGES_PATH = path.join(DATA_DIR, "focus-pages.json");
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// ----------------
// Cosine Similarity
// ----------------

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

// ----------------
// Strip Markdown for Embedding
// ----------------

function stripMarkdown(body: string): string {
  return body
    .replace(/^---[\s\S]*?---\n?/, "") // frontmatter
    .replace(/!\[.*?\]\(.*?\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links -> text
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/<[^>]+>/g, "") // HTML tags
    .replace(/#{1,6}\s/g, "") // heading markers
    .replace(/[*_~`]/g, ""); // emphasis markers
}

function extractFirstNWords(body: string, n: number): string {
  const stripped = stripMarkdown(body);
  const words = stripped.split(/\s+/).filter(Boolean);
  return words.slice(0, n).join(" ");
}

// ----------------
// Embed Helpers
// ----------------

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const isRateLimit =
        error instanceof Error && ("status" in error && (error as { status: number }).status === 429);
      const isLastAttempt = attempt === retries - 1;

      if (isLastAttempt || !isRateLimit) throw error;

      const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
      console.log(`  Rate limited, retrying in ${delay}ms (attempt ${attempt + 2}/${retries})...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Retry exhausted");
}

export async function embedText(client: OpenAI, text: string): Promise<number[]> {
  const response = await retryWithBackoff(() =>
    client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    })
  );
  return response.data[0].embedding;
}

export async function embedBatch(client: OpenAI, texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await retryWithBackoff(() =>
      client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
        dimensions: EMBEDDING_DIMENSIONS,
      })
    );

    // Sort by index to ensure correct ordering
    const sorted = response.data.sort((a, b) => a.index - b.index);
    for (const item of sorted) {
      allEmbeddings.push(item.embedding);
    }

    if (i + BATCH_SIZE < texts.length) {
      console.log(`  Embedded ${Math.min(i + BATCH_SIZE, texts.length)}/${texts.length} pages...`);
    }
  }

  return allEmbeddings;
}

// ----------------
// Load Embedding Index (memoized per process by file mtime+size)
// ----------------

let cachedIndex: { key: string; value: EmbeddingIndex } | null = null;

export async function loadEmbeddingIndex(): Promise<EmbeddingIndex | null> {
  try {
    const indexPath = path.resolve(INDEX_PATH);
    const stat = await fs.stat(indexPath);
    const key = `${stat.mtimeMs}:${stat.size}`;
    if (cachedIndex && cachedIndex.key === key) {
      return cachedIndex.value;
    }
    const data = await fs.readFile(indexPath, "utf-8");
    const value = JSON.parse(data) as EmbeddingIndex;
    cachedIndex = { key, value };
    return value;
  } catch {
    return null;
  }
}

// ----------------
// Build Embedding Index
// ----------------

export async function buildEmbeddingIndex(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.log("  Skipping embedding index build (no OPENAI_API_KEY)");
    return;
  }

  console.log("  Building embedding index...");

  // Load raw catalog
  const rawCatalogPath = path.resolve(DATA_DIR, "raw-catalog.json");
  let pages: RawPageData[];
  try {
    const catalog = JSON.parse(await fs.readFile(rawCatalogPath, "utf-8")) as {
      pages: RawPageData[];
    };
    pages = catalog.pages;
  } catch {
    console.error("  Raw catalog not found. Run build-catalog first.");
    return;
  }

  // Filter out queue articles and tooltip-only pages
  const indexablePages = pages.filter(
    (p) => p.type !== "queue" && !p.isTooltipOnly
  );
  console.log(`  Indexable pages: ${indexablePages.length}`);

  // Load blog post bodies for content
  const blogPosts = await loadMarkdownFiles(BLOG_DIR);
  const blogBodyMap = new Map<string, string>();
  for (const post of blogPosts) {
    blogBodyMap.set(post.slug, parseBody(post.rawContent));
  }

  // Load existing index for incremental updates
  let existingIndex: EmbeddingIndex | null = null;
  try {
    existingIndex = await loadEmbeddingIndex();
  } catch {
    // No existing index
  }

  const existingEntries = existingIndex?.entries || {};

  // Prepare texts and determine which pages need new embeddings
  const pagesToEmbed: { url: string; title: string; text: string; contentHash: string }[] = [];
  const unchangedEntries: Record<string, EmbeddingEntry> = {};

  for (const page of indexablePages) {
    const normalizedUrl = page.url.endsWith("/") ? page.url : page.url + "/";
    const titleText = `${page.title} ${page.title}`;
    const descText = page.description || "";

    let bodyText = "";
    const bodyContent = blogBodyMap.get(page.slug);
    if (bodyContent) {
      bodyText = extractFirstNWords(bodyContent, 500);
    }

    const fullText = `${titleText} ${descText} ${bodyText}`;
    const contentHash = computeContentHash(fullText);

    // Check if this page already has an up-to-date embedding
    const existing = existingEntries[normalizedUrl];
    if (existing && existing.contentHash === contentHash) {
      unchangedEntries[normalizedUrl] = existing;
    } else {
      pagesToEmbed.push({ url: normalizedUrl, title: page.title, text: fullText, contentHash });
    }
  }

  console.log(`  Unchanged (cached): ${Object.keys(unchangedEntries).length}`);
  console.log(`  Need embedding: ${pagesToEmbed.length}`);

  // Embed new/changed pages
  let newEntries: Record<string, EmbeddingEntry> = {};

  if (pagesToEmbed.length > 0) {
    const client = new OpenAI();
    const texts = pagesToEmbed.map((p) => p.text);

    console.log(`  Calling OpenAI API (${EMBEDDING_MODEL}, ${EMBEDDING_DIMENSIONS}d)...`);
    const embeddings = await embedBatch(client, texts);

    for (let i = 0; i < pagesToEmbed.length; i++) {
      const page = pagesToEmbed[i];
      newEntries[page.url] = {
        title: page.title,
        contentHash: page.contentHash,
        embedding: embeddings[i],
      };
    }
  }

  // Merge unchanged + new entries
  const allEntries: Record<string, EmbeddingEntry> = {
    ...unchangedEntries,
    ...newEntries,
  };

  // Build the index
  const index: EmbeddingIndex = {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    builtAt: new Date().toISOString(),
    entries: allEntries,
  };

  // Write to disk
  const indexPath = path.resolve(INDEX_PATH);
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(index));

  const fileSizeKB = Math.round((JSON.stringify(index).length / 1024) * 10) / 10;
  console.log(`  Embedding index: ${indexPath} (${fileSizeKB} KB)`);
  console.log(`  Documents indexed: ${Object.keys(allEntries).length}`);
}

// ----------------
// Rank Pages by Embedding
// ----------------

export async function rankPagesByEmbedding(
  articleTitle: string,
  articleBody: string,
  articleSlug: string,
  index: EmbeddingIndex,
  linkGraph?: LinkGraphData | null,
  focusPages?: FocusPageEntry[]
): Promise<RankedPage[]> {
  // Embed the article — reuse cached embedding if content hash matches
  const client = new OpenAI();
  const articleText = `${articleTitle} ${articleTitle} ${articleBody.slice(0, 3000)}`;
  const articleContentHash = computeContentHash(articleText);

  // Check if this article already has an up-to-date embedding in the index
  const normalizedArticleUrl = `/blog/${articleSlug}/`;
  const cachedEntry = index.entries[normalizedArticleUrl];
  let articleEmbedding: number[];

  if (cachedEntry && cachedEntry.contentHash === articleContentHash) {
    articleEmbedding = cachedEntry.embedding;
  } else {
    articleEmbedding = await embedText(client, articleText);
  }

  // Load raw catalog for page metadata
  const rawCatalogPath = path.resolve(DATA_DIR, "raw-catalog.json");
  let pageMap: Map<string, RawPageData>;
  try {
    const catalog = JSON.parse(await fs.readFile(rawCatalogPath, "utf-8")) as {
      pages: RawPageData[];
    };
    pageMap = new Map(catalog.pages.map((p) => [p.slug, p]));
  } catch {
    return [];
  }

  // Build lookup maps from link graph
  const orphanSet = new Set(linkGraph?.orphanPages || []);
  const overLinkedSet = new Set(linkGraph?.overLinkedPages || []);
  const focusPageUrls = new Set(
    (focusPages || []).map((p) => (p.url.endsWith("/") ? p.url : p.url + "/"))
  );

  // Load enriched catalog for purpose cards
  let enrichedMap = new Map<string, { readerPromise?: string; linkWhen?: string[]; doNotLinkWhen?: string[] }>();
  try {
    const enrichedPath = path.resolve(DATA_DIR, "page-catalog.json");
    const enrichedCatalog = JSON.parse(await fs.readFile(enrichedPath, "utf-8"));
    if (enrichedCatalog.pages) {
      for (const p of enrichedCatalog.pages) {
        enrichedMap.set(p.slug, {
          readerPromise: p.readerPromise,
          linkWhen: p.linkWhen,
          doNotLinkWhen: p.doNotLinkWhen,
        });
      }
    }
  } catch {
    // No enriched catalog
  }

  // Build URL-to-slug map from raw catalog
  const urlToSlug = new Map<string, string>();
  for (const [slug, page] of pageMap) {
    const normalizedUrl = page.url.endsWith("/") ? page.url : page.url + "/";
    urlToSlug.set(normalizedUrl, slug);
  }

  // Score each entry
  const scored: RankedPage[] = [];
  const pillarPages: RankedPage[] = [];

  for (const [url, entry] of Object.entries(index.entries)) {
    // Find the slug for this URL
    const slug = urlToSlug.get(url);
    if (!slug) continue;

    // Exclude the source article itself
    if (slug === articleSlug) continue;

    // Skip glossary/tooltip pages
    if (url.startsWith("/glossary/")) continue;

    const pageData = pageMap.get(slug);
    if (!pageData) continue;

    const similarity = cosineSimilarity(articleEmbedding, entry.embedding);

    // Apply graph + focus boosts (same logic as semantic-filter.ts)
    let graphBoost = 0;
    if (orphanSet.has(url)) graphBoost = Math.min(0.15, similarity * 0.5);
    if (overLinkedSet.has(url)) graphBoost = -Math.min(0.05, similarity * 0.2);
    if (focusPageUrls.has(url)) graphBoost += Math.min(0.1, similarity * 0.3);

    const finalScore = similarity + graphBoost;

    const enriched = enrichedMap.get(slug);

    const ranked: RankedPage = {
      slug,
      url,
      type: pageData.type,
      title: pageData.title,
      description: pageData.description,
      category: pageData.category,
      region: pageData.region,
      tags: pageData.tags || [],
      similarityScore: Math.round(similarity * 10000) / 10000,
      graphBoost,
      finalScore: Math.round(finalScore * 10000) / 10000,
      readerPromise: enriched?.readerPromise,
      linkWhen: enriched?.linkWhen,
      doNotLinkWhen: enriched?.doNotLinkWhen,
    };

    if (pageData.type === "pillar") {
      pillarPages.push(ranked);
    } else {
      scored.push(ranked);
    }
  }

  // Sort by finalScore descending
  scored.sort((a, b) => b.finalScore - a.finalScore);

  // Take top 40 non-pillar pages; only add pillars above relevance floor
  const PILLAR_RELEVANCE_FLOOR = 0.12;
  const topScored = scored.slice(0, 40);
  const resultSlugs = new Set(topScored.map((p) => p.slug));

  const relevantPillars = pillarPages.filter(
    (p) => !resultSlugs.has(p.slug) && p.finalScore >= PILLAR_RELEVANCE_FLOOR
  );
  const result = [...topScored, ...relevantPillars];

  result.sort((a, b) => b.finalScore - a.finalScore);

  return result;
}

// ----------------
// Anchor-Target Similarity
// ----------------

export async function computeAnchorTargetSimilarity(
  client: OpenAI,
  anchorText: string,
  targetPageEmbedding: number[]
): Promise<number> {
  const anchorEmbedding = await embedText(client, anchorText);
  return cosineSimilarity(anchorEmbedding, targetPageEmbedding);
}
