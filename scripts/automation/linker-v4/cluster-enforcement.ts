// ============================================
// Smart Linker v4 — Hub-and-Spoke Enforcement
// ============================================
// Ensures blog posts link to their category's pillar pages and that
// pillar pages link back to spoke articles. Used by generate-api.ts
// to inject prompt notes and by report mode for coverage stats.

import fs from "fs/promises";
import path from "path";
import type { LinkGraphData, LinkGraphNode, RawPageData } from "./types";
import { normalizeUrl } from "./catalog-utils";

// ----------------
// Constants
// ----------------

const DATA_DIR = "src/data/linker-v4";
const RAW_CATALOG_PATH = path.join(DATA_DIR, "raw-catalog.json");
const DETECTED_PILLARS_PATH = path.join(DATA_DIR, "detected-pillars.json");

/** Cache is considered stale after this many days */
const CACHE_TTL_DAYS = 30;

/** Minimum score required for a candidate to be treated as a real pillar */
const MIN_PILLAR_SCORE = 0.3;

/** Max pillars per category */
const MAX_PILLARS_PER_CATEGORY = 3;

// ----------------
// Static Fallback Map
// ----------------

/**
 * Hardcoded fallback used when detected-pillars.json is missing, stale, or
 * unreadable. Kept in sync with PILLAR_PAGES in build-catalog.ts.
 */
/**
 * Hub-and-spoke pillars for Multi-Family USA content categories.
 * Hubs: loan-types + tools; spokes: blog / learn guides.
 */
export const FALLBACK_CATEGORY_PILLARS: Record<string, string[]> = {
  fundamentals: [
    "/loan-types/",
    "/learn/",
    "/tools/",
    "/learn/five-plus-unit-commercial-financing-basics/",
  ],
  underwriting: [
    "/tools/",
    "/tools/commercial-dscr-calculator/",
    "/tools/debt-yield-calculator/",
    "/learn/commercial-dscr-explained/",
  ],
  qualification: [
    "/tools/commercial-dscr-calculator/",
    "/tools/loan-sizing-calculator/",
    "/loan-types/",
    "/learn/debt-yield-and-ltv-framework/",
  ],
  "capital-markets": [
    "/loan-types/",
    "/compare/",
    "/loan-types/agency-stabilized/",
    "/loan-types/bridge-value-add/",
  ],
  execution: [
    "/checklists/",
    "/loan-types/bridge-value-add/",
    "/learn/multifamily-close-checklist/",
    "/deal-review/",
  ],
  risk: [
    "/rates/",
    "/checklists/",
    "/learn/rate-risk-and-refinance-planning/",
    "/compare/",
  ],
  rates: [
    "/rates/",
    "/loan-types/",
    "/tools/loan-sizing-calculator/",
    "/compare/agency-vs-bridge/",
  ],
  // Catalog page types that still tag financing hubs
  "mortgage-financing": ["/loan-types/", "/tools/", "/compare/"],
  "investing-fundamentals": ["/learn/", "/invest/", "/tools/"],
};

/** @deprecated Use FALLBACK_CATEGORY_PILLARS or detectPillars() instead. */
export const CATEGORY_PILLARS = FALLBACK_CATEGORY_PILLARS;

// ----------------
// Detected Pillars Cache Shape
// ----------------

export interface DetectedPillarEntry {
  url: string;
  score: number;
  pageRank: number;
  inbound: number;
  coherence: number;
}

export interface DetectedPillarsCache {
  generatedAt: string;
  pillarsByCategory: Record<string, DetectedPillarEntry[]>;
}

// ----------------
// Loaded Cache (module-level, lazy)
// ----------------

let cachedPillars: DetectedPillarsCache | null = null;
let cacheLoadAttempted = false;

function isCacheFresh(cache: DetectedPillarsCache): boolean {
  const generated = new Date(cache.generatedAt).getTime();
  if (!Number.isFinite(generated)) return false;
  const ageMs = Date.now() - generated;
  const maxAgeMs = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
  return ageMs >= 0 && ageMs < maxAgeMs;
}

