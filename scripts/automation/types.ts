// ============================================
// Multi-Family USA Automation System - Type Definitions
// ============================================

// ----------------
// Enums
// ----------------

export type Category =
  | "mortgage-financing"
  | "investing-fundamentals"
  | "scaling-portfolio"
  | "partnerships-capital"
  | "us-cross-border"
  | "personal-finance-mindset";

export type TopicCluster =
  | "mortgage-basics"
  | "mortgage-qualification"
  | "refinancing-strategies"
  | "commercial-lending"
  | "getting-started"
  | "rental-property-analysis"
  | "multifamily-investing"
  | "brrrr-flipping"
  | "portfolio-scaling"
  | "joint-ventures-partnerships"
  | "capital-raising"
  | "us-investing-basics"
  | "dscr-foreign-national"
  | "cross-border-tax-legal"
  | "investor-mindset"
  | "success-stories"
  | "team-building"
  | "market-analysis"
  | "property-management"
  | "short-term-rentals"
  | "private-mortgage-investing"
  | "development-investing";

export type FunnelStage = "awareness" | "consideration" | "decision";

export type TargetPersona =
  | "beginner"
  | "scaling-investor"
  | "cross-border"
  | "professional";

export type Region = "canada" | "usa" | "both" | "mexico";

export type Priority = "low" | "normal" | "high";
export type QueueStatus = "ready" | "merged" | "hold";
export type QueueRegion = "canada" | "usa" | "both";

export type ArticleSource = "manual" | "podcast" | "import";

// ----------------
// Blog Post
// ----------------

export interface BlogPostFrontmatter {
  title: string;
  description: string;
  pubDate: Date;
  updatedDate?: Date;
  image?: string;
  authorImage?: string;
  authorName?: string;
  category: Category;
  tags: string[];
  keyTerms?: string[];

  // Smart Linker fields
  topicCluster?: TopicCluster;
  funnelStage?: FunnelStage;
  targetPersona?: TargetPersona;
  region: Region;
  extractedKeywords?: string[];
  contentSummary?: string;
  qualityScore?: number;
  isPillar: boolean;
  isEvergreen: boolean;
  seasonalRelevance?: string[];
  // LLM semantic analysis fields (populated by --generate-prompts / --import-results or API)
  semanticThemes?: string[];
  linkableTopics?: string[];
  idealIncomingAnchors?: string[];
  focusKeyphrase?: string; // Single most important keyword phrase for this post (used as preferred anchor text by other posts)

  // Processing tracking fields
  enrichedAt?: string; // ISO date when post was last enriched
  metaGeneratedAt?: string; // ISO date when SEO meta was last generated

  // SEO meta fields (separate from title/description which are content-focused)
  seoTitle?: string; // SEO-optimized title (50-60 chars)
  seoDescription?: string; // SEO meta description (150-160 chars)

  // Podcast fields
  podcastEpisodeId?: string;
  podcastShowId?: string;
  podcastEmbed?: string;
}

export interface BlogPost {
  slug: string;
  frontmatter: BlogPostFrontmatter;
  content: string;
  filePath: string;
}

// ----------------
// Queue Article
// ----------------

export interface QueueArticleFrontmatter {
  title: string;
  description?: string;
  category?: Category;
  tags?: string[];
  queuedAt: Date;
  priority: Priority;
  skipEnhancement: boolean;
  source: ArticleSource;
  status?: QueueStatus;
  canonicalTopicId?: string;
  mergeInto?: string;
  funnelStage?: FunnelStage;
  region?: QueueRegion;
  keyTerms?: string[];
}

export interface QueueArticle {
  slug: string;
  frontmatter: QueueArticleFrontmatter;
  content: string;
  filePath: string;
}

// ----------------
// Smart Linker
// ----------------

export interface LinkSuggestion {
  targetSlug: string;
  targetTitle: string;
  targetUrl: string;
  targetType: "post" | "page" | "glossary";
  score: number;
  breakdown: ScoreBreakdown;
  anchorOptions: string[];
  reason: string;
}

// ----------------
// Pillar Pages (Service/Location Pages)
// ----------------

export interface PillarPage {
  slug: string;
  url: string;
  title: string;
  isPillar: boolean;
  priority: number;
  topicClusters: TopicCluster[];
  matchingKeywords: string[];
  matchingTags: string[];
  anchorTextSuggestions: string[];
  region: Region;
}

export interface PillarPagesConfig {
  description: string;
  updatedAt: string;
  pages: PillarPage[];
}

export interface ScoreBreakdown {
  clusterMatch: number;
  funnelFlow: number;
  personaMatch: number;
  tagOverlap: number;
  keywordOverlap: number;
  qualityScore: number;
  pillarBonus: number;
  orphanBoost: number;
  freshnessDecay: number;
  reciprocalPenalty: number;
  diversityPenalty: number;
  geographicBoost: number;
  seasonalBoost: number;
}

