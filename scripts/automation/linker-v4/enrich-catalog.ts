// ============================================
// Smart Linker v6 — Catalog Enrichment
// ============================================
// Builds page-catalog.json from raw-catalog.json, pillar intent cards,
// and blog frontmatter heuristics.

import fs from "fs/promises";
import path from "path";
import type { PageCatalog, PagePurpose, RawPageData } from "./types";
import { PILLAR_INTENT_CARDS, type PillarIntentCard } from "./pillar-intent";
import {
  PURPOSE_CARD_OVERRIDES,
  applyPurposeCardOverride,
} from "./purpose-card-overrides";
import {
  deriveConceptsFromMeta,
  deriveTopicsExcluded,
  type FinancingConcept,
} from "./concept-taxonomy";
import { loadMarkdownFiles, BLOG_DIR } from "./parse";

const DATA_DIR = "src/data/linker-v4";

// ----------------
// Topic cluster → asset types
// ----------------

const TOPIC_CLUSTER_ASSET_TYPES: Record<string, string[]> = {
  "loan-products": ["multifamily", "apartment", "5-plus-unit"],
  "agency-execution": ["multifamily", "stabilized", "apartment"],
  "bridge-value-add": ["multifamily", "value-add", "transitional"],
  "underwriting-metrics": ["multifamily", "commercial"],
  "property-types": ["garden", "mid-rise", "suburban", "value-add", "multifamily"],
  "small-multifamily": ["5-10-unit", "small-multifamily", "apartment"],
  "market-geography": ["multifamily", "market"],
  "deal-execution": ["multifamily", "closing"],
  "capital-stack": ["multifamily", "capital-stack"],
  "rates-spreads": ["multifamily", "agency", "bridge"],
  "sponsor-strategy": ["multifamily", "sponsor"],
  "construction-rehab": ["multifamily", "construction", "rehab"],
};

// ----------------
// Topic cluster + category → linkWhen heuristics
// ----------------

const TOPIC_CLUSTER_LINK_WHEN: Record<string, string[]> = {
  "loan-products": [
    "when the reader needs to choose among agency, bridge, bank, CMBS, debt fund, or FHA paths",
    "when comparing multifamily loan product fit for a 5+ unit asset",
  ],
  "agency-execution": [
    "when Fannie Mae, Freddie Mac Optigo, or stabilized agency underwriting is the focus",
    "when DSCR, debt yield, and occupancy grids for agency debt are discussed",
  ],
  "bridge-value-add": [
    "when bridge, transitional, or value-add multifamily debt is the topic",
    "when extension risk, floating rate, or business-plan execution drives financing",
  ],
  "underwriting-metrics": [
    "when DSCR, debt yield, cap rate, NOI, or LTV math is central",
    "when the reader should run calculator tools before choosing a product",
  ],
  "property-types": [
    "when garden-style, mid-rise, suburban, or C-class value-add assets change lender appetite",
    "when property type drives leverage or execution channel",
  ],
  "small-multifamily": [
    "when financing 5–10 unit apartment buildings is the focus",
    "when crossing the commercial threshold from residential 1–4 unit habits",
  ],
  "market-geography": [
    "when state or city market context affects multifamily financing",
    "when tax, rent control, or local capital markets matter to lender fit",
  ],
  "deal-execution": [
    "when closing, diligence, lender docs, entity structure, or reporting is the focus",
    "when the reader needs checklists before term sheet or close",
  ],
  "capital-stack": [
    "when comparing capital paths (agency vs bridge, bank vs debt fund, fixed vs floating)",
    "when stack design or recourse structure is the decision",
  ],
  "rates-spreads": [
    "when multifamily rate, spread, or all-in cost context is the topic",
    "when pricing differences across agency, bridge, and bank matter",
  ],
  "sponsor-strategy": [
    "when sponsor profile (first-time, value-add, portfolio, institutional) drives capital strategy",
    "when the reader needs an investor playbook rather than a product page",
  ],
  "construction-rehab": [
    "when ground-up construction, major rehab, or FHA 221(d)(4) is discussed",
    "when construction loan structure or takeout planning is relevant",
  ],
};

