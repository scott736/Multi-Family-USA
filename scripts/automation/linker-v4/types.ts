// ============================================
// Smart Linker v4 — Type Definitions
// ============================================
// 100% self-contained. No imports from existing automation code.

// ----------------
// Page Catalog
// ----------------

/** What a page delivers to readers — its "purpose card" */
export interface PagePurpose {
  slug: string;
  url: string;
  title: string;
  type: "pillar" | "post" | "queue" | "page";
  description: string;
  /** One sentence: what the reader gets by visiting */
  readerPromise: string;
  /** Specific topics this page covers in depth */
  topicsCovered: string[];
  /** Questions a reader can get answered here */
  questionsAnswered: string[];
  /** Contexts where linking here is appropriate */
  linkWhen: string[];
  /** Contexts where linking here would be wrong */
  doNotLinkWhen: string[];
  /** Topics/contexts this page does NOT cover — reject links when anchor hits these */
  topicsExcluded?: string[];
  /** Financing concepts this page addresses */
  financingConcepts?: string[];
  /** Property/asset classes this page serves */
  assetTypes?: string[];
  /** Unit count range when relevant (e.g. "1-4", "5+") */
  unitRange?: string;
  region: string;
  category: string;
  tags: string[];
  /** Whether this page is only for tooltips, not for full links */
  isTooltipOnly?: boolean;
}

export interface PageCatalog {
  generatedAt: string;
  totalPages: number;
  pages: PagePurpose[];
}

// ----------------
// Compact catalog entry (for prompt building)
// ----------------

/** Minimal page info used in the prompt sent to the LLM */
export interface CompactPage {
  url: string;
  title: string;
  purpose: string;
}

// ----------------
// Raw page data (before enrichment)
// ----------------

/** Raw page data collected from source files before LLM enrichment */
export interface RawPageData {
  slug: string;
  url: string;
  title: string;
  type: "pillar" | "post" | "queue" | "page";
  description: string;
  category: string;
  tags: string[];
  region: string;
  /** First 2-3 paragraphs for context during enrichment */
  excerpt?: string;
  /** Whether this page is only for tooltips, not for full links */
  isTooltipOnly?: boolean;
  /** Whether this page is a focus page that should receive priority inbound links */
  isFocusPage?: boolean;
}

// ----------------
// Focus Pages Config
// ----------------

export interface FocusPageEntry {
  /** URL or slug of the page */
  url: string;
  /** Why this page needs more inbound links */
  reason: "orphan" | "high-value" | "new-content" | "seo-target" | "manual" | "low-inbound" | "fragile";
  /** Optional: minimum inbound links desired */
  targetInbound?: number;
  /** ISO timestamp when this entry was added */
  addedAt?: string;
  /** Who/what added this entry */
  addedBy?: string;
}

export interface FocusPagesConfig {
  updatedAt: string;
  description: string;
  pages: FocusPageEntry[];
}

// ----------------
// Link Suggestions
// ----------------

/** What the LLM returns per link suggestion */
export interface LinkSuggestion {
  /** Paragraph number in the article (1-indexed) */
  paragraphIndex: number;
  /** Exact substring from the paragraph */
  anchorText: string;
  /** URL of the target page */
  targetUrl: string;
  /** Why the reader needs this link at this point */
  readerNeed: string;
  /** What the reader expects to find on click */
  expectation: string;
  /** Why this anchor text is semantically correct for the target's readerPromise */
  semanticIntent: string;
  /** 0.0-1.0 confidence score */
  confidence: number;
}

/** @deprecated Use LinkSuggestion instead */
export type V3Suggestion = LinkSuggestion;

// ----------------
// Validation
// ----------------

/** Canonical set of reasons a suggestion may be rejected during validation. */
export type RejectionReason =
  | "tooltip-only-target"
  | "unpublished-target"
  | "anchor-not-found"
  | "anchor-too-short"
  | "anchor-too-long"
  | "anchor-has-brackets"
  | "generic-anchor"
  | "in-skip-zone"
  | "negative-context"
  | "duplicate-target"
  | "too-close-to-other-link"
  | "low-confidence"
  | "pillar-cap"
  | "not-at-word-boundary"
  | "duplicate-anchor-cross-article"
  | "section-cap"
  | "intent-mismatch"
  | "linkwhen-mismatch"
  | "region-mismatch"
  | "semantic-mismatch"
  | "position-cluster"
  | "unknown";

/** Bucketed position of an accepted link within the article body. */
export type PositionBucket = "intro" | "body" | "conclusion";

/** Per-bucket count of accepted suggestions in an article. */
export interface PositionDistribution {
  intro: number;
  body: number;
  conclusion: number;
}

