// ============================================
// Smart Linker v8 — Hand-curated purpose card overrides
// ============================================
// Fixes auto-generated linkWhen / concept tags for high-traffic or
// frequently mis-linked pages.

import type { FinancingConcept } from "./concept-taxonomy";

export interface PurposeCardOverride {
  slug: string;
  linkWhen?: string[];
  doNotLinkWhen?: string[];
  topicsExcluded?: string[];
  financingConcepts?: FinancingConcept[];
  assetTypes?: string[];
  questionsAnswered?: string[];
}

export const PURPOSE_CARD_OVERRIDES: PurposeCardOverride[] = [
  {
    slug: "force-appreciation-in-multifamily-properties",
    financingConcepts: [
      "force-appreciation-value-add",
      "multifamily-investing",
      "refinancing-equity",
      "bridge-financing",
    ],
    linkWhen: [
      "when discussing value-add renovations that increase NOI on apartment buildings",
      "when the reader wants to force appreciation through improvements and refinance",
      "when BRRRR or bridge-to-permanent multifamily strategy is the topic",
    ],
    doNotLinkWhen: [
      "when the anchor discusses residential mortgage count limits or lender caps",
      "when the reader is asking about fixed vs variable rate decisions",
      "when the context is about qualifying for the next residential rental only",
      "when the article is a beginner guide with no portfolio-scale financing need",
    ],
    topicsExcluded: [
      "mortgage-count-limits",
      "fixed-vs-variable-decisions",
      "residential-qualification-basics",
    ],
    questionsAnswered: [
      "How do I force appreciation on a multifamily property?",
      "How does value-add renovation increase apartment building value?",
      "How do I refinance after improving NOI on an apartment building?",
    ],
  },
  {
    slug: "fixed-vs-variable-commercial-mortgage-canada",
    financingConcepts: ["fixed-vs-variable-rates", "commercial-financing"],
    assetTypes: ["commercial", "multifamily"],
    linkWhen: [
      "when comparing fixed and variable rates on commercial or multifamily mortgages",
      "when the reader is deciding rate type on a 5+ unit or commercial property",
    ],
    doNotLinkWhen: [
      "when the article is about residential 1-4 unit investment property mortgages",
      "when the anchor discusses residential variable rate conversion options",
      "when the context is portfolio scaling or mortgage count limits only",
    ],
    topicsExcluded: ["residential-1-4-unit-only", "mortgage-count-limits"],
    questionsAnswered: [
      "Should I choose fixed or variable on a commercial mortgage in Canada?",
      "How do fixed vs variable rates affect commercial property cash flow?",
    ],
  },
  {
    slug: "fixed-vs-variable-rate-mortgages-what-canadian-investors-need-to-know",
    financingConcepts: ["fixed-vs-variable-rates", "residential-financing"],
    assetTypes: ["residential", "investment-property"],
    linkWhen: [
      "when comparing fixed and variable rates on residential investment mortgages",
      "when the reader is deciding rate type on 1-4 unit rental properties",
    ],
    doNotLinkWhen: [
      "when the article is about commercial or 5+ unit multifamily financing only",
    ],
  },
  {
    slug: "fixed-vs-variable-for-investors-decision-framework",
    financingConcepts: ["fixed-vs-variable-rates", "residential-financing"],
    assetTypes: ["residential", "investment-property"],
    linkWhen: [
      "when the reader needs a framework to choose fixed vs variable on investment properties",
      "when comparing rate types for rental property mortgages",
    ],
    doNotLinkWhen: [
      "when the context is commercial multifamily or CMHC apartment lending only",
    ],
  },
  {
    slug: "real-estate-development-investing-guide-for-canadians",
    financingConcepts: ["development-ground-up"],
    assetTypes: ["development"],
    linkWhen: [
      "when the reader wants to participate in ground-up development as an investor or LP",
      "when the article discusses development lifecycle from land to stabilization",
    ],
    doNotLinkWhen: [
      "when the anchor discusses financing an operating self-storage facility",
      "when the reader is buying an existing income-producing property",
      "when the context is residential rental mortgage qualification",
    ],
    topicsExcluded: ["operating-existing-self-storage", "residential-1-4-unit-only"],
  },
  {
    slug: "self-storage-facility-financing-canada",
    financingConcepts: ["self-storage-financing", "commercial-financing"],
    assetTypes: ["self-storage", "commercial"],
    linkWhen: [
      "when financing an existing or acquisition self-storage facility",
      "when lenders evaluate self-storage as a specialized commercial asset class",
    ],
    doNotLinkWhen: [
      "when the article is about general real estate development investing",
      "when the context is residential rental property mortgages",
    ],
    questionsAnswered: [
      "How do I finance a self-storage facility in Canada?",
      "What do lenders look for on self-storage acquisitions?",
    ],
  },
  {
    slug: "how-to-qualify-for-multiple-rental-properties-breaking-through-traditional-financing-limits",
    financingConcepts: ["portfolio-scaling-limits", "residential-financing", "lender-selection"],
    assetTypes: ["residential", "investment-property"],
    linkWhen: [
      "when the reader has hit residential mortgage count limits with a lender",
      "when portfolio scaling requires a new lender or qualification strategy",
      "when the anchor discusses how many mortgages one borrower can hold",
    ],
    doNotLinkWhen: [
      "when the topic is value-add renovation or forcing appreciation",
      "when the context is commercial multifamily only",
    ],
    questionsAnswered: [
      "How do I qualify for more rental properties after hitting lender limits?",
      "How many residential mortgages can one investor hold in Canada?",
    ],
  },
  {
    slug: "how-to-scale-from-1-to-5-properties-with-smart-financing",
    financingConcepts: ["portfolio-scaling-limits", "residential-financing", "lender-selection"],
    linkWhen: [
      "when scaling a rental portfolio from a few properties to five or more",
      "when lender sequencing and mortgage count limits block the next purchase",
    ],
    doNotLinkWhen: [
      "when the topic is value-add multifamily appreciation only",
      "when the reader is analyzing a single deal's cash flow",
    ],
  },
  {
    slug: "office-building-investment-guide-for-beginners",
    financingConcepts: ["commercial-financing"],
    assetTypes: ["office", "commercial"],
    doNotLinkWhen: [
      "when the anchor discusses self-storage facility financing",
      "when the reader needs financing for storage facilities not office buildings",
    ],
    topicsExcluded: ["self-storage-financing", "operating-existing-self-storage"],
  },
  {
    financingConcepts: ["development-ground-up"],
    assetTypes: ["development"],
    linkWhen: [
      "when securing construction or development mortgage financing for a new build",
      "when the reader is developing ground-up residential or commercial projects",
    ],
    doNotLinkWhen: [
      "when financing an existing operating self-storage facility acquisition",
      "when the context is buy-and-hold rental qualification only",
    ],
  },
];

export function applyPurposeCardOverride<T extends { slug: string }>(
  page: T,
  fields: PurposeCardOverride
): T & PurposeCardOverride {
  const merged = { ...page } as T & PurposeCardOverride;
  for (const key of [
    "linkWhen",
    "doNotLinkWhen",
    "topicsExcluded",
    "financingConcepts",
    "assetTypes",
    "questionsAnswered",
  ] as const) {
    const val = fields[key];
    if (val !== undefined) (merged as Record<string, unknown>)[key] = val;
  }
  return merged;
}
