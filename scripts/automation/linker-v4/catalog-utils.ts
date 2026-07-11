// ============================================
// Smart Linker v4 — Shared Constants & Utilities
// ============================================
// Extracted from generate-api.ts, audit.ts, validate.ts,
// semantic-audit.ts, and build-catalog.ts to eliminate duplication.

import fs from "fs/promises";
import path from "path";
import type { PagePurpose, RawPageData, PageCatalog } from "./types";
import { isServiceHubUrl } from "../shared/service-cta";

const DATA_DIR = "src/data/linker-v4";
// ----------------
// Category Adjacency
// ----------------

/** Which additional categories to include per article category */
export const CATEGORY_ADJACENCY: Record<string, string[]> = {
  "mortgage-financing": [
    "mortgage-financing",
    "investing-fundamentals",
    "scaling-portfolio",
  ],
  "investing-fundamentals": [
    "investing-fundamentals",
    "mortgage-financing",
    "scaling-portfolio",
    "personal-finance-mindset",
  ],
  "scaling-portfolio": [
    "scaling-portfolio",
    "investing-fundamentals",
    "partnerships-capital",
    "mortgage-financing",
  ],
  "partnerships-capital": [
    "partnerships-capital",
    "scaling-portfolio",
    "investing-fundamentals",
  ],
  "us-cross-border": [
    "us-cross-border",
    "mortgage-financing",
    "investing-fundamentals",
  ],
  "personal-finance-mindset": [
    "personal-finance-mindset",
    "investing-fundamentals",
    "partnerships-capital",
  ],
};

// ----------------
// Category Labels
// ----------------

export const CATEGORY_LABELS: Record<string, string> = {
  fundamentals: "Multifamily Fundamentals",
  underwriting: "Underwriting Metrics",
  qualification: "Qualification & Sizing",
  "capital-markets": "Capital Markets & Loan Products",
  execution: "Deal Execution",
  risk: "Risk & Refinance Planning",
  rates: "Rates & Spreads",
  "mortgage-financing": "Multifamily Financing",
  "investing-fundamentals": "Investor Education",
};

// ----------------
// Generic Anchors
// ----------------

/** Generic anchors that are never acceptable */
export const GENERIC_ANCHORS = [
  "real estate investors",
  "real estate investing",
  "investment property",
  "investment properties",
  "investment strategies",
  "financing options",
  "mortgage options",
  "click here",
  "learn more",
  "read more",
  "check out",
  "this article",
  "this guide",
  "this post",
  "here",
  "this page",
  "our guide",
  "our article",
  "property investors",
  "real estate market",
  "real estate portfolio",
  "rental property",
  "rental properties",
  "mortgage broker",
  "mortgage brokers",
  "getting started",
  "get started",
  "find out more",
  "see more",
  "for more information",
];

// ----------------
// Pillar URL Patterns
// ----------------

/** Pillar page URL prefixes for Multi-Family USA sitemap */
export const PILLAR_URL_PATTERNS = [
  "/loan-types",
  "/property-types",
  "/learn",
  "/tools",
  "/states",
  "/cities",
  "/compare",
  "/invest",
  "/checklists",
  "/rates",
  "/book-strategy-call",
  "/deal-review",
];

// ----------------
// URL Utilities
// ----------------

/** Normalize internal URLs for comparison (strip domain, query, hash, trailing slash). */
export function normalizeUrl(url: string): string {
  let path = url.trim();
  const domainMatch = path.match(/^https?:\/\/(?:www\.)?multifamily-usa\.ca(\/.*)/i);
  if (domainMatch) path = domainMatch[1];
  path = path.split("#")[0].split("?")[0];
  return path.replace(/\/+$/, "").toLowerCase();
}

export function isPillarUrl(url: string): boolean {
  const normalized = normalizeUrl(url);
  return PILLAR_URL_PATTERNS.some((pattern) =>
    normalized.startsWith(pattern.toLowerCase())
  );
}

// ----------------
// Existing Internal Link Extraction
// ----------------

/**
 * Extract all internal link URLs from a markdown body.
 * Detects:
 *   - Markdown links: [text](/url)
 *   - HTML <a> tags: <a href="/url">
 *   - Absolute same-domain URLs (multifamily-usa.com) normalized to relative paths
 * Returns a Set of normalized relative URLs (without trailing slashes).
 */
export function extractExistingInternalLinks(body: string): Set<string> {
  const urls = new Set<string>();

  // 1. Markdown links: [text](/path) or [text](https://multifamily-usa.com/path)
  const mdLinkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdLinkRegex.exec(body)) !== null) {
    const url = match[1];
    const normalized = normalizeInternalUrl(url);
    if (normalized) urls.add(normalized);
  }

  // 2. HTML <a> tags: <a href="/path"> or <a href="https://multifamily-usa.com/path">
  const htmlLinkRegex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>/gi;
  while ((match = htmlLinkRegex.exec(body)) !== null) {
    const url = match[1];
    const normalized = normalizeInternalUrl(url);
    if (normalized) urls.add(normalized);
  }

  return urls;
}

/** Count all internal links in body (including duplicate targets). */
export function countInternalLinks(body: string): number {
  let count = 0;
  const mdLinkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdLinkRegex.exec(body)) !== null) {
    if (normalizeInternalUrl(match[1])) count++;
  }
  const htmlLinkRegex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>/gi;
  while ((match = htmlLinkRegex.exec(body)) !== null) {
    if (normalizeInternalUrl(match[1])) count++;
  }
  return count;
}