async function loadDetectedPillarsCache(): Promise<DetectedPillarsCache | null> {
  if (cacheLoadAttempted) return cachedPillars;
  cacheLoadAttempted = true;

  try {
    const raw = await fs.readFile(path.resolve(DETECTED_PILLARS_PATH), "utf-8");
    const parsed = JSON.parse(raw) as DetectedPillarsCache;
    if (!parsed || typeof parsed !== "object" || !parsed.pillarsByCategory) {
      return null;
    }
    if (!isCacheFresh(parsed)) return null;
    cachedPillars = parsed;
    return cachedPillars;
  } catch {
    return null;
  }
}

/**
 * Returns pillar URLs for a given category, preferring the detected cache
 * (if fresh) and falling back to the hardcoded map. Never throws.
 */
export async function getPillarsForCategory(category: string): Promise<string[]> {
  const cache = await loadDetectedPillarsCache();
  if (cache) {
    const entries = cache.pillarsByCategory[category];
    if (entries && entries.length > 0) {
      return entries.map((e) => e.url);
    }
  }
  return FALLBACK_CATEGORY_PILLARS[category] ?? [];
}

/**
 * Synchronous variant used by existing call sites that already hold a
 * category string and cannot easily switch to async. Falls back to the
 * hardcoded map if the cache has not been preloaded via preloadPillarCache().
 */
export function getPillarsForCategorySync(category: string): string[] {
  if (cachedPillars) {
    const entries = cachedPillars.pillarsByCategory[category];
    if (entries && entries.length > 0) {
      return entries.map((e) => e.url);
    }
  }
  return FALLBACK_CATEGORY_PILLARS[category] ?? [];
}

/** Preload the detected-pillars cache so sync callers can use it. */
export async function preloadPillarCache(): Promise<void> {
  await loadDetectedPillarsCache();
}

// ----------------
// Pillar Detection
// ----------------

async function loadRawCatalog(): Promise<RawPageData[]> {
  try {
    const raw = await fs.readFile(path.resolve(RAW_CATALOG_PATH), "utf-8");
    const parsed = JSON.parse(raw) as { pages?: RawPageData[] };
    return parsed.pages ?? [];
  } catch {
    return [];
  }
}

function isBlogLeaf(page: RawPageData): boolean {
  if (page.type === "post" || page.type === "queue") return true;
  if (page.url.toLowerCase().startsWith("/blog/")) return true;
  return false;
}

function computeCoherence(
  node: LinkGraphNode | undefined,
  urlToCategory: Map<string, string>,
  ownCategory: string
): number {
  if (!node || node.outboundCount === 0) return 0;
  let sameCat = 0;
  for (const target of node.outboundTo) {
    const cat = urlToCategory.get(normalizeUrl(target));
    if (cat && cat === ownCategory) sameCat++;
  }
  return sameCat / node.outboundCount;
}

export interface DetectPillarsResult {
  cache: DetectedPillarsCache;
  skipped: Array<{ category: string; reason: string }>;
}

/**
 * Data-driven pillar detection. Groups catalog entries by category and
 * scores candidates with:
 *   0.5 * normalizedPageRank
 * + 0.3 * (inbound / maxInboundInCategory)
 * + 0.2 * categoryCoherence
 *
 * Blog leaves (/blog/**, type=post|queue) are excluded. Top 3 per
 * category are kept, provided they clear MIN_PILLAR_SCORE.
 */
