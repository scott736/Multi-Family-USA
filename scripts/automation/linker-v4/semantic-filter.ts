// ============================================
// Smart Linker v4 — Semantic Pre-Filtering
// ============================================
// Local TF-IDF implementation for ranking pages by relevance.
// No external API calls — runs entirely on local data.
//
// Usage:
//   Built automatically at the end of build-catalog.
//   Called by generate-api.ts and audit.ts to filter catalog pages.

import fs from "fs/promises";
import path from "path";
import { loadMarkdownFiles, parseBody, BLOG_DIR } from "./parse";
import type { TermVector, SemanticIndexEntry, SemanticIndex, RankedPage, LinkGraphData, RawPageData, FocusPagesConfig } from "./types";

// ----------------
// Constants
// ----------------

const DATA_DIR = "src/data/linker-v4";
const INDEX_PATH = path.join(DATA_DIR, "semantic-index.json");
const GRAPH_PATH = path.join(DATA_DIR, "link-graph.json");
const FOCUS_PAGES_PATH = path.join(DATA_DIR, "focus-pages.json");
const TOP_TERMS_PER_ENTRY = 50;

// ----------------
// Stop Words
// ----------------

export const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "also", "am",
  "an", "and", "any", "are", "aren", "arent", "as", "at", "be", "because",
  "been", "before", "being", "below", "between", "both", "but", "by", "can",
  "could", "couldn", "couldnt", "did", "didn", "didnt", "do", "does",
  "doesn", "doesnt", "doing", "don", "dont", "down", "during", "each",
  "even", "every", "few", "for", "from", "further", "get", "gets", "got",
  "had", "hadn", "hadnt", "has", "hasn", "hasnt", "have", "haven", "havent",
  "having", "he", "her", "here", "hers", "herself", "him", "himself", "his",
  "how", "however", "if", "in", "into", "is", "isn", "isnt", "it", "its",
  "itself", "just", "let", "like", "ll", "may", "me", "might", "more",
  "most", "much", "must", "mustn", "mustnt", "my", "myself", "need", "no",
  "nor", "not", "now", "of", "off", "on", "once", "only", "or", "other",
  "our", "ours", "ourselves", "out", "over", "own", "re", "same", "shall",
  "shan", "shant", "she", "should", "shouldn", "shouldnt", "so", "some",
  "still", "such", "than", "that", "the", "their", "theirs", "them",
  "themselves", "then", "there", "these", "they", "this", "those", "through",
  "to", "too", "under", "until", "up", "us", "ve", "very", "was", "wasn",
  "wasnt", "we", "were", "weren", "werent", "what", "when", "where",
  "which", "while", "who", "whom", "why", "will", "with", "won", "wont",
  "would", "wouldn", "wouldnt", "you", "your", "yours", "yourself",
  "yourselves",
  // Common web/content words that don't add signal
  "also", "one", "two", "three", "many", "well", "way", "use", "used",
  "using", "make", "makes", "made", "know", "see", "want", "come", "take",
  "new", "first", "last", "long", "great", "little", "right", "old",
  "big", "high", "different", "small", "large", "next", "early", "young",
  "important", "public", "good", "best", "back", "help", "work", "part",
  "think", "going", "look", "say", "said", "keep", "give", "most",
]);

// ----------------
// Porter Stemmer (simplified)
// ----------------

/**
 * Simplified Porter stemmer for English.
 * Handles the most common morphological suffixes relevant to real estate content.
 * Applied after stop word filtering to collapse word variants into stems.
 */