/**
 * Normalize a URL to a relative internal path, or return null if external.
 * Converts absolute multifamily-usa.com URLs to relative paths.
 */
function normalizeInternalUrl(url: string): string | null {
  let path = url.trim();

  // Handle absolute multifamily-usa.com URLs
  const domainMatch = path.match(/^https?:\/\/(?:www\.)?multifamily-usa\.ca(\/.*)/i);
  if (domainMatch) {
    path = domainMatch[1];
  }

  // Only keep relative paths (starting with /)
  if (!path.startsWith("/")) return null;

  // Strip trailing slash and normalize
  return path.replace(/\/+$/, "");
}

// ----------------
// CTA / Preserved Links (not stripped during relink)
// ----------------

/** URLs that should never be stripped during a relink pass. */
export const PRESERVED_URL_PATTERNS = ["/book-strategy-call"];

/** Anchor phrases that identify deliberate CTA links (inline). */
export const PRESERVED_ANCHOR_PHRASES = [
  "book a free strategy call",
  "book a strategy call",
  "schedule a free strategy session",
  "book a call with multifamily-usa",
  "book a call",
];

/**
 * Returns true when an internal link should be kept during strip/relink
 * (strategy-call CTAs, service-hub CTAs, and equivalents).
 */
export function isPreservedInternalLink(url: string, anchorText: string): boolean {
  const normalized = normalizeUrl(url);
  if (PRESERVED_URL_PATTERNS.some((p) => normalized.includes(p.replace(/\/$/, "")))) {
    return true;
  }
  // Service CTA hubs — keep parent financing/invest pages on strip
  if (isServiceHubUrl(url)) {
    return true;
  }
  const lower = anchorText.toLowerCase();
  return PRESERVED_ANCHOR_PHRASES.some((phrase) => lower.includes(phrase));
}

// ----------------
// Merged Catalog (raw + enriched purpose cards)
// ----------------

/**
 * Load raw catalog with enriched purpose fields overlaid.
 * Blog posts use frontmatter description as readerPromise when not enriched.
 */
export async function loadMergedCatalog(): Promise<{
  pages: (PagePurpose | RawPageData)[];
  enrichedCount: number;
}> {
  const rawPath = path.resolve(DATA_DIR, "raw-catalog.json");
  const enrichedPath = path.resolve(DATA_DIR, "page-catalog.json");

  const raw: { pages: RawPageData[] } = JSON.parse(await fs.readFile(rawPath, "utf-8"));

  const enrichedByUrl = new Map<string, Partial<PagePurpose>>();
  const enrichedBySlug = new Map<string, Partial<PagePurpose>>();
  let enrichedCount = 0;

  try {
    const enriched: PageCatalog = JSON.parse(await fs.readFile(enrichedPath, "utf-8"));
    for (const p of enriched.pages || []) {
      if (p.url) enrichedByUrl.set(normalizeUrl(p.url), p);
      if (p.slug) enrichedBySlug.set(p.slug, p);
      enrichedCount++;
    }
  } catch {
    // No enriched catalog — descriptions only
  }

  const pages = raw.pages.map((p) => {
    const e =
      enrichedByUrl.get(normalizeUrl(p.url)) || enrichedBySlug.get(p.slug) || null;

    const readerPromise = e?.readerPromise || p.description;
    const linkWhen = e?.linkWhen || [];
    const doNotLinkWhen = e?.doNotLinkWhen || [];

    return {
      ...p,
      readerPromise,
      linkWhen,
      doNotLinkWhen,
      topicsCovered: e?.topicsCovered,
      questionsAnswered: e?.questionsAnswered,
      assetTypes: e?.assetTypes,
      unitRange: e?.unitRange,
      topicsExcluded: e?.topicsExcluded,
      financingConcepts: e?.financingConcepts,
    } as PagePurpose | RawPageData;
  });

  return { pages, enrichedCount };
}

// ----------------
// Category-Filtered Catalog (shared between generate-api.ts and audit.ts)
// ----------------

export interface FilteredPage {
  url: string;
  title: string;
  description: string;
  category: string;
  region: string;
  tags: string[];
  readerPromise?: string;
  linkWhen?: string[];
  doNotLinkWhen?: string[];
}

export function filterCatalogByCategory(
  allPages: (PagePurpose | RawPageData)[],
  articleCategory: string,
  articleSlug: string
): FilteredPage[] {
  const relevantCategories =
    CATEGORY_ADJACENCY[articleCategory] || [articleCategory];

  // Always include pillar pages and tool pages (universal)
  // Exclude glossary terms — they are rendered as tooltips, not standalone link targets
  const pillarPages = allPages.filter(
    (p) =>
      (p.type === "pillar" || p.type === "page") &&
      !p.url.startsWith("/glossary/")
  );

  // Include blog posts from relevant categories
  const relevantPosts = allPages.filter(
    (p) =>
      p.type === "post" &&
      relevantCategories.includes(p.category) &&
      p.slug !== articleSlug
  );

  // Combine and deduplicate
  const all = [...pillarPages, ...relevantPosts];
  const seen = new Set<string>();
  const filtered: FilteredPage[] = [];

  for (const p of all) {
    if (seen.has(p.url)) continue;
    seen.add(p.url);
    filtered.push({
      url: p.url,
      title: p.title,
      description: p.description,
      category: p.category,
      region: p.region,
      tags: p.tags || [],
      readerPromise: (p as PagePurpose).readerPromise,
      linkWhen: (p as PagePurpose).linkWhen,
      doNotLinkWhen: (p as PagePurpose).doNotLinkWhen,
    });
  }

  return filtered;
}
