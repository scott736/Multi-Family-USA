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
  "mortgage-basics": ["single-family", "residential", "duplex", "triplex", "fourplex"],
  "mortgage-qualification": ["residential", "investment-property"],
  "refinancing-strategies": ["residential", "investment-property"],
  "commercial-lending": ["commercial", "multifamily", "office", "retail", "industrial", "mixed-use"],
  "getting-started": ["residential", "investment-property"],
  "rental-property-analysis": ["investment-property", "rental", "residential"],
  "multifamily-investing": ["multifamily", "apartment"],
  "brrrr-flipping": ["single-family", "residential"],
  "us-investing-basics": ["investment-property", "rental"],
  "dscr-foreign-national": ["investment-property", "rental"],
  "portfolio-scaling": ["investment-property", "multifamily", "residential"],
  "joint-ventures-partnerships": ["investment-property"],
  "capital-raising": ["investment-property"],
  "cross-border-tax-legal": ["investment-property"],
  "investor-mindset": ["education"],
  "success-stories": ["investment-property"],
  "team-building": ["investment-property"],
  "market-analysis": ["investment-property", "residential"],
  "property-management": ["rental", "investment-property"],
  "short-term-rentals": ["short-term-rental", "vacation-rental"],
  "private-mortgage-investing": ["passive-income", "private-lending", "secured-lending"],
  "development-investing": ["development", "capital-raising", "joint-ventures-partnerships"],
};

// ----------------
// Topic cluster + category → linkWhen heuristics
// ----------------

const TOPIC_CLUSTER_LINK_WHEN: Record<string, string[]> = {
  "mortgage-basics": [
    "when explaining core mortgage concepts or qualification basics",
    "when the reader needs foundational lending guidance",
  ],
  "mortgage-qualification": [
    "when the article discusses approval criteria or underwriting",
    "when the reader is trying to understand how to qualify",
  ],
  "refinancing-strategies": [
    "when discussing refinancing, equity access, or BRRRR refi exits",
    "when the reader wants to leverage existing property equity",
  ],
  "commercial-lending": [
    "when the article discusses commercial property financing or DSCR/NOI",
    "when the deal involves 5+ units or income-based commercial underwriting",
  ],
  "getting-started": [
    "when the article targets beginner investors exploring first steps",
    "when the reader needs an entry point to investment property financing",
  ],
  "rental-property-analysis": [
    "when analyzing rental deal metrics, cash flow, or cap rates",
    "when the reader is evaluating whether a rental property pencils out",
  ],
  "multifamily-investing": [
    "when discussing apartment buildings or scaling to multifamily",
    "when the reader is moving beyond single-family rentals",
  ],
  "brrrr-flipping": [
    "when the article covers fix-and-flip, BRRRR, or value-add renovation",
    "when short-term renovation financing is relevant",
  ],
  "us-investing-basics": [
    "when Canadians are buying or financing US investment property",
    "when cross-border US market entry is the topic",
  ],
  "dscr-foreign-national": [
    "when US DSCR or foreign national lending is discussed",
    "when qualifying on rental income without personal income docs",
  ],
  "portfolio-scaling": [
    "when the article discusses growing a rental portfolio",
    "when financing strategy shifts as unit count increases",
  ],
  "joint-ventures-partnerships": [
    "when structuring deals with partners or raising capital for acquisitions",
    "when the reader needs financing alongside partnership structures",
  ],
  "capital-raising": [
    "when raising private capital or creative financing for deals",
    "when the reader needs capital stack options beyond traditional mortgages",
  ],
  "cross-border-tax-legal": [
    "when US LLC, ITIN, or cross-border entity setup affects financing",
    "when legal structure decisions precede property acquisition",
  ],
  "investor-mindset": [
    "when the article focuses on psychology or habits with a financing intro",
    "when beginner readers need educational context before product pages",
  ],
  "success-stories": [
    "when a case study illustrates a financing strategy the reader might replicate",
    "when the narrative connects portfolio growth to specific lending products",
  ],
  "team-building": [
    "when assembling a professional team including mortgage brokers",
    "when the reader is scaling and needs financing partners",
  ],
  "market-analysis": [
    "when city or market guides connect to local financing options",
    "when market selection leads to a financing decision",
  ],
  "property-management": [
    "when operational topics tie back to financing qualification or refi",
    "when improving NOI or rents affects lending options",
  ],
  "short-term-rentals": [
    "when Airbnb, VRBO, or short-term rental financing is discussed",
    "when platform income affects mortgage qualification",
  ],
  "private-mortgage-investing": [
    "when the reader wants to lend capital as a private mortgage investor",
    "when passive secured yield, MICs, or RRSP private lending is discussed",
  ],
  "development-investing": [
    "when the reader invests equity in development projects or syndications",
    "when GP/LP structures or development partnership due diligence is the topic",
  ],
};