const CATEGORY_LINK_WHEN: Record<string, string[]> = {
  fundamentals: [
    "when explaining commercial multifamily financing basics for 5+ unit assets",
    "when the reader needs an entry path into loan types or underwriting tools",
  ],
  underwriting: [
    "when metric definitions or binding constraints (DSCR, debt yield, LTV) are the focus",
    "when calculator tools are the natural next step",
  ],
  qualification: [
    "when sizing proceeds or meeting lender coverage floors is the topic",
    "when the reader needs qualification math before choosing a product",
  ],
  "capital-markets": [
    "when loan product or capital market channel selection is discussed",
    "when agency, bridge, CMBS, or FHA execution is compared",
  ],
  execution: [
    "when closing process, checklists, or deal packaging is the focus",
    "when operational execution after term sheet matters",
  ],
  risk: [
    "when rate risk, refinance planning, or downside stress is discussed",
    "when extension or exit risk should drive structure choice",
  ],
  rates: [
    "when spread or all-in borrowing cost context is the article focus",
    "when readers need rate framing before requesting quotes",
  ],
};

const CATEGORY_DO_NOT_LINK_WHEN: Record<string, string[]> = {
  fundamentals: [
    "when a specific loan product or calculator is already the clear destination",
    "when the article is a live deal review with no educational framing",
  ],
  underwriting: [
    "when metrics are mentioned only in passing without calculation intent",
    "when the reader needs a market geography page, not a metric tool",
  ],
  qualification: [
    "when the article is purely a rate update with no sizing math",
  ],
  "capital-markets": [
    "when the reader needs diligence checklists rather than product comparison",
  ],
  execution: [
    "when the article is only defining underwriting metrics with no process angle",
  ],
  risk: [
    "when risk is mentioned generically without refinance or rate exposure",
  ],
  rates: [
    "when rates are background color without pricing or spread decisions",
  ],
};

const TOPIC_CLUSTER_DO_NOT_LINK: Record<string, string[]> = {
  "loan-products": [
    "when the article is already a deep single-product loan-type page",
    "when the reader only needs a calculator with no product choice",
  ],
  "agency-execution": [
    "when the asset is clearly transitional/value-add and bridge is the fit",
    "when Fannie/Freddie are mentioned only as market commentary",
  ],
  "bridge-value-add": [
    "when the asset is fully stabilized and agency is the clear path",
  ],
  "underwriting-metrics": [
    "when numbers are not actionable and a narrative market piece is enough",
  ],
  "property-types": [
    "when property type is incidental and product selection is the real topic",
  ],
  "small-multifamily": [
    "when the deal is institutional large-scale multifamily with no 5–10 unit angle",
  ],
  "market-geography": [
    "when city or state names appear only as examples without market intent",
  ],
  "deal-execution": [
    "when the article is a rate or product overview with no process steps",
  ],
  "capital-stack": [
    "when only one product is being explained in depth",
  ],
  "rates-spreads": [
    "when rates are not the decision driver",
  ],
  "sponsor-strategy": [
    "when the focus is pure product mechanics without sponsor profile",
  ],
  "construction-rehab": [
    "when the deal is stabilized acquisition with no construction component",
  ],
};

// ----------------
// Blog frontmatter helpers
// ----------------

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const trimmed = v.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function asStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

function deriveReaderPromise(fm: Record<string, unknown>, fallback: string): string {
  const summary = fm.contentSummary;
  if (typeof summary === "string" && summary.trim()) {
    return summary.trim().replace(/\s+/g, " ");
  }
  const description = fm.description;
  if (typeof description === "string" && description.trim()) {
    return description.trim();
  }
  return fallback;
}

function deriveTopicsCovered(fm: Record<string, unknown>, tags: string[]): string[] {
  const keyTerms = asStringArray(fm.keyTerms);
  return uniqueStrings([...keyTerms, ...tags]);
}

function deriveLinkWhen(
  topicCluster: string | undefined,
  category: string,
  tags: string[]
): string[] {
  const clauses: string[] = [];

  if (topicCluster && TOPIC_CLUSTER_LINK_WHEN[topicCluster]) {
    clauses.push(...TOPIC_CLUSTER_LINK_WHEN[topicCluster]);
  }
  if (CATEGORY_LINK_WHEN[category]) {
    clauses.push(...CATEGORY_LINK_WHEN[category]);
  }

  const tagHints: Record<string, string> = {
    "dscr-loans": "when DSCR or debt service coverage is discussed",
    "fix-and-flip": "when fix-and-flip or renovation financing is relevant",
    "multifamily": "when multifamily or apartment investing is the topic",
    "cmhc": "when CMHC programs or insured financing is discussed",
    "us-investing": "when US investing or cross-border financing is the topic",
    "cross-border": "when cross-border property financing is discussed",
    "commercial-financing": "when commercial property lending is the topic",
    "self-employed": "when self-employed borrower qualification is discussed",
  };

  for (const tag of tags) {
    const hint = tagHints[tag.toLowerCase()];
    if (hint) clauses.push(hint);
  }

  return uniqueStrings(clauses).slice(0, 6);
}