export async function detectPillars(
  linkGraphData: LinkGraphData
): Promise<DetectPillarsResult> {
  const catalog = await loadRawCatalog();

  // Build URL -> category map from the catalog for coherence scoring
  const urlToCategory = new Map<string, string>();
  for (const page of catalog) {
    if (!page.category) continue;
    urlToCategory.set(normalizeUrl(page.url), page.category);
  }

  // Group catalog entries by category (eligible candidates only)
  const byCategory = new Map<string, RawPageData[]>();
  for (const page of catalog) {
    if (!page.category) continue;
    if (isBlogLeaf(page)) continue;
    const list = byCategory.get(page.category) ?? [];
    list.push(page);
    byCategory.set(page.category, list);
  }

  // Normalize PageRank across all known nodes (global max so scores are
  // comparable across categories)
  let maxPageRank = 0;
  for (const node of Object.values(linkGraphData.nodes)) {
    if (node.pageRank && node.pageRank > maxPageRank) maxPageRank = node.pageRank;
  }
  if (maxPageRank === 0) maxPageRank = 1;

  const pillarsByCategory: Record<string, DetectedPillarEntry[]> = {};
  const skipped: Array<{ category: string; reason: string }> = [];

  for (const [category, candidates] of byCategory) {
    // Gather per-candidate metrics
    const scored: DetectedPillarEntry[] = [];

    // First pass: find max inbound in this category for normalization
    let maxInboundInCategory = 0;
    for (const page of candidates) {
      const node =
        linkGraphData.nodes[normalizeUrl(page.url)] ||
        linkGraphData.nodes[normalizeUrl(page.url) + "/"];
      const inbound = node?.inboundCount ?? 0;
      if (inbound > maxInboundInCategory) maxInboundInCategory = inbound;
    }
    if (maxInboundInCategory === 0) maxInboundInCategory = 1;

    for (const page of candidates) {
      const normalized = normalizeUrl(page.url);
      const node =
        linkGraphData.nodes[normalized] ||
        linkGraphData.nodes[normalized + "/"];
      const pageRank = node?.pageRank ?? 0;
      const inbound = node?.inboundCount ?? 0;
      const coherence = computeCoherence(node, urlToCategory, category);

      const normalizedPageRank = pageRank / maxPageRank;
      const normalizedInbound = inbound / maxInboundInCategory;
      const score =
        0.5 * normalizedPageRank +
        0.3 * normalizedInbound +
        0.2 * coherence;

      scored.push({
        url: page.url,
        score: Math.round(score * 10000) / 10000,
        pageRank: Math.round(pageRank * 1e6) / 1e6,
        inbound,
        coherence: Math.round(coherence * 10000) / 10000,
      });
    }

    scored.sort((a, b) => b.score - a.score);

    // Small category — include all (still respect min threshold)
    let selected: DetectedPillarEntry[];
    if (candidates.length < MAX_PILLARS_PER_CATEGORY) {
      selected = scored.filter((e) => e.score >= MIN_PILLAR_SCORE);
    } else {
      selected = scored
        .slice(0, MAX_PILLARS_PER_CATEGORY)
        .filter((e) => e.score >= MIN_PILLAR_SCORE);
    }

    if (selected.length === 0) {
      skipped.push({
        category,
        reason: `top score ${scored[0]?.score ?? 0} below threshold ${MIN_PILLAR_SCORE}`,
      });
      continue;
    }

    pillarsByCategory[category] = selected;
  }

  const cache: DetectedPillarsCache = {
    generatedAt: new Date().toISOString(),
    pillarsByCategory,
  };

  return { cache, skipped };
}

/** Write the detected-pillars cache to disk and refresh the in-memory copy. */
export async function writeDetectedPillars(
  cache: DetectedPillarsCache
): Promise<string> {
  const outPath = path.resolve(DETECTED_PILLARS_PATH);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(cache, null, 2));
  cachedPillars = cache;
  cacheLoadAttempted = true;
  return outPath;
}

// ----------------
// Hub-and-Spoke Check
// ----------------

export interface HubAndSpokeResult {
  missingPillarLink: boolean;
  pillarUrl: string;
  missingBacklink: boolean;
}

/**
 * Check if a blog article links to its category's pillar page(s)
 * and whether those pillar pages link back to it.
 *
 * Uses the detected-pillars cache if it has been preloaded via
 * preloadPillarCache(); otherwise falls back to FALLBACK_CATEGORY_PILLARS.
 */