function stem(word: string): string {
  // Don't stem short words
  if (word.length <= 3) return word;

  let w = word;

  // Step 1a: Plurals
  if (w.endsWith("sses")) {
    w = w.slice(0, -2); // sses → ss
  } else if (w.endsWith("ies")) {
    w = w.slice(0, -2); // ies → i  (but we'll normalize below)
  } else if (w.endsWith("ss")) {
    // keep as-is (e.g., "less", "pass")
  } else if (w.endsWith("s") && w.length > 4) {
    w = w.slice(0, -1); // general plural
  }

  // Step 1b: -ed and -ing
  if (w.endsWith("eed")) {
    // e.g., "agreed" → "agree" (only strip one 'e' worth)
    if (w.length > 4) w = w.slice(0, -1);
  } else if (w.endsWith("ied")) {
    w = w.slice(0, -2); // e.g., "applied" → "appli"  (but short enough)
    if (w.length <= 2) w = word.slice(0, -1);
  } else if (w.endsWith("ed") && w.length > 4) {
    const base = w.slice(0, -2);
    // Check there's a vowel in the stem
    if (/[aeiou]/.test(base)) {
      w = base;
      // Clean up doubled consonants
      if (/([^aeiou])\1$/.test(w) && !/[lsz]$/.test(w.slice(-1))) {
        w = w.slice(0, -1);
      }
    }
  } else if (w.endsWith("ing") && w.length > 5) {
    const base = w.slice(0, -3);
    if (/[aeiou]/.test(base)) {
      w = base;
      // Clean up doubled consonants
      if (/([^aeiou])\1$/.test(w) && !/[lsz]$/.test(w.slice(-1))) {
        w = w.slice(0, -1);
      }
    }
  }

  // Step 2: Long suffixes (most specific first)
  if (w.endsWith("ational")) {
    w = w.slice(0, -7) + "ate";
  } else if (w.endsWith("ization")) {
    w = w.slice(0, -7) + "ize";
  } else if (w.endsWith("fulness")) {
    w = w.slice(0, -7) + "ful";
  } else if (w.endsWith("iveness")) {
    w = w.slice(0, -7) + "ive";
  } else if (w.endsWith("ousli")) {
    w = w.slice(0, -5) + "ous";
  } else if (w.endsWith("tion") && w.length > 6) {
    w = w.slice(0, -4) + "t";
  } else if (w.endsWith("ment") && w.length > 6) {
    w = w.slice(0, -4);
  } else if (w.endsWith("ness") && w.length > 6) {
    w = w.slice(0, -4);
  } else if (w.endsWith("able") && w.length > 6) {
    w = w.slice(0, -4);
  } else if (w.endsWith("ible") && w.length > 6) {
    w = w.slice(0, -4);
  } else if (w.endsWith("ance") && w.length > 6) {
    w = w.slice(0, -4);
  } else if (w.endsWith("ence") && w.length > 6) {
    w = w.slice(0, -4);
  }

  // Step 3: Shorter suffixes
  if (w.endsWith("ful") && w.length > 5) {
    w = w.slice(0, -3);
  } else if (w.endsWith("ous") && w.length > 5) {
    w = w.slice(0, -3);
  } else if (w.endsWith("ive") && w.length > 5) {
    w = w.slice(0, -3);
  } else if (w.endsWith("ize") && w.length > 5) {
    w = w.slice(0, -3);
  } else if (w.endsWith("ise") && w.length > 5) {
    w = w.slice(0, -3);
  } else if (w.endsWith("ity") && w.length > 5) {
    w = w.slice(0, -3);
  } else if (w.endsWith("ent") && w.length > 5) {
    w = w.slice(0, -3);
  } else if (w.endsWith("ant") && w.length > 5) {
    w = w.slice(0, -3);
  } else if (w.endsWith("ist") && w.length > 5) {
    w = w.slice(0, -3);
  } else if (w.endsWith("ism") && w.length > 5) {
    w = w.slice(0, -3);
  } else if (w.endsWith("al") && w.length > 4) {
    w = w.slice(0, -2);
  } else if (w.endsWith("er") && w.length > 4) {
    w = w.slice(0, -2);
  } else if (w.endsWith("ly") && w.length > 4) {
    w = w.slice(0, -2);
  }

  // Final: strip trailing 'e' if stem is long enough
  if (w.endsWith("e") && w.length > 3) {
    w = w.slice(0, -1);
  }

  return w;
}

// ----------------
// Tokenizer
// ----------------