function deriveDoNotLinkWhen(
  category: string,
  topicCluster: string | undefined
): string[] {
  const clauses: string[] = [];

  if (CATEGORY_DO_NOT_LINK_WHEN[category]) {
    clauses.push(...CATEGORY_DO_NOT_LINK_WHEN[category]);
  }
  if (topicCluster && TOPIC_CLUSTER_DO_NOT_LINK[topicCluster]) {
    clauses.push(...TOPIC_CLUSTER_DO_NOT_LINK[topicCluster]);
  }

  return uniqueStrings(clauses).slice(0, 5);
}

function deriveAssetTypes(
  topicCluster: string | undefined,
  category: string,
  tags: string[]
): string[] {
  if (topicCluster && TOPIC_CLUSTER_ASSET_TYPES[topicCluster]) {
    return TOPIC_CLUSTER_ASSET_TYPES[topicCluster];
  }

  const tagAssetMap: Record<string, string[]> = {
    multifamily: ["multifamily", "apartment"],
    "commercial-financing": ["commercial"],
    "commercial-mortgage": ["commercial"],
    "fix-and-flip": ["single-family", "residential"],
    "single-family": ["single-family", "residential"],
    "dscr-loans": ["investment-property", "rental"],
    "us-investing": ["investment-property"],
    "short-term-rentals": ["short-term-rental"],
    "self-storage": ["self-storage", "commercial"],
  };

  for (const tag of tags) {
    const mapped = tagAssetMap[tag.toLowerCase()];
    if (mapped) return mapped;
  }

  if (category === "us-cross-border") {
    return ["investment-property"];
  }

  return ["investment-property", "residential"];
}

function deriveQuestionsAnswered(title: string, topics: string[], category: string): string[] {
  const questions: string[] = [];
  const t = title.toLowerCase();

  if (/\bfixed\s+vs\.?\s+variable\b/i.test(title)) {
    questions.push("Should I choose a fixed or variable rate mortgage?");
    questions.push("How do fixed and variable rates affect my investment property cash flow?");
  } else if (/\bhow\s+to\b/i.test(title)) {
    const topic = title.replace(/^how\s+to\s+/i, "").replace(/\?.*$/, "").trim();
    if (topic) questions.push(`How do I ${topic.toLowerCase()}?`);
  } else if (/\bwhat\s+is\b/i.test(title)) {
    const topic = title.replace(/^what\s+is\s+/i, "").replace(/\?.*$/, "").trim();
    if (topic) questions.push(`What is ${topic.toLowerCase()}?`);
  } else if (/\bguide\b/i.test(title)) {
    questions.push(`What should I know from this guide on ${title.toLowerCase()}?`);
  }

  if (questions.length === 0 && topics.length > 0) {
    for (const topic of topics.slice(0, 2)) {
      questions.push(`How does ${topic.toLowerCase()} apply to my financing decision?`);
    }
  }

  if (questions.length === 0 && category === "scaling-portfolio") {
    questions.push("How do I finance portfolio growth as I acquire more properties?");
  }

  return uniqueStrings(questions).slice(0, 5);
}

function applyPillarIntent(raw: RawPageData, card: PillarIntentCard): PagePurpose {
  const financingConcepts = deriveConceptsFromMeta(
    raw.title,
    card.readerPromise,
    raw.tags || [],
    card.topicsCovered,
    card.readerPromise
  ) as FinancingConcept[];

  let page: PagePurpose = {
    slug: raw.slug,
    url: raw.url,
    title: raw.title,
    type: raw.type,
    description: raw.description,
    region: raw.region,
    category: raw.category,
    tags: raw.tags || [],
    isTooltipOnly: raw.isTooltipOnly,
    readerPromise: card.readerPromise,
    topicsCovered: card.topicsCovered,
    questionsAnswered: card.questionsAnswered,
    linkWhen: card.linkWhen,
    doNotLinkWhen: card.doNotLinkWhen,
    assetTypes: card.assetTypes,
    unitRange: card.unitRange,
    financingConcepts,
    topicsExcluded: deriveTopicsExcluded(financingConcepts),
  };

  const override = PURPOSE_CARD_OVERRIDES.find((o) => o.slug === raw.slug);
  if (override) {
    page = applyPurposeCardOverride(page, override);
  }

  return page;
}