export interface PostSuggestions {
  slug: string;
  generatedAt: string;
  suggestions: LinkSuggestion[];
  stats: {
    candidatesConsidered: number;
    afterScoring: number;
    afterReranking: number;
  };
}

export interface PostMetadata {
  slug: string;
  title: string;
  description: string;
  category: Category;
  tags: string[];
  topicCluster?: TopicCluster;
  funnelStage?: FunnelStage;
  targetPersona?: TargetPersona;
  region: Region;
  extractedKeywords?: string[];
  qualityScore?: number;
  isPillar: boolean;
  isEvergreen: boolean;
  pubDate: string;
  inboundLinks: string[];
  outboundLinks: string[];
  // LLM semantic analysis fields (used by AI smart linker v2)
  semanticThemes?: string[];
  focusKeyphrase?: string;
  idealIncomingAnchors?: string[];
  linkableTopics?: string[];
}

export interface LinkGraph {
  [slug: string]: {
    inbound: string[];
    outbound: string[];
  };
}

export interface DashboardStats {
  generatedAt: string | null;
  totalPosts: number;
  postsWithSuggestions: number;
  orphanPosts: Array<{ slug: string; inboundCount: number }>;
  overLinkedPosts: Array<{ slug: string; inboundCount: number }>;
  clusterDistribution: Record<TopicCluster, number>;
  funnelCoverage: Record<FunnelStage, number>;
  recentActivity: Array<{
    slug: string;
    suggestionsGenerated: number;
    timestamp: string;
  }>;
}

// ----------------
// Podcast
// ----------------

export interface TransistorEpisode {
  id: string;
  title: string;
  shareUrl: string;
  showId: string;
  publishedAt: string;
}

export interface ProcessedEpisode {
  episodeId: string;
  title: string;
  slug: string;
  processedAt: string;
  showId: string;
}

export interface ShowMapping {
  category: Category;
  defaultPersona: TargetPersona;
  defaultCluster: TopicCluster;
}

export interface GeneratedArticle {
  title: string;
  description: string;
  content: string;
  tags: string[];
  category: Category;
  topicCluster: TopicCluster;
  funnelStage: FunnelStage;
  targetPersona: TargetPersona;
  region: Region;
  faqs: Array<{ question: string; answer: string }>;
  imageSearchQuery: string;
}

// ----------------
// Configuration
// ----------------

export interface AutomationConfig {
  scheduler: {
    publishFrequency: number;
    publishTime: string;
    minScheduledPosts: number;
    defaultCategory: Category;
    shuffleQueue: boolean;
  };
  podcast: {
    showMapping: Record<string, ShowMapping>;
    autoPublish: boolean;
    saveToQueue: boolean;
  };
  images: {
    maxWidth: number;
    quality: number;
    format: "webp" | "jpeg" | "png";
  };
}

// ----------------
// CLI Options
// ----------------

export interface CLIOptions {
  feature?: string;
  mode?: string;
  slug?: string;
  file?: string;
  episodeId?: string;
  shareUrl?: string;
  showId?: string;
  all?: boolean;
  useApi?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  generatePrompts?: boolean;
  importResults?: boolean;
  // New options for skip processed, meta generation, and link removal
  skipProcessed?: boolean;
  generateMeta?: boolean;
  skipMeta?: boolean;
  removeLinks?: boolean;
  bulkRemoveLinks?: boolean;
  // Smart CTA rescan filters
  skipExisting?: boolean;
  category?: string;
  /** Skip API call and use template-only path for Smart CTA rescan/generate. */
  noApi?: boolean;
  /** Locale for blog content: en | es | fr. Defaults to en. */
  locale?: string;
  /** Content collection: blog | glossary. Defaults to blog. */
  collection?: string;
  // Content updater options
  threshold?: number;
  maxPosts?: number;
  // Linker v4 API options
  concurrency?: number;
  model?: string;
  highConfidenceOnly?: boolean;
  /** Keep strategy-call / CTA links when stripping (default true). */
  preserveCta?: boolean;
  /** Enable a second LLM pass to prune the accepted set after validation. Default: true. */
  rerank?: boolean;
  // Force a rebuild even when the catalog inputs hash is unchanged
  force?: boolean;
  // SEO competitor analysis options
  competitor?: string;
  keywords?: string;
  url?: string;
  prompt?: string;
  to?: string;
  baselineDate?: string;
  // Scheduler catch-up: publish multiple articles in one run
  count?: number;
  /** Required for full-list newsletter send (not --to preview). */
  confirmSend?: boolean;
  /** Newsletter edition date YYYY-MM-DD (send-approved / preflight). */
  edition?: string;
  /** Newsletter subject (send-approved / preflight). */
  subject?: string;
  /** Override pubDate for scheduler publish (YYYY-MM-DD). */
  pubDate?: string;
  /** HTML artifact path for send-approved. */
  htmlFile?: string;
}
