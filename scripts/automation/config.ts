// ============================================
// Multi-Family USA Automation System - Configuration
// ============================================

import type { TopicCluster, Category, TargetPersona, AutomationConfig } from "./types";
import configJson from "../../src/data/automation/config.json";

// Export loaded config
export const config = configJson as AutomationConfig;

// ----------------
// Model IDs
// ----------------

export const MODELS = {
  /** Heavy content work: article writing, enhancement, glossary definitions */
  CONTENT: "grok-4.5",
  /** Lighter analysis: metadata enrichment, SEO meta, link suggestions */
  ANALYSIS: "grok-4.5",
  /** Utilitarian tasks: translation, basic cleanup, Smart CTAs */
  UTILITY: "grok-4.5",
} as const;

// ----------------
// Cluster Adjacency Map
// ----------------
// Defines which clusters are related for scoring purposes

// ----------------
// Category to Cluster Mapping
// ----------------
// Default cluster assignments based on category

export const CATEGORY_TO_CLUSTERS: Record<Category, TopicCluster[]> = {
  fundamentals: ["loan-products", "small-multifamily", "underwriting-metrics"],
  underwriting: ["underwriting-metrics", "loan-products", "capital-stack"],
  qualification: ["underwriting-metrics", "agency-execution", "loan-products"],
  "capital-markets": [
    "loan-products",
    "agency-execution",
    "bridge-value-add",
    "capital-stack",
  ],
  execution: ["deal-execution", "bridge-value-add", "construction-rehab"],
  risk: ["rates-spreads", "deal-execution", "capital-stack"],
  rates: ["rates-spreads", "agency-execution", "loan-products"],
};

// ----------------
// Approved Tags
// ----------------

export const APPROVED_TAGS = [
  "agency",
  "fannie-mae",
  "freddie-mac",
  "bridge",
  "bank-balance-sheet",
  "cmbs",
  "debt-fund",
  "fha-hud",
  "commercial-dscr",
  "debt-yield",
  "cap-rate",
  "noi",
  "ltv",
  "loan-sizing",
  "garden-style",
  "mid-rise",
  "value-add",
  "small-multifamily",
  "5-plus-unit",
  "states",
  "cities",
  "checklists",
  "closing",
  "entity-structure",
  "capital-stack",
  "rates",
  "spreads",
  "construction",
  "cash-out-refinance",
  "sponsor",
];

// ----------------
// Writing Style Prompts
// ----------------

export const WRITING_STYLE_PROMPT = `
Write like Brandon Turner (BiggerPockets) or Gary Keller (Keller Williams) - conversational, actionable, and investor-focused.

Voice characteristics:
- Talk TO the reader like a friend who's been there
- Share "I've seen investors..." or "Here's what works..."
- Use simple, everyday language - no jargon without explaining it
- Short, punchy sentences that hit hard
- Break up complex ideas into digestible chunks
- Be direct: "Do this. Don't do that."
- Use "you" and "your" constantly
- Include real numbers and examples
- Sound like you're coaching, not lecturing

NEVER use:
- Corporate buzzwords: navigate, leverage, utilize, optimize, synergy
- Filler phrases: "It's important to note", "In today's market", "At the end of the day"
- "In conclusion" or "To summarize"
- Passive voice when active is clearer
- Wishy-washy qualifiers: "might", "could potentially", "it's possible that"
`;

const CANADIAN_CONTEXT_PROMPT = `
For Canadian content:
- Use "you" (Canadian investor) perspective
- Reference Canadian cities, lenders, regulations
- CMHC, provincial rules, CAD amounts
- "Here in Canada..." or "For us Canadians..."
`;

const US_CONTEXT_PROMPT = `
For US content:
- Use American market context
- Reference US cities, Fannie/Freddie, USD
- State-specific rules when relevant
- "In the US market..." or "American investors..."
`;

// ----------------
// SEO Prompts
// ----------------

const SEO_TITLE_PROMPT = `
Generate an SEO-optimized title (50-60 chars):
- Front-load the primary keyword
- Include a benefit or hook
- Use numbers when applicable ("5 Ways to...", "$100K...")
- No years (keep evergreen)
- Match search intent (how-to, guide, tips)

GOOD: "BRRRR Strategy: Build a $1M Portfolio with One Property"
BAD: "Everything You Need to Know About the BRRRR Strategy in 2026"
`;

const SEO_DESCRIPTION_PROMPT = `
Generate a meta description (150-160 chars):
- Start with action verb or benefit
- Include primary and secondary keywords naturally
- End with value proposition or CTA hook
- Match the content's promise

GOOD: "Learn how Canadian investors use DSCR loans to buy US rentals without income verification. Step-by-step guide with real numbers and lender contacts."
BAD: "This article discusses DSCR loans and how they can be used by investors."
`;

// ----------------
// Scoring Constants
// ----------------

// ----------------
// Pillar Component Prefixes
// ----------------
// Maps pillar page slug to its component file prefix for content extraction

// ----------------
// File Paths
// ----------------

export const PATHS = {
  BLOG_CONTENT: "src/content/blog",
  BLOG_ROOT: "src/content/blog",
  QUEUE_CONTENT: "src/drafts/queue",
  BLOG_IMAGES: "src/assets/blog-images",
  AUTOMATION_DATA: "src/data/automation",
  LINKER_V4: "src/data/linker-v4",
};

// ----------------
// Show Mapping (Podcast)
// ----------------
// Maps Transistor show IDs to content settings

export const SHOW_MAPPING: Record<
  string,
  {
    category: string;
    defaultPersona: TargetPersona;
    defaultCluster: TopicCluster;
    autoPublish?: boolean;
  }
> = {
  default: {
    category: "fundamentals",
    defaultPersona: "value-add-sponsor",
    defaultCluster: "loan-products",
    autoPublish: false,
  },
};

// ----------------
// Prompts (Combined for easy access)
// ----------------

export const PROMPTS = {
  WRITING_STYLE: WRITING_STYLE_PROMPT,
  CANADIAN_CONTEXT: CANADIAN_CONTEXT_PROMPT,
  US_CONTEXT: US_CONTEXT_PROMPT,
  SEO: `${SEO_TITLE_PROMPT}\n\n${SEO_DESCRIPTION_PROMPT}`,
  SEO_TITLE: SEO_TITLE_PROMPT,
  SEO_DESCRIPTION: SEO_DESCRIPTION_PROMPT,
};

