import { getCollection, type CollectionEntry } from "astro:content";

import { filterPublished } from "@/lib/scheduled-publish";

export type ContentKind =
  | "guide"
  | "tool"
  | "state"
  | "city"
  | "loanType"
  | "propertyType"
  | "comparison"
  | "investorProfile"
  | "blog";

export type RelatedLinkType =
  | "guide"
  | "tool"
  | "state"
  | "city"
  | "loan-type"
  | "property-type"
  | "comparison"
  | "investor-profile"
  | "blog";

export interface RelatedLink {
  href: string;
  title: string;
  description?: string;
  type: RelatedLinkType;
}

export interface RelatedLinkInput {
  kind: ContentKind;
  slug: string;
  title: string;
  description?: string;
  keywords?: string[];
  category?: string;
  stateCode?: string;
  stateName?: string;
  relatedTools?: string[];
  relatedGuides?: string[];
  relatedStates?: string[];
  relatedCities?: string[];
  relatedLoanTypes?: string[];
  relatedPropertyTypes?: string[];
  relatedComparisons?: string[];
  relatedInvestorProfiles?: string[];
  relatedBlog?: string[];
  limit?: number;
}

interface ToolDefinition {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
}

interface Candidate extends RelatedLink {
  slug: string;
  score: number;
  tokens: Set<string>;
  stateCode?: string;
  category?: string;
}

type StateEntry = CollectionEntry<"states">;
type CityEntry = CollectionEntry<"cities">;
type GuideEntry = CollectionEntry<"guides">;
type LoanTypeEntry = CollectionEntry<"loanTypes">;
type PropertyTypeEntry = CollectionEntry<"propertyTypes">;
type ComparisonEntry = CollectionEntry<"comparisons">;
type InvestorProfileEntry = CollectionEntry<"investorProfiles">;
type BlogEntry = CollectionEntry<"blog">;

interface RelatedCollections {
  states: StateEntry[];
  cities: CityEntry[];
  guides: GuideEntry[];
  loanTypes: LoanTypeEntry[];
  propertyTypes: PropertyTypeEntry[];
  comparisons: ComparisonEntry[];
  investorProfiles: InvestorProfileEntry[];
  blog: BlogEntry[];
}

const TOOL_CATALOG: ToolDefinition[] = [
  {
    slug: "commercial-dscr-calculator",
    title: "Commercial DSCR Calculator",
    description: "Stress-test debt service coverage for 5+ unit multifamily deals.",
    keywords: ["dscr", "coverage", "debt service", "qualification", "underwriting"],
  },
  {
    slug: "cap-rate-noi-calculator",
    title: "Cap Rate & NOI Calculator",
    description: "Turn income and expense assumptions into NOI and cap-rate outputs.",
    keywords: ["cap rate", "noi", "net operating income", "valuation"],
  },
  {
    slug: "debt-yield-calculator",
    title: "Debt Yield Calculator",
    description: "Calculate debt yield and pressure-test lender-side risk tolerance.",
    keywords: ["debt yield", "proceeds", "loan sizing", "lender risk"],
  },
  {
    slug: "loan-sizing-calculator",
    title: "Loan Sizing Calculator",
    description: "Estimate maximum proceeds across DSCR, debt yield, and leverage constraints.",
    keywords: ["loan sizing", "proceeds", "ltv", "debt yield", "dscr"],
  },
  {
    slug: "cash-on-cash-calculator",
    title: "Cash-on-Cash Calculator",
    description: "Estimate annual equity return based on net cash flow and invested capital.",
    keywords: ["cash on cash", "equity return", "yield", "cash flow"],
  },
];

const TYPE_AFFINITY: Record<ContentKind, Partial<Record<RelatedLinkType, number>>> = {
  guide: {
    tool: 7,
    "loan-type": 6,
    comparison: 6,
    "property-type": 5,
    blog: 4,
    "investor-profile": 3,
  },
  tool: {
    guide: 8,
    comparison: 7,
    "loan-type": 5,
    "property-type": 4,
    "investor-profile": 4,
    blog: 3,
  },
  state: {
    city: 9,
    "loan-type": 6,
    tool: 5,
    guide: 5,
    "property-type": 4,
    comparison: 3,
  },
  city: {
    state: 9,
    "loan-type": 6,
    tool: 5,
    guide: 5,
    "property-type": 4,
    comparison: 3,
  },
  loanType: {
    guide: 7,
    tool: 6,
    comparison: 6,
    "property-type": 4,
    state: 3,
    city: 3,
  },
  propertyType: {
    guide: 7,
    tool: 6,
    "loan-type": 6,
    comparison: 4,
    state: 3,
    city: 3,
  },
  comparison: {
    guide: 7,
    tool: 7,
    "loan-type": 5,
    "property-type": 4,
    "investor-profile": 4,
    blog: 3,
  },
  investorProfile: {
    guide: 7,
    tool: 6,
    comparison: 6,
    "loan-type": 5,
    "property-type": 4,
    blog: 3,
  },
  blog: {
    guide: 7,
    tool: 6,
    comparison: 5,
    "loan-type": 5,
    "property-type": 4,
    "investor-profile": 4,
    state: 3,
    city: 3,
  },
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "us",
  "with",
  "your",
  "you",
  "why",
  "how",
  "what",
]);

