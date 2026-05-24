import { getCollection } from "astro:content";

const ES_COLLECTION_BY_KIND = {
  guide: "esGuides",
  blog: "esBlog",
  state: "esStates",
  city: "esCities",
  loanType: "esLoanTypes",
  propertyType: "esPropertyTypes",
  comparison: "esComparisons",
  investorProfile: "esInvestorProfiles",
} as const;

export type LocalizedContentKind = keyof typeof ES_COLLECTION_BY_KIND;

let esSlugCache: Promise<Map<LocalizedContentKind, Set<string>>> | null = null;

async function loadEsSlugCache(): Promise<Map<LocalizedContentKind, Set<string>>> {
  if (esSlugCache) return esSlugCache;

  esSlugCache = (async () => {
    const map = new Map<LocalizedContentKind, Set<string>>();
    for (const [kind, collectionName] of Object.entries(ES_COLLECTION_BY_KIND)) {
      // @ts-expect-error dynamic collection lookup
      const entries = await getCollection(collectionName);
      const slugs = new Set(entries.map((e) => e.id.replace(/\.mdx$/, "")));
      map.set(kind as LocalizedContentKind, slugs);
    }
    return map;
  })();

  return esSlugCache;
}

export async function hasSpanishContent(
  kind: LocalizedContentKind,
  slug: string,
): Promise<boolean> {
  const cache = await loadEsSlugCache();
  return cache.get(kind)?.has(slug) ?? false;
}

export function localizedLearnPaths(slug: string, hasEs: boolean) {
  return {
    enPath: `/learn/${slug}/`,
    esPath: hasEs ? `/es/learn/${slug}/` : undefined,
    includeSpanish: hasEs,
  };
}

export function localizedBlogPaths(slug: string, hasEs: boolean) {
  return {
    enPath: `/blog/${slug}/`,
    esPath: hasEs ? `/es/blog/${slug}/` : undefined,
    includeSpanish: hasEs,
  };
}