/**
 * Lowercase, remove punctuation, split on whitespace, filter stop words,
 * then apply Porter stemming for better term matching.
 * Minimum 3 character length.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
    .map(stem);
}

// ----------------
// TF-IDF Functions
// ----------------

/**
 * Term frequency per document, normalized by max frequency.
 * tf(t) = freq(t) / max(freq)
 */
export function computeTF(tokens: string[]): TermVector {
  const freq: Record<string, number> = {};
  let maxFreq = 0;

  for (const token of tokens) {
    freq[token] = (freq[token] || 0) + 1;
    if (freq[token] > maxFreq) maxFreq = freq[token];
  }

  if (maxFreq === 0) return {};

  const tf: TermVector = {};
  for (const [term, count] of Object.entries(freq)) {
    tf[term] = count / maxFreq;
  }

  return tf;
}

/**
 * Inverse document frequency across all documents.
 * idf(t) = log(N / (1 + df(t)))
 * where df(t) is the number of documents containing term t.
 */
export function computeIDF(documents: TermVector[]): TermVector {
  const N = documents.length;
  const df: Record<string, number> = {};

  for (const doc of documents) {
    for (const term of Object.keys(doc)) {
      df[term] = (df[term] || 0) + 1;
    }
  }

  const idf: TermVector = {};
  for (const [term, count] of Object.entries(df)) {
    idf[term] = Math.log(N / (1 + count));
  }

  return idf;
}

/**
 * Compute TF-IDF vector from TF and IDF.
 * Returns only top N terms by score.
 */
function computeTFIDF(tf: TermVector, idf: TermVector, topN: number): TermVector {
  const tfidf: TermVector = {};
  for (const [term, tfScore] of Object.entries(tf)) {
    const idfScore = idf[term];
    if (idfScore !== undefined) {
      tfidf[term] = tfScore * idfScore;
    }
  }

  // Keep only top N terms
  const sorted = Object.entries(tfidf)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN);

  const result: TermVector = {};
  for (const [term, score] of sorted) {
    result[term] = Math.round(score * 10000) / 10000;
  }

  return result;
}

/**
 * Cosine similarity between two term vectors.
 */
function cosineSimilarity(a: TermVector, b: TermVector): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Use the smaller vector for iteration
  const [smaller, larger] = Object.keys(a).length <= Object.keys(b).length ? [a, b] : [b, a];

  for (const [term, scoreA] of Object.entries(smaller)) {
    const scoreB = larger[term];
    if (scoreB !== undefined) {
      dotProduct += scoreA * scoreB;
    }
  }

  for (const val of Object.values(a)) normA += val * val;
  for (const val of Object.values(b)) normB += val * val;

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

// ----------------
// Extract First N Words from Body
// ----------------