function enrichBlogPost(raw: RawPageData, fm: Record<string, unknown>): PagePurpose {
  const topicCluster =
    typeof fm.topicCluster === "string" ? fm.topicCluster : undefined;
  const tags = raw.tags || [];
  const topicsCovered = deriveTopicsCovered(fm, tags);
  const readerPromise = deriveReaderPromise(fm, raw.description);
  const financingConcepts = deriveConceptsFromMeta(
    raw.title,
    raw.description,
    tags,
    topicsCovered,
    readerPromise
  ) as FinancingConcept[];

  let page: PagePurpose = {
    slug: raw.slug,
    url: raw.url,
    title: raw.title,
    type: raw.type,
    description: raw.description,
    region: raw.region,
    category: raw.category,
    tags,
    isTooltipOnly: raw.isTooltipOnly,
    readerPromise,
    topicsCovered,
    questionsAnswered: deriveQuestionsAnswered(raw.title, topicsCovered, raw.category),
    linkWhen: deriveLinkWhen(topicCluster, raw.category, tags),
    doNotLinkWhen: deriveDoNotLinkWhen(raw.category, topicCluster),
    assetTypes: deriveAssetTypes(topicCluster, raw.category, tags),
    financingConcepts,
    topicsExcluded: deriveTopicsExcluded(financingConcepts),
  };

  const override = PURPOSE_CARD_OVERRIDES.find((o) => o.slug === raw.slug);
  if (override) {
    page = applyPurposeCardOverride(page, override);
  }

  return page;
}

function enrichFallback(raw: RawPageData): PagePurpose {
  const topicsCovered = uniqueStrings([...(raw.tags || [])]);

  return {
    slug: raw.slug,
    url: raw.url,
    title: raw.title,
    type: raw.type,
    description: raw.description,
    region: raw.region,
    category: raw.category,
    tags: raw.tags || [],
    isTooltipOnly: raw.isTooltipOnly,
    readerPromise: raw.description,
    topicsCovered,
    questionsAnswered: [],
    linkWhen: CATEGORY_LINK_WHEN[raw.category] || [],
    doNotLinkWhen: CATEGORY_DO_NOT_LINK_WHEN[raw.category] || [],
    assetTypes: deriveAssetTypes(undefined, raw.category, raw.tags || []),
  };
}

function enrichPage(raw: RawPageData, blogBySlug: Map<string, Record<string, unknown>>): PagePurpose {
  const pillarCard = PILLAR_INTENT_CARDS[raw.slug];
  if (pillarCard) {
    return applyPillarIntent(raw, pillarCard);
  }

  if (raw.type === "post") {
    const fm = blogBySlug.get(raw.slug);
    if (fm) {
      return enrichBlogPost(raw, fm);
    }
  }

  return enrichFallback(raw);
}

// ----------------
// Main export
// ----------------

export async function enrichPageCatalog(): Promise<PageCatalog> {
  const dataDir = path.resolve(DATA_DIR);
  const rawPath = path.join(dataDir, "raw-catalog.json");
  const catalogPath = path.join(dataDir, "page-catalog.json");

  const rawData: { pages: RawPageData[]; generatedAt?: string; totalPages?: number } =
    JSON.parse(await fs.readFile(rawPath, "utf-8"));

  const blogPosts = await loadMarkdownFiles(BLOG_DIR);
  const blogBySlug = new Map<string, Record<string, unknown>>();
  for (const post of blogPosts) {
    blogBySlug.set(post.slug, post.frontmatter);
  }

  const pages = rawData.pages.map((p) => enrichPage(p, blogBySlug));

  const catalog: PageCatalog = {
    generatedAt: new Date().toISOString(),
    totalPages: pages.length,
    pages,
  };

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2));

  const pillarCount = pages.filter((p) => PILLAR_INTENT_CARDS[p.slug]).length;
  const postCount = pages.filter((p) => p.type === "post").length;

  console.log(`  Enriched catalog: ${catalogPath}`);
  console.log(`    Pillar intent cards applied: ${pillarCount}`);
  console.log(`    Blog posts enriched: ${postCount}`);

  return catalog;
}