const COLLECTION_PREFIX: Record<RelatedLinkType, string> = {
  guide: "/learn/",
  tool: "/tools/",
  state: "/states/",
  city: "/cities/",
  "loan-type": "/loan-types/",
  "property-type": "/property-types/",
  comparison: "/compare/",
  "investor-profile": "/invest/",
  blog: "/blog/",
};

const RELATED_FIELD_TO_TYPE: Array<[keyof RelatedLinkInput, RelatedLinkType]> = [
  ["relatedTools", "tool"],
  ["relatedGuides", "guide"],
  ["relatedStates", "state"],
  ["relatedCities", "city"],
  ["relatedLoanTypes", "loan-type"],
  ["relatedPropertyTypes", "property-type"],
  ["relatedComparisons", "comparison"],
  ["relatedInvestorProfiles", "investor-profile"],
  ["relatedBlog", "blog"],
];

const relatedCollectionsCache: { promise: Promise<RelatedCollections> | null } = {
  promise: null,
};

function idToSlug(id: string): string {
  return id.replace(/\.mdx$/, "");
}

function withTrailingSlash(href: string): string {
  const clean = href.endsWith("/") ? href : `${href}/`;
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function normalizeTokenSource(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenize(...values: Array<string | undefined>): Set<string> {
  const tokens = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const token of normalizeTokenSource(value).split(/\s+/)) {
      if (!token || STOP_WORDS.has(token) || token.length < 2) continue;
      tokens.add(token);
    }
  }
  return tokens;
}

function keywordTokens(keywords?: string[]): Set<string> {
  if (!keywords?.length) return new Set<string>();
  return tokenize(keywords.join(" "));
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let score = 0;
  for (const token of a) {
    if (b.has(token)) score += 1;
  }
  return score;
}