const CATEGORY_LINK_WHEN: Record<string, string[]> = {
  "mortgage-financing": [
    "when the article discusses mortgage products, rates, or lender options",
    "when the reader needs help choosing a financing path",
  ],
  "investing-fundamentals": [
    "when investment strategy connects to how deals get funded",
    "when the reader is learning how financing fits their investing plan",
  ],
  "scaling-portfolio": [
    "when portfolio growth requires new financing structures beyond one lender",
    "when the reader needs lender sequencing or alternative qualification paths",
  ],
  "partnerships-capital": [
    "when capital structure or partnerships affect how deals are financed",
    "when the reader combines private capital with institutional debt",
  ],
  "us-cross-border": [
    "when cross-border investing or foreign national lending is the topic",
    "when the reader is a Canadian investing outside Canada",
  ],
  "personal-finance-mindset": [
    "when personal finance decisions connect to real estate leverage",
    "when mindset content references taking action on financed deals",
  ],
};

const CATEGORY_DO_NOT_LINK_WHEN: Record<string, string[]> = {
  "mortgage-financing": [
    "when the article topic is unrelated to lending or property acquisition",
    "when a more specific regional or product pillar is the clear fit",
  ],
  "investing-fundamentals": [
    "when the reader needs a specific mortgage product page, not general strategy",
    "when financing is mentioned only in passing without actionable context",
  ],
  "scaling-portfolio": [
    "when the article is a beginner guide with no portfolio-scale financing need",
    "when the context is operational (property management) without lending angle",
  ],
  "partnerships-capital": [
    "when partnerships are discussed without property financing implications",
    "when the deal size does not involve institutional mortgage lending",
  ],
  "us-cross-border": [
    "when the article is purely about Canadian domestic lending with no cross-border angle",
    "when tax or legal topics have no financing decision attached",
  ],
  "personal-finance-mindset": [
    "when the article is motivational content without a financing call-to-action",
    "when the reader needs technical mortgage guidance, not mindset content",
  ],
};

const TOPIC_CLUSTER_DO_NOT_LINK: Record<string, string[]> = {
  "commercial-lending": [
    "when the property is 1–4 units and residential qualification applies",
    "when commercial is mentioned only to contrast with residential lending",
  ],
  "multifamily-investing": [
    "when the article focuses on single-family rentals only",
    "when unit count is 1–4 and residential financing is appropriate",
  ],
  "dscr-foreign-national": [
    "when the article is about Canadian conventional or CMHC residential mortgages",
    "when DSCR refers to Canadian commercial without US investing context",
  ],
  "us-investing-basics": [
    "when the article is about Canadian domestic investing only",
    "when US markets are mentioned only for comparison without financing intent",
  ],
  "brrrr-flipping": [
    "when the article is about long-term buy-and-hold without renovation financing",
    "when flip is mentioned as market commentary without capital needs",
  ],
  "private-mortgage-investing": [
    "when the reader is borrowing a mortgage, not investing as a lender",
    "when development equity is the primary capital deployment topic",
  ],
  "development-investing": [
    "when the reader wants secured debt income rather than equity upside",
    "when development is discussed only from a builder/borrower perspective",
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