/** After validation pass */
export interface ValidatedLink {
  suggestion: V3Suggestion;
  /** Character offset in body */
  positionInBody: number;
  passed: boolean;
  /**
   * Rejection reason. Typed as a string to preserve backward compatibility
   * with callers that append contextual detail (e.g. "low-confidence: 0.7").
   */
  rejectionReason?: string;
  confidenceTier?: "high" | "medium" | "low";
  /** Bucketed position within article body (only set for accepted links). */
  positionBucket?: PositionBucket;
  /** Distribution of accepted suggestions across intro/body/conclusion buckets. */
  positionDistribution?: PositionDistribution;
}

// ----------------
// Per-post output file
// ----------------

export interface SuggestionFile {
  sourceSlug: string;
  /** SHA-256 of article body for drift detection */
  sourceContentHash: string;
  generatedAt: string;
  model: string;
  /** How many pages the LLM could see */
  catalogSize: number;
  /** What the LLM returned */
  raw: V3Suggestion[];
  /** After validation pass */
  validated: ValidatedLink[];
  appliedAt?: string;
}

// ----------------
// Link Tracker
// ----------------

export interface TrackedLink {
  /** Source post slug */
  from: string;
  /** Target page slug */
  to: string;
  /** Target URL */
  toUrl: string;
  /** Anchor text used */
  anchor: string;
  /** Why this link was placed */
  readerNeed: string;
  /** ISO timestamp */
  appliedAt: string;
}

export interface LinkTracker {
  updatedAt: string;
  links: TrackedLink[];
}

// ----------------
// Skip Zones
// ----------------

export interface SkipZone {
  start: number;
  end: number;
  reason: string;
}

// ----------------
// Parsed Article
// ----------------

export interface ParsedArticle {
  slug: string;
  filePath: string;
  frontmatter: Record<string, unknown>;
  body: string;
  rawContent: string;
}

export interface NumberedParagraph {
  index: number;
  text: string;
  isContent: boolean;
  /** Character offset in original body */
  offset: number;
}

// ----------------
// Link Graph
// ----------------

export interface LinkGraphNode {
  slug: string;
  url: string;
  title: string;
  type: "pillar" | "post" | "queue" | "page";
  inboundCount: number;
  outboundCount: number;
  inboundFrom: string[];  // source URLs
  outboundTo: string[];   // target URLs
  pageRank?: number;
  outboundDensity?: number; // links per 500 words
  isOverLinked?: boolean;
  isUnderLinked?: boolean;
  wordCount?: number;
}

export interface LinkGraphData {
  generatedAt: string;
  totalNodes: number;
  totalEdges: number;
  nodes: Record<string, LinkGraphNode>;  // keyed by normalized URL
  orphanPages: string[];   // URLs with 0 inbound
  overLinkedPages: string[]; // URLs with 20+ inbound
}

export interface LinkHealthReport {
  totalNodes: number;
  totalEdges: number;
  orphanCount: number;
  overLinkedCount: number;
  averageInbound: number;
  averageOutbound: number;
  orphanPages: Array<{ url: string; title: string }>;
  overLinkedPages: Array<{ url: string; title: string; inboundCount: number }>;
  topLinkedPages: Array<{ url: string; title: string; inboundCount: number }>;
  nearOrphans: string[];      // 1-2 inbound links
  fragilePages: string[];     // all inbound from single source
  overLinkedArticles: string[];  // outbound density > 5.0
  underLinkedArticles: string[];  // outbound density < 0.5
}

// ----------------
// Semantic Filter
// ----------------

export type TermVector = Record<string, number>;

export interface SemanticIndexEntry {
  slug: string;
  url: string;
  type: "pillar" | "post" | "queue" | "page";
  category: string;
  termVector: TermVector;
}

export interface SemanticIndex {
  generatedAt: string;
  documentCount: number;
  idfScores: TermVector;
  entries: SemanticIndexEntry[];
}

export interface RankedPage {
  slug: string;
  url: string;
  type: "pillar" | "post" | "queue" | "page";
  title: string;
  description: string;
  category: string;
  region: string;
  tags: string[];
  similarityScore: number;
  graphBoost: number;
  finalScore: number;
  readerPromise?: string;
  linkWhen?: string[];
  doNotLinkWhen?: string[];
  questionsAnswered?: string[];
  topicsCovered?: string[];
  topicsExcluded?: string[];
  financingConcepts?: string[];
}

// ----------------
// Embedding Index
// ----------------

export interface EmbeddingEntry {
  title: string;
  contentHash: string;
  embedding: number[];
}

export interface EmbeddingIndex {
  model: string;
  dimensions: number;
  builtAt: string;
  entries: Record<string, EmbeddingEntry>;
}
