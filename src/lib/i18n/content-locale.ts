import { getCollection, type CollectionKey } from "astro:content";

import { addEsPrefix, ensureTrailingSlash } from "@/i18n/alternates";

type LocaleKind =
  | "guide"
  | "blog"
  | "loanType"
  | "comparison"
  | "state"
  | "city"
  | "propertyType"
  | "investorProfile";

const ES_COLLECTION_BY_KIND: Record<LocaleKind, CollectionKey> = {
  guide: "esGuides",
  blog: "esBlog",
  loanType: "esLoanTypes",
  comparison: "esComparisons",
  state: "esStates",
  city: "esCities",
  propertyType: "esPropertyTypes",
  investorProfile: "esInvestorProfiles",
};

const EN_PATH_BY_KIND: Record<LocaleKind, (slug: string) => string> = {
  guide: (slug) => `/learn/${slug}`,
  blog: (slug) => `/blog/${slug}`,
  loanType: (slug) => `/loan-types/${slug}`,
  comparison: (slug) => `/compare/${slug}`,
  state: (slug) => `/states/${slug}`,
  city: (slug) => `/cities/${slug}`,
  propertyType: (slug) => `/property-types/${slug}`,
  investorProfile: (slug) => `/invest/${slug}`,
};

function slugFromEntryId(id: string): string {
  return id.replace(/\.mdx$/, "");
}

export async function hasSpanishContent(kind: LocaleKind, slug: string): Promise<boolean> {
  const collection = ES_COLLECTION_BY_KIND[kind];
  try {
    const entries = await getCollection(collection);
    return entries.some((entry) => slugFromEntryId(entry.id) === slug);
  } catch {
    return false;
  }
}

export function localizedLearnPaths(
  slug: string,
  includeSpanish: boolean,
): { enPath: string; esPath: string; includeSpanish: boolean } {
  const enPath = ensureTrailingSlash(EN_PATH_BY_KIND.guide(slug));
  return {
    enPath,
    esPath: ensureTrailingSlash(addEsPrefix(enPath)),
    includeSpanish,
  };
}

export function localizedBlogPaths(
  slug: string,
  includeSpanish: boolean,
): { enPath: string; esPath: string; includeSpanish: boolean } {
  const enPath = ensureTrailingSlash(EN_PATH_BY_KIND.blog(slug));
  return {
    enPath,
    esPath: ensureTrailingSlash(addEsPrefix(enPath)),
    includeSpanish,
  };
}