function extractFirstNWords(body: string, n: number): string {
  // Strip markdown formatting
  const stripped = body
    .replace(/^---[\s\S]*?---\n?/, "") // frontmatter
    .replace(/!\[.*?\]\(.*?\)/g, "")    // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links -> text
    .replace(/```[\s\S]*?```/g, "")     // code blocks
    .replace(/<[^>]+>/g, "")            // HTML tags
    .replace(/#{1,6}\s/g, "")           // heading markers
    .replace(/[*_~`]/g, "");            // emphasis markers

  const words = stripped.split(/\s+/).filter(Boolean);
  return words.slice(0, n).join(" ");
}

// ----------------
// Build Semantic Index
// ----------------

export async function buildSemanticIndex(): Promise<void> {
  console.log("  Loading raw catalog...");

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

  // Load blog posts for body content
  console.log("  Loading blog post bodies...");
  const blogPosts = await loadMarkdownFiles(BLOG_DIR);
  const blogBodyMap = new Map<string, string>();
  for (const post of blogPosts) {
    blogBodyMap.set(post.slug, parseBody(post.rawContent));
  }

  // Tokenize each page: title (repeated 2x) + description + first 500 words of body
  console.log("  Tokenizing pages...");
  const allTFs: TermVector[] = [];
  const pageMetadata: Array<{ slug: string; url: string; type: string; category: string }> = [];

  for (const page of indexablePages) {
    const titleText = `${page.title} ${page.title}`; // title repeated 2x
    const descText = page.description || "";

    // Get body content for blog posts
    let bodyText = "";
    const bodyContent = blogBodyMap.get(page.slug);
    if (bodyContent) {
      bodyText = extractFirstNWords(bodyContent, 500);
    }

    const fullText = `${titleText} ${descText} ${bodyText}`;
    const tokens = tokenize(fullText);
    const tf = computeTF(tokens);

    allTFs.push(tf);
    pageMetadata.push({
      slug: page.slug,
      url: page.url,
      type: page.type,
      category: page.category,
    });
  }

  // Compute IDF across all pages
  console.log("  Computing IDF scores...");
  const idfScores = computeIDF(allTFs);

  // Compute TF-IDF vectors (top 50 terms per entry)
  console.log("  Building TF-IDF vectors...");
  const entries: SemanticIndexEntry[] = [];

  for (let i = 0; i < indexablePages.length; i++) {
    const meta = pageMetadata[i];
    const tf = allTFs[i];
    const termVector = computeTFIDF(tf, idfScores, TOP_TERMS_PER_ENTRY);

    entries.push({
      slug: meta.slug,
      url: meta.url,
      type: meta.type as SemanticIndexEntry["type"],
      category: meta.category,
      termVector,
    });
  }

  // Only keep IDF scores for terms that appear in at least one entry
  const usedTerms = new Set<string>();
  for (const entry of entries) {
    for (const term of Object.keys(entry.termVector)) {
      usedTerms.add(term);
    }
  }

  const trimmedIDF: TermVector = {};
  for (const term of Array.from(usedTerms)) {
    if (idfScores[term] !== undefined) {
      trimmedIDF[term] = Math.round(idfScores[term] * 10000) / 10000;
    }
  }

  // Build the index
  const index: SemanticIndex = {
    generatedAt: new Date().toISOString(),
    documentCount: entries.length,
    idfScores: trimmedIDF,
    entries,
  };

  // Write to disk
  const indexPath = path.resolve(INDEX_PATH);
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2));

  const fileSizeKB = Math.round((JSON.stringify(index).length / 1024) * 10) / 10;
  console.log(`  Semantic index: ${indexPath} (${fileSizeKB} KB)`);
  console.log(`  Documents indexed: ${entries.length}`);
  console.log(`  Unique terms in IDF: ${Object.keys(trimmedIDF).length}`);
}

// ----------------
// Rank Pages by Relevance
// ----------------

let cachedSemanticIndex: { key: string; value: SemanticIndex } | null = null;

async function loadSemanticIndexCached(): Promise<SemanticIndex | null> {
  try {
    const indexPath = path.resolve(INDEX_PATH);
    const stat = await fs.stat(indexPath);
    const key = `${stat.mtimeMs}:${stat.size}`;
    if (cachedSemanticIndex && cachedSemanticIndex.key === key) {
      return cachedSemanticIndex.value;
    }
    const value = JSON.parse(await fs.readFile(indexPath, "utf-8")) as SemanticIndex;
    cachedSemanticIndex = { key, value };
    return value;
  } catch {
    return null;
  }
}

export async function rankPagesByRelevance(
  articleBody: string,
  articleTitle: string,
  articleSlug: string,
  topN = 40
): Promise<RankedPage[]> {
  const index = await loadSemanticIndexCached();
  if (!index) return [];

  // Load raw catalog for page metadata (title, description, tags, etc.)
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

  // Compute source article TF-IDF vector (use full body for maximum topic coverage)
  const titleText = `${articleTitle} ${articleTitle}`;
  const bodyText = articleBody;
  const fullText = `${titleText} ${bodyText}`;
  const tokens = tokenize(fullText);
  const sourceTF = computeTF(tokens);

  // Build source TF-IDF using the index's IDF scores
  const sourceTFIDF: TermVector = {};
  for (const [term, tfScore] of Object.entries(sourceTF)) {
    const idfScore = index.idfScores[term];
    if (idfScore !== undefined) {
      sourceTFIDF[term] = tfScore * idfScore;
    }
  }

  // Load link graph for boosts
  let linkGraph: LinkGraphData | null = null;
  try {
    const graphPath = path.resolve(GRAPH_PATH);
    linkGraph = JSON.parse(await fs.readFile(graphPath, "utf-8")) as LinkGraphData;
  } catch {
    // No graph available — no boosts
  }

  const orphanSet = new Set(linkGraph?.orphanPages || []);
  const overLinkedSet = new Set(linkGraph?.overLinkedPages || []);

  // Load focus pages config
  let focusPageUrls = new Set<string>();
  try {
    const focusConfig = JSON.parse(await fs.readFile(path.resolve(FOCUS_PAGES_PATH), "utf-8")) as FocusPagesConfig;
    focusPageUrls = new Set(focusConfig.pages.map((p) => p.url.endsWith("/") ? p.url : p.url + "/"));
  } catch {
    // No focus pages config — no focus boosts
  }

  // Load enriched catalog once for purpose cards
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
    // No enriched catalog — no purpose cards
  }

  // Score each index entry
  const scored: RankedPage[] = [];
  const pillarPages: RankedPage[] = [];

  for (const entry of index.entries) {
    // Exclude the source article itself
    if (entry.slug === articleSlug) continue;

    // Skip glossary/tooltip pages
    if (entry.url.startsWith("/glossary/")) continue;

    const similarity = cosineSimilarity(sourceTFIDF, entry.termVector);

    // Apply graph + focus boosts
    const normalizedUrl = entry.url.endsWith("/") ? entry.url : entry.url + "/";
    let graphBoost = 0;
    if (orphanSet.has(normalizedUrl)) graphBoost = Math.min(0.15, similarity * 0.5);
    if (overLinkedSet.has(normalizedUrl)) graphBoost = -Math.min(0.05, similarity * 0.2);
    // Focus pages get an additional boost (stacks with orphan boost)
    if (focusPageUrls.has(normalizedUrl)) graphBoost += Math.min(0.1, similarity * 0.3);

    const finalScore = similarity + graphBoost;

    // Look up full page data
    const pageData = pageMap.get(entry.slug);
    if (!pageData) continue;

    // Get enriched data
    const enriched = enrichedMap.get(entry.slug);

    const ranked: RankedPage = {
      slug: entry.slug,
      url: entry.url,
      type: entry.type,
      title: pageData.title,
      description: pageData.description,
      category: entry.category,
      region: pageData.region,
      tags: pageData.tags || [],
      similarityScore: Math.round(similarity * 10000) / 10000,
      graphBoost,
      finalScore: Math.round(finalScore * 10000) / 10000,
      readerPromise: enriched?.readerPromise,
      linkWhen: enriched?.linkWhen,
      doNotLinkWhen: enriched?.doNotLinkWhen,
      questionsAnswered: enriched?.questionsAnswered,
      topicsCovered: enriched?.topicsCovered,
      topicsExcluded: enriched?.topicsExcluded,
      financingConcepts: enriched?.financingConcepts,
      assetTypes: enriched?.assetTypes,
    };

    // Always keep pillar pages
    if (entry.type === "pillar") {
      pillarPages.push(ranked);
    } else {
      scored.push(ranked);
    }
  }

  // Sort by finalScore descending
  scored.sort((a, b) => b.finalScore - a.finalScore);

  // Take top N non-pillar pages; only add pillars that score above relevance floor
  const PILLAR_RELEVANCE_FLOOR = 0.12;
  const topScored = scored.slice(0, topN);
  const resultSlugs = new Set(topScored.map((p) => p.slug));

  const relevantPillars = pillarPages.filter(
    (p) => !resultSlugs.has(p.slug) && p.finalScore >= PILLAR_RELEVANCE_FLOOR
  );
  const result = [...topScored, ...relevantPillars];

  result.sort((a, b) => b.finalScore - a.finalScore);

  return result;
}