function normalizeExplicitTarget(raw: string, type: RelatedLinkType): string | null {
  const value = raw.trim();
  if (!value) return null;

  const noExt = value.replace(/\.mdx$/, "");
  if (!noExt.startsWith("/")) {
    return noExt
      .replace(/^tools\//, "")
      .replace(/^learn\//, "")
      .replace(/^states\//, "")
      .replace(/^cities\//, "")
      .replace(/^loan-types\//, "")
      .replace(/^property-types\//, "")
      .replace(/^compare\//, "")
      .replace(/^invest\//, "")
      .replace(/^blog\//, "");
  }

  const expectedPrefix = COLLECTION_PREFIX[type];
  if (!noExt.startsWith(expectedPrefix)) return null;
  return noExt.slice(expectedPrefix.length).replace(/\/+$/, "");
}

async function loadCollections(): Promise<RelatedCollections> {
  if (relatedCollectionsCache.promise) return relatedCollectionsCache.promise;

  relatedCollectionsCache.promise = Promise.all([
    getCollection("states"),
    getCollection("cities"),
    getCollection("guides"),
    getCollection("loanTypes"),
    getCollection("propertyTypes"),
    getCollection("comparisons"),
    getCollection("investorProfiles"),
    getCollection("blog"),
  ]).then(
    ([
      states,
      cities,
      guides,
      loanTypes,
      propertyTypes,
      comparisons,
      investorProfiles,
      blog,
    ]) => ({
      states,
      cities,
      guides,
      loanTypes,
      propertyTypes,
      comparisons,
      investorProfiles,
      blog: filterPublished(blog),
    }),
  );

  return relatedCollectionsCache.promise;
}

function buildCandidates(collections: RelatedCollections): Candidate[] {
  const fromGuides: Candidate[] = collections.guides.map((entry) => {
    const slug = idToSlug(entry.id);
    return {
      slug,
      href: withTrailingSlash(`/learn/${slug}`),
      title: entry.data.title,
      description: entry.data.description,
      type: "guide",
      category: entry.data.category,
      stateCode: undefined,
      tokens: new Set([
        ...tokenize(slug, entry.data.title, entry.data.description, entry.data.category),
        ...keywordTokens(entry.data.keywords),
      ]),
      score: 0,
    };
  });

  const fromStates: Candidate[] = collections.states.map((entry) => {
    const slug = idToSlug(entry.id);
    return {
      slug,
      href: withTrailingSlash(`/states/${slug}`),
      title: entry.data.title,
      description: entry.data.description,
      type: "state",
      stateCode: entry.data.stateCode,
      tokens: new Set([
        ...tokenize(slug, entry.data.title, entry.data.description, entry.data.stateName),
        ...keywordTokens(entry.data.keywords),
      ]),
      score: 0,
    };
  });

  const fromCities: Candidate[] = collections.cities.map((entry) => {
    const slug = idToSlug(entry.id);
    return {
      slug,
      href: withTrailingSlash(`/cities/${slug}`),
      title: entry.data.title,
      description: entry.data.description,
      type: "city",
      stateCode: entry.data.stateCode,
      tokens: new Set([
        ...tokenize(
          slug,
          entry.data.title,
          entry.data.description,
          entry.data.cityName,
          entry.data.stateName,
        ),
        ...keywordTokens(entry.data.keywords),
      ]),
      score: 0,
    };
  });

  const fromLoanTypes: Candidate[] = collections.loanTypes.map((entry) => {
    const slug = idToSlug(entry.id);
    return {
      slug,
      href: withTrailingSlash(`/loan-types/${slug}`),
      title: entry.data.title,
      description: entry.data.description,
      type: "loan-type",
      tokens: new Set([
        ...tokenize(slug, entry.data.title, entry.data.description, entry.data.loanType),
        ...keywordTokens(entry.data.keywords),
      ]),
      score: 0,
    };
  });

  const fromPropertyTypes: Candidate[] = collections.propertyTypes.map((entry) => {
    const slug = idToSlug(entry.id);
    return {
      slug,
      href: withTrailingSlash(`/property-types/${slug}`),
      title: entry.data.title,
      description: entry.data.description,
      type: "property-type",
      tokens: new Set([
        ...tokenize(
          slug,
          entry.data.title,
          entry.data.description,
          entry.data.propertyType,
          entry.data.typicalCapRateBand,
        ),
        ...keywordTokens(entry.data.keywords),
      ]),
      score: 0,
    };
  });

  const fromComparisons: Candidate[] = collections.comparisons.map((entry) => {
    const slug = idToSlug(entry.id);
    return {
      slug,
      href: withTrailingSlash(`/compare/${slug}`),
      title: entry.data.title,
      description: entry.data.description,
      type: "comparison",
      tokens: new Set([
        ...tokenize(
          slug,
          entry.data.title,
          entry.data.description,
          entry.data.productA,
          entry.data.productB,
        ),
        ...keywordTokens(entry.data.keywords),
      ]),
      score: 0,
    };
  });

  const fromInvestorProfiles: Candidate[] = collections.investorProfiles.map((entry) => {
    const slug = idToSlug(entry.id);
    return {
      slug,
      href: withTrailingSlash(`/invest/${slug}`),
      title: entry.data.title,
      description: entry.data.description,
      type: "investor-profile",
      tokens: new Set([
        ...tokenize(slug, entry.data.title, entry.data.description, entry.data.profile),
        ...keywordTokens(entry.data.keywords),
      ]),
      score: 0,
    };
  });

  const fromBlog: Candidate[] = collections.blog.map((entry) => {
    const slug = idToSlug(entry.id);
    return {
      slug,
      href: withTrailingSlash(`/blog/${slug}`),
      title: entry.data.title,
      description: entry.data.description,
      type: "blog",
      category: entry.data.category,
      tokens: new Set([
        ...tokenize(slug, entry.data.title, entry.data.description, entry.data.category),
        ...keywordTokens(entry.data.keywords),
      ]),
      score: 0,
    };
  });

  const fromTools: Candidate[] = TOOL_CATALOG.map((tool) => ({
    slug: tool.slug,
    href: withTrailingSlash(`/tools/${tool.slug}`),
    title: tool.title,
    description: tool.description,
    type: "tool",
    tokens: tokenize(tool.slug, tool.title, tool.description, tool.keywords.join(" ")),
    score: 0,
  }));

  return [
    ...fromGuides,
    ...fromStates,
    ...fromCities,
    ...fromLoanTypes,
    ...fromPropertyTypes,
    ...fromComparisons,
    ...fromInvestorProfiles,
    ...fromBlog,
    ...fromTools,
  ];
}

function getSelfHref(kind: ContentKind, slug: string): string {
  switch (kind) {
    case "guide":
      return withTrailingSlash(`/learn/${slug}`);
    case "tool":
      return withTrailingSlash(`/tools/${slug}`);
    case "state":
      return withTrailingSlash(`/states/${slug}`);
    case "city":
      return withTrailingSlash(`/cities/${slug}`);
    case "loanType":
      return withTrailingSlash(`/loan-types/${slug}`);
    case "propertyType":
      return withTrailingSlash(`/property-types/${slug}`);
    case "comparison":
      return withTrailingSlash(`/compare/${slug}`);
    case "investorProfile":
      return withTrailingSlash(`/invest/${slug}`);
    case "blog":
      return withTrailingSlash(`/blog/${slug}`);
  }
}

function relatedTypeFromKind(kind: ContentKind): RelatedLinkType {
  switch (kind) {
    case "guide":
      return "guide";
    case "tool":
      return "tool";
    case "state":
      return "state";
    case "city":
      return "city";
    case "loanType":
      return "loan-type";
    case "propertyType":
      return "property-type";
    case "comparison":
      return "comparison";
    case "investorProfile":
      return "investor-profile";
    case "blog":
      return "blog";
  }
}

export async function getRelatedLinks(input: RelatedLinkInput): Promise<RelatedLink[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 6, 6));
  const collections = await loadCollections();
  const candidates = buildCandidates(collections);
  const selfHref = getSelfHref(input.kind, input.slug);
  const selfType = relatedTypeFromKind(input.kind);

  const targetTokens = new Set([
    ...tokenize(input.slug, input.title, input.description, input.category, input.stateName),
    ...keywordTokens(input.keywords),
  ]);

  const explicitByType = new Map<RelatedLinkType, Set<string>>();
  for (const [field, type] of RELATED_FIELD_TO_TYPE) {
    const values = input[field];
    if (!Array.isArray(values)) continue;
    const normalized = values
      .map((value) => normalizeExplicitTarget(value, type))
      .filter((value): value is string => Boolean(value));
    if (!normalized.length) continue;
    explicitByType.set(type, new Set(normalized));
  }

  const preferredTypes = TYPE_AFFINITY[input.kind];
  const scored = candidates
    .filter((candidate) => candidate.href !== selfHref)
    .map((candidate) => {
      let score = 0;
      const overlap = overlapScore(targetTokens, candidate.tokens);
      score += overlap * 4;
      score += preferredTypes[candidate.type] ?? 0;

      if (input.category && candidate.category && input.category === candidate.category) {
        score += 4;
      }

      if (input.stateCode && candidate.stateCode && input.stateCode === candidate.stateCode) {
        score += 10;
      } else if (input.stateCode && candidate.stateCode) {
        score -= 1;
      }

      if (input.kind === "state" && candidate.type === "city" && input.stateCode === candidate.stateCode) {
        score += 8;
      }
      if (input.kind === "city" && candidate.type === "state" && input.stateCode === candidate.stateCode) {
        score += 8;
      }

      const explicitSlugs = explicitByType.get(candidate.type);
      if (explicitSlugs?.has(candidate.slug)) {
        score += 30;
      }

      if (candidate.type === selfType) {
        score += 1;
      }

      return { ...candidate, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const chosen: Candidate[] = [];
  const chosenHrefs = new Set<string>();

  for (const type of Object.keys(COLLECTION_PREFIX) as RelatedLinkType[]) {
    const explicitSlugs = explicitByType.get(type);
    if (!explicitSlugs?.size) continue;
    for (const slug of explicitSlugs) {
      const candidate = scored.find((item) => item.type === type && item.slug === slug);
      if (!candidate || chosenHrefs.has(candidate.href)) continue;
      chosen.push(candidate);
      chosenHrefs.add(candidate.href);
      if (chosen.length >= limit) break;
    }
    if (chosen.length >= limit) break;
  }

  if (chosen.length < limit) {
    const preferredOrder = Object.entries(preferredTypes)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([type]) => type as RelatedLinkType);
    for (const type of preferredOrder) {
      const candidate = scored.find((item) => item.type === type && !chosenHrefs.has(item.href));
      if (!candidate) continue;
      chosen.push(candidate);
      chosenHrefs.add(candidate.href);
      if (chosen.length >= limit) break;
    }
  }

  if (chosen.length < limit) {
    for (const candidate of scored) {
      if (chosenHrefs.has(candidate.href)) continue;
      chosen.push(candidate);
      chosenHrefs.add(candidate.href);
      if (chosen.length >= limit) break;
    }
  }

  return chosen.map((item) => ({
    href: item.href,
    title: item.title,
    description: item.description,
    type: item.type,
  }));
}