export function checkHubAndSpoke(
  slug: string,
  category: string,
  body: string,
  linkGraphData: LinkGraphData | null
): HubAndSpokeResult {
  const pillarUrls = getPillarsForCategorySync(category);
  if (!pillarUrls || pillarUrls.length === 0) {
    return { missingPillarLink: false, pillarUrl: "", missingBacklink: false };
  }

  // Check if the article body contains a link to any pillar URL
  const bodyLower = body.toLowerCase();
  let linkedPillarUrl = "";
  let hasPillarLink = false;

  for (const pillarUrl of pillarUrls) {
    // Check for markdown or HTML links containing this pillar URL
    const urlVariants = [
      pillarUrl,
      pillarUrl.replace(/\/$/, ""), // without trailing slash
    ];
    for (const variant of urlVariants) {
      if (bodyLower.includes(`(${variant.toLowerCase()}`) || bodyLower.includes(`"${variant.toLowerCase()}`)) {
        hasPillarLink = true;
        linkedPillarUrl = pillarUrl;
        break;
      }
    }
    if (hasPillarLink) break;
  }

  // Use the first pillar URL as the primary one for reporting
  const primaryPillarUrl = linkedPillarUrl || pillarUrls[0];

  // Check if the pillar page links back to this article
  let missingBacklink = false;
  if (linkGraphData) {
    const articleUrl = normalizeUrl(`/blog/${slug}/`);
    const pillarNormalized = normalizeUrl(primaryPillarUrl);
    const pillarNode = linkGraphData.nodes[pillarNormalized + "/"] || linkGraphData.nodes[pillarNormalized];
    if (pillarNode) {
      const linksToArticle = pillarNode.outboundTo.some(
        (url) => normalizeUrl(url) === articleUrl
      );
      missingBacklink = !linksToArticle;
    } else {
      // Pillar not in graph — can't check backlink
      missingBacklink = false;
    }
  }

  return {
    missingPillarLink: !hasPillarLink,
    pillarUrl: primaryPillarUrl,
    missingBacklink,
  };
}

// ----------------
// Prompt Note for Generate API
// ----------------

/**
 * Returns a prompt note to inject when generating link suggestions,
 * reminding the model to include a pillar page link if one is missing.
 */
export function getHubAndSpokePromptNote(
  slug: string,
  category: string,
  body: string,
  linkGraphData: LinkGraphData | null
): string {
  const result = checkHubAndSpoke(slug, category, body, linkGraphData);
  if (result.missingPillarLink) {
    return `\n[IMPORTANT: This article does NOT link to its pillar page "${result.pillarUrl}". You MUST include a link to it.]\n`;
  }
  return "";
}

// ----------------
// Report: Hub-and-Spoke Coverage
// ----------------

export interface HubAndSpokeCoverage {
  category: string;
  pillarUrl: string;
  articlesWithLink: number;
  articlesMissingLink: number;
}

/**
 * Generates a coverage report showing how many articles in each category
 * link to their pillar page vs. how many are missing the link.
 *
 * Uses the detected-pillars cache if it has been preloaded via
 * preloadPillarCache(); otherwise falls back to FALLBACK_CATEGORY_PILLARS.
 */
export async function getHubAndSpokeReport(
  linkGraphData: LinkGraphData
): Promise<HubAndSpokeCoverage[]> {
  const report: HubAndSpokeCoverage[] = [];

  await preloadPillarCache();

  const source: Record<string, string[]> = {};
  if (cachedPillars) {
    for (const [cat, entries] of Object.entries(cachedPillars.pillarsByCategory)) {
      source[cat] = entries.map((e) => e.url);
    }
  }
  // Ensure any fallback-only categories are still reported
  for (const [cat, urls] of Object.entries(FALLBACK_CATEGORY_PILLARS)) {
    if (!source[cat]) source[cat] = urls;
  }

  for (const [category, pillarUrls] of Object.entries(source)) {
    for (const pillarUrl of pillarUrls) {
      const pillarNormalized = normalizeUrl(pillarUrl);
      // Find the pillar node — try both with and without trailing slash
      const pillarNode =
        linkGraphData.nodes[pillarNormalized + "/"] ||
        linkGraphData.nodes[pillarNormalized];

      if (!pillarNode) continue;

      // Count blog posts that link to this pillar
      let articlesWithLink = 0;
      let articlesMissingLink = 0;

      for (const node of Object.values(linkGraphData.nodes)) {
        // Only count blog posts in this category
        if (node.type !== "post") continue;

        // Check if this post links to the pillar
        const linksToThisPillar = node.outboundTo.some(
          (url) => normalizeUrl(url) === pillarNormalized
        );

        if (linksToThisPillar) {
          articlesWithLink++;
        } else {
          articlesMissingLink++;
        }
      }

      report.push({
        category,
        pillarUrl,
        articlesWithLink,
        articlesMissingLink,
      });
    }
  }

  return report;
}
